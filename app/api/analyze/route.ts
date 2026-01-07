import { NextResponse } from 'next/server';
import { analyzeMeetingVideoWithAutoSplit, analyzePPTX } from '@/lib/gemini';
import { updateMeeting, writeLog, getMeetingById } from '@/lib/database';
import { saveMeetingDocument } from '@/lib/docx-generator';
import * as fs from 'fs';
import * as path from 'path';

// 設置最大執行時間為 5 分鐘 (或更長，視 Vercel/伺服器設定而定)
export const maxDuration = 300;

export async function POST(request: Request) {
    let meetingId = '';

    try {
        const body = await request.json();
        const { meetingId: id, role } = body; // Extract role
        meetingId = id;

        if (!meetingId) {
            return NextResponse.json(
                { success: false, error: 'Meeting ID is required' },
                { status: 400 }
            );
        }

        const meeting = getMeetingById(meetingId);
        if (!meeting) {
            return NextResponse.json(
                { success: false, error: 'Meeting not found' },
                { status: 404 }
            );
        }

        writeLog({ level: 'INFO', source: 'API/Analyze', message: '收到分析請求', meeting_id: meetingId });

        // 檢查檔案類型並執行對應分析
        // 目前只支援影片/音訊分析 (video_path)
        if (meeting.video_path && meeting.video_path.match(/\.(mp4|mp3|wav|webm|mov|m4a)$/i)) {
            // 步驟 1：檢查是否有 PPTX 檔案，若有則先分析作為上下文
            let pptxContext = '';
            if (meeting.pptx_path && fs.existsSync(meeting.pptx_path)) {
                try {
                    writeLog({ level: 'INFO', source: 'API/Analyze', message: '偵測到 PPTX 檔案，開始分析簡報內容', meeting_id: meetingId });

                    // 讀取 PPTX 檔案（簡單讀取為文字，實際可使用 pptx 解析套件）
                    const pptxContent = fs.readFileSync(meeting.pptx_path, 'utf-8');
                    pptxContext = await analyzePPTX(pptxContent);

                    writeLog({ level: 'INFO', source: 'API/Analyze', message: 'PPTX 分析完成，將作為會議分析的參考上下文', meeting_id: meetingId });
                } catch (pptxError) {
                    writeLog({ level: 'WARN', source: 'API/Analyze', message: 'PPTX 分析失敗，將忽略簡報內容', details: String(pptxError), meeting_id: meetingId });
                    // 不中斷流程，繼續進行影片分析
                }
            }

            // 步驟 2：執行影片分析（智慧切分模式）
            writeLog({ level: 'INFO', source: 'API/Analyze', message: `開始執行影音分析（智慧切分模式）(Role: ${role || 'secretary'})${pptxContext ? ' [含PPTX上下文]' : ''}`, meeting_id: meetingId });

            // 執行分析（使用自動切分功能，並傳入 PPTX 上下文）
            const result = await analyzeMeetingVideoWithAutoSplit(
                meeting.video_path,
                meetingId,
                pptxContext || undefined,  // 將 PPTX 分析結果作為上下文
                role
            );

            // 自動生成 Word 文件
            let docxPath = '';
            try {
                const outputDir = path.join(process.cwd(), 'outputs');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                const filename = `meeting_${meetingId}_${Date.now()}.docx`;
                docxPath = path.join(outputDir, filename);

                // --- 結構相容性處理 ---
                // AI 有時會直接回傳 MeetingMinutes 物件，而不是包在 minutes 屬性裡
                let minutesData = result.minutes;
                if (!minutesData && (result as any).info) {
                    // 假設 result 本身就是 MeetingMinutes 結構
                    minutesData = result as any;
                    // 同時修正 result 結構以便存入 DB
                    result.minutes = minutesData;
                }

                if (!minutesData || !minutesData.info) {
                    console.error('Invalid Minutes Data Structure:', JSON.stringify(minutesData, null, 2));
                    const keys = minutesData ? Object.keys(minutesData).join(', ') : 'null';
                    throw new Error(`Meeting minutes structure is invalid (missing info). Keys found: ${keys}`);
                }
                // -----------------------

                await saveMeetingDocument(minutesData, docxPath);
                writeLog({ level: 'INFO', source: 'API/Analyze', message: 'Word 文件生成成功', meeting_id: meetingId });
            } catch (docError) {
                console.error('DOCX Generation Error:', docError);
                writeLog({ level: 'ERROR', source: 'API/Analyze', message: 'Word 文件生成失敗', details: String(docError), meeting_id: meetingId });
            }

            // 更新資料庫
            updateMeeting(meetingId, {
                status: 'completed',
                transcript: result.transcript,
                summary: result.summary,
                minutes_json: JSON.stringify(result.minutes),
                output_docx_path: docxPath // 儲存檔案路徑
            });

            writeLog({ level: 'INFO', source: 'API/Analyze', message: '分析完成並已儲存', meeting_id: meetingId });

            return NextResponse.json({
                success: true,
                message: 'Analysis completed successfully',
                data: {
                    transcript: result.transcript,
                    summary: result.summary
                }
            });
        } else {
            // 暫時處理非影音檔
            updateMeeting(meetingId, { status: 'completed' });
            writeLog({ level: 'WARN', source: 'API/Analyze', message: '檔案類型暫不支援自動分析，標記為完成', meeting_id: meetingId });

            return NextResponse.json({
                success: true,
                message: 'File type not supported for auto-analysis yet, marked as completed'
            });
        }

    } catch (error) {
        console.error('Analysis API Error:', error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error';

        if (meetingId) {
            updateMeeting(meetingId, { status: 'failed' });
            writeLog({
                level: 'ERROR',
                source: 'API/Analyze',
                message: '分析過程發生錯誤',
                details: errMsg,
                meeting_id: meetingId
            });
        }

        return NextResponse.json(
            { success: false, error: 'Analysis failed: ' + errMsg },
            { status: 500 }
        );
    }
}
