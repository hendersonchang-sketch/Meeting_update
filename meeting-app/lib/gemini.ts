// Gemini API 整合模組
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import * as path from 'path';
import { MeetingMinutes } from './types';
import { createLogger } from './logger';
import { getApiKey as getApiKeyFromDb, writeLog } from './database';

// 南山人壽專用系統指令
const NSL_SYSTEM_INSTRUCTION = `你是專業的會議記錄秘書。請根據影片內容，填寫以下結構的會議記錄。

【格式嚴格要求】
1. 輸出必須是純 JSON。
2. 內容請「精簡摘要」並以「條列式」呈現。
3. 若某欄位無資料，請填入 "無"。

【JSON 結構 Schema】
{
    "time": "民國XX年XX月XX日（星期X）下午X時XX分",
    "location": "會議地點",
    "recorder": "記錄人姓名",
    "attendees": {
        "nanshan": "南山長官姓名",
        "tech_team": "技術小組代表姓名",
        "pm": "PM代表姓名",
        "ibm": "IBM代表姓名",
        "vendors": "參與廠商名稱"
    },
    "topics": {
        "relocation": ["機房搬遷重點1", "機房搬遷重點2"],
        "service": ["機房服務重點"],
        "network_security": ["網路、資安重點"],
        "storage": ["儲存重點"],
        "sap_hw": ["SAP (HW) 重點"],
        "wenxin": ["文心機房搬遷重點"],
        "modernization": ["現代化顧問服務重點"]
    },
    "action_items": ["待辦事項1", "待辦事項2"],
    "risks": ["風險事項 (若無請填無)"],
    "others": ["其他事項"],
    "adjourn_time": "下午X時XX分"
}`;

// 取得 API Key
function getApiKey(): string {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    const dbKey = getApiKeyFromDb();
    if (dbKey) return dbKey;
    throw new Error('未設定 Gemini API Key，請至設定頁面設定');
}

// 測試 API Key
export async function testApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent('回覆「OK」');
        return { success: true, message: 'API Key 有效' };
    } catch (error) {
        return { success: false, message: `API Key 無效: ${error instanceof Error ? error.message : '未知錯誤'}` };
    }
}

// 分析會議影片
export async function analyzeMeetingVideo(
    videoPath: string,
    meetingId: string,
    customerType: string = 'nanshan',
    customPrompt: string = ''
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
        const uploadResult = await fileManager.uploadFile(videoPath, {
            mimeType: getMimeType(videoPath),
            displayName: path.basename(videoPath),
        });

        let file = await fileManager.getFile(uploadResult.file.name);
        while (file.state === 'PROCESSING') {
            await delay(5000);
            file = await fileManager.getFile(uploadResult.file.name);
            logger.info('檔案處理中...', { state: String(file.state) });
        }

        if (file.state === 'FAILED') {
            const errorMsg = 'Gemini 檔案處理失敗 (FAILED)';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        logger.info(`檔案處理完成，狀態: ${String(file.state)}`);

        const runGeneration = async (prompt: string, stageName: string, systemInstruction?: string): Promise<string> => {
            const modelName = 'gemini-2.0-flash';
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemInstruction,
                generationConfig: { responseMimeType: systemInstruction ? 'application/json' : 'text/plain', temperature: 0.2 },
            });

            const result = await model.generateContent([
                { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
                { text: prompt },
            ]);
            return result.response.text();
        };

        // Stage 0: 影片長度
        logger.info('正在偵測影片長度 (Stage 0)...');
        writeLog({ level: 'info', source: 'Gemini', message: '正在偵測影片長度...', meeting_id: meetingId });
        const durationResponse = await runGeneration('請分析影片總長度（分鐘），只回傳數字（例如: 45）。', 'Stage 0');
        const durationMinutes = parseFloat(durationResponse.replace(/[^0-9.]/g, '')) || 60;
        logger.info(`預估影片長度: ${durationMinutes} 分鐘`);

        // Stage 1: 分段逐字稿
        const segmentSize = 10;
        const totalSegments = Math.ceil(durationMinutes / segmentSize);
        let fullTranscript = '';
        for (let i = 0; i < totalSegments; i++) {
            const startMin = i * segmentSize;
            const endMin = Math.min((i + 1) * segmentSize, durationMinutes);
            logger.info(`正在處理分段逐字稿: ${startMin} - ${endMin} 分鐘...`);
            writeLog({ level: 'info', source: 'Gemini', message: `正在生成第 ${i + 1}/${totalSegments} 段逐字稿...`, meeting_id: meetingId });
            const segmentTranscript = await runGeneration(buildSegmentPrompt(startMin, endMin), `Segment ${i + 1}`);
            fullTranscript += `\n\n--- [${startMin}:00 - ${endMin}:00] ---\n\n${segmentTranscript}`;
        }

        // Stage 2: 結構化分析
        logger.info('開始結構化分析 (Stage 2)...');
        writeLog({ level: 'info', source: 'Gemini', message: '開始結構化分析...', meeting_id: meetingId });

        // 根據客戶類型與自定義 Prompt 選取指令
        let systemInstruction = customerType === 'nanshan' ? NSL_SYSTEM_INSTRUCTION : NSL_SYSTEM_INSTRUCTION;

        // 如果有自定義 Prompt，將其注入到系統指令最前方
        if (customPrompt && customPrompt.trim()) {
            systemInstruction = `【自定義人設指令】：${customPrompt}\n\n${systemInstruction}`;
        }

        const analysisResponse = await runGeneration(
            `${buildAnalysisFromTranscriptPrompt(fullTranscript)}\n\n重要：請嚴格遵守 JSON Schema 格式。`,
            'Stage 2',
            systemInstruction
        );

        const parsed = parseGeminiResponse(analysisResponse, logger);
        parsed.transcript = fullTranscript;

        try { await fileManager.deleteFile(uploadResult.file.name); } catch { }

        return parsed;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';

        logger.error('Gemini 分析失敗', { error: errorMsg });
        writeLog({
            level: 'error',
            source: 'Gemini',
            message: `Gemini 分析失敗: ${errorMsg}`,
            details: errorStack,
            meeting_id: meetingId
        });
        throw error;
    }
}

