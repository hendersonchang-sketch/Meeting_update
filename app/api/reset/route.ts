
import { NextResponse } from 'next/server';
import { clearAllMeetings, clearAllLogs } from '@/lib/database';
import * as fs from 'fs';
import * as path from 'path';

export async function POST() {
    try {
        console.log('[API] Starting system reset...');

        // 1. 清空資料庫
        const meetingsDeleted = clearAllMeetings();
        const logsDeleted = clearAllLogs();
        console.log(`[API] Database cleared. Meetings: ${meetingsDeleted}, Logs: ${logsDeleted}`);

        // 2. 清空檔案系統 (uploads 和 outputs)
        const uploadsDir = path.join(process.cwd(), 'uploads');
        // ... rest of the code
        const outputsDir = path.join(process.cwd(), 'outputs');

        const cleanDirectory = (dirPath: string) => {
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                for (const file of files) {
                    if (file === '.gitkeep') continue; // 保留 .gitkeep
                    const filePath = path.join(dirPath, file);
                    try {
                        if (fs.lstatSync(filePath).isDirectory()) {
                            fs.rmSync(filePath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    } catch (e) {
                        console.error(`Failed to delete ${filePath}:`, e);
                    }
                }
            }
        };

        cleanDirectory(uploadsDir);
        cleanDirectory(outputsDir);

        return NextResponse.json({
            success: true,
            message: 'System reset successfully',
            details: {
                meetingsDeleted,
                logsDeleted,
                dbPath: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'meetings.db')
            }
        });
    } catch (error) {
        console.error('Reset API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to reset system' },
            { status: 500 }
        );
    }
}
