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
            setMessage({ type: 'error', text: '連線失敗' });
        } finally {
            setTesting(false);
        }
    };

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
                setApiKey('');
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
            <div className="flex items-center justify-center h-64">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-xl">
            {/* 標題 */}
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">設定</h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">管理 API Key 與系統參數</p>
            </div>

            {/* API Key 設定 */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Gemini API Key</h2>
                    {hasApiKey ? (
                        <span className="status-badge status-completed">已設定</span>
                    ) : (
                        <span className="status-badge status-failed">未設定</span>
                    )}
                </div>

                {/* 目前 Key */}
                {maskedApiKey && (
                    <div className="mb-4 p-3 bg-[var(--bg-tertiary)] rounded-md">
                        <span className="text-xs text-[var(--text-tertiary)]">目前 Key: </span>
                        <code className="text-sm text-[var(--text-secondary)]">{maskedApiKey}</code>
                    </div>
                )}

                {/* 輸入欄位 */}
                <div className="mb-4">
                    <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-2">
                        {hasApiKey ? '輸入新的 API Key' : '輸入 API Key'}
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="font-mono"
                    />
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                        可在{' '}
                        <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-purple)] hover:underline">
                            Google AI Studio
                        </a>{' '}
                        免費取得
                    </p>
                </div>

                {/* 訊息 */}
                {message && (
                    <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'success'
                            ? 'bg-[rgba(34,197,94,0.15)] text-[var(--accent-green)]'
                            : 'bg-[rgba(239,68,68,0.15)] text-[var(--accent-red)]'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* 按鈕 */}
                <div className="flex gap-3">
                    <button
                        onClick={handleTest}
                        disabled={testing || !apiKey.trim()}
                        className="btn-secondary disabled:opacity-50"
                    >
                        {testing ? (
                            <><span className="loading-spinner w-4 h-4" /> 測試中</>
                        ) : (
                            '測試連線'
                        )}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !apiKey.trim()}
                        className="btn-primary disabled:opacity-50"
                    >
                        {saving ? (
                            <><span className="loading-spinner w-4 h-4" /> 儲存中</>
                        ) : (
                            '儲存'
                        )}
                    </button>
                </div>
            </div>

            {/* 說明 */}
            <div className="card mt-6">
                <div className="card-header">
                    <h2 className="card-title">如何取得 API Key</h2>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--text-secondary)]">
                    <li>前往 <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-purple)] hover:underline">Google AI Studio</a></li>
                    <li>使用 Google 帳號登入</li>
                    <li>點擊左側選單「Get API key」</li>
                    <li>點擊「Create API key」</li>
                    <li>複製 Key 貼到上方欄位</li>
                </ol>

                <div className="mt-4 p-3 rounded-md bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)]">
                    <p className="text-xs text-[var(--accent-orange)]">
                        ⚠️ 請妥善保管 API Key，不要分享給他人
                    </p>
                </div>
            </div>
        </div>
    );
}