function buildSegmentPrompt(startMin: number, endMin: number): string {
    return `你是專業聽打速記員。請詳細紀錄影片中從 ${startMin} 到 ${endMin} 分鐘的對話重點。內容請包含發言者（若可辨識）與具體討論細節。`;
}

function buildAnalysisFromTranscriptPrompt(transcript: string): string {
    return `請根據以下逐字稿生成會議記錄 JSON：\n\n${transcript}`;
}

function parseGeminiResponse(responseText: string, logger: any) {
    try {
        let jsonStr = responseText.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonStr);
        return {
            transcript: '',
            summary: '會議分析完成',
            minutes: {
                info: { title: '114年度新機房基礎架構建置技術小組進度會議紀錄', date: parsed.time || '', location: parsed.location || '', recorder: parsed.recorder || '' },
                attendees: {
                    companyLeaders: parsed.attendees?.nanshan ? [parsed.attendees.nanshan] : [],
                    technicalTeam: parsed.attendees?.tech_team ? [parsed.attendees.tech_team] : [],
                    pmTeam: parsed.attendees?.pm ? [parsed.attendees.pm] : [],
                    ibmTeam: parsed.attendees?.ibm ? [parsed.attendees.ibm] : [],
                    vendors: parsed.attendees?.vendors ? [parsed.attendees.vendors] : [],
                },
                keyPoints: [
                    { category: '1.機房搬遷', content: Array.isArray(parsed.topics?.relocation) ? parsed.topics.relocation : [parsed.topics?.relocation || '無'] },
                    { category: '2.機房服務', content: Array.isArray(parsed.topics?.service) ? parsed.topics.service : [parsed.topics?.service || '無'] },
                    { category: '3.網路、資安', content: Array.isArray(parsed.topics?.network_security) ? parsed.topics.network_security : [parsed.topics?.network_security || '無'] },
                    { category: '4.儲存', content: Array.isArray(parsed.topics?.storage) ? parsed.topics.storage : [parsed.topics?.storage || '無'] },
                    { category: '5.SAP（HW）', content: Array.isArray(parsed.topics?.sap_hw) ? parsed.topics.sap_hw : [parsed.topics?.sap_hw || '無'] },
                    { category: '6.文心機房搬遷', content: Array.isArray(parsed.topics?.wenxin) ? parsed.topics.wenxin : [parsed.topics?.wenxin || '無'] },
                    { category: '7.現代化顧問服務', content: Array.isArray(parsed.topics?.modernization) ? parsed.topics.modernization : [parsed.topics?.modernization || '無'] },
                ],
                actionItems: (parsed.action_items || []).map((item: string) => ({ description: item, status: 'pending' })),
                riskItems: (parsed.risks || []).map((item: string) => ({ description: item })),
                otherNotes: Array.isArray(parsed.others) ? parsed.others : [parsed.others || '無'],
                endTime: parsed.adjourn_time || '',
            },
        };
    } catch (e) {
        return { transcript: responseText, summary: '解析失敗', minutes: { info: { title: '會議紀錄', date: '' }, attendees: {}, keyPoints: [], actionItems: [], riskItems: [], otherNotes: [], endTime: '' } };
    }
}

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: any = { '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4a': 'audio/mp4' };
    return map[ext] || 'video/mp4';
}

function delay(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
