
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Simple .env parser since dotenv is missing
function loadEnv() {
    try {
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join('=').trim();
                    if (key && !process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
        }

        const envLocalPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envLocalPath)) {
            const content = fs.readFileSync(envLocalPath, 'utf-8');
            content.split('\n').forEach(line => {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join('=').trim();
                    if (key && !process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
        }
    } catch (e) {
        console.error('Error loading .env:', e);
    }
}

loadEnv();

async function main() {
    let apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        try {
            const dbPath = path.join(process.cwd(), 'meeting.db');
            if (fs.existsSync(dbPath)) {
                const db = new Database(dbPath);
                const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
                if (row) apiKey = row.value;
            }
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
        'gemini-2.0-flash-exp'
    ];

    console.log('Testing models with API Key:', apiKey.substring(0, 5) + '...');

    for (const modelName of modelsToTry) {
        process.stdout.write(`Testing ${modelName}... `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Hi');
            await result.response;
            console.log('SUCCESS! ✅');
        } catch (e) {
            if (e.message && (e.message.includes('404') || e.message.includes('not found'))) {
                console.log('NOT FOUND ❌');
            } else {
                console.log(`ERROR: ${e.message} ⚠️`);
            }
        }
    }
}

main();
