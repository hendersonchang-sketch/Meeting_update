// Gemini API 整合模組
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import * as path from 'path';
import { MeetingMinutes } from './types';
import { createLogger } from './logger';
import { getApiKey as getApiKeyFromDb } from './database';

// 會議記錄模板 - 固定的章節結構（依據範例文件）
const MEETING_TEMPLATE = {
    keyPointCategories: [
        '1. 機房搬遷',
        '2. 機房服務',
        '3. 網路、資安',
        '4. 儲存',
        '5. SAP（HW）',
        '6. 文心機房搬遷',
        '7. 現代化顧問服務',
    ],
    sections: {
        keyPoints: '一、重點紀錄',
        actionItems: '二、待辦事項',
        riskItems: '三、風險管理事項',
        otherNotes: '四、其他事項紀錄',
    },
};

// 取得 API Key
function getApiKey(): string {
    // 優先從環境變數取得
    if (process.env.GEMINI_API_KEY) {
        return process.env.GEMINI_API_KEY;
    }

    // 從資料庫取得
    const dbKey = getApiKeyFromDb();
    if (dbKey) {
        return dbKey;
    }

    throw new Error('未設定 Gemini API Key，請至設定頁面設定');
}

// 測試 API Key
export async function testApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        // 使用簡單的測試請求
        const result = await model.generateContent('回覆「OK」');
        const text = result.response.text();

        if (text) {
            return { success: true, message: 'API Key 有效' };
        }
        return { success: false, message: '無法取得回應' };
    } catch (error) {
        const message = error instanceof Error ? error.message : '未知錯誤';
        return { success: false, message: `API Key 無效: ${message}` };
    }
}

// 分析會議影片
export async function analyzeMeetingVideo(
    videoPath: string,
    meetingId: string
): Promise<{
    transcript: string;
    summary: string;
    minutes: MeetingMinutes;
}> {
    const logger = createLogger('Gemini', meetingId);

    try {
        const apiKey = getApiKey();
        const genAI = new GoogleGenerativeAI(apiKey);
        const fileManager = new GoogleAIFileManager(apiKey);

        logger.info('開始上傳影片至 Gemini...');

        // 上傳影片檔案
        const uploadResult = await fileManager.uploadFile(videoPath, {
            mimeType: getMimeType(videoPath),
            displayName: path.basename(videoPath),
        });

        logger.info('影片上傳完成，等待處理...', { fileName: uploadResult.file.name });

        // 等待檔案處理完成
        let file = await fileManager.getFile(uploadResult.file.name);
        while (file.state === 'PROCESSING') {
            await delay(5000);
            file = await fileManager.getFile(uploadResult.file.name);
            logger.debug('檔案處理中...', { state: file.state });
        }

        if (file.state === 'FAILED') {
            throw new Error('Gemini 檔案處理失敗');
        }

        logger.info('影片已準備就緒，開始分析...');

        // Helper function to run generation with retry for 429 errors
        const runGeneration = async (prompt: string, stageName: string): Promise<string> => {
            const modelName = 'gemini-2.0-flash-exp';
            const maxRetries = 5; // 增加重試次數
            let retryCount = 0;

            while (retryCount < maxRetries) {
                try {
                    logger.info(`[${stageName}] 使用模型: ${modelName} (嘗試 ${retryCount + 1}/${maxRetries})`);
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        generationConfig: {
                            maxOutputTokens: 8192,
                            temperature: 0.3,
                        },
                    });

                    const result = await model.generateContent([
                        {
                            fileData: {
                                mimeType: file.mimeType,
                                fileUri: file.uri,
                            },
                        },
                        { text: prompt },
                    ]);
                    return result.response.text();

                } catch (err: unknown) {
                    const errorMsg = err instanceof Error ? err.message : String(err);

                    // 檢查是否為 Quota Exceeded (429)
                    if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('quota')) {
                        const waitTime = 60000; // 延長等待時間至 60 秒
                        logger.warn(`[${stageName}] 配額不足 (429)，等待 ${waitTime / 1000} 秒後重試...`, { attempt: retryCount + 1 });
                        await delay(waitTime);
                        retryCount++;
                    } else {
                        // 其他錯誤直接拋出
                        logger.error(`[${stageName}] 模型執行失敗`, { error: errorMsg });
                        throw err;
                    }
                }
            }
            throw new Error(`[${stageName}] 重試次數過多，無法完成分析。`);
        };

        // --- Stage 1: 深度內容提取 ---
        logger.info('執行 Stage 1: 深度內容提取...');
        const extractionPrompt = buildExtractionPrompt();
        const extractionNotes = await runGeneration(extractionPrompt, 'Stage 1');
        logger.info('Stage 1 完成', { length: extractionNotes.length });

        // --- Stage 2: 格式化 ---
        logger.info('執行 Stage 2: 格式化輸出...');
        const formattingPrompt = buildFormattingPrompt(extractionNotes);
        const finalResponseText = await runGeneration(formattingPrompt, 'Stage 2');
        logger.info('Stage 2 完成', { length: finalResponseText.length });

        // 解析回應
        const parsed = parseGeminiResponse(finalResponseText, logger);

        // 清理上傳的檔案
        try {
            await fileManager.deleteFile(uploadResult.file.name);
            logger.debug('已清理暫時檔案');
        } catch {
            logger.warn('清理暫時檔案失敗');
        }

        return parsed;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
        logger.error('Gemini 分析失敗', { error: errorMessage });
        throw error;
    }
}

