// 日誌記錄模組
import { writeLog } from './database';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
    debug: (message: string, details?: Record<string, unknown>) => void;
    info: (message: string, details?: Record<string, unknown>) => void;
    warn: (message: string, details?: Record<string, unknown>) => void;
    error: (message: string, details?: Record<string, unknown>) => void;
}

function formatDetails(details?: Record<string, unknown>): string | undefined {
    if (!details) return undefined;
    try {
        return JSON.stringify(details);
    } catch {
        return String(details);
    }
}

export function createLogger(source: string, meetingId?: string): Logger {
    const log = (level: LogLevel, message: string, details?: Record<string, unknown>) => {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] [${source}]`;
        const detailsStr = formatDetails(details);

        // 輸出到 console
        const consoleMessage = detailsStr ? `${prefix} ${message} ${detailsStr}` : `${prefix} ${message}`;
        switch (level) {
            case 'debug':
                console.debug(consoleMessage);
                break;
            case 'info':
                console.info(consoleMessage);
                break;
            case 'warn':
                console.warn(consoleMessage);
                break;
            case 'error':
                console.error(consoleMessage);
                break;
        }

        // 寫入資料庫
        try {
            writeLog({
                level,
                source,
                message,
                details: detailsStr,
                meeting_id: meetingId,
            });
        } catch (err) {
            console.error('寫入日誌失敗:', err);
        }
    };

    return {
        debug: (message, details) => log('debug', message, details),
        info: (message, details) => log('info', message, details),
        warn: (message, details) => log('warn', message, details),
        error: (message, details) => log('error', message, details),
    };
}
