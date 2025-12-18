'use client';

import { useState, useEffect, useCallback } from 'react';

interface LogEntry {
    id: number;
    timestamp: string;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    source: string;
    message: string;
    details?: string;
    meeting_id?: string;
}

interface DebugPanelProps {
    meetingId?: string;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export default function DebugPanel({
    meetingId,
    autoRefresh = true,
    refreshInterval = 2000,
}: DebugPanelProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<string>('ALL');

    const loadLogs = useCallback(async () => {
        try {
            const url = meetingId
                ? `/api/logs?meetingId=${meetingId}`
                : '/api/logs?limit=50';
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setLogs(data.data.logs || []);
            }
        } catch (error) {
            console.error('載入日誌失敗:', error);
        }
    }, [meetingId]);

    useEffect(() => {
        loadLogs();

        if (autoRefresh) {
            const interval = setInterval(loadLogs, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [loadLogs, autoRefresh, refreshInterval]);

    const clearLogs = async () => {
        setLoading(true);
        try {
            await fetch('/api/logs', { method: 'DELETE' });
            setLogs([]);
        } catch (error) {
            console.error('清除日誌失敗:', error);
        } finally {
            setLoading(false);
        }
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'ERROR':
                return 'text-red-400 bg-red-500/20';
            case 'WARN':
                return 'text-yellow-400 bg-yellow-500/20';
            case 'INFO':
                return 'text-blue-400 bg-blue-500/20';
            case 'DEBUG':
                return 'text-gray-400 bg-gray-500/20';
            default:
                return 'text-gray-400 bg-gray-500/20';
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const filteredLogs = filter === 'ALL'
        ? logs
        : logs.filter((log) => log.level === filter);

    return (
        <div className="glass-card overflow-hidden">
            {/* 標題列 */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-sm">
                        🔧
                    </span>
                    <h3 className="font-bold">Debug Log</h3>
                    <span className="text-xs text-gray-400">({logs.length} 筆)</span>
                    {autoRefresh && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                            自動更新
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <svg
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {/* 展開的內容 */}
            {isExpanded && (
                <div className="border-t border-white/10">
                    {/* 工具列 */}
                    <div className="flex items-center justify-between p-3 bg-white/5">
                        <div className="flex items-center gap-2">
                            {['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map((level) => (
                                <button
                                    key={level}
                                    onClick={() => setFilter(level)}
                                    className={`px-3 py-1 text-xs rounded-full transition-colors ${filter === level
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                        }`}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    if (!confirm('警告：確定要清除所有會議記錄和 Debug 日誌嗎？此動作無法復原。')) return;
                                    setLoading(true);
                                    try {
                                        const res = await fetch('/api/reset', { method: 'POST' });
                                        const data = await res.json();
                                        if (data.success) {
                                            alert('系統已重置完成');
                                            loadLogs(); // 重新載入日誌（應該只剩下一條重置成功的日誌）
                                            // 可選：重新載入網頁以清除前端暫存
                                            window.location.reload();
                                        } else {
                                            alert('重置失敗: ' + data.error);
                                        }
                                    } catch (err) {
                                        alert('重置發生錯誤');
                                        console.error(err);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="px-3 py-1 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded text-xs transition-colors border border-red-500/30"
                            >
                                ⚠️ 重置系統
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={loadLogs}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                title="重新載入"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                            <button
                                onClick={clearLogs}
                                disabled={loading}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-red-400"
                                title="清除日誌"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* 日誌列表 */}
                    <div className="max-h-80 overflow-y-auto">
                        {filteredLogs.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                                <p>尚無日誌記錄</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {filteredLogs.map((log) => (
                                    <div
                                        key={log.id}
                                        className="p-3 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span
                                                className={`px-2 py-0.5 text-xs rounded font-mono ${getLevelColor(log.level)}`}
                                            >
                                                {log.level}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                                    <span>{formatTime(log.timestamp)}</span>
                                                    <span className="text-gray-600">|</span>
                                                    <span className="text-purple-400">{log.source}</span>
                                                </div>
                                                <p className="text-sm text-gray-300 break-words">{log.message}</p>
                                                {log.details && (
                                                    <pre className="mt-2 p-2 bg-black/30 rounded text-xs text-gray-400 overflow-x-auto">
                                                        {log.details}
                                                    </pre>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
