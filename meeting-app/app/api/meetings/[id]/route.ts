import { NextRequest, NextResponse } from 'next/server';
import { getMeetingById, updateMeeting, deleteMeeting } from '@/lib/database';
import { MeetingMinutes } from '@/lib/types';

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

        // 解析 minutes_json
        let minutes: MeetingMinutes | null = null;
        if (meeting.minutes_json) {
            try {
                minutes = JSON.parse(meeting.minutes_json);
            } catch {
                console.error('解析 minutes_json 失敗');
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                ...meeting,
                minutes,
            },
        });
    } catch (error) {
        console.error('取得會議詳情錯誤:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '取得會議詳情失敗',
            },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

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

        // 如果更新 minutes，轉換為 JSON 字串
        if (body.minutes) {
            body.minutes_json = JSON.stringify(body.minutes);
            delete body.minutes;
        }

        const updated = updateMeeting(id, body);

        return NextResponse.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        console.error('更新會議錯誤:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '更新會議失敗',
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const success = deleteMeeting(id);

        if (!success) {
            return NextResponse.json(
                {
                    success: false,
                    error: '找不到會議記錄',
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: '會議記錄已刪除',
        });
    } catch (error) {
        console.error('刪除會議錯誤:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '刪除會議失敗',
            },
            { status: 500 }
        );
    }
}
