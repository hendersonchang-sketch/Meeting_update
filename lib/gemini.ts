import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { MeetingMinutes, GeminiAnalysisResult } from './types';
import { getSetting } from './database';
import { createLogger } from './logger';

const logger = createLogger('Gemini');

/**
 * 取得 Gemini API 客戶端
 */
function getGeminiClient(): any {
  let apiKey = getSetting('gemini_api_key');
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY || '';
  }

  if (!apiKey) {
    const error = 'Gemini API Key 未設定。請前往設定頁面輸入 API Key。';
    logger.error(error);
    throw new Error(error);
  }

  return new GoogleGenAI({ apiKey });
}

/**
 * 將檔案轉換為 base64 格式
 */
function fileToBase64(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

/**
 * 根據檔案副檔名取得 MIME 類型
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.m4a': 'audio/mp4',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 會議記錄 JSON Schema (OpenAPI 3.0 格式)
 * 使用 snake_case 屬性名與 Google GenAI API 規格一致
 */
const MEETING_MINUTES_SCHEMA = {
  type: 'object',
  properties: {
    minutes: {
      type: 'object',
      required: ['info', 'attendees', 'keyPoints', 'actionItems', 'riskItems', 'endTime'],
      properties: {
        info: {
          type: 'object',
          required: ['title', 'date', 'time', 'location', 'recorder'],
          properties: {
            title: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
            time: { type: 'string', description: 'HH:MM' },
            location: { type: 'string' },
            recorder: { type: 'string' },
            chairman: { type: 'string' }
          }
        },
        attendees: {
          type: 'object',
          required: ['companyLeaders', 'technicalTeam', 'pmTeam', 'ibmTeam', 'vendors'],
          properties: {
            companyLeaders: { type: 'array', items: { type: 'string' } },
            technicalTeam: { type: 'array', items: { type: 'string' } },
            pmTeam: { type: 'array', items: { type: 'string' } },
            ibmTeam: { type: 'array', items: { type: 'string' } },
            vendors: { type: 'array', items: { type: 'string' } }
          }
        },
        keyPoints: {
          type: 'array',
          items: {
            type: 'object',
            required: ['category', 'content'],
            properties: {
              category: {
                type: 'string',
                enum: ['機房搬遷', '機房服務', '網路、資安', '儲存', 'SAP（HW）', '文心機房搬遷', '現代化顧問服務']
              },
              content: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        actionItems: {
          type: 'array',
          items: {
            type: 'object',
            required: ['description', 'status'],
            properties: {
              description: { type: 'string' },
              assignee: { type: 'string' },
              dueDate: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'in-progress', 'completed'] }
            }
          }
        },
        riskItems: {
          type: 'array',
          items: {
            type: 'object',
            required: ['description'],
            properties: {
              description: { type: 'string' },
              severity: { type: 'string', enum: ['low', 'medium', 'high'] },
              mitigation: { type: 'string' }
            }
          }
        },
        otherNotes: { type: 'array', items: { type: 'string' } },
        endTime: { type: 'string', description: 'HH:MM' }
      }
    },
    summary: { type: 'string', description: '完整會議摘要（約 500-800 字，確保內容連貫且不影響結構化資料產量）' },
    speakers: { type: 'array', items: { type: 'string' }, description: '發言者列表' }
  },
  required: ['minutes', 'summary', 'speakers']
};

/**
 * 測試 API Key 是否有效
 */
export async function testApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
  const testLogger = createLogger('Gemini.TestApiKey');
  testLogger.info('開始測試 API Key');

  try {
    const client = new GoogleGenAI({ apiKey });

    const result = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: 'You are a helpful assistant for testing API connections.'
      },
      contents: [{
        role: 'user',
        parts: [{ text: 'Hello, please respond with "OK".' }]
      }]
    });

    const text = result.text || '';
    return { success: true, message: 'API Key 有效！連線測試成功。' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    testLogger.error('API Key 測試失敗', { error: errorMessage });
    return { success: false, message: `API Key 無效或連線失敗: ${errorMessage}` };
  }
}

/**
 * 分析會議影音檔並生成會議記錄 (Transcript-First Approach)
 */
