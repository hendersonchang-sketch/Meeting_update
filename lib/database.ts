import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { MeetingRecord } from './types';

// 確保資料庫目錄存在
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化資料庫
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'meetings.db');
const db = new Database(dbPath);

// 建立資料表
db.exec(`
  CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    title TEXT NOT NULL,
    date TEXT,
    status TEXT DEFAULT 'processing',
    video_path TEXT,
    pptx_path TEXT,
    docx_path TEXT,
    transcript TEXT,
    summary TEXT,
    minutes_json TEXT,
    output_docx_path TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL,
    source TEXT,
    message TEXT NOT NULL,
    details TEXT,
    meeting_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
  CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_meeting_id ON logs(meeting_id);
`);

// ==================== 會議記錄 CRUD ====================

/**
 * 建立新的會議記錄
 */
export function createMeeting(meeting: Partial<MeetingRecord>): MeetingRecord {
  const stmt = db.prepare(`
    INSERT INTO meetings (id, title, date, status, video_path, pptx_path, docx_path)
    VALUES (@id, @title, @date, @status, @video_path, @pptx_path, @docx_path)
  `);

  const now = new Date().toISOString();
  const record: MeetingRecord = {
    id: meeting.id!,
    created_at: now,
    updated_at: now,
    title: meeting.title || '未命名會議',
    date: meeting.date || now.split('T')[0],
    status: meeting.status || 'processing',
    video_path: meeting.video_path,
    pptx_path: meeting.pptx_path,
    docx_path: meeting.docx_path,
  };

  stmt.run(record);
  return record;
}

/**
 * 更新會議記錄
 */
export function updateMeeting(id: string, updates: Partial<MeetingRecord>): MeetingRecord | null {
  const fields = Object.keys(updates)
    .filter((key) => key !== 'id' && key !== 'created_at')
    .map((key) => `${key} = @${key}`)
    .join(', ');

  if (!fields) {
    return getMeetingById(id);
  }

  const stmt = db.prepare(`
    UPDATE meetings
    SET ${fields}, updated_at = @updated_at
    WHERE id = @id
  `);

  stmt.run({
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  });

  return getMeetingById(id);
}

/**
 * 根據 ID 取得會議記錄
 */
export function getMeetingById(id: string): MeetingRecord | null {
  const stmt = db.prepare('SELECT * FROM meetings WHERE id = ?');
  const row = stmt.get(id) as MeetingRecord | undefined;
  return row || null;
}

/**
 * 取得所有會議記錄
 */
export function getAllMeetings(): MeetingRecord[] {
  const stmt = db.prepare('SELECT * FROM meetings ORDER BY date DESC, created_at DESC');
  return stmt.all() as MeetingRecord[];
}

/**
 * 搜尋會議記錄
 */
export function searchMeetings(query: string): MeetingRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM meetings 
    WHERE title LIKE @query 
       OR transcript LIKE @query 
       OR summary LIKE @query
    ORDER BY date DESC
  `);
  return stmt.all({ query: `%${query}%` }) as MeetingRecord[];
}

/**
 * 根據日期範圍取得會議記錄
 */
export function getMeetingsByDateRange(startDate: string, endDate: string): MeetingRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM meetings 
    WHERE date >= @startDate AND date <= @endDate
    ORDER BY date DESC
  `);
  return stmt.all({ startDate, endDate }) as MeetingRecord[];
}

/**
 * 刪除會議記錄
 */
export function deleteMeeting(id: string): boolean {
  const stmt = db.prepare('DELETE FROM meetings WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * 清除所有會議記錄 (開發用)
 */
export function clearAllMeetings(): void {
  const stmt = db.prepare('DELETE FROM meetings');
  stmt.run();
}

/**
 * 取得會議統計
 */
export function getMeetingStats(): {
  total: number;
  completed: number;
  processing: number;
  failed: number;
} {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM meetings
  `);
  const row = stmt.get() as {
    total: number;
    completed: number;
    processing: number;
    failed: number;
  };
  return row;
}

// ==================== 設定 CRUD ====================

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

/**
 * 取得設定值
 */
export function getSetting(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value || null;
}

/**
 * 設定值
 */
export function setSetting(key: string, value: string): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at)
    VALUES (@key, @value, @updated_at)
  `);
  stmt.run({ key, value, updated_at: new Date().toISOString() });
}

/**
 * 取得所有設定
 */
export function getAllSettings(): Setting[] {
  const stmt = db.prepare('SELECT * FROM settings');
  return stmt.all() as Setting[];
}

/**
 * 檢查 API Key 是否已設定
 */
export function hasApiKey(): boolean {
  const apiKey = getSetting('gemini_api_key');
  return !!apiKey && apiKey.length > 0;
}

/**
 * 取得 API Key（遮蔽顯示）
 */
export function getMaskedApiKey(): string | null {
  const apiKey = getSetting('gemini_api_key');
  if (!apiKey) return null;
  // 只顯示前 4 碼和後 4 碼
  if (apiKey.length <= 8) return '****';
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

// ==================== 日誌 CRUD ====================

export interface LogEntry {
  id?: number;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  source: string;
  message: string;
  details?: string;
  meeting_id?: string;
}

/**
 * 寫入日誌
 */
export function writeLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
  const stmt = db.prepare(`
    INSERT INTO logs (timestamp, level, source, message, details, meeting_id)
    VALUES (@timestamp, @level, @source, @message, @details, @meeting_id)
  `);
  stmt.run({
    timestamp: new Date().toISOString(),
    level: entry.level,
    source: entry.source,
    message: entry.message,
    details: entry.details || null,
    meeting_id: entry.meeting_id || null,
  });
}

/**
 * 取得最近的日誌
 */
export function getRecentLogs(limit: number = 100): LogEntry[] {
  const stmt = db.prepare(`
    SELECT * FROM logs 
    ORDER BY timestamp DESC 
    LIMIT ?
  `);
  return stmt.all(limit) as LogEntry[];
}

/**
 * 取得特定會議的日誌
 */
export function getLogsByMeetingId(meetingId: string): LogEntry[] {
  const stmt = db.prepare(`
    SELECT * FROM logs 
    WHERE meeting_id = ?
    ORDER BY timestamp ASC
  `);
  return stmt.all(meetingId) as LogEntry[];
}

/**
 * 清除舊日誌（保留最近 N 筆）
 */
export function clearOldLogs(keepCount: number = 1000): number {
  const stmt = db.prepare(`
    DELETE FROM logs 
    WHERE id NOT IN (
      SELECT id FROM logs ORDER BY timestamp DESC LIMIT ?
    )
  `);
  const result = stmt.run(keepCount);
  return result.changes;
}

/**
 * 清除所有日誌
 */
export function clearAllLogs(): number {
  const stmt = db.prepare('DELETE FROM logs');
  const result = stmt.run();
  return result.changes;
}

export default db;
