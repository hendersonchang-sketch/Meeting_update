import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

// --- 強制設定 Node.js fetch 的全域 Timeout (針對 30 分鐘以上長影片) ---
// 這可以解決 TTFB (首字節時間) 過長導致的 fetch failed
import { setGlobalDispatcher, Agent } from 'undici';

// 僅在 Node.js 環境中執行
if (typeof (global as any).Dispatcher !== 'undefined' || typeof process !== 'undefined') {
  setGlobalDispatcher(new Agent({
    connect: { timeout: 1200000 }, // 連線超時: 20 分鐘
    bodyTimeout: 1200000,          // 內容接收超時: 20 分鐘
    headersTimeout: 1200000        // 標頭接收超時: 20 分鐘
  }));
}
// -------------------------------------------------------------------
import { MeetingMinutes, GeminiAnalysisResult } from './types';
import { getSetting, getMeetingById } from './database';
import { createLogger } from './logger';
import { getVideoDuration, getVideoInfo, splitVideo, cleanupTempFiles, VIDEO_CONFIG } from './videoUtils';

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

  // 設置較長的 timeout (例如 10 分鐘)
  return new GoogleGenAI({
    apiKey,
  });
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
              content: {
                type: 'array',
                items: { type: 'string' },
                description: '3-5 個精簡的紀錄要點。每個要點必須是獨立、簡短且具實質意義的句子，嚴禁長篇大論。'
              }
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
      model: 'gemini-2.5-flash',
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
 * 上傳檔案到 Gemini (使用 File API)
 */
async function uploadToGemini(filePath: string, mimeType: string): Promise<any> {
  const client = getGeminiClient();
  const logger = createLogger('Gemini.Upload');

  try {
    const uploadResult = await client.files.upload({
      file: filePath,
      config: {
        mimeType,
        displayName: path.basename(filePath)
      }
    });

    const file = uploadResult;
    logger.info(`檔案上傳成功: ${file.name} (${file.uri})`);
    return file;
  } catch (error) {
    logger.error('檔案上傳失敗', { error });
    throw error;
  }
}

/**
 * 等待檔案處理完成
 */
async function waitForFileActive(file: any): Promise<void> {
  const client = getGeminiClient();
  const logger = createLogger('Gemini.FilePoll');
  const name = file.name;

  logger.info('等待檔案處理...', { name });

  let fileState = file;
  while (fileState.state === 'PROCESSING') {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 每 5 秒檢查一次

    try {
      fileState = await client.files.get({ name });
      logger.debug('檔案狀態更新', { state: fileState.state });
    } catch (err) {
      logger.warn('檢查檔案狀態時發生錯誤，重試中...', { err });
    }
  }

  if (fileState.state !== 'ACTIVE') {
    throw new Error(`檔案處理失敗，狀態: ${fileState.state}`);
  }

  logger.info('檔案處理完成，準備分析');
}

/**
 * 逐字稿提取 System Prompt (第一階段 - Token 優化版)
 */
const TRANSCRIPT_SYSTEM_PROMPT = `你是專業的會議語音轉錄員。請將影片中的語音內容轉換為完整的逐字稿。

要求：
1. 完整記錄所有對話內容
2. 標記發言者（如：「發言者A」、「發言者B」）
3. 保留時間順序
4. 使用繁體中文
5. 直接輸出純文字格式，不需要額外標記`;

/**
 * 角色對應的 Prompt 設置
 */
const MINUTES_TEMPLATE = `{
  "minutes": {
    "info": { "title": "...", "date": "...", "time": "...", "location": "...", "recorder": "..." },
    "attendees": {
      "companyLeaders": [], "technicalTeam": [], "pmTeam": [], "ibmTeam": [], "vendors": []
    },
    "keyPoints": [
      { 
        "category": "機房搬遷", 
        "content": ["重點1", "重點2"] 
      }
    ],
    "actionItems": [
      { "description": "事項", "assignee": "負責人", "dueDate": "YYYY-MM-DD", "status": "pending" }
    ],
    "riskItems": [
      { "description": "風險描述", "severity": "high", "mitigation": "對策" }
    ],
    "otherNotes": [],
    "endTime": "HH:MM"
  },
  "summary": "...",
  "speakers": []
}`;

