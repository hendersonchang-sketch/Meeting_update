import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createMeeting, updateMeeting } from '@/lib/database';
import { analyzeMeetingVideo } from '@/lib/gemini';
import { generateMeetingDocument } from '@/lib/docx-generator';
import { createLogger } from '@/lib/logger';

// 確保上傳目錄存在
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export async function POST(request: NextRequest) {
    const logger = createLogger('API.Upload');

    try {
        logger.info('收到上傳請求');

        // 確保上傳目錄存在
        if (!existsSync(UPLOAD_DIR)) {
            await mkdir(UPLOAD_DIR, { recursive: true });
            logger.debug('建立上傳目錄');
        }

        const formData = await request.formData();
        const id = uuidv4();
        const meetingDir = path.join(UPLOAD_DIR, id);
        await mkdir(meetingDir, { recursive: true });

        let videoPath: string | undefined;
        let pptxPath: string | undefined;
        let docxPath: string | undefined;
        let title = formData.get('title') as string || '未命名會議';
        let customerType = formData.get('customer_type') as string || 'nanshan';
        let customPrompt = formData.get('custom_prompt') as string || '';

        logger.info(`會議 ID: ${id}, 標題: ${title}, 客戶: ${customerType}`);

        // 處理上傳的檔案
        for (const [key, value] of formData.entries()) {
            if (value instanceof File && value.size > 0) {
                const bytes = await value.arrayBuffer();
                const buffer = Buffer.from(bytes);
                const filename = `${key}_${value.name}`;
                const filePath = path.join(meetingDir, filename);
                await writeFile(filePath, buffer);

                logger.info(`檔案已儲存: ${filename} (${(value.size / 1024 / 1024).toFixed(2)} MB)`);

                if (key === 'video' || value.name.match(/\.(mp4|mp3|wav|webm|mov|m4a)$/i)) {
                    videoPath = filePath;
                } else if (value.name.match(/\.pptx?$/i)) {
                    pptxPath = filePath;
                } else if (value.name.match(/\.docx?$/i)) {
                    docxPath = filePath;
                }
            }
        }

        // 從影片檔名提取標題（如果沒有提供）
        if (videoPath && title === '未命名會議') {
            const videoFilename = path.basename(videoPath);
            const match = videoFilename.match(/\[NSL\].*?(\d{8})/);
            if (match) {
                title = `NSL-技術小組進度會議-${match[1]}會議摘要`;
            }
        }

        // 建立資料庫記錄
        const meeting = createMeeting({
            id,
            title,
            status: 'processing',
            video_path: videoPath,
            pptx_path: pptxPath,
            docx_path: docxPath,
            customer_type: customerType,
            custom_prompt: customPrompt,
        });

        logger.info(`會議記錄已建立: ${id}`);

        if (!videoPath) {
            return NextResponse.json({ success: false, error: '未偵測到影音檔案' }, { status: 400 });
        }

        // 開始非同步分析（不等待完成）
        processVideoAsync(id, videoPath, customerType, customPrompt);

        return NextResponse.json({
            success: true,
            data: {
                id,
                message: '檔案上傳成功，正在分析中...',
                meeting,
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '上傳失敗';
        logger.error('上傳錯誤', { error: errorMessage });
        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
            },
            { status: 500 }
        );
    }
}

/**
 * 非同步處理影片分析
 */
async function processVideoAsync(
    meetingId: string,
    videoPath: string,
    customerType: string = 'nanshan',
    customPrompt: string = ''
) {
    const logger = createLogger('VideoProcessor', meetingId);

    try {
        if (!videoPath) {
            logger.error('未提供影音檔案');
            updateMeeting(meetingId, {
                status: 'failed',
                summary: '未提供影音檔案',
            });
            return;
        }

        logger.info('開始分析會議影片', { videoPath, customerType, hasCustomPrompt: !!customPrompt });

        // 使用 Gemini 分析影片
        logger.info('呼叫 Gemini API 進行分析...');
        const result = await analyzeMeetingVideo(videoPath, meetingId, customerType, customPrompt);

        logger.info('Gemini 分析完成', {
            transcriptLength: result.transcript?.length || 0,
            keyPointsCount: result.minutes?.keyPoints?.length || 0,
        });

        // 生成 Word 文件
        const outputDir = path.join(process.cwd(), 'outputs');
        if (!existsSync(outputDir)) {
            await mkdir(outputDir, { recursive: true });
        }

        const outputDocxPath = path.join(
            outputDir,
            `meeting_${meetingId}_${Date.now()}.docx`
        );

        logger.info('生成 Word 文件...', { customerType });
        const docBuffer = await generateMeetingDocument(result.minutes, customerType);
        await writeFile(outputDocxPath, docBuffer);
        logger.info('Word 文件已生成', { path: outputDocxPath });

        // 生成獨立的逐字稿文件
        const transcriptPath = path.join(
            outputDir,
            `transcript_${meetingId}_${Date.now()}.txt`
        );
        const transcriptContent = `會議逐字稿
================================================================================
會議標題：${result.minutes?.info?.title || '未知'}
日期：${result.minutes?.info?.date || '未知'}
================================================================================

${result.transcript || '無逐字稿內容'}
`;
        await writeFile(transcriptPath, transcriptContent, 'utf-8');
        logger.info('逐字稿文件已生成', { path: transcriptPath });

        // 更新資料庫
        updateMeeting(meetingId, {
            status: 'completed',
            transcript: result.transcript,
            summary: result.summary,
            minutes_json: JSON.stringify(result.minutes),
            output_docx_path: outputDocxPath,
        });

        logger.info('會議分析完成！');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '分析失敗';
        logger.error('會議分析失敗', { error: errorMessage });

        updateMeeting(meetingId, {
            status: 'failed',
            summary: errorMessage,
        });
    }
}
