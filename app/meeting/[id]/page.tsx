'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface MeetingDetail {
    id: string;
    title: string;
    date: string;
    status: string;
    created_at: string;
    summary?: string;
    transcript?: string;
    minutes_json?: string;
}

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'minutes' | 'transcript'>('overview');

    const fetchMeeting = useCallback(async () => {
        try {
            const res = await fetch(`/api/meetings/${id}`);
            const data = await res.json();
            if (data.success) {
                setMeeting(data.data);
            } else {
                console.error('載入失敗:', data.error);
            }
        } catch (error) {
            console.error('API 錯誤:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchMeeting();
    }, [fetchMeeting]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    if (!meeting) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <h1 className="text-2xl font-bold text-red-400 mb-4">找不到該會議記錄</h1>
                <Link href="/" className="btn-secondary">返回首頁</Link>
            </div>
        );
    }

    const minutesData = meeting.minutes_json ? JSON.parse(meeting.minutes_json) : null;
    const minutes = minutesData?.minutes || minutesData; // 相容不同包層

    return (
        <main className="min-h-screen p-8 max-w-7xl mx-auto">
            {/* 麵包屑與導覽 */}
            <nav className="mb-8 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    返回列表
                </Link>
                <div className="flex gap-3">
                    <a
                        href={`/api/meetings/${id}/download`}
                        className="btn-primary flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        下載 Word
                    </a>
                </div>
            </nav>

            {/* 標題區域 */}
            <header className="mb-10 animate-fade-in">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    {meeting.title}
                </h1>
                <div className="flex items-center gap-4 text-gray-400">
                    <span className="flex items-center gap-1">📅 {meeting.date}</span>
                    <span className="flex items-center gap-1">
                        ⏱️ {meeting.created_at?.includes('T')
                            ? meeting.created_at.split('T')[1].slice(0, 5)
                            : meeting.created_at?.split(' ')[1]?.slice(0, 5) || 'N/A'}
                    </span>
                    <span className={`status-badge ${meeting.status === 'completed' ? 'status-completed' : 'status-processing'}`}>
                        {meeting.status === 'completed' ? '✅ 已完成' : '⏳ 處理中'}
                    </span>
                </div>
            </header>

            {/* 頁籤切換 */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-8 animate-fade-in">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 py-3 rounded-lg font-medium transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    摘要與出席
                </button>
                <button
                    onClick={() => setActiveTab('minutes')}
                    className={`flex-1 py-3 rounded-lg font-medium transition-all ${activeTab === 'minutes' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    結構化紀錄
                </button>
                <button
                    onClick={() => setActiveTab('transcript')}
                    className={`flex-1 py-3 rounded-lg font-medium transition-all ${activeTab === 'transcript' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    會議逐字稿
                </button>
            </div>

            {/* 內容區 */}
            <div className="space-y-8 animate-fade-in">
                {/* --- 摘要與出席 --- */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-slide-in">
                        <section className="glass-card p-8">
                            <h2 className="text-xl font-bold mb-4 text-blue-400 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">📝</span>
                                會議摘要
                            </h2>
                            <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                                {meeting.summary || '尚未生成摘要'}
                            </div>
                        </section>

                        {minutes?.attendees && (
                            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {Object.entries(minutes.attendees).map(([key, list]: [string, any]) => (
                                    <div key={key} className="glass-card p-6">
                                        <h3 className="font-bold mb-3 text-gray-400 text-sm uppercase tracking-wider">
                                            {key === 'companyLeaders' ? '公司長官' :
                                                key === 'technicalTeam' ? '技術團隊' :
                                                    key === 'pmTeam' ? 'PM 團隊' :
                                                        key === 'ibmTeam' ? 'IBM 團隊' :
                                                            key === 'vendors' ? '廠商代表' : key}
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {Array.isArray(list) && list.length > 0 ? (
                                                list.map((name, i) => (
                                                    <span key={i} className="px-3 py-1 bg-white/5 rounded-full text-sm text-blue-300">
                                                        {name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-500 text-sm italic">無</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}
                    </div>
                )}

                {/* --- 結構化紀錄 --- */}
                {activeTab === 'minutes' && (
                    <div className="space-y-6 animate-slide-in">
                        {/* 7 大重點分類 */}
                        {minutes?.keyPoints?.map((item: any, idx: number) => (
                            <section key={idx} className="glass-card p-6 border-l-4 border-blue-500">
                                <h3 className="text-lg font-bold mb-4 text-white flex items-center justify-between">
                                    {item.category}
                                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">重點紀錄</span>
                                </h3>
                                <ul className="space-y-3">
                                    {item.content?.map((point: string, i: number) => (
                                        <li key={i} className="flex gap-3 text-gray-300">
                                            <span className="text-blue-500 mt-1.5">•</span>
                                            <span className="leading-relaxed">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* 待辦事項 */}
                            <section className="glass-card p-6">
                                <h3 className="text-lg font-bold mb-6 text-green-400 flex items-center gap-2">
                                    <span>📅</span> 待辦事項 (Action Items)
                                </h3>
                                <div className="space-y-4">
                                    {minutes?.actionItems?.map((item: any, i: number) => (
                                        <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="font-medium text-white">{item.description}</p>
                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase ${item.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                            <div className="flex gap-4 text-xs text-gray-400">
                                                <span>👤 {item.assignee || '未定'}</span>
                                                <span>⏰ {item.dueDate || 'ASAP'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* 風險評估 */}
                            <section className="glass-card p-6">
                                <h3 className="text-lg font-bold mb-6 text-red-400 flex items-center gap-2">
                                    <span>⚠️</span> 風險評估 (Risk Items)
                                </h3>
                                <div className="space-y-4">
                                    {minutes?.riskItems?.map((item: any, i: number) => (
                                        <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="font-medium text-white">{item.description}</p>
                                                <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase">
                                                    {item.severity}
                                                </span>
                                            </div>
                                            {item.mitigation && (
                                                <p className="text-xs text-gray-400 mt-2 bg-black/20 p-2 rounded">
                                                    <span className="text-red-400/70 font-bold">對策：</span>{item.mitigation}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                {/* --- 會議逐字稿 --- */}
                {activeTab === 'transcript' && (
                    <section className="glass-card p-8 animate-slide-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm">🎤</span>
                                會議完整逐字稿
                            </h2>
                            <button
                                onClick={() => {
                                    if (meeting.transcript) {
                                        navigator.clipboard.writeText(meeting.transcript);
                                        alert('逐字稿已複製到剪貼簿');
                                    }
                                }}
                                className="text-xs text-gray-400 hover:text-white underline"
                            >
                                複製全內容
                            </button>
                        </div>
                        <div className="bg-black/20 p-6 rounded-2xl border border-white/5 max-h-[600px] overflow-y-auto scrollbar-thin">
                            {meeting.transcript ? (
                                <div className="text-gray-300 leading-relaxed font-mono text-sm whitespace-pre-wrap">
                                    {meeting.transcript}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500 italic">
                                    此會議尚未生成逐字稿。
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
