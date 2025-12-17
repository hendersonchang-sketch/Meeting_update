'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { MeetingMinutes } from '@/lib/types';

interface MeetingDetail {
    id: string;
    title: string;
    date: string;
    status: 'processing' | 'completed' | 'failed';
    created_at: string;
    updated_at: string;
    transcript?: string;
    summary?: string;
    minutes?: MeetingMinutes;
    output_docx_path?: string;
}

export default function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'keyPoints']));

    useEffect(() => {
        const loadMeeting = async () => {
            try {
                const res = await fetch(`/api/meetings/${resolvedParams.id}`);
                const data = await res.json();

                if (data.success) {
                    setMeeting(data.data);
                } else {
                    setError(data.error || '載入失敗');
                }
            } catch (err) {
                setError('載入會議記錄失敗');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadMeeting();

        // 如果是處理中，每 5 秒刷新一次
        const interval = setInterval(() => {
            if (meeting?.status === 'processing') {
                loadMeeting();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [resolvedParams.id, meeting?.status]);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(section)) {
                newSet.delete(section);
            } else {
                newSet.add(section);
            }
            return newSet;
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="loading-spinner mx-auto mb-4"></div>
                    <p className="text-gray-400">載入會議記錄中...</p>
                </div>
            </div>
        );
    }

    if (error || !meeting) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="glass-card p-8 text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-red-400 mb-2">發生錯誤</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <Link href="/" className="btn-primary">
                        返回首頁
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen p-8">
            <div className="max-w-5xl mx-auto">
                {/* 返回按鈕 */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    返回列表
                </Link>

                {/* 標題區域 */}
                <header className="glass-card p-8 mb-8 animate-fade-in">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold mb-4">{meeting.title}</h1>
                            <div className="flex flex-wrap gap-4 text-gray-400">
                                <span className="flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {meeting.date || '日期未設定'}
                                </span>
                                <span className="flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    建立於 {new Date(meeting.created_at).toLocaleString('zh-TW')}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {meeting.status === 'processing' && (
                                <span className="status-badge status-processing">
                                    <div className="loading-spinner w-4 h-4"></div>
                                    處理中
                                </span>
                            )}
                            {meeting.status === 'completed' && (
                                <>
                                    <span className="status-badge status-completed">✅ 已完成</span>
                                    <a
                                        href={`/api/meetings/${meeting.id}/download`}
                                        className="btn-primary flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        下載 Word 文件
                                    </a>
                                    <a
                                        href={`/api/meetings/${meeting.id}/transcript`}
                                        className="btn-secondary flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        下載逐字稿
                                    </a>
                                </>
                            )}
                            {meeting.status === 'failed' && (
                                <span className="status-badge status-failed">❌ 處理失敗</span>
                            )}
                        </div>
                    </div>
                </header>

                {/* 處理中提示 */}
                {meeting.status === 'processing' && (
                    <div className="glass-card p-8 text-center animate-fade-in">
                        <div className="loading-spinner mx-auto mb-4 w-16 h-16"></div>
                        <h2 className="text-xl font-bold mb-2">正在分析會議內容...</h2>
                        <p className="text-gray-400">
                            AI 正在處理您的會議影片，這可能需要幾分鐘時間。
                            <br />
                            頁面將自動刷新顯示結果。
                        </p>
                    </div>
                )}

                {/* 會議摘要 */}
                {meeting.status === 'completed' && meeting.summary && (
                    <section className="glass-card p-6 mb-6 animate-fade-in">
                        <div
                            className="accordion-header"
                            onClick={() => toggleSection('summary')}
                        >
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm">
                                    📝
                                </span>
                                會議摘要
                            </h2>
                            <svg
                                className={`w-5 h-5 transition-transform ${expandedSections.has('summary') ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        {expandedSections.has('summary') && (
                            <div className="accordion-content mt-4">
                                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{meeting.summary}</p>
                            </div>
                        )}
                    </section>
                )}

                {/* 重點紀錄 */}
                {meeting.status === 'completed' && meeting.minutes?.keyPoints && (
                    <section className="glass-card p-6 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <div
                            className="accordion-header"
                            onClick={() => toggleSection('keyPoints')}
                        >
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-sm">
                                    🎯
                                </span>
                                重點紀錄
                            </h2>
                            <svg
                                className={`w-5 h-5 transition-transform ${expandedSections.has('keyPoints') ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        {expandedSections.has('keyPoints') && (
                            <div className="accordion-content mt-4 space-y-4">
                                {meeting.minutes.keyPoints.map((point, index) => (
                                    <div key={index} className="bg-white/5 rounded-xl p-4">
                                        <h3 className="font-bold text-blue-400 mb-3">{point.category}</h3>
                                        <ul className="space-y-2">
                                            {point.content.map((item, itemIndex) => (
                                                <li key={itemIndex} className="flex items-start gap-2 text-gray-300">
                                                    <span className="text-green-400 mt-1">•</span>
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* 待辦事項 */}
                {meeting.status === 'completed' && meeting.minutes?.actionItems && meeting.minutes.actionItems.length > 0 && (
                    <section className="glass-card p-6 mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <div
                            className="accordion-header"
                            onClick={() => toggleSection('actionItems')}
                        >
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-sm">
                                    ✅
                                </span>
                                待辦事項
                            </h2>
                            <svg
                                className={`w-5 h-5 transition-transform ${expandedSections.has('actionItems') ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        {expandedSections.has('actionItems') && (
                            <div className="accordion-content mt-4">
                                <div className="space-y-3">
                                    {meeting.minutes.actionItems.map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-4 p-4 bg-white/5 rounded-xl"
                                        >
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.status === 'completed' ? 'bg-green-500' :
                                                item.status === 'in-progress' ? 'bg-yellow-500' : 'bg-gray-500'
                                                }`}>
                                                {item.status === 'completed' ? '✓' : item.status === 'in-progress' ? '◔' : '○'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium">{item.description}</p>
                                                {item.assignee && (
                                                    <p className="text-sm text-gray-400">負責人：{item.assignee}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* 風險管理事項 */}
                {meeting.status === 'completed' && meeting.minutes?.riskItems && meeting.minutes.riskItems.length > 0 && (
                    <section className="glass-card p-6 mb-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <div
                            className="accordion-header"
                            onClick={() => toggleSection('riskItems')}
                        >
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-sm">
                                    ⚠️
                                </span>
                                風險管理事項
                            </h2>
                            <svg
                                className={`w-5 h-5 transition-transform ${expandedSections.has('riskItems') ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        {expandedSections.has('riskItems') && (
                            <div className="accordion-content mt-4">
                                <p className="text-sm text-gray-400 mb-4">
                                    ＊必要時風險評估需依循南山內部程序進行（如風管、法遵、資安等）
                                </p>
                                <div className="space-y-3">
                                    {meeting.minutes.riskItems.map((item, index) => (
                                        <div
                                            key={index}
                                            className="p-4 bg-white/5 rounded-xl border-l-4 border-red-500"
                                        >
                                            <p className="font-medium">{item.description}</p>
                                            {item.mitigation && (
                                                <p className="text-sm text-gray-400 mt-2">緩解措施：{item.mitigation}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* 其他事項紀錄 */}
                {meeting.status === 'completed' && (
                    <section className="glass-card p-6 mb-6 animate-fade-in" style={{ animationDelay: '0.35s' }}>
                        <div
                            className="accordion-header"
                            onClick={() => toggleSection('otherNotes')}
                        >
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-slate-500 flex items-center justify-center text-sm">
                                    📋
                                </span>
                                其他事項紀錄
                            </h2>
                            <svg
                                className={`w-5 h-5 transition-transform ${expandedSections.has('otherNotes') ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        {expandedSections.has('otherNotes') && (
                            <div className="accordion-content mt-4">
                                {meeting.minutes?.otherNotes && meeting.minutes.otherNotes.length > 0 ? (
                                    <ul className="space-y-2">
                                        {meeting.minutes.otherNotes.map((note, index) => (
                                            <li key={index} className="flex items-start gap-2 text-gray-300">
                                                <span className="text-gray-400 mt-1">•</span>
                                                <span>{note}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-400">無</p>
                                )}
                            </div>
                        )}
                    </section>
                )}

                {/* 逐字稿 */}
                {meeting.status === 'completed' && meeting.transcript && (
                    <section className="glass-card p-6 mb-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                        <div
                            className="accordion-header"
                            onClick={() => toggleSection('transcript')}
                        >
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-sm">
                                    🎙️
                                </span>
                                會議逐字稿
                            </h2>
                            <svg
                                className={`w-5 h-5 transition-transform ${expandedSections.has('transcript') ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        {expandedSections.has('transcript') && (
                            <div className="accordion-content mt-4">
                                <div className="bg-black/30 rounded-xl p-6 max-h-96 overflow-y-auto">
                                    <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                                        {meeting.transcript}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* 出席人員 */}
                {meeting.status === 'completed' && meeting.minutes?.attendees && (
                    <section className="glass-card p-6 mb-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
                        <div
                            className="accordion-header"
                            onClick={() => toggleSection('attendees')}
                        >
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-sm">
                                    👥
                                </span>
                                出席人員
                            </h2>
                            <svg
                                className={`w-5 h-5 transition-transform ${expandedSections.has('attendees') ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        {expandedSections.has('attendees') && (
                            <div className="accordion-content mt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { label: '南山長官', data: meeting.minutes.attendees.companyLeaders },
                                        { label: '技術小組代表', data: meeting.minutes.attendees.technicalTeam },
                                        { label: 'PM代表', data: meeting.minutes.attendees.pmTeam },
                                        { label: 'IBM代表', data: meeting.minutes.attendees.ibmTeam },
                                        { label: '參與廠商', data: meeting.minutes.attendees.vendors },
                                    ].map((group, index) => (
                                        group.data && group.data.length > 0 && (
                                            <div key={index} className="bg-white/5 rounded-xl p-4">
                                                <h4 className="text-sm font-medium text-gray-400 mb-2">{group.label}</h4>
                                                <p className="text-gray-300">{group.data.join(', ')}</p>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </main>
    );
}
