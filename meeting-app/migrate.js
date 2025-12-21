const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'meetings.db');
const db = new Database(DB_PATH);

try {
    console.log('正在檢查並升級資料庫...');

    // 檢查 custom_prompt 欄位是否存在
    const info = db.prepare("PRAGMA table_info(meetings)").all();
    const hasCustomPrompt = info.some(col => col.name === 'custom_prompt');

    if (!hasCustomPrompt) {
        console.log('正在新增 custom_prompt 欄位...');
        db.prepare("ALTER TABLE meetings ADD COLUMN custom_prompt TEXT").run();
        console.log('custom_prompt 欄位新增成功！');
    } else {
        console.log('custom_prompt 欄位已存在。');
    }

    console.log('資料庫升級完成。');
} catch (error) {
    console.error('升級失敗:', error);
} finally {
    db.close();
}
