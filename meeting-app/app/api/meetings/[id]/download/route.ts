import { NextRequest, NextResponse } from 'next/server';
import { getMeetingById } from '@/lib/database';
import { generateMeetingDocument } from '@/lib/docx-generator';
import { MeetingMinutes } from '@/lib/types';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const meeting = getMeetingById(id);

        if (!meeting) {
            return NextResponse.json(
                {
                    success: false,
                    error: '找不到會議記錄',
                },
                { status: 404 }
            );
        }

        // 檢查是否有現成的 docx 檔案
        if (meeting.output_docx_path && existsSync(meeting.output_docx_path)) {
            const fileBuffer = await readFile(meeting.output_docx_path);

            // 生成檔案名稱
            const filename = `${meeting.title || 'meeting'}_${meeting.date || 'report'}.docx`;

            return new NextResponse(new Uint8Array(fileBuffer), {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
                },
            });
        }

        // 如果沒有現成檔案，即時生成
        if (!meeting.minutes_json) {
            return NextResponse.json(
                {
                    success: false,
                    error: '會議記錄尚未生成完成',
                },
                { status: 400 }
            );
        }

        const minutes: MeetingMinutes = JSON.parse(meeting.minutes_json);
        const docBuffer = await generateMeetingDocument(minutes);

        const filename = `${meeting.title || 'meeting'}_${meeting.date || 'report'}.docx`;

        return new NextResponse(new Uint8Array(docBuffer), {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            },
        });
    } catch (error) {
        console.error('下載 Word 文件錯誤:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '下載失敗',
            },
            { status: 500 }
        );
    }
}
