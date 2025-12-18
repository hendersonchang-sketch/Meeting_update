import { writeLog, LogEntry } from './database';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
    private source: string;
    private meetingId?: string;

    constructor(source: string, meetingId?: string) {
        this.source = source;
        this.meetingId = meetingId;
    }

    private log(level: LogLevel, message: string, details?: unknown): void {
        const detailsStr = details ? JSON.stringify(details, null, 2) : undefined;

        // 寫入資料庫
        writeLog({
            level,
            source: this.source,
            message,
            details: detailsStr,
            meeting_id: this.meetingId,
        });

        // 同時輸出到 console
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${this.source}]`;

        switch (level) {
            case 'ERROR':
                console.error(prefix, message, details || '');
                break;
            case 'WARN':
                console.warn(prefix, message, details || '');
                break;
            case 'DEBUG':
                console.debug(prefix, message, details || '');
                break;
            default:
                console.log(prefix, message, details || '');
        }
    }

    debug(message: string, details?: unknown): void {
        this.log('DEBUG', message, details);
    }

    info(message: string, details?: unknown): void {
        this.log('INFO', message, details);
    }

    warn(message: string, details?: unknown): void {
        this.log('WARN', message, details);
    }

    error(message: string, details?: unknown): void {
        this.log('ERROR', message, details);
    }

    /**
     * 建立子 Logger（繼承 meetingId）
     */
    child(source: string): Logger {
        return new Logger(source, this.meetingId);
    }

    /**
     * 設定 meetingId
     */
    setMeetingId(meetingId: string): void {
        this.meetingId = meetingId;
    }
}

/**
 * 建立 Logger 實例
 */
export function createLogger(source: string, meetingId?: string): Logger {
    return new Logger(source, meetingId);
}

/**
 * 預設 Logger
 */
export const logger = new Logger('App');

export default Logger;
