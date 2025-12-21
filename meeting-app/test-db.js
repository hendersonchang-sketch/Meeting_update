const { getAllMeetings, getMeetingStats } = require('./meeting-app/.next/server/chunks/lib_database_ts.js');
// Wait, I can't easily require ts files or next chunks.
// I'll use jiti or ts-node if available, or just create a plain JS version of the logic.

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'meetings.db');
const db = new Database(DB_PATH);

try {
    console.log('測試 getAllMeetings...');
    const meetings = db.prepare('SELECT * FROM meetings ORDER BY created_at DESC').all();
    console.log('成功取得會議數量:', meetings.length);

    console.log('測試 getMeetingStats...');
    const total = db.prepare('SELECT COUNT(*) as count FROM meetings').get().count;
    const completed = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'completed'").get().count;
    const processing = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'processing'").get().count;
    const failed = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'failed'").get().count;
    console.log('成功取得統計數據:', { total, completed, processing, failed });

} catch (error) {
    console.error('測試失敗，錯誤原因:', error.message);
    console.error(error.stack);
} finally {
    db.close();
}
