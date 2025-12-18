import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createMeeting, updateMeeting, writeLog } from '@/lib/database';
import { analyzeMeetingVideo } from '@/lib/gemini';
import { MeetingRecord } from '@/lib/types';
import * as fs from 'fs';

// 確保上傳目錄存在
const uploadDir = join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('video') as File || formData.get('pptx') as File || formData.get('docx') as File;
        const title = formData.get('title') as string;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file uploaded' },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileExtension = file.name.split('.').pop();
        const filename = `${uuidv4()}.${fileExtension}`;
        const filepath = join(uploadDir, filename);

        // 寫入檔案
        await writeFile(filepath, buffer);

        const meetingId = uuidv4();
        const now = new Date().toISOString();

        // 建立資料庫記錄
        const meetingData: Partial<MeetingRecord> = {
            id: meetingId,
            title: title || file.name,
            date: now.split('T')[0],
            status: 'processing',
            video_path: filepath, // 這裡統稱 video_path，雖然可能是 pptx/docx，視欄位設計而定
        };

        // 根據檔案類型調整路徑存儲 (雖然目前 DB schema 主要是 video_path 比較重要)
        if (file.name.match(/\.pptx?$/i)) {
            meetingData.pptx_path = filepath;
            meetingData.video_path = ''; // Clear video path if it's pptx
        } else if (file.name.match(/\.docx?$/i)) {
            meetingData.docx_path = filepath;
            meetingData.video_path = '';
        }

        createMeeting(meetingData);

        writeLog({
            level: 'INFO',
            source: 'API/Upload',
            message: `檔案上傳成功: ${file.name}`,
            meeting_id: meetingId
        });

        // 非同步開始分析 (Fire and Forget)
        // 注意：在 Vercel 等 Serverless 環境這種寫法不安全，但在本地 Node server 是可以的
        processNextTick(async () => {
            try {
                writeLog({ level: 'INFO', source: 'BackgroundJob', message: '開始分析任務', meeting_id: meetingId });

                // 這裡假設只處理影片/音訊，若是 PPT/Docx 需額外處理 (目前 analyzeMeetingVideo 若傳入非影音可能會錯，需檢查 fileExtension)
                if (file.name.match(/\.(mp4|mp3|wav|webm|mov|m4a)$/i)) {
                    // 使用 Transcript-First 流程
                    const result = await analyzeMeetingVideo(filepath, meetingId);

                    updateMeeting(meetingId, {
                        status: 'completed',
                        transcript: result.transcript,
                        summary: result.summary,
                        minutes_json: JSON.stringify(result.minutes)
                    });

                    writeLog({ level: 'INFO', source: 'BackgroundJob', message: '分析任務完成', meeting_id: meetingId });
                } else {
                    // 暫不處理 PPTX/DOCX 的自動分析，先標記完成
                    updateMeeting(meetingId, { status: 'completed' });
                    writeLog({ level: 'INFO', source: 'BackgroundJob', message: '文件上傳已儲存 (尚未實作自動分析)', meeting_id: meetingId });
                }

            } catch (error) {
                console.error('Background Analysis Error:', error);
                const errMsg = error instanceof Error ? error.message : 'Unknown error';

                updateMeeting(meetingId, { status: 'failed' });
                writeLog({
                    level: 'ERROR',
                    source: 'BackgroundJob',
                    message: '分析任務失敗',
                    details: errMsg,
                    meeting_id: meetingId
                });
            }
        });

        return NextResponse.json({
            success: true,
            message: 'File uploaded successfully',
            data: { meetingId }
        });

    } catch (error) {
        console.error('Upload Error:', error);
        return NextResponse.json(
            { success: false, error: 'Upload failed' },
            { status: 500 }
        );
    }
}

// Helper shim for cleaning up background execution context in Next.js if needed
function processNextTick(fn: () => Promise<void>) {
    setTimeout(fn, 100);
}
