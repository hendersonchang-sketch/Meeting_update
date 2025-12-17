'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Meeting {
    id: string;
    title: string;
    date: string;
    status: 'processing' | 'completed' | 'failed';
    created_at: string;
}

interface Stats {
    total: number;
    completed: number;
    processing: number;
    failed: number;
}

interface LogEntry {
    id: string;
    timestamp: string;
    level: string;
    source: string;
    message: string;
}

export default function HomePage() {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, processing: 0, failed: 0 });
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 載入會議列表
    const loadMeetings = async () => {
        try {
            const res = await fetch('/api/meetings');
            const data = await res.json();
            if (data.success) {
                setMeetings(data.data.meetings);
                setStats(data.data.stats);
            }
        } catch (error) {
            console.error('載入會議失敗:', error);
        } finally {
            setLoading(false);
        }
    };

    // 載入日誌
    const loadLogs = async () => {
        try {
            const res = await fetch('/api/logs');
            const data = await res.json();
            if (data.success) {
                setLogs(data.data);
            }
        } catch (error) {
            console.error('載入日誌失敗:', error);
        }
    };

    useEffect(() => {
        loadMeetings();
        const interval = setInterval(() => {
            loadMeetings();
            if (showDebug) loadLogs();
        }, 5000);
        return () => clearInterval(interval);
    }, [showDebug]);

    useEffect(() => {
        if (showDebug) loadLogs();
    }, [showDebug]);

    // 上傳檔案
    const handleUpload = async (files: FileList) => {
        if (files.length === 0) return;

        setUploading(true);
        const formData = new FormData();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.match(/\.(mp4|mp3|wav|webm|mov|m4a)$/i)) {
                formData.append('video', file);
            } else if (file.name.match(/\.pptx?$/i)) {
                formData.append('pptx', file);
            } else if (file.name.match(/\.docx?$/i)) {
                formData.append('docx', file);
            }
        }

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.success) {
                loadMeetings();
            } else {
                alert('上傳失敗: ' + data.error);
            }
        } catch (error) {
            console.error('上傳錯誤:', error);
            alert('上傳失敗，請稍後再試');
        } finally {
            setUploading(false);
        }
    };

    // 強制重置
    const handleReset = async () => {
        if (!confirm('確定要清除所有資料嗎？此操作無法復原！')) return;

        try {
            const res = await fetch('/api/reset', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                loadMeetings();
                setLogs([]);
                alert('系統已重置');
            }
        } catch (error) {
            console.error('重置失敗:', error);
        }
    };

    // 拖放處理
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files) {
            handleUpload(e.dataTransfer.files);
        }
    };

    return (
        <main className="min-h-screen p-8">
            <div className="max-w-6xl mx-auto">
                {/* 標題區域 */}
                <header className="text-center mb-12 animate-fade-in">
                    <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        AI 會議記錄系統
                    </h1>
                    <p className="text-gray-400 text-lg">
                        上傳會議影片，AI 自動生成專業會議紀錄
                    </p>
                    <div className="mt-4 flex justify-center gap-4">
                        <Link href="/settings" className="btn-secondary text-sm">
                            ⚙️ 設定
                        </Link>
                        <button
                            onClick={() => setShowDebug(!showDebug)}
                            className="btn-secondary text-sm"
                        >
                            🔧 {showDebug ? '隱藏' : '顯示'}除錯
                        </button>
                        <button onClick={handleReset} className="btn-danger text-sm">
                            🔄 強制重置
                        </button>
                    </div>
                </header>

                {/* 統計卡片 */}
                <div className="grid grid-cols-4 gap-6 mb-12">
                    {[
                        { label: '總會議數', value: stats.total, color: 'from-blue-500 to-cyan-500' },
                        { label: '已完成', value: stats.completed, color: 'from-green-500 to-emerald-500' },
                        { label: '處理中', value: stats.processing, color: 'from-yellow-500 to-orange-500' },
                        { label: '失敗', value: stats.failed, color: 'from-red-500 to-pink-500' },
                    ].map((stat, index) => (
                        <div
                            key={index}
                            className="glass-card p-6 text-center animate-fade-in"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className={`text-4xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                                {stat.value}
                            </div>
                            <div className="text-gray-400 mt-2">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* 上傳區域 */}
                <div
                    className={`upload-zone mb-12 animate-fade-in ${dragOver ? 'dragover' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".mp4,.mp3,.wav,.webm,.mov,.m4a,.ppt,.pptx,.doc,.docx"
                        multiple
                        onChange={(e) => e.target.files && handleUpload(e.target.files)}
                    />
                    {uploading ? (
                        <>
                            <div className="loading-spinner mx-auto mb-4"></div>
                            <p className="text-gray-300">正在上傳...</p>
                        </>
                    ) : (
                        <>
                            <svg
                                className="w-16 h-16 mx-auto mb-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                            </svg>
                            <p className="text-gray-300 text-lg mb-2">
                                拖放檔案至此處，或點擊選擇檔案
                            </p>
                            <p className="text-gray-500 text-sm">
                                支援 MP4、MP3、WAV、PPT、PPTX、DOC、DOCX
                            </p>
                        </>
                    )}
                </div>

                {/* 會議列表 */}
                <section>
                    <h2 className="text-2xl font-bold mb-6">會議記錄</h2>
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="loading-spinner mx-auto mb-4"></div>
                            <p className="text-gray-400">載入中...</p>
                        </div>
                    ) : meetings.length === 0 ? (
                        <div className="glass-card p-12 text-center">
                            <p className="text-gray-400">尚無會議記錄，請上傳影片開始</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {meetings.map((meeting, index) => (
                                <Link
                                    key={meeting.id}
                                    href={`/meeting/${meeting.id}`}
                                    className="glass-card p-6 flex items-center justify-between animate-fade-in block"
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                >
                                    <div>
                                        <h3 className="text-lg font-semibold">{meeting.title}</h3>
                                        <p className="text-gray-400 text-sm mt-1">
                                            {meeting.date} · 建立於 {new Date(meeting.created_at).toLocaleString('zh-TW')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {meeting.status === 'processing' && (
                                            <span className="status-badge status-processing">
                                                <div className="loading-spinner w-4 h-4"></div>
                                                處理中
                                            </span>
                                        )}
                                        {meeting.status === 'completed' && (
                                            <span className="status-badge status-completed">✅ 已完成</span>
                                        )}
                                        {meeting.status === 'failed' && (
                                            <span className="status-badge status-failed">❌ 失敗</span>
                                        )}
                                        <svg
                                            className="w-5 h-5 text-gray-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* 除錯面板 */}
            {showDebug && (
                <div className="debug-panel">
                    <div className="debug-panel-header">
                        <span className="font-semibold">🔧 除錯日誌</span>
                        <button onClick={() => setShowDebug(false)} className="text-gray-400 hover:text-white">
                            ✕
                        </button>
                    </div>
                    <div className="debug-panel-content">
                        {logs.length === 0 ? (
                            <p className="text-gray-500">尚無日誌</p>
                        ) : (
                            logs.slice(0, 50).map((log) => (
                                <div key={log.id} className={`log-entry log-${log.level}`}>
                                    <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    {' '}[{log.source}] {log.message}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
