import { NextRequest, NextResponse } from 'next/server';
import { getMeetingById } from '@/lib/database';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
    const meetingId = resolvedParams.id;

    try {
        const meeting = getMeetingById(meetingId);

        if (!meeting) {
            return NextResponse.json(
                { success: false, error: '會議記錄不存在' },
                { status: 404 }
            );
        }

        if (!meeting.transcript) {
            return NextResponse.json(
                { success: false, error: '此會議記錄尚無逐字稿' },
                { status: 404 }
            );
        }

        // 建立逐字稿內容
        const transcriptContent = `會議逐字稿
================================================================================
會議標題：${meeting.title || '未知'}
日期：${meeting.date || '未知'}
================================================================================

${meeting.transcript}
`;

        // 返回文字檔案
        return new NextResponse(transcriptContent, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="transcript_${meetingId}.txt"`,
            },
        });
    } catch (error) {
        console.error('下載逐字稿失敗:', error);
        return NextResponse.json(
            { success: false, error: '下載逐字稿失敗' },
            { status: 500 }
        );
    }
}