// Stage 1: 詳細內容萃取 Prompt
function buildExtractionPrompt(): string {
    return `你是專業的會議速記員與技術分析師。請仔細分析這段會議錄影，這是一場高強度的技術專案會議。
    
**你的目標是：寧可記樣太細，也不要遺漏任何一個技術細節。**

請針對以下面向進行 "逐字等級" 的重點編目：

1. **關鍵決策與結論**：所有已定案的項目，包含決策者是誰。
2. **具體數據與參數 (這是最重要的)**：
   - 務必提取所有：日期 (e.g. 12/5, 下週三)、時間 (14:00)、進度百分比 (85%)、預算金額、IP位置、版本號。
   - 硬體型號 (e.g. Dell R750, Cisco 9k)、軟體名稱 (SAP HANA, DCIM)。
3. **待辦事項 (Action Items)**：
   - 誰 (Owner)？ 要在什麼時候 (Deadline)？ 做什麼具體動作 (Action)？
4. **風險與問題 (Risks)**：
   - 目前遇到的具體阻礙、需要的確切支援。
5. **各項專案細節 (請依序詳細列出)**：
   - 機房搬遷 (時程、動線、廠商)
   - 機房服務 (環控、保全)
   - 網路、資安 (防火牆策略、線路介接)
   - 儲存設備 (Storage, Backup)
   - SAP 硬體 (HANA 機器狀況)
   - 文心機房搬遷
   - 現代化顧問服務

**輸出要求：**
- 請使用條列式。
- 每個重點請盡量保留完整的句子，不要過度簡化，保留原始語氣中的強調點。
- **請寫出至少 1500 字以上的詳細筆記。**`;
}

// Stage 2: 格式化 Prompt (接收 Stage 1 的筆記)
function buildFormattingPrompt(notes: string): string {
    return `你是專業的會議記錄編輯。請根據以下的 **會議詳細筆記**，將內容填入嚴格的 JSON 格式。

**會議詳細筆記：**
${notes}

---

**任務要求：**
1. 依據上述筆記內容，填入對應的 JSON 欄位。
2. **所有項目標題固定** (1. 機房搬遷, 2. 機房服務...等)，不可修改。
3. **內容要求**：
   - 每個重點類別 ("content" 陣列) 需包含 **3-5 個詳細要點**。
   - 每個要點 **約 30 字**，簡潔但必須包含筆記中的具體數據（日期、與會人、設備名）。
   - 若某類別在筆記中完全未提及，請填入 ["無"]。
   - **待辦事項** 與 **風險事項** 務必從筆記中提取，若無則填 ["無"]。

**只輸出 JSON，不要有任何其他文字！**

${JSON.stringify({
        "transcript": "精簡版逐字稿摘要...",
        "summary": "會議高層摘要...",
        "minutes": {
            "info": {
                "title": "114年度新機房基礎架構建置技術小組進度會議紀錄",
                "date": "民國114年MM月DD日...",
                "location": "會議地點",
                "recorder": "記錄人"
            },
            "attendees": {
                "companyLeaders": ["範例: 張副總", "李協理"],
                "technicalTeam": ["範例: 王經理"],
                "pmTeam": ["範例: 陳PM"],
                "ibmTeam": [],
                "vendors": []
            },
            "keyPoints": MEETING_TEMPLATE.keyPointCategories.map(cat => ({ category: cat, content: ["詳細要點1...", "詳細要點2..."] })),
            "actionItems": [
                { "owner": "負責人", "content": "待辦事項內容...", "deadline": "YYYY/MM/DD", "status": "進行中" }
            ],
            "riskItems": [
                { "content": "風險內容...", "countermeasure": "對策...", "owner": "負責人" }
            ],
            "otherNotes": ["其他事項1...", "其他事項2..."],
            "endTime": "17:30"
        }
    }, null, 2)}`;
}

// 解析 Gemini 回應
function parseGeminiResponse(
    responseText: string,
    logger: ReturnType<typeof createLogger>
): {
    transcript: string;
    summary: string;
    minutes: MeetingMinutes;
} {
    try {
        let jsonStr = responseText.trim();

        // 記錄原始回應長度
        logger.debug(`[Gemini] 原始回應長度: ${jsonStr.length} 字元`);

        // 移除可能的 markdown code block（支援多種格式）
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '');
        jsonStr = jsonStr.replace(/\n?```\s*$/i, '');

        // 嘗試找到 JSON 物件的開始和結束
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }

        const parsed = JSON.parse(jsonStr);

        // 驗證必要欄位
        const result = {
            transcript: parsed.transcript || '',
            summary: parsed.summary || '無摘要',
            minutes: {
                info: parsed.minutes?.info || { title: '會議紀錄', date: new Date().toISOString().split('T')[0] },
                attendees: parsed.minutes?.attendees || {},
                keyPoints: parsed.minutes?.keyPoints || [],
                actionItems: parsed.minutes?.actionItems || [],
                riskItems: parsed.minutes?.riskItems || [],
                otherNotes: parsed.minutes?.otherNotes || [],
                endTime: parsed.minutes?.endTime || undefined,
            },
        };

        return result;
    } catch (error) {
        logger.error('[Gemini] JSON 解析失敗', { error: String(error) });

        // 回傳基本結構，保留原始回應作為逐字稿
        return {
            transcript: responseText,
            summary: '解析失敗，請查看原始回應。錯誤: ' + (error instanceof Error ? error.message : String(error)),
            minutes: {
                info: { title: '會議紀錄', date: new Date().toISOString().split('T')[0] },
                attendees: {},
                keyPoints: [],
                actionItems: [],
                riskItems: [],
                otherNotes: [],
                endTime: null,
            },
        };
    }
}

// 取得 MIME 類型
function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.m4a': 'audio/mp4',
    };
    return mimeTypes[ext] || 'video/mp4';
}

// 延遲函數
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
