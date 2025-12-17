// 資料庫模組 - 使用 better-sqlite3
import Database from 'better-sqlite3';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Meeting, MeetingStats, LogEntry } from './types';

// 資料庫路徑
const DB_PATH = path.join(process.cwd(), 'data', 'meetings.db');

// 建立資料庫連線
let db: Database.Database | null = null;

function getDb(): Database.Database {
    if (!db) {
        db = new Database(DB_PATH);
        initDatabase();
    }
    return db;
}

// 初始化資料庫
function initDatabase() {
    const database = getDb();

    // 建立會議表
    database.exec(`
        CREATE TABLE IF NOT EXISTS meetings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            status TEXT DEFAULT 'processing',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            video_path TEXT,
            pptx_path TEXT,
            docx_path TEXT,
            transcript TEXT,
            summary TEXT,
            minutes_json TEXT,
            output_docx_path TEXT
        )
    `);

    // 建立日誌表
    database.exec(`
        CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            source TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT,
            meeting_id TEXT
        )
    `);
}

// 會議 CRUD 操作
export function getAllMeetings(): Meeting[] {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM meetings ORDER BY created_at DESC');
    return stmt.all() as Meeting[];
}

export function getMeetingById(id: string): Meeting | undefined {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM meetings WHERE id = ?');
    return stmt.get(id) as Meeting | undefined;
}

export function createMeeting(data: {
    id?: string;
    title: string;
    status?: string;
    video_path?: string;
    pptx_path?: string;
    docx_path?: string;
}): Meeting {
    const database = getDb();
    const now = new Date().toISOString();
    const id = data.id || uuidv4();

    const meeting: Meeting = {
        id,
        title: data.title,
        date: now.split('T')[0],
        status: (data.status as Meeting['status']) || 'processing',
        created_at: now,
        updated_at: now,
        video_path: data.video_path,
        pptx_path: data.pptx_path,
        docx_path: data.docx_path,
    };

    const stmt = database.prepare(`
        INSERT INTO meetings (id, title, date, status, created_at, updated_at, video_path, pptx_path, docx_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        meeting.id,
        meeting.title,
        meeting.date,
        meeting.status,
        meeting.created_at,
        meeting.updated_at,
        meeting.video_path || null,
        meeting.pptx_path || null,
        meeting.docx_path || null
    );

    return meeting;
}

export function updateMeeting(id: string, data: Partial<Meeting>): void {
    const database = getDb();
    const now = new Date().toISOString();

    const fields: string[] = ['updated_at = ?'];
    const values: (string | null)[] = [now];

    if (data.status !== undefined) {
        fields.push('status = ?');
        values.push(data.status);
    }
    if (data.transcript !== undefined) {
        fields.push('transcript = ?');
        values.push(data.transcript);
    }
    if (data.summary !== undefined) {
        fields.push('summary = ?');
        values.push(data.summary);
    }
    if (data.minutes_json !== undefined) {
        fields.push('minutes_json = ?');
        values.push(data.minutes_json);
    }
    if (data.output_docx_path !== undefined) {
        fields.push('output_docx_path = ?');
        values.push(data.output_docx_path);
    }

    values.push(id);

    const stmt = database.prepare(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
}

export function getMeetingStats(): MeetingStats {
    const database = getDb();
    const total = (database.prepare('SELECT COUNT(*) as count FROM meetings').get() as { count: number }).count;
    const completed = (database.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'completed'").get() as { count: number }).count;
    const processing = (database.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'processing'").get() as { count: number }).count;
    const failed = (database.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'failed'").get() as { count: number }).count;


    return { total, completed, processing, failed };
}

export function deleteMeeting(id: string): boolean {
    const database = getDb();
    const meeting = getMeetingById(id);
    if (!meeting) return false;

    const stmt = database.prepare('DELETE FROM meetings WHERE id = ?');
    stmt.run(id);
    return true;
}

export function clearAllMeetings(): void {
    const database = getDb();
    database.exec('DELETE FROM meetings');
}

// 日誌操作
export function writeLog(data: {
    level: string;
    source: string;
    message: string;
    details?: string;
    meeting_id?: string;
}): void {
    const database = getDb();
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const stmt = database.prepare(`
        INSERT INTO logs (id, timestamp, level, source, message, details, meeting_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        String(id),
        String(timestamp),
        String(data.level),
        String(data.source),
        String(data.message),
        data.details ? String(data.details) : null,
        data.meeting_id ? String(data.meeting_id) : null
    );
}

export function getAllLogs(limit = 100): LogEntry[] {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit) as LogEntry[];
}

export function clearAllLogs(): number {
    const database = getDb();
    const result = database.prepare('SELECT COUNT(*) as count FROM logs').get() as { count: number };
    database.exec('DELETE FROM logs');
    return result.count;
}

export function getRecentLogs(limit = 100): LogEntry[] {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit) as LogEntry[];
}

export function getLogsByMeetingId(meetingId: string): LogEntry[] {
    const database = getDb();
    const stmt = database.prepare('SELECT * FROM logs WHERE meeting_id = ? ORDER BY timestamp DESC');
    return stmt.all(meetingId) as LogEntry[];
}

// ========== 設定操作 ==========

// 確保設定表存在
function ensureSettingsTable() {
    const database = getDb();
    database.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);
}

export function getSetting(key: string): string | null {
    const database = getDb();
    ensureSettingsTable();
    const stmt = database.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value || null;
}

export function setSetting(key: string, value: string): void {
    const database = getDb();
    ensureSettingsTable();
    const stmt = database.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, value);
}

export function hasApiKey(): boolean {
    const apiKey = getSetting('gemini_api_key');
    return !!apiKey && apiKey.length > 0;
}

export function getApiKey(): string | null {
    return getSetting('gemini_api_key');
}

export function getMaskedApiKey(): string | null {
    const apiKey = getSetting('gemini_api_key');
    if (!apiKey) return null;
    if (apiKey.length < 8) return '***';
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
