import { NextRequest, NextResponse } from 'next/server';
import { getMeetingById, updateMeeting } from '@/lib/database';
import { saveMeetingDocument } from '@/lib/docx-generator';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const meeting = getMeetingById(id);

        if (!meeting) {
            return new NextResponse('Meeting not found', { status: 404 });
        }
        let docxPath = meeting.output_docx_path;
        let fileExists = docxPath && fs.existsSync(docxPath);

        // 優先從現有的 JSON 重新生成 Word 檔，以確保最新的格式（docx-generator.ts）被套用
        if (meeting.minutes_json) {
            try {
                const minutes = JSON.parse(meeting.minutes_json);
                const outputDir = path.join(process.cwd(), 'outputs');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                // 產生新的檔名（增加時間戳記避免快取）
                const filename = `meeting_${id}_${Date.now()}.docx`;
                docxPath = path.join(outputDir, filename);

                await saveMeetingDocument(minutes, docxPath);

                // 更新資料庫中的路徑，下次下載如果不想重打也可以，但這裡我們為了保險起見每次都重產或是有 JSON 就重產
                updateMeeting(id, { output_docx_path: docxPath });
                fileExists = true;
            } catch (genError) {
                console.error('Failed to generate DOCX on the fly:', genError);
                // 如果重產失敗且舊檔還在，就勉強用舊檔
                if (docxPath && fs.existsSync(docxPath)) {
                    fileExists = true;
                }
            }
        }

        if (!fileExists || !docxPath) {
            return new NextResponse('Word document not available yet. Please wait for analysis to complete or check if it failed.', { status: 404 });
        }

        // 讀取檔案並返回
        const fileBuffer = fs.readFileSync(docxPath);
        const filename = meeting.title
            ? `${meeting.title.replace(/[\\/:*?"<>|]/g, '_')}.docx`
            : `meeting_${id}.docx`;

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            },
        });

    } catch (error) {
        console.error('Download API Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
