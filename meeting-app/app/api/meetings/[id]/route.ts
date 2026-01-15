import { NextRequest, NextResponse } from 'next/server';
import { getMeetingById } from '@/lib/database';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const meeting = getMeetingById(id);

        if (!meeting) {
            return NextResponse.json(
                { success: false, error: 'Meeting not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: meeting
        });
    } catch (error) {
        console.error('Fetch Meeting Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
