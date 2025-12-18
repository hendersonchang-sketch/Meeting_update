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
/**
 * 取得 Gemini API 客戶端
 */
function getGeminiClient(): GoogleGenAI {
  // 優先從資料庫取得 API Key
  let apiKey = getSetting('gemini_api_key');

  // 如果資料庫沒有，則從環境變數取得
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY || '';
  }

  if (!apiKey) {
    const error = 'Gemini API Key 未設定。請前往設定頁面輸入 API Key。';
    logger.error(error);
    throw new Error(error);
  }

  logger.debug('使用 API Key 初始化 Gemini 客戶端', { keyPrefix: apiKey.slice(0, 4) + '...' });

  return new GoogleGenAI({ apiKey });
}

/**
 * 將檔案轉換為 base64 格式
 */
function fileToBase64(filePath: string): string {
  logger.debug(`讀取檔案: ${filePath}`);
  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString('base64');
  logger.debug(`檔案轉換完成，大小: ${(base64.length / 1024 / 1024).toFixed(2)} MB`);
  return base64;
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
 * 測試 API Key 是否有效
 */
export async function testApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
  const testLogger = createLogger('Gemini.TestApiKey');
  testLogger.info('開始測試 API Key');

  try {
    const client = new GoogleGenAI({ apiKey });

    testLogger.debug('發送測試請求...');
    const result = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{ text: 'Hello, please respond with "OK" if you can read this.' }]
      }]
    });

    const text = result.text || '';

    testLogger.info('API Key 測試成功', { response: text.slice(0, 50) });
    return { success: true, message: 'API Key 有效！連線測試成功。' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    testLogger.error('API Key 測試失敗', { error: errorMessage });
    return { success: false, message: `API Key 無效或連線失敗: ${errorMessage}` };
  }
}

/**
 * 嘗試修復不完整的 JSON
 */
function tryFixIncompleteJson(text: string): string {
  // 移除 markdown 標記
  let jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // 計算括號配對
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let lastChar = '';

  for (const char of jsonStr) {
    if (char === '"' && lastChar !== '\\') {
      inString = !inString;
    }
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }
    lastChar = char;
  }

  // 如果在字串中被截斷，嘗試關閉字串
  if (inString) {
    jsonStr += '"';
  }

  // 關閉未配對的括號
  while (bracketCount > 0) {
    jsonStr += ']';
    bracketCount--;
  }
  while (braceCount > 0) {
    jsonStr += '}';
    braceCount--;
  }

  return jsonStr;
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

  analysisLogger.info('開始分析會議影片 (Transcript-First)', { videoPath });

  try {
    const client = getGeminiClient();
    const mimeType = getMimeType(videoPath);
    const base64Video = fileToBase64(videoPath);

    // --- 第一階段：生成逐字稿 (Transcript Generation) ---
    analysisLogger.info('--- 第一階段：生成逐字稿 ---');
    const transcriptPrompt = `請將這個會議影片轉換為「完整的逐字稿」。
    
    規則：
    1. 記錄所有發言內容，不要摘要。
    2. 區分發言者（如 Speaker A, Speaker B）。
    3. 使用繁體中文。
    4. 保持客觀，不添加個人意見。
    5. 純文字輸出，不要 Markdown 格式。`;

    const transcriptResult = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 32768,
        temperature: 0.3,
      },
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Video } },
          { text: transcriptPrompt },
        ]
      }]
    });

    const fullTranscript = transcriptResult.text || '';

    analysisLogger.info(`逐字稿生成完成，長度: ${fullTranscript.length} 字`);

    // 儲存逐字稿到檔案
    const outputDir = path.join(process.cwd(), 'outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const transcriptFilename = `transcript_${safeMeetingId}_${Date.now()}.txt`;
    const transcriptPath = path.join(outputDir, transcriptFilename);
    fs.writeFileSync(transcriptPath, fullTranscript, 'utf-8');
    analysisLogger.info(`逐字稿已儲存: ${transcriptFilename}`);

    // --- 第二階段：會議分析 (Analysis based on Transcript) ---
    analysisLogger.info('--- 第二階段：基於逐字稿進行分析 ---');

    // 詳細的 prompt，嚴格遵循範本格式
    const analysisPrompt = `你是專業會議記錄秘書。請分析以下「會議逐字稿」，輸出 JSON 格式會議記錄。

重要：這是正式的「會議摘要」，必須嚴格遵循範本格式。

**範本格式規範（不可更改）：**

「一、重點紀錄」底下必須有以下 **7 個固定子項標題**，順序不可變動：
1. 機房搬遷
2. 機房服務
3. 網路、資安
4. 儲存
5. SAP（HW）
6. 文心機房搬遷
7. 現代化顧問服務

請將會議內容歸類到這 7 個分類中。如果某分類沒有相關討論，內容填入「無」。

**核心規則：**
1. **內容長度**：整份會議紀錄總字數必須超過 1000 字。每個有內容的項目需要 2-3 句完整描述。
2. **不寫人名**：摘要內容中不提及人名，人名只出現在 attendees 欄位。
3. **必要細節**：標註日期、設備名稱、地點等具體資訊。
4. **格式**：不使用 (1), (2), (3) 編號開頭。
5. **風格**：專業、客觀、資訊導向。

逐字稿內容：
${fullTranscript}

${existingContext ? `參考資料：\n${existingContext}` : ''}

輸出格式 JSON：
{
  "transcript": "（請保留此欄位，填入 '請見附件獨立逐字稿檔案' 以節省輸出長度）",
  "summary": "完整會議摘要（約 800-1200 字）",
  "speakers": ["發言者列表"],
  "minutes": {
    "info": {
      "title": "會議標題",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "location": "地點",
      "recorder": "記錄者"
    },
    "attendees": {
      "companyLeaders": [],
      "technicalTeam": [],
      "pmTeam": [],
      "ibmTeam": [],
      "vendors": []
    },
    "keyPoints": [
      {"category": "機房搬遷", "content": ["內容..."]},
      {"category": "機房服務", "content": ["內容..."]},
      {"category": "網路、資安", "content": ["內容..."]},
      {"category": "儲存", "content": ["內容..."]},
      {"category": "SAP（HW）", "content": ["內容..."]},
      {"category": "文心機房搬遷", "content": ["內容..."]},
      {"category": "現代化顧問服務", "content": ["內容..."]}
    ],
    "actionItems": [
      {"description": "事項", "assignee": "負責人", "status": "pending"}
    ],
    "riskItems": [
      {"description": "風險", "severity": "medium", "mitigation": "對策"}
    ],
    "otherNotes": [],
    "endTime": "HH:MM"
  }
}`;

    const analysisResultData = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 32768,
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
      contents: [{
        role: 'user',
        parts: [{ text: analysisPrompt }]
      }]
    });

    const jsonText = analysisResultData.text || '';

    analysisLogger.debug('解析 JSON 回應...');
    let jsonStr = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    // 清理控制字符
    jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    try {
      let analysisResult: GeminiAnalysisResult = JSON.parse(jsonStr);

      // 回填完整的逐字稿 (雖然 Prompt 叫它不要回傳以節省 Token，我們這裡手動補上)
      analysisResult.transcript = fullTranscript;

      // 驗證結構: 確保 minutes 存在
      if (!analysisResult.minutes) {
        // 嘗試找常見的錯誤結構
        analysisResult.minutes = (analysisResult as any).meeting_minutes || {
          info: {}, attendees: {}, keyPoints: [], actionItems: [], riskItems: [], otherNotes: []
        };
      }

      // 確保 keyPoints 結構正確 (如果不完整，可以補預設值，這裡先簡單檢查)
      if (!analysisResult.minutes?.info) {
        throw new Error('JSON 缺少 minutes.info');
      }

      analysisLogger.info('會議記錄分析完成 (Transcript-First 模式成功)');
      return analysisResult;

    } catch (parseError) {
      analysisLogger.warn('JSON 解析失敗，嘗試修復...', { error: parseError });
      const fixedJson = tryFixIncompleteJson(jsonText);
      const analysisResult: GeminiAnalysisResult = JSON.parse(fixedJson);
      analysisResult.transcript = fullTranscript; // 補上逐字稿

      if (!analysisResult.minutes) throw new Error('無法修復 JSON 結構');

      return analysisResult;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    analysisLogger.error('會議分析失敗', { error: errorMessage });
    throw error;
  }
}