export async function analyzeMeetingVideo(
  videoPath: string,
  meetingId?: string,
  existingContext?: string
): Promise<GeminiAnalysisResult> {
  const analysisLogger = createLogger('Gemini.AnalyzeVideo', meetingId);
  const safeMeetingId = meetingId || 'unknown_meeting';

  analysisLogger.info('開始分析會議影片 (Gemini 3 Flash Optimized)', { videoPath });

  try {
    const client = getGeminiClient();
    const mimeType = getMimeType(videoPath);
    const base64Video = fileToBase64(videoPath);

    // --- 第一階段：生成逐字稿 ---
    analysisLogger.info('--- 第一階段：生成逐字稿 ---');

    const transcriptResult = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: '你是一個專業的速記員。這是一場 PPT 會議，請對每一頁 PPT 進行 OCR 文字掃描，並以該文字內容為基準來對齊語音說明。注意：所有提到的機房名稱「四方機房」必須正確記錄為「是方機房」。',
        maxOutputTokens: 32768,
        temperature: 0.1,
        thinkingLevel: 'HIGH',
        mediaResolution: 'MEDIA_RESOLUTION_HIGH',
      },
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Video } },
          { text: '請精確地將簡報畫面中的文字與講者的說明對齊，產出包含 PPT 標題與時間戳的專業逐字稿。' },
        ]
      }]
    });

    const fullTranscript = transcriptResult.text || '';

    // 儲存逐字稿
    const outputDir = path.join(process.cwd(), 'outputs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `transcript_${safeMeetingId}_${Date.now()}.txt`), fullTranscript, 'utf-8');

    // --- 第二階段：結構化會議分析 ---
    analysisLogger.info('--- 第二階段：結構化會議分析 ---');

    const analysisResultData = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: `你是南山人壽技術小組的專業會議秘書，負責根據逐字稿整理高度精確的會議記錄。
        嚴格遵守以下準則：
        1. 總字數需求：報告總字數必須大於 1000 字，內容需詳盡且具體。
        2. 隱私規範：嚴禁在報告中提及任何具體的人名。
        3. 重點紀錄分類：必須將所有討論重點精確分配到以下 7 個固定分類中，不可自行增減：
           - 機房搬遷
           - 機房服務
           - 網路、資安
           - 儲存
           - SAP（HW）
           - 文心機房搬遷
           - 現代化顧問服務
        4. 語言要求：使用繁體中文。
        5. 術語修正：若逐字稿出現「四方機房」，必須在報告中「直接且安靜地」修正為「是方機房」。
        6. **絕對禁止 Meta-Commentary**：嚴禁在輸出中包含任何關於指令執行、規則確認或處理過程的句子（例如：「已依規定修正...」、「術語已更正」）。輸出中只准出現會議相關的實質內容。
        7. 格式規範：嚴禁在類別標題 (category) 或內容 (content) 中使用項目符號（如 ●, ○, •, -, *）或數字編號（如 1., 1、）。內容應直接以敘述句組成。
        8. 結構完整性：確保 JSON 輸出完整，不要因為摘要過長而截斷。若字數過多，優先保證 minutes 區塊的完整性。`,
        maxOutputTokens: 32768,
        temperature: 0.1,
        thinkingLevel: 'MEDIUM',
        responseMimeType: 'application/json',
        responseSchema: MEETING_MINUTES_SCHEMA,
      },
      contents: [{
        role: 'user',
        parts: [{ text: `逐字稿：\n\n${fullTranscript}\n\n${existingContext ? `參考上下文：\n${existingContext}` : ''}` }]
      }]
    });

    const jsonText = analysisResultData.text || '';

    try {
      let analysisResult: GeminiAnalysisResult = JSON.parse(jsonText);
      analysisResult.transcript = fullTranscript;
      return analysisResult;
    } catch (parseError) {
      analysisLogger.error('JSON 解析失敗', { error: parseError, raw: jsonText });
      throw new Error('AI 回傳格式錯誤');
    }

  } catch (error) {
    analysisLogger.error('會議分析失敗', { error });
    throw error;
  }
}

/**
 * 分析 PPTX 簡報內容
 */
export async function analyzePPTX(pptxContent: string): Promise<string> {
  const client = getGeminiClient();
  try {
    const result = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: '你是一個專業的簡報分析師。',
        thinkingLevel: 'LOW'
      },
      contents: [{
        role: 'user',
        parts: [{ text: `分析簡報並條列重點：\n${pptxContent}` }]
      }]
    });
    return result.text || '';
  } catch (error) {
    logger.error('PPTX 分析錯誤', { error });
    throw error;
  }
}

/**
 * 分析 Word 文件內容
 */
export async function analyzeDocx(docxContent: string): Promise<string> {
  const client = getGeminiClient();
  try {
    const result = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: '你是一個專業的文件摘要專家。',
        thinkingLevel: 'LOW'
      },
      contents: [{
        role: 'user',
        parts: [{ text: `分析文件並條列重點：\n${docxContent}` }]
      }]
    });
    return result.text || '';
  } catch (error) {
    logger.error('Word 分析錯誤', { error });
    throw error;
  }
}

/**
 * 重新生成或優化會議記錄
 */
export async function refineMeetingMinutes(
  currentMinutes: MeetingMinutes,
  additionalContext: string,
  instructions?: string
): Promise<MeetingMinutes> {
  const client = getGeminiClient();
  try {
    const result = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: '你是一個專業的會議顧問。',
        responseMimeType: 'application/json',
        responseSchema: MEETING_MINUTES_SCHEMA.properties.minutes,
        thinkingLevel: 'MEDIUM',
      },
      contents: [{
        role: 'user',
        parts: [{
          text: `優化記錄：\n${JSON.stringify(currentMinutes)}\n額外資訊：\n${additionalContext}\n說明：${instructions || '優化內容'}`
        }]
      }]
    });
    return JSON.parse(result.text || '');
  } catch (error) {
    logger.error('會議記錄優化錯誤', { error });
    throw error;
  }
}

/**
 * 生成會議摘要
 */
export async function generateSummary(minutes: MeetingMinutes): Promise<string> {
  const client = getGeminiClient();
  try {
    const result = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: '你是一個各類會議的摘要專家。',
        thinkingLevel: 'LOW'
      },
      contents: [{
        role: 'user',
        parts: [{ text: `摘要以下記錄：\n${JSON.stringify(minutes)}` }]
      }]
    });
    return result.text || '';
  } catch (error) {
    logger.error('摘要生成錯誤', { error });
    throw error;
  }
}
