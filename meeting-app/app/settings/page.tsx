'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.success && data.data.maskedApiKey) {
                setApiKey(data.data.maskedApiKey);
            }
        } catch (error) {
            console.error('載入設定失敗:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        // 如果是遮罩過的 key（包含 ...），不要儲存
        if (apiKey.includes('...')) {
            setMessage({ type: 'error', text: '請輸入完整的 API Key' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, action: 'save' }),
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: '設定已儲存' });
                // 更新顯示為遮罩後的 key
                if (data.data?.maskedApiKey) {
                    setApiKey(data.data.maskedApiKey);
                }
            } else {
                setMessage({ type: 'error', text: data.error || '儲存失敗' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '儲存失敗' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    return (
        <main className="min-h-screen p-8">
            <div className="max-w-2xl mx-auto">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    返回首頁
                </Link>

                <div className="glass-card p-8 animate-fade-in">
                    <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
                        <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            ⚙️
                        </span>
                        系統設定
                    </h1>

                    <div className="space-y-6">
                        {/* API Key 設定 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Gemini API Key
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="輸入您的 Gemini API Key"
                                className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                            <p className="text-sm text-gray-500 mt-2">
                                請至{' '}
                                <a
                                    href="https://aistudio.google.com/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline"
                                >
                                    Google AI Studio
                                </a>
                                {' '}取得 API Key
                            </p>
                        </div>

                        {/* 訊息顯示 */}
                        {message && (
                            <div
                                className={`p-4 rounded-xl ${message.type === 'success'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    }`}
                            >
                                {message.text}
                            </div>
                        )}

                        {/* 儲存按鈕 */}
                        <button
                            onClick={saveSettings}
                            disabled={saving}
                            className="btn-primary w-full"
                        >
                            {saving ? '儲存中...' : '儲存設定'}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
