import { NextRequest, NextResponse } from 'next/server';
import { getAllMeetings, getMeetingStats, getLatestLogByMeetingId } from '@/lib/database';

export async function GET(request: NextRequest) {
    try {
        const meetings = getAllMeetings();
        const stats = getMeetingStats();

        // 注入最新的處理日誌
        meetings.forEach(meeting => {
            if (meeting.status === 'processing') {
                const latestLog = getLatestLogByMeetingId(meeting.id);
                if (latestLog) {
                    meeting.latestLog = latestLog.message;
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                meetings,
                stats,
            },
        });
    } catch (error) {
        console.error('取得會議列表錯誤:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '取得會議列表失敗',
            },
            { status: 500 }
        );
    }
}
