
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKeyFromDb } from './lib/database';
import * as dotenv from 'dotenv';
dotenv.config();

// Mock database for standalone run if needed, but better to reuse lib
// Actually, let's just use the key directly if we can, or try to load it.

async function main() {
    // Try env first
    let apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        // Try to read from db if possible, but that's complex in a standalone script without proper setup.
        // Let's ask user to check their key or we assume it's set in process.env for 'npm run dev'
        // But here we are running a script.
        // Let's hardcode the DB logic simply here if needed, or rely on the user having set it in .env
        // Wait, the app uses better-sqlite3.
        const Database = require('better-sqlite3');
        const path = require('path');
        const dbPath = path.join(process.cwd(), 'meeting.db');
        const db = new Database(dbPath);
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key') as { value: string } | undefined;
        if (row) apiKey = row.value;
    }

    if (!apiKey) {
        console.error('No API Key found in .env or database');
        return;
    }

    console.log('Using API Key:', apiKey.substring(0, 5) + '...');

    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // Need to use the model management API if available, but SDK might specific.
        // Actually, just try to generate with fallback models.
        // But wait, there should be a listModels functionality?
        // It seems the JS SDK doesn't expose listModels easily on the main instance in older versions, 
        // but 0.21.0 might. 
        // Actually, let's just try to instantiate a few common models and see which one doesn't throw IMMEDIATELY
        // ... No, generateContent throws.

        const modelsToTry = [
            'gemini-1.5-flash',
            'gemini-1.5-flash-001',
            'gemini-1.5-flash-002',
            'gemini-1.5-pro',
            'gemini-1.5-pro-001',
            'gemini-1.5-pro-002',
            'gemini-pro',
            'gemini-2.0-flash-exp'
        ];

        console.log('Testing models...');

        for (const modelName of modelsToTry) {
            process.stdout.write(`Testing ${modelName}... `);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('Hello');
                const response = await result.response;
                console.log('SUCCESS! ✅');
            } catch (e: any) {
                if (e.message.includes('404')) {
                    console.log('NOT FOUND ❌');
                } else {
                    console.log(`ERROR: ${e.message} ⚠️`);
                }
            }
        }

    } catch (error) {
        console.error('Fatal Error:', error);
    }
}

main();
