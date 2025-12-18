'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import DebugPanel from '@/components/DebugPanel';

interface Meeting {
  id: string;
  title: string;
  date: string;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
  summary?: string;
}

interface Stats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
}

export default function Home() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, processing: 0, failed: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [showDebug, setShowDebug] = useState(true);

  // 檢查 API Key 狀態
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success) {
          setHasApiKey(data.data.hasApiKey);
        }
      } catch (error) {
        console.error('檢查 API Key 失敗:', error);
      }
    };
    checkApiKey();
  }, []);

  // 載入會議列表
  const loadMeetings = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings');
      const data = await res.json();
      if (data.success) {
        setMeetings(data.data.meetings);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('載入會議失敗:', error);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
    // 每 10 秒自動刷新
    const interval = setInterval(loadMeetings, 10000);
    return () => clearInterval(interval);
  }, [loadMeetings]);

  // 處理檔案拖放
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  // 處理檔案選擇
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  // 移除選擇的檔案
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 上傳檔案
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('title', meetingTitle || '未命名會議');

    selectedFiles.forEach((file) => {
      if (file.name.match(/\.(mp4|mp3|wav|webm|mov|m4a)$/i)) {
        formData.append('video', file);
      } else if (file.name.match(/\.pptx?$/i)) {
        formData.append('pptx', file);
      } else if (file.name.match(/\.docx?$/i)) {
        formData.append('docx', file);
      }
    });

    try {
      // 模擬上傳進度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();

      if (data.success) {
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          setSelectedFiles([]);
          setMeetingTitle('');
          loadMeetings();
        }, 500);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('上傳失敗:', error);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 取得檔案圖示
  const getFileIcon = (filename: string) => {
    if (filename.match(/\.(mp4|mp3|wav|webm|mov|m4a)$/i)) {
      return (
        <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    } else if (filename.match(/\.pptx?$/i)) {
      return (
        <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
  };

  // 格式化檔案大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 狀態標籤
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      processing: { class: 'status-processing', text: '處理中', icon: '⏳' },
      completed: { class: 'status-completed', text: '已完成', icon: '✅' },
      failed: { class: 'status-failed', text: '失敗', icon: '❌' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.processing;
    return (
      <span className={`status-badge ${config.class}`}>
        {config.icon} {config.text}
      </span>
    );
  };

  return (
    <main className="min-h-screen p-8">
      {/* 頂部標題 */}
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  智能會議記錄系統
                </h1>
                <p className="text-gray-400 mt-1">上傳會議影音，自動生成專業會議記錄</p>
              </div>
            </div>

            {/* 右側按鈕 */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className={`p-3 rounded-xl transition-colors ${showDebug ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-gray-400 hover:text-white'}`}
                title="切換 Debug 面板"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </button>
              <Link
                href="/settings"
                className={`p-3 rounded-xl transition-colors ${hasApiKey === false
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : 'bg-white/10 text-gray-400 hover:text-white'
                  }`}
                title="系統設定"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>
          </div>

          {/* API Key 未設定警告 */}
          {hasApiKey === false && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/20 border border-red-500/30 animate-fade-in">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-medium text-red-400">API Key 尚未設定</p>
                  <p className="text-sm text-red-300/70">
                    請先前往{' '}
                    <Link href="/settings" className="underline hover:text-red-200">
                      設定頁面
                    </Link>{' '}
                    輸入您的 Gemini API Key
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 統計卡片 */}
          <div className="grid grid-cols-4 gap-4 mt-8">
            {[
              { label: '總會議數', value: stats.total, color: 'from-blue-500 to-cyan-500', icon: '📊' },
              { label: '已完成', value: stats.completed, color: 'from-green-500 to-emerald-500', icon: '✅' },
              { label: '處理中', value: stats.processing, color: 'from-yellow-500 to-orange-500', icon: '⏳' },
              { label: '失敗', value: stats.failed, color: 'from-red-500 to-pink-500', icon: '❌' },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="glass-card p-6 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">{stat.label}</p>
                    <p className={`text-3xl font-bold mt-1 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                      {stat.value}
                    </p>
                  </div>
                  <span className="text-3xl">{stat.icon}</span>
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* 主要內容區域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左側：上傳和會議列表 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 上傳區域 */}
            <section className="glass-card p-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  📤
                </span>
                上傳會議檔案
              </h2>

              {/* 會議標題輸入 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-2">會議標題（選填）</label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="例如：NSL-技術小組進度會議-20251217會議摘要"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* 拖放上傳區 */}
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <input
                  id="fileInput"
                  type="file"
                  multiple
                  accept=".mp4,.mp3,.wav,.webm,.mov,.m4a,.pptx,.ppt,.docx,.doc"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl font-medium">拖放檔案至此處或點擊上傳</p>
                    <p className="text-gray-400 mt-2">支援 MP4、MP3、WAV、PPTX、DOCX 格式</p>
                  </div>
                </div>
              </div>

              {/* 已選擇的檔案列表 */}
              {selectedFiles.length > 0 && (
                <div className="mt-6 space-y-3">
                  <p className="text-sm font-medium text-gray-400">已選擇的檔案：</p>
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 bg-white/5 rounded-xl animate-slide-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      {getFileIcon(file.name)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 上傳進度 */}
              {isUploading && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">上傳中...</span>
                    <span className="text-sm text-gray-400">{uploadProgress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {/* 上傳按鈕 */}
              {selectedFiles.length > 0 && !isUploading && (
                <button
                  onClick={handleUpload}
                  disabled={hasApiKey === false}
                  className="btn-primary mt-6 w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  開始分析會議
                </button>
              )}
            </section>

            {/* 會議列表 */}
            <section className="glass-card p-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
                  📋
                </span>
                會議記錄列表
              </h2>

              {meetings.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <p className="text-xl font-medium text-gray-400">尚無會議記錄</p>
                  <p className="text-gray-500 mt-2">上傳您的第一個會議影片開始使用</p>
                </div>
              ) : (
                <table className="meeting-table">
                  <thead>
                    <tr>
                      <th>會議標題</th>
                      <th>日期</th>
                      <th>狀態</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((meeting, index) => (
                      <tr
                        key={meeting.id}
                        className="animate-slide-in"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <td>
                          <div className="font-medium">{meeting.title}</div>
                          {meeting.summary && (
                            <p className="text-sm text-gray-400 mt-1 line-clamp-1">{meeting.summary}</p>
                          )}
                        </td>
                        <td className="text-gray-400">{meeting.date || '—'}</td>
                        <td>
                          <StatusBadge status={meeting.status} />
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/meeting/${meeting.id}`}
                              className="btn-secondary px-4 py-2 text-sm"
                            >
                              查看詳情
                            </Link>
                            {meeting.status === 'completed' && (
                              <a
                                href={`/api/meetings/${meeting.id}/download`}
                                className="btn-primary px-4 py-2 text-sm flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                下載 Word
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          {/* 右側：Debug Panel */}
          {showDebug && (
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <DebugPanel autoRefresh={true} refreshInterval={3000} />
              </div>
            </div>
          )}
        </div>

        {/* 頁尾 */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>智能會議記錄系統 © 2024 · Powered by Google Gemini AI</p>
        </footer>
      </div>
    </main>
  );
}
