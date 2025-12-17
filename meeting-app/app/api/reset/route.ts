import { NextRequest, NextResponse } from 'next/server';
import { clearAllMeetings, clearAllLogs, writeLog } from '@/lib/database';
import { createLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    const logger = createLogger('API.Reset');
    logger.warn('收到系統重置請求');

    try {
        clearAllMeetings();
        clearAllLogs();

        // 寫入一筆新的日誌表示重置完成
        logger.info('系統資料已重置 (會議記錄與日誌已清除)');

        return NextResponse.json({
            success: true,
            message: '系統已重置'
        });
    } catch (error) {
        console.error('系統重置失敗:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '重置失敗',
            },
            { status: 500 }
        );
    }
}
