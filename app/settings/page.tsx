'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('');
    const [maskedApiKey, setMaskedApiKey] = useState<string | null>(null);
    const [hasApiKey, setHasApiKey] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // 載入設定狀態
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.success) {
                setHasApiKey(data.data.hasApiKey);
                setMaskedApiKey(data.data.maskedApiKey);
            }
        } catch (error) {
            console.error('載入設定失敗:', error);
        } finally {
            setLoading(false);
        }
    };

    // 測試 API Key
    const handleTest = async () => {
        if (!apiKey.trim()) {
            setMessage({ type: 'error', text: '請輸入 API Key' });
            return;
        }

        setTesting(true);
        setMessage(null);

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, action: 'test' }),
            });

            const data = await res.json();
            setMessage({
                type: data.success ? 'success' : 'error',
                text: data.message || (data.success ? '測試成功' : '測試失敗'),
            });
        } catch (error) {
            setMessage({ type: 'error', text: '連線失敗，請檢查網路' });
        } finally {
            setTesting(false);
        }
    };

    // 儲存 API Key
    const handleSave = async () => {
        if (!apiKey.trim()) {
            setMessage({ type: 'error', text: '請輸入 API Key' });
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
                setMessage({ type: 'success', text: 'API Key 已儲存！' });
                setHasApiKey(true);
                setMaskedApiKey(data.data.maskedApiKey);
                setApiKey(''); // 清空輸入
            } else {
                setMessage({ type: 'error', text: data.error || '儲存失敗' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '儲存失敗，請稍後再試' });
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
                {/* 返回按鈕 */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    返回首頁
                </Link>

                {/* 標題 */}
                <header className="mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            ⚙️
                        </span>
                        系統設定
                    </h1>
                    <p className="text-gray-400 mt-2">設定 API Key 和其他系統參數</p>
                </header>

                {/* API Key 設定卡片 */}
                <section className="glass-card p-8 animate-fade-in">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        🔑 Gemini API Key
                    </h2>

                    {/* 目前狀態 */}
                    <div className="mb-6 p-4 rounded-xl bg-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400">目前狀態</span>
                            {hasApiKey ? (
                                <span className="status-badge status-completed">
                                    ✅ 已設定
                                </span>
                            ) : (
                                <span className="status-badge status-failed">
                                    ❌ 未設定
                                </span>
                            )}
                        </div>
                        {maskedApiKey && (
                            <div className="mt-2 text-sm text-gray-500">
                                API Key: <code className="bg-white/10 px-2 py-1 rounded">{maskedApiKey}</code>
                            </div>
                        )}
                    </div>

                    {/* 輸入欄位 */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            {hasApiKey ? '輸入新的 API Key（留空則保持原設定）' : '輸入 API Key'}
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-mono"
                        />
                        <p className="mt-2 text-sm text-gray-500">
                            可在 <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a> 免費取得 API Key
                        </p>
                    </div>

                    {/* 訊息提示 */}
                    {message && (
                        <div
                            className={`mb-6 p-4 rounded-xl ${message.type === 'success'
                                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                                    : 'bg-red-500/20 border border-red-500/30 text-red-400'
                                }`}
                        >
                            {message.type === 'success' ? '✅' : '❌'} {message.text}
                        </div>
                    )}

                    {/* 按鈕 */}
                    <div className="flex gap-4">
                        <button
                            onClick={handleTest}
                            disabled={testing || !apiKey.trim()}
                            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {testing ? (
                                <>
                                    <div className="loading-spinner w-4 h-4"></div>
                                    測試中...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    測試連線
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !apiKey.trim()}
                            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <div className="loading-spinner w-4 h-4"></div>
                                    儲存中...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    儲存
                                </>
                            )}
                        </button>
                    </div>
                </section>

                {/* 說明區塊 */}
                <section className="glass-card p-8 mt-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <h2 className="text-xl font-bold mb-4">📖 如何取得 API Key</h2>
                    <ol className="list-decimal list-inside space-y-3 text-gray-300">
                        <li>
                            前往 <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>
                        </li>
                        <li>使用 Google 帳號登入</li>
                        <li>點擊左側選單的「Get API key」</li>
                        <li>點擊「Create API key」建立新的 Key</li>
                        <li>複製 API Key 並貼到上方欄位</li>
                    </ol>

                    <div className="mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                        <p className="text-yellow-400 text-sm">
                            ⚠️ <strong>注意：</strong>請妥善保管您的 API Key，不要分享給他人。
                        </p>
                    </div>
                </section>
            </div>
        </main>
    );
}
