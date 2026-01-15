import { NextResponse } from 'next/server';
import { getMeetingById, updateMeeting, writeLog } from '@/lib/database';

/**
 * POST /api/analyze/abort
 * 中斷正在進行的分析任務
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { meetingId } = body;

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

        // 只有 processing 狀態才能中斷
        if (meeting.status !== 'processing') {
            return NextResponse.json(
                { success: false, error: `無法中斷：目前狀態為 ${meeting.status}` },
                { status: 400 }
            );
        }

        // 更新狀態為 aborted
        updateMeeting(meetingId, { status: 'aborted' as any });

        writeLog({
            level: 'WARN',
            source: 'API/Abort',
            message: '使用者手動中斷分析',
            meeting_id: meetingId,
        });

        return NextResponse.json({
            success: true,
            message: '分析已中斷',
        });
    } catch (error) {
        console.error('Abort error:', error);
        return NextResponse.json(
            { success: false, error: '中斷失敗' },
            { status: 500 }
        );
    }
}