const SYSTEM_PROMPTS = {
  secretary: `你是南山人壽技術小組的專業會議秘書。你的目標不是「記錄所有對話」，而是「提煉決策與行動」。
        嚴格遵守以下準則：
        1. **深度篩選 (關鍵)**：
           - 請忽略寒暄、重複的確認過程、無結論的發散討論。
           - 只記錄：已定案的決策、明確的待辦事項 (Action Items)、識別出的具體風險。
        2. **整合歸納**：
           - 不要流水帳。若多人在討論同一主題，請將其整合成單一條精簡的重點。
           - "每一點都提到" 是失敗的分析。請挑選最重要的 30% 核心資訊。
        3. **格式規範**：
           - 務必輸出合法的 JSON，結構如下：
           ${MINUTES_TEMPLATE}
           - keyPoints 必須是「經過消化後的結論」，而非對話摘錄。
        4. **語言與風格**：
           - 繁體中文，專業、客觀。
           - 將「四方機房」修正為「是方機房」。
        5. **長度與完整性**：
           - 總字數控制在 1200 字以內。
           - 優先保留 actionItems (負責人/期限) 與 riskItems。確保 JSON 格式完整閉合。`,

  pmo: `你是 PMO資深專案經理，你的職責是「專案健康度診斷」而非單純紀錄。
        你必須展現批判性思維 (Critical Thinking)：
        1. **抓大放小**：
           - 忽略例行性的進度匯報 (除非有落後)。
           - **嚴格聚焦**：資源衝突、時程延誤風險、規避責任的模糊承諾、關鍵路徑上的決策。
        2. **待辦事項 (Action Items) 強制歸責**：
           - 找出「誰」答應了「什麼時候」做「什麼」。
           - 若有人承諾模糊 (如「再看看」、「盡快」)，請在 status 標記 "pending" 並在 description 註明「需確認具體壓修日期」。
        3. **風險識別 (最重要的價值)**：
           - 聽出言外之意。例如某人說「這可能要再研究」，可能暗示技術瓶頸或人力不足，請將其轉化為 riskItems。
        4. **格式規範**：
           - 輸出合法的 JSON，結構如下：
           ${MINUTES_TEMPLATE}
        5. **摘要要求**：
           - 不要摘要「大家開了會」，要摘要「會議判定了專案處於什麼狀態」。總字數控制在 1200 字以內。`,
};

/**
 * 分析會議影音檔並生成會議記錄 (Two-Stage Approach with File API)
 */
