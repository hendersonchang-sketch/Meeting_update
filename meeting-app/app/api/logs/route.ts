import { NextRequest, NextResponse } from 'next/server';
import { getRecentLogs, getLogsByMeetingId, clearAllLogs } from '@/lib/database';

/**
 * GET /api/logs - 取得日誌
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const meetingId = searchParams.get('meetingId');
        const limit = parseInt(searchParams.get('limit') || '100');

        let logs;
        if (meetingId) {
            logs = getLogsByMeetingId(meetingId);
        } else {
            logs = getRecentLogs(limit);
        }

        return NextResponse.json({
            success: true,
            data: logs,
        });
    } catch (error) {
        console.error('取得日誌失敗:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '取得日誌失敗',
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/logs - 清除日誌
 */
export async function DELETE() {
    try {
        const count = clearAllLogs();

        return NextResponse.json({
            success: true,
            message: `已清除 ${count} 筆日誌`,
        });
    } catch (error) {
        console.error('清除日誌失敗:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '清除日誌失敗',
            },
            { status: 500 }
        );
    }
}
