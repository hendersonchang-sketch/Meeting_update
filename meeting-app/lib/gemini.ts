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

        // 嘗試使用高品質模型 (NotebookLM 同級)，若失敗則退回 Flash
        let modelName = 'gemini-1.5-pro-002';
        let result;

        try {
            logger.info(`嘗試使用高品質模型: ${modelName}`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    maxOutputTokens: 8192,
                    temperature: 0.3,
                },
            });

            const prompt = buildAnalysisPrompt();
            result = await model.generateContent([
                {
                    fileData: {
                        mimeType: file.mimeType,
                        fileUri: file.uri,
                    },
                },
                { text: prompt },
            ]);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.warn(`模型 ${modelName} 使用失敗，切換至備用模型 gemini-2.0-flash-exp`, { error: errorMsg });

            // Fallback to Flash
            modelName = 'gemini-2.0-flash-exp';
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    maxOutputTokens: 8192,
                    temperature: 0.3,
                },
            });

            const prompt = buildAnalysisPrompt();
            result = await model.generateContent([
                {
                    fileData: {
                        mimeType: file.mimeType,
                        fileUri: file.uri,
                    },
                },
                { text: prompt },
            ]);
        }

        const responseText = result.response.text();
        logger.info('AI 分析完成', { responseLength: responseText.length });

        // 解析回應
        const parsed = parseGeminiResponse(responseText, logger);

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

// 建立分析 prompt - 根據實際會議紀錄範例
function buildAnalysisPrompt(): string {
    return `你是專業的會議記錄助理。請仔細分析這段會議錄影，根據以下格式產生詳細的會議紀錄。

⚠️ **嚴格規定：**
- 所有類別標題 **完全固定，不可更改、不可省略、不可新增**
- **只記錄影片中實際提到的內容，禁止編造**
- 若該類別在影片中無相關討論，content 填入 ["無"]

📝 **內容格式要求：**
- **每個重點描述約 30 字**，簡潔但完整
- 必須包含：具體日期、進度百分比、設備名稱、關鍵動作
- **除了「重點紀錄」外，務必檢查並填寫「待辦事項」與「風險管理事項」，若無則填寫 ["無"]**

**範例格式（請嚴格參考此風格）：**

1. 機房搬遷：
• 近兩週（12/2、3、5、9）進行四次週會，討論 VM 搬遷方法及 HANA 升級計畫。
• 階段三前置規劃：動線計畫已於 12/3 交付，預計 12/13 報告。

2. 機房服務：
• 子任務進度已達 95%，實體安全建置完成。
• DCIM 客製化部分預計明年完成。

**只輸出 JSON，不要有任何其他文字！**

{
    "transcript": "會議逐字稿重點摘錄",
    "summary": "會議摘要（100字以內）",
    "minutes": {
        "info": {
            "title": "114年度新機房基礎架構建置技術小組進度會議紀錄",
            "date": "民國114年MM月DD日（星期X）下午X時XX分",
            "location": "民權東路二段144號7樓會議室",
            "recorder": "記錄人姓名"
        },
        "attendees": {
            "companyLeaders": ["Fanny Chan"],
            "technicalTeam": ["Troy Tsuei", "Hank Hsieh", "Jason Yu", "Jack Sie", "Yuan Liu", "Erich Lee"],
            "pmTeam": ["KuanLingLin", "WeiYuChang", "Chean Wu"],
            "ibmTeam": ["Qi Peng", "Tony Yo", "Jack Wang", "Eric Chung", "Jacqueline Cheng"],
            "vendors": ["遠傳", "中華", "精誠", "HPE", "Dell", "邁達特", "仁大"]
        },
        "keyPoints": [
            {"category": "1. 機房搬遷", "content": [
                "近兩週有進行X次週會：MM/DD討論XXX，MM/DD討論YYY",
                "某項目進度說明：具體日期、狀態、下一步動作"
            ]},
            {"category": "2. 機房服務", "content": ["任務進度已達 XX%。具體完成項目說明。"]},
            {"category": "3. 網路、資安", "content": ["網路整合測試進度為 XX%。具體測試項目說明。"]},
            {"category": "4. 儲存", "content": ["MM/DD 完成某設備上架。具體設備名稱和動作。"]},
            {"category": "5. SAP（HW）", "content": ["建置計劃進度說明。設備到貨和安裝狀態。"]},
            {"category": "6. 文心機房搬遷", "content": ["搬遷時程和準備狀態說明。"]},
            {"category": "7. 現代化顧問服務", "content": ["腳本編寫進度 XX%。問題和解決方案說明。"]}
        ],
        "actionItems": [
            {"description": "待辦事項具體描述", "assignee": "負責人/團隊", "status": "pending"}
        ],
        "riskItems": [
            {"description": "風險描述", "mitigation": "緩解措施"}
        ],
        "otherNotes": ["其他討論事項"],
        "endTime": "下午X時XX分"
    }
}

**填寫規則（必須嚴格遵守）：**
1. 7 個 category 名稱 **絕對不可更改**：1. 機房搬遷、2. 機房服務、3. 網路、資安、4. 儲存、5. SAP（HW）、6. 文心機房搬遷、7. 現代化顧問服務
2. **詳細記錄影片中每個討論項目，格式參照上方範例**
3. 每個要點要包含：具體日期（如12/3）、進度百分比（如95%）、設備名稱、廠商名稱、動作說明
4. 若影片中該類別無相關討論，content 填入 ["無"]
5. 若無待辦事項，actionItems 設為 []
6. 若無風險事項，riskItems 設為 []
7. 只輸出 JSON，確保 JSON 完整有效`;
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
        console.log(`[Gemini] 原始回應長度: ${jsonStr.length} 字元`);

        // 移除可能的 markdown code block（支援多種格式）
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '');
        jsonStr = jsonStr.replace(/\n?```\s*$/i, '');

        // 嘗試找到 JSON 物件的開始和結束
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }

        console.log(`[Gemini] 處理後 JSON 長度: ${jsonStr.length} 字元`);

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
                endTime: parsed.minutes?.endTime || null,
            },
        };

        console.log(`[Gemini] 解析成功 - keyPoints: ${result.minutes.keyPoints?.length || 0}, actionItems: ${result.minutes.actionItems?.length || 0}`);

        return result;
    } catch (error) {
        console.error('[Gemini] JSON 解析失敗:', error);
        console.error('[Gemini] 回應前 500 字:', responseText.substring(0, 500));

        // 嘗試提取逐字稿部分
        let transcript = responseText;

        // 如果回應包含可識別的逐字稿標記，嘗試提取
        const transcriptMatch = responseText.match(/"transcript"\s*:\s*"([^"]+)"/);
        if (transcriptMatch) {
            transcript = transcriptMatch[1].replace(/\\n/g, '\n');
        }

        // 回傳基本結構，保留原始回應作為逐字稿
        return {
            transcript: transcript,
            summary: '解析失敗，請查看原始回應。錯誤: ' + (error instanceof Error ? error.message : String(error)),
            minutes: {
                keyPoints: [],
                actionItems: [],
                riskItems: [],
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
