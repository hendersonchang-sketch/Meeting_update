
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import Database from 'better-sqlite3';
import * as path from 'path';

dotenv.config();

async function main() {
    let apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        try {
            const dbPath = path.join(process.cwd(), 'meeting.db');
            const db = new Database(dbPath);
            const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key') as { value: string } | undefined;
            if (row) apiKey = row.value;
        } catch (e) {
            console.error('Error reading DB:', e);
        }
    }

    if (!apiKey) {
        console.error('No API Key found. Please set GEMINI_API_KEY in .env or database.');
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelsToTry = [
        'gemini-3.0-flash-exp',
        'gemini-3-flash-preview',
        'gemini-3.0-flash',
        'gemini-2.0-flash-exp' // Control
    ];

    console.log('Testing models with API Key:', apiKey.substring(0, 5) + '...');

    for (const modelName of modelsToTry) {
        process.stdout.write(`Testing ${modelName}... `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Hi');
            await result.response;
            console.log('SUCCESS! ✅');
        } catch (e: any) {
            if (e.message.includes('404') || e.message.includes('not found')) {
                console.log('NOT FOUND ❌');
            } else {
                console.log(`ERROR: ${e.message} ⚠️`);
            }
        }
    }
}

main();
