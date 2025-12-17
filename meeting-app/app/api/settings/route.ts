import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting, getMaskedApiKey, hasApiKey } from '@/lib/database';
import { testApiKey } from '@/lib/gemini';
import { createLogger } from '@/lib/logger';

const logger = createLogger('API.Settings');

/**
 * GET /api/settings - 取得設定狀態
 */
export async function GET() {
    try {
        const hasKey = hasApiKey();
        const maskedKey = getMaskedApiKey();

        return NextResponse.json({
            success: true,
            data: {
                hasApiKey: hasKey,
                maskedApiKey: maskedKey,
            },
        });
    } catch (error) {
        logger.error('取得設定失敗', { error });
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '取得設定失敗',
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/settings - 儲存設定
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { apiKey, action } = body;

        // 測試 API Key
        if (action === 'test') {
            if (!apiKey) {
                return NextResponse.json(
                    {
                        success: false,
                        error: '請輸入 API Key',
                    },
                    { status: 400 }
                );
            }

            logger.info('測試 API Key...');
            const result = await testApiKey(apiKey);

            return NextResponse.json({
                success: result.success,
                message: result.message,
            });
        }

        // 儲存 API Key
        if (action === 'save') {
            if (!apiKey) {
                return NextResponse.json(
                    {
                        success: false,
                        error: '請輸入 API Key',
                    },
                    { status: 400 }
                );
            }

            logger.info('儲存 API Key...');
            setSetting('gemini_api_key', apiKey);

            return NextResponse.json({
                success: true,
                message: 'API Key 已儲存',
                data: {
                    hasApiKey: true,
                    maskedApiKey: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
                },
            });
        }

        return NextResponse.json(
            {
                success: false,
                error: '無效的操作',
            },
            { status: 400 }
        );
    } catch (error) {
        logger.error('設定操作失敗', { error });
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '設定操作失敗',
            },
            { status: 500 }
        );
    }
}
