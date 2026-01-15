import { NextResponse } from 'next/server';
import { getRecentLogs, clearAllLogs } from '@/lib/database';

export const dynamic = 'force-dynamic';

// GET: 取得日誌
export async function GET() {
    try {
        const logs = getRecentLogs(100);
        return NextResponse.json({
            success: true,
            data: { logs }
        });
    } catch (error) {
        console.error('Logs API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch logs' },
            { status: 500 }
        );
    }
}

// DELETE: 清除日誌
export async function DELETE() {
    try {
        clearAllLogs();
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Failed to clear logs' },
            { status: 500 }
        );
    }
}