/**
 * 建立基本結果結構（當 JSON 解析完全失敗時）
 */
function createBasicResult(rawText: string): GeminiAnalysisResult {
  return {
    transcript: rawText.slice(0, 5000), // 保留原始文字作為逐字稿
    summary: '會議記錄解析過程中發生錯誤，請查看逐字稿內容並手動整理。',
    speakers: [],
    minutes: {
      info: {
        id: '',
        title: '會議記錄（需手動整理）',
        date: new Date().toISOString().split('T')[0],
        time: '',
        location: '待確認',
        recorder: '系統自動生成',
      },
      attendees: {
        companyLeaders: [],
        technicalTeam: [],
        pmTeam: [],
        ibmTeam: [],
        vendors: [],
      },
      keyPoints: [
        {
          category: '待整理',
          content: ['請查看逐字稿手動整理重點'],
        },
      ],
      actionItems: [],
      riskItems: [],
      otherNotes: ['AI 解析失敗，請手動整理此會議記錄'],
      endTime: '待確認',
    },
  };
}

/**
 * 分析 PPTX 簡報內容（文字版本）
 */
export async function analyzePPTX(pptxContent: string): Promise<string> {
  const client = getGeminiClient();

  const prompt = `請分析以下簡報內容，提取重點摘要：

${pptxContent}

請以條列式整理簡報的主要內容和重點。使用繁體中文。`;

  try {
    const result = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
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

  const prompt = `請分析以下文件內容，提取重點摘要：

${docxContent}

請以條列式整理文件的主要內容和重點。使用繁體中文。`;

  try {
    const result = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
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

  const prompt = `請根據以下資訊優化會議記錄：

目前的會議記錄：
${JSON.stringify(currentMinutes, null, 2)}

額外參考資料：
${additionalContext}

${instructions ? `特別指示：${instructions}` : ''}

請輸出優化後的完整 JSON 格式會議記錄。保持原有的格式結構。使用繁體中文。`;

  try {
    const result = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        responseMimeType: 'application/json',
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    });
    const text = result.text || '';

    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
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

  const prompt = `請根據以下會議記錄生成一份簡潔的會議摘要（約200-300字）：

${JSON.stringify(minutes, null, 2)}

摘要應包含：
1. 會議主題和日期
2. 主要討論事項
3. 重要決議
4. 下一步行動

使用繁體中文，以專業的商業書信風格撰寫。`;

  try {
    const result = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    });
    return result.text || '';
  } catch (error) {
    logger.error('摘要生成錯誤', { error });
    throw error;
  }
}