export async function analyzeMeetingVideo(
  videoPath: string,
  meetingId?: string,
  existingContext?: string,
  role: string = 'secretary'
): Promise<GeminiAnalysisResult> {
  const analysisLogger = createLogger('Gemini.AnalyzeVideo', meetingId);
  const safeMeetingId = meetingId || 'unknown_meeting';

  // 取得對應的 System Prompt
  const currentSystemPrompt = SYSTEM_PROMPTS[role as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.secretary;

  analysisLogger.info(`開始分析會議影片 (兩階段分析架構) [Role: ${role}]`, { videoPath });

  try {
    const client = getGeminiClient();
    const mimeType = getMimeType(videoPath);

    // 1. 上傳檔案
    analysisLogger.info('正在上傳檔案到 Gemini...');
    const uploadFile = await uploadToGemini(videoPath, mimeType);

    // 2. 等待處理
    await waitForFileActive(uploadFile);

    // ========== 第一階段：提取逐字稿 (Token 優化) ==========
    analysisLogger.info('--- 第一階段：提取會議逐字稿 ---');

    let fullTranscript = '';

    try {
      // 使用 gemini-2.5-pro 處理大型影片檔案
      // 注意：截至 2026 年初，gemini-2.5-pro 的上限仍為 1M tokens（2M 版本即將推出）
      // 因此超長影片（> 30 分鐘）仍可能超限
      const transcriptResp = await client.models.generateContent({
        model: 'gemini-2.5-pro',
        config: {
          systemInstruction: TRANSCRIPT_SYSTEM_PROMPT,
          maxOutputTokens: 16384,
          temperature: 0.1,
        },
        contents: [{
          role: 'user',
          parts: [
            {
              fileData: {
                mimeType: uploadFile.mimeType,
                fileUri: uploadFile.uri
              }
            },
            {
              text: '請將影片中的會議內容完整轉為逐字稿，標記發言者並保持時間順序。'
            }
          ]
        }]
      });

      fullTranscript = transcriptResp.text || '';
      analysisLogger.info(`逐字稿提取完成 (長度: ${fullTranscript.length} 字元)`);

      if (fullTranscript.length < 50) {
        analysisLogger.warn('逐字稿內容過短，可能分析失敗', { transcript: fullTranscript });
      }
    } catch (transcriptError) {
      analysisLogger.error('逐字稿提取失敗', { error: transcriptError });

      // 檢查是否是 token 超限錯誤
      const errorMessage = transcriptError instanceof Error ? transcriptError.message : String(transcriptError);
      if (errorMessage.includes('token count exceeds')) {
        throw new Error(`影片檔案過大，超過 Gemini API 處理上限（1M tokens）。

建議解決方案：
1. 【最佳】將影片縮短至 20-25 分鐘以內
2. 【次選】將長會議分成多個片段分別上傳分析
3. 【進階】降低影片解析度/位元率（例如：720p → 480p）
4. 【臨時】僅上傳會議的關鍵片段

技術限制說明：
- 目前 Gemini 2.5 Pro 最大支援約 1,048,576 tokens
- 一個 30 分鐘的高清影片可能就接近或超過此限制
- 2M tokens 版本預計未來推出，屆時可支援更長影片`);
      }

      throw new Error(`逐字稿提取失敗: ${errorMessage}`);
    }

    // ========== 第二階段：基於逐字稿生成會議記錄 ==========
    analysisLogger.info('--- 第二階段：生成結構化會議記錄 ---');

    try {
      // 使用 Stream 模式處理第二階段，避免大型文字稿導致連線逾時
      const streamingResp = await client.models.generateContentStream({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: currentSystemPrompt,
          maxOutputTokens: 32768,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: MEETING_MINUTES_SCHEMA,
        },
        contents: [{
          role: 'user',
          parts: [{
            text: `以下是會議逐字稿：

${fullTranscript}

${existingContext ? `參考上下文：\n${existingContext}\n\n` : ''}請根據逐字稿內容，產生符合 Schema 的會議記錄。
注意：嚴格輸出純 JSON 格式，不要包含 Markdown 標記。`
          }]
        }]
      });

      let fullText = '';

      // 兼容性處理：確保能正確取得 Async Iterator
      const streamSource = (streamingResp as any).stream || streamingResp;

      for await (const chunk of streamSource) {
        let chunkText = '';
        if (typeof chunk.text === 'function') {
          chunkText = chunk.text();
        } else if (typeof chunk.text === 'string') {
          chunkText = chunk.text;
        } else if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
          chunkText = chunk.candidates[0].content.parts.map((p: any) => p.text).join('');
        }
        fullText += chunkText;
      }

      // 清理可能的 Markdown code block 標記
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      let jsonText = jsonMatch ? jsonMatch[0] : fullText.replace(/```json/g, '').replace(/```/g, '').trim();

      // --- JSON 自動修復邏輯 ---
      if (!jsonText.endsWith('}')) {
        analysisLogger.warn(`偵測到 JSON 截斷 (總長度: ${jsonText.length})，嘗試預先修復...`, { tail: jsonText.slice(-50) });
        const closers = ['}', ']}', '"]}}', '} }'];
        for (const closer of closers) {
          try {
            JSON.parse(jsonText + closer);
            jsonText += closer;
            analysisLogger.info(`JSON 預先修復成功 (Closer: ${closer})`);
            break;
          } catch (e) { }
        }
      }

      try {
        let analysisResult: GeminiAnalysisResult = JSON.parse(jsonText);

        // 驗證結構：至少要有 minutes 或 info
        if (!analysisResult.minutes && !(analysisResult as any).info) {
          throw new Error('Missing minutes/info');
        }

        // 將完整逐字稿附加到結果中
        analysisResult.transcript = fullTranscript;
        analysisLogger.info('會議記錄生成完成');
        return analysisResult;
      } catch (parseError) {
        analysisLogger.warn('JSON 初次解析失敗，嘗試暴力修復...', { error: String(parseError) });

        // 策略 B: 暴力嘗試各種閉合組合
        const repairClosers = ['}', ']}', '}}', ']}}', '}]}}', '"]}}', '"}}', '}]', ']'];

        for (const closer of repairClosers) {
          try {
            const patchedText = jsonText + closer;
            let fixedResult = JSON.parse(patchedText);

            // 驗證修復後的結果是否合理
            if (fixedResult.minutes || fixedResult.info || fixedResult.summary) {
              analysisLogger.info(`JSON 暴力修復成功 (Suffix: ${closer})`);
              (fixedResult as any).transcript = fullTranscript;
              return fixedResult as GeminiAnalysisResult;
            }
          } catch (e) {
            // try next
          }
        }

        // 若都修復失敗，才拋出錯誤
        const previewLength = 500;
        const startSnippet = jsonText.substring(0, previewLength);
        const endSnippet = jsonText.substring(Math.max(0, jsonText.length - previewLength));

        analysisLogger.error('JSON 解析失敗 (詳細資訊-修復無效)', {
          error: String(parseError),
          jsonStart: startSnippet,
          jsonEnd: endSnippet,
          totalLength: jsonText.length
        });
        throw new Error('AI 回傳格式錯誤 (JSON Parse Error)，自動修復失敗，請查看 Server Log');
      }

    } catch (minutesError) {
      analysisLogger.error('會議記錄生成失敗', { error: minutesError });
      throw minutesError;
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
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: '你是一個專業的簡報分析師。',
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
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: '你是一個專業的文件摘要專家。',
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
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: '你是一個專業的會議顧問。',
        responseMimeType: 'application/json',
        responseSchema: MEETING_MINUTES_SCHEMA.properties.minutes,
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
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: '你是一個各類會議的摘要專家。',
      },
      contents: [{
        role: 'user',
        parts: [{
          text: `摘要以下記錄：\n${JSON.stringify(minutes)}`
        }]
      }]
    });
    return result.text || '';
  } catch (error) {
    logger.error('摘要生成錯誤', { error });
    throw error;
  }
}

