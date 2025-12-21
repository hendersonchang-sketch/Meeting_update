'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Meeting {
    id: string;
    title: string;
    date: string;
    status: 'processing' | 'completed' | 'failed';
    created_at: string;
    latestLog?: string;
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
    const [customerType, setCustomerType] = useState('nanshan');
    const [customPrompt, setCustomPrompt] = useState('');
    const [isMounted, setIsMounted] = useState(false);
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
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
        setIsMounted(true);
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

    // 準備檔案（暫存）
    const prepareFiles = (files: FileList) => {
        const newFiles = Array.from(files);
        setStagedFiles(prev => [...prev, ...newFiles]);
    };

    // 移除暫存檔案
    const removeStagedFile = (index: number) => {
        setStagedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // 執行實際分析上傳
    const handleStartAnalysis = async () => {
        if (stagedFiles.length === 0) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('customer_type', customerType);
        formData.append('custom_prompt', customPrompt);

        // 分類並加入檔案
        stagedFiles.forEach(file => {
            if (file.name.match(/\.(mp4|mp3|wav|webm|mov|m4a)$/i)) {
                formData.append('video', file);
            } else if (file.name.match(/\.pptx?$/i)) {
                formData.append('pptx', file);
            } else if (file.name.match(/\.docx?$/i)) {
                formData.append('docx', file);
            }
        });

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.success) {
                setStagedFiles([]); // 清空暫存
                loadMeetings();
            } else {
                alert('執行失敗: ' + data.error);
            }
        } catch (error) {
            console.error('執行錯誤:', error);
            alert('分析啟動失敗，請稍後再試');
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

    // 清除日誌
    const handleClearLogs = async () => {
        try {
            const res = await fetch('/api/logs', { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setLogs([]);
            }
        } catch (error) {
            console.error('清除日誌失敗:', error);
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
            prepareFiles(e.dataTransfer.files);
        }
    };

    return (
        <main className="min-h-screen py-16 px-6 md:px-12">
            <div className="max-w-6xl mx-auto">
                {/* 標題區域 (Hero) */}
                <header className="text-center mb-16 stagger-item" style={{ animationDelay: '0.1s' }}>
                    <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-white/5 border border-white/10 text-xs font-bold tracking-widest text-blue-400 uppercase">
                        AI-Powered Intelligence
                    </div>
                    <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight">
                        <span className="text-gradient">NSL 會議記錄系統</span>
                    </h1>
                    <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                        運用頂尖 AI 技術自動分析會議內容，精準提取重點、待辦與風險項目。
                    </p>

                    <div className="mt-10 flex flex-wrap justify-center gap-4">
                        <Link href="/settings" className="btn-secondary">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            設定介面
                        </Link>
                        <button
                            onClick={() => setShowDebug(!showDebug)}
                            className="btn-secondary"
                        >
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            除錯面板
                        </button>
                    </div>
                </header>

                {/* 狀態卡片區 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
                    {[
                        { label: '總處理', value: stats.total, color: 'from-blue-500 to-cyan-500', icon: '📊' },
                        { label: '已完成', value: stats.completed, color: 'from-emerald-500 to-teal-500', icon: '✅' },
                        { label: '分析中', value: stats.processing, color: 'from-amber-500 to-orange-500', icon: '⏳' },
                        { label: '錯誤', value: stats.failed, color: 'from-rose-500 to-pink-500', icon: '❌' },
                    ].map((stat, index) => (
                        <div
                            key={index}
                            className="glass-card p-6 flex flex-col items-center justify-center stagger-item"
                            style={{ animationDelay: `${0.3 + index * 0.1}s` }}
                        >
                            <span className="text-2xl mb-2">{stat.icon}</span>
                            <div className={`text-3xl font-black bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`}>
                                {stat.value}
                            </div>
                            <div className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* 客戶選擇與上傳主區塊 */}
                <div
                    className="stagger-item mb-12"
                    style={{ animationDelay: '0.7s' }}
                >
                    <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-8">
                        <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-sm font-bold uppercase tracking-widest">分析客群</span>
                            <div className="relative">
                                <select
                                    value={customerType}
                                    onChange={(e) => setCustomerType(e.target.value)}
                                    className="appearance-none bg-white/5 border border-white/10 text-blue-400 text-sm font-bold py-2 px-8 rounded-full focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                                >
                                    <option value="nanshan">南山人壽 (預設)</option>
                                    <option value="generic">通用企業格式 (開發中)</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 角色人設 Prompt 輸入區 */}
                    <div className="max-w-2xl mx-auto mb-10 stagger-item" style={{ animationDelay: '0.8s' }}>
                        <div className="glass-card p-4 border-blue-500/10 hover:border-blue-500/30 transition-all group">
                            <div className="flex items-center gap-2 mb-3">
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">角色人設 Prompt (選填)</label>
                            </div>
                            <textarea
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder="例如：請以一位幽默、重視時效性的資深顧問視角來撰寫這份會議摘要..."
                                className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/30 min-h-[100px] transition-all resize-none"
                            />
                            <div className="mt-2 text-[10px] text-gray-500 font-medium italic">
                                * 若留空，系統將使用預設的專業秘書模式進行分析。
                            </div>
                        </div>
                    </div>

                    <div
                        className={`upload-zone group ${uploading ? 'pointer-events-none opacity-50' : ''} ${dragOver ? 'dragover shadow-[0_0_50px_rgba(59,130,246,0.2)]' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".mp4,.mp3,.wav,.webm,.mov,.m4a,.ppt,.pptx,.doc,.docx"
                            multiple
                            onChange={(e) => e.target.files && prepareFiles(e.target.files)}
                        />

                        {uploading ? (
                            <div className="flex flex-col items-center py-10">
                                <div className="loading-spinner mb-6"></div>
                                <h3 className="text-2xl font-bold text-gradient animate-pulse">正在執行分析部署...</h3>
                                <p className="text-gray-500 mt-2">請稍候，系統正在傳輸資源至處理器</p>
                            </div>
                        ) : stagedFiles.length > 0 ? (
                            <div className="text-left w-full space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">📦</span>
                                        待分析檔案清單 ({stagedFiles.length})
                                    </h3>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setStagedFiles([]); }}
                                        className="text-[10px] font-bold text-gray-500 hover:text-rose-400 uppercase tracking-widest transition-colors"
                                    >
                                        清空 Staging
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {stagedFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors group/item">
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${file.name.match(/\.(mp4|mp3|wav|webm|mov|m4a)$/i) ? 'bg-purple-500/20 text-purple-400' :
                                                    file.name.match(/\.pptx?$/i) ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {file.name.match(/\.(mp4|mp3|wav|webm|mov|m4a)$/i) ? '🎬' : '📄'}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-bold text-white truncate">{file.name}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeStagedFile(idx); }}
                                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-rose-500/20 text-gray-600 hover:text-rose-500 transition-all opacity-0 group-hover/item:opacity-100"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-6 flex flex-col gap-4">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleStartAnalysis(); }}
                                        className="btn-primary w-full py-5 text-lg shadow-[0_20px_50px_rgba(59,130,246,0.3)]"
                                    >
                                        🚀 啟動 AI 深度分析
                                    </button>
                                    <p className="text-center text-[10px] text-gray-500 font-medium uppercase tracking-[0.2em]">
                                        點擊後將會同步上傳並呼叫 GEMINI 2.0 FLASH
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div onClick={() => fileInputRef.current?.click()}>
                                <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                                    <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4v12" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold mb-3 text-white text-center">啟動新的會議分析</h3>
                                <p className="text-gray-400 mb-2 text-center">拖放影片檔案至此虛擬空間，或點擊開始上傳</p>
                                <div className="flex justify-center gap-3 mt-4 opacity-50 text-xs font-mono tracking-tighter">
                                    <span className="px-2 py-1 rounded bg-white/5 border border-white/10 uppercase">MP4</span>
                                    <span className="px-2 py-1 rounded bg-white/5 border border-white/10 uppercase">PPTX</span>
                                    <span className="px-2 py-1 rounded bg-white/5 border border-white/10 uppercase">DOCX</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 會議列表區 */}
                <section className="stagger-item" style={{ animationDelay: '0.9s' }}>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                            <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                            歷史分析記錄
                        </h2>
                        <button onClick={handleReset} className="text-rose-400/50 hover:text-rose-400 text-xs font-bold uppercase transition-colors">
                            重置所有 Record
                        </button>
                    </div>

                    {loading ? (
                        <div className="grid place-items-center py-20">
                            <div className="loading-spinner mb-4"></div>
                            <p className="text-gray-500 tracking-widest text-sm uppercase">Synchronizing...</p>
                        </div>
                    ) : meetings.length === 0 ? (
                        <div className="glass-card p-20 text-center border-dashed border-white/5">
                            <p className="text-gray-500 text-lg">等待首個任務部署...</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {meetings.map((meeting, index) => (
                                <Link
                                    key={meeting.id}
                                    href={`/meeting/${meeting.id}`}
                                    className="glass-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between group stagger-item"
                                    style={{ animationDelay: `${1.0 + index * 0.05}s` }}
                                >
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                                            {meeting.title}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500 mt-2">
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                {meeting.date || '未偵測日期'}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                                            <span>
                                                DEPLOYED AT {isMounted ? new Date(meeting.created_at).toLocaleTimeString('zh-TW') : '---'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 mt-4 md:mt-0 w-full md:w-auto">
                                        {meeting.status === 'processing' && (
                                            <div className="flex flex-col items-end gap-1.5 w-full md:w-auto">
                                                <div className="status-badge status-processing animate-pulse">
                                                    <div className="loading-spinner w-3 h-3"></div>
                                                    核心分析中
                                                </div>
                                                {meeting.latestLog && (
                                                    <div className="text-[10px] text-amber-500/60 font-mono text-right max-w-[200px] truncate uppercase tracking-tighter">
                                                        LOG: {meeting.latestLog}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {meeting.status === 'completed' && (
                                            <span className="status-badge status-completed">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                SUCCESS
                                            </span>
                                        )}
                                        {meeting.status === 'failed' && (
                                            <span className="status-badge status-failed">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                FAILED
                                            </span>
                                        )}

                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:bg-blue-500/10">
                                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* 進階除錯終端面板 */}
            {showDebug && (
                <div className="debug-panel fixed bottom-0 right-0 w-full md:w-[450px] shadow-2xl animate-fade-in translate-y-0 opacity-100 overflow-hidden flex flex-col">
                    <div className="debug-panel-header shrink-0 px-4 py-3 flex items-center justify-between border-b border-white/5 bg-white/5">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest ml-2 opacity-50">System Logs</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleClearLogs}
                                className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => setShowDebug(false)}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-gray-400"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="debug-panel-content flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed">
                        {logs.length === 0 ? (
                            <div className="py-20 text-center text-gray-700 uppercase tracking-widest text-[10px]">No signals detected</div>
                        ) : (
                            logs.slice(0, 100).map((log) => (
                                <div key={log.id} className={`log-entry mb-2 border-none ${log.level === 'error' ? 'log-error' : log.level === 'warn' ? 'log-warn' : 'log-info'}`}>
                                    <span className="opacity-30 mr-2 text-[9px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    <span className="font-bold mr-2">[{log.source.toUpperCase()}]</span>
                                    <span className="opacity-80">{log.message}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
