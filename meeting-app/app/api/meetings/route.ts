import { NextResponse } from 'next/server';
import { getAllMeetings, getMeetingStats } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const meetings = getAllMeetings();
        const stats = getMeetingStats();

        return NextResponse.json({
            success: true,
            data: {
                meetings,
                stats
            }
        });
    } catch (error) {
        console.error('Meetings API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch meetings' },
            { status: 500 }
        );
    }
}
