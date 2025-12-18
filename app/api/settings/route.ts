import { NextResponse } from 'next/server';
import { hasApiKey, setSetting, getSetting } from '@/lib/database';
import { testApiKey } from '@/lib/gemini';

// GET: 檢查 API Key 狀態
export async function GET() {
    try {
        const isSet = hasApiKey();
        // 為了安全，不直接回傳 Key，只回傳狀態
        return NextResponse.json({
            success: true,
            data: {
                hasApiKey: isSet
            }
        });
    } catch (error) {
        console.error('Settings API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

// POST: 儲存設定
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { apiKey } = body;

        if (apiKey) {
            // 驗證 API Key
            const testResult = await testApiKey(apiKey);

            if (!testResult.success) {
                return NextResponse.json(
                    { success: false, error: testResult.message },
                    { status: 400 }
                );
            }

            setSetting('gemini_api_key', apiKey);
            return NextResponse.json({ success: true, message: 'API Key 設定成功' });
        }

        return NextResponse.json(
            { success: false, error: 'Invalid settings data' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Settings Update Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update settings' },
            { status: 500 }
        );
    }
}
