const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(process.cwd(), 'data', 'meetings.db');

// 確保目錄存在
if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);

try {
    console.log('--- 啟動全面資料庫結構檢核 ---');

    // 獲取現有欄位訊息
    const info = db.prepare("PRAGMA table_info(meetings)").all();
    const columnNames = info.map(col => col.name);
    console.log('目前欄位:', columnNames.join(', '));

    // 檢查並新增 customer_type
    if (!columnNames.includes('customer_type')) {
        console.log('正在修復: 新增 customer_type 欄位...');
        db.prepare("ALTER TABLE meetings ADD COLUMN customer_type TEXT DEFAULT 'nanshan'").run();
        console.log('>> customer_type 新增成功');
    }

    // 檢查並新增 custom_prompt
    if (!columnNames.includes('custom_prompt')) {
        console.log('正在修復: 新增 custom_prompt 欄位...');
        db.prepare("ALTER TABLE meetings ADD COLUMN custom_prompt TEXT").run();
        console.log('>> custom_prompt 新增成功');
    }

    console.log('--- 資料庫遷移完成，所有欄位已就緒 ---');
} catch (error) {
    console.error('!!! 遷移過程中發生錯誤:', error.message);
} finally {
    db.close();
}