/**
 * 智慧影片分析（自動切分）
 * 
 * 此函數會自動偵測影片長度：
 * - 若 <= 20 分鐘：直接分析
 * - 若 > 20 分鐘：自動切分為多個 18 分鐘片段，逐段分析後合併
 */
export async function analyzeMeetingVideoWithAutoSplit(
  videoPath: string,
  meetingId?: string,
  existingContext?: string,
  role: string = 'secretary'
): Promise<GeminiAnalysisResult> {
  const analysisLogger = createLogger('Gemini.AutoSplit', meetingId);

  try {
    // 1. 偵測影片資訊
    analysisLogger.info('開始智慧影片分析（自動切分模式）', { videoPath });

    const videoInfo = await getVideoInfo(videoPath);
    const durationMinutes = videoInfo.durationMinutes;

    analysisLogger.info('影片資訊', {
      duration: `${durationMinutes} 分 ${Math.floor(videoInfo.duration % 60)} 秒`,
      size: `${(videoInfo.size / 1024 / 1024).toFixed(2)} MB`,
      resolution: videoInfo.resolution,
    });

    // 2. 判斷是否需要切分
    if (videoInfo.duration <= VIDEO_CONFIG.MAX_SAFE_DURATION) {
      // 直接分析（不切分）
      analysisLogger.info('影片長度符合限制，直接分析');
      return await analyzeMeetingVideo(videoPath, meetingId, existingContext, role);
    }

    // 3. 自動切分模式
    const segmentCount = Math.ceil(videoInfo.duration / VIDEO_CONFIG.SEGMENT_DURATION);
    analysisLogger.info(`影片過長（${durationMinutes} 分鐘），自動切分為 ${segmentCount} 段`);

    const tempDir = path.join(VIDEO_CONFIG.TEMP_DIR, `meeting_${meetingId || Date.now()}`);

    try {
      // 4. 切分影片
      analysisLogger.info('正在切分影片...');
      const segments = await splitVideo(videoPath, VIDEO_CONFIG.SEGMENT_DURATION, tempDir);
      analysisLogger.info(`影片切分完成，共 ${segments.length} 段`);

      // 5. 逐段分析並收集逐字稿
      const transcripts: string[] = [];
      let cumulativeContext = existingContext || '';

      for (let i = 0; i < segments.length; i++) {
        // === 中斷檢查點 === 
        if (meetingId) {
          const meeting = getMeetingById(meetingId);
          if (meeting?.status === 'aborted') {
            analysisLogger.warn(`分析已被中斷（在第 ${i + 1}/${segments.length} 段前）`);
            await cleanupTempFiles(tempDir);
            throw new Error('ANALYSIS_ABORTED');
          }
        }

        analysisLogger.info(`正在分析第 ${i + 1}/${segments.length} 段...`);

        try {
          // 分析當前片段
          const segmentResult = await analyzeMeetingVideo(
            segments[i],
            meetingId,
            cumulativeContext,
            role
          );

          // 收集逐字稿
          if (segmentResult.transcript) {
            transcripts.push(`--- 第 ${i + 1} 段 (${i * 18}-${(i + 1) * 18} 分鐘) ---\n\n${segmentResult.transcript}`);

            // 更新累積上下文（用於下一段分析）
            cumulativeContext = transcripts.join('\n\n');
          }

          analysisLogger.info(`第 ${i + 1}/${segments.length} 段分析完成`);

        } catch (segmentError) {
          // 檢查是否是主動中斷
          if (segmentError instanceof Error && segmentError.message === 'ANALYSIS_ABORTED') {
            throw segmentError;
          }
          analysisLogger.error(`第 ${i + 1}/${segments.length} 段分析失敗`, { error: segmentError });
          // 繼續處理下一段，不中斷整個流程
          transcripts.push(`--- 第 ${i + 1} 段分析失敗 ---\n錯誤：${segmentError instanceof Error ? segmentError.message : String(segmentError)}`);
        }
      }

      // 6. 合併逐字稿
      const fullTranscript = transcripts.join('\n\n');
      analysisLogger.info(`所有片段分析完成，正在生成統一會議記錄...`);

      // 7. 基於完整逐字稿生成統一的會議記錄
      const client = getGeminiClient();
      const currentSystemPrompt = SYSTEM_PROMPTS[role as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.secretary;

      const streamingResp = await client.models.generateContentStream({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: currentSystemPrompt,
          maxOutputTokens: 32768,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: MEETING_MINUTES_SCHEMA,
        },
        contents: [{
          role: 'user',
          parts: [{
            text: `以下是完整的會議逐字稿（影片長度 ${durationMinutes} 分鐘，已自動切分為 ${segmentCount} 段）：

${fullTranscript}

請根據完整逐字稿內容，產生統一的會議記錄。
注意：
1. 整合所有片段的資訊，生成一份完整的會議記錄
2. 將相同主題的討論合併
3. 確保 action items 和 risk items 不重複
4. 嚴格輸出純 JSON 格式，不要包含 Markdown 標記`
          }]
        }]
      });

      // 8. 解析 JSON 結果（與原本邏輯相同）
      let fullText = '';
      const streamSource = (streamingResp as any).stream || streamingResp;

      for await (const chunk of streamSource) {
        let chunkText = '';
        if (typeof chunk.text === 'function') {
          chunkText = chunk.text();
        } else if (typeof chunk.text === 'string') {
          chunkText = chunk.text;
        } else if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
          chunkText = chunk.candidates[0].content.parts.map((p: any) => p.text).join('');
        }
        fullText += chunkText;
      }

      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      let jsonText = jsonMatch ? jsonMatch[0] : fullText.replace(/```json/g, '').replace(/```/g, '').trim();

      // JSON 自動修復邏輯
      if (!jsonText.endsWith('}')) {
        analysisLogger.warn(`偵測到 JSON 截斷，嘗試修復...`);
        const closers = ['}', ']}', '"]}}', '} }'];
        for (const closer of closers) {
          try {
            JSON.parse(jsonText + closer);
            jsonText += closer;
            analysisLogger.info(`JSON 修復成功 (Closer: ${closer})`);
            break;
          } catch (e) { }
        }
      }

      try {
        let analysisResult: GeminiAnalysisResult = JSON.parse(jsonText);

        if (!analysisResult.minutes && !(analysisResult as any).info) {
          throw new Error('Missing minutes/info');
        }

        // 附加完整逐字稿
        analysisResult.transcript = fullTranscript;
        analysisLogger.info('自動切分模式分析完成');
        return analysisResult;

      } catch (parseError) {
        analysisLogger.warn('JSON 解析失敗，嘗試暴力修復...', { error: String(parseError) });

        const repairClosers = ['}', ']}', '}}', ']}}', '}]}}', '"]}}', '"}}', '}]', ']'];
        for (const closer of repairClosers) {
          try {
            const patchedText = jsonText + closer;
            let fixedResult = JSON.parse(patchedText);

            if (fixedResult.minutes || fixedResult.info || fixedResult.summary) {
              analysisLogger.info(`JSON 暴力修復成功`);
              (fixedResult as any).transcript = fullTranscript;
              return fixedResult as GeminiAnalysisResult;
            }
          } catch (e) { }
        }

        throw new Error('AI 回傳格式錯誤 (JSON Parse Error)，自動修復失敗');
      }

    } finally {
      // 9. 清理臨時檔案
      analysisLogger.info('清理臨時檔案...');
      await cleanupTempFiles(tempDir);
    }

  } catch (error) {
    analysisLogger.error('自動切分分析失敗', { error });
    throw error;
  }
}
