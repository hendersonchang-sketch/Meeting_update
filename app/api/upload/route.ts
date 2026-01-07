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

        // 背景分析邏輯已移動至 /api/analyze，這裡只負責上傳
        writeLog({
            level: 'INFO',
            source: 'API/Upload',
            message: `檔案上傳成功，等待觸發分析: ${file.name}`,
            meeting_id: meetingId
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
