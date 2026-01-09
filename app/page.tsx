'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import DebugPanel from '@/components/DebugPanel';

interface Meeting {
  id: string;
  title: string;
  date: string;
  status: 'processing' | 'completed' | 'failed' | 'aborted';
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
  const [selectedRole, setSelectedRole] = useState('secretary');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [showDebug, setShowDebug] = useState(false);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

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
        const meetingId = data.data.meetingId;
        const currentRole = selectedRole;

        fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId, role: currentRole })
        }).catch(err => console.error("Auto-analysis trigger failed:", err));

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 中斷分析
  const handleAbort = async (meetingId: string) => {
    if (!confirm('確定要中斷此分析？')) return;
    try {
      const res = await fetch('/api/analyze/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId }),
      });
      const data = await res.json();
      if (data.success) {
        loadMeetings();
      } else {
        alert(data.error || '中斷失敗');
      }
    } catch (error) {
      console.error('中斷失敗:', error);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      processing: { class: 'status-processing', text: '處理中' },
      completed: { class: 'status-completed', text: '已完成' },
      failed: { class: 'status-failed', text: '失敗' },
      aborted: { class: 'status-aborted', text: '已中斷' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.processing;
    return (
      <span className={`status-badge ${config.class}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">會議記錄</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">上傳影音檔案，AI 自動生成會議紀要</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`btn-ghost ${showDebug ? 'text-[var(--accent-orange)]' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* API Key 警告 */}
      {hasApiKey === false && (
        <div className="card mb-6 border-[var(--accent-orange)] bg-[rgba(245,158,11,0.1)]">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-medium text-[var(--accent-orange)]">API Key 尚未設定</p>
              <p className="text-sm text-[var(--text-secondary)]">
                請前往 <Link href="/settings" className="underline hover:text-[var(--text-primary)]">設定頁面</Link> 輸入 Gemini API Key
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 統計卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: '總會議數', value: stats.total, color: 'var(--accent-purple)' },
          { label: '已完成', value: stats.completed, color: 'var(--accent-green)' },
          { label: '處理中', value: stats.processing, color: 'var(--accent-blue)' },
          { label: '失敗', value: stats.failed, color: 'var(--accent-red)' },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：上傳與列表 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 上傳區域 */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">上傳會議檔案</h2>
            </div>

            {/* 會議標題 */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-2">會議標題（選填）</label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="例如：技術小組週會 2026-01-09"
              />
            </div>

            {/* 角色選擇 */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-2">分析角色</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="secretary">專業會議秘書 - 詳細流水帳</option>
                <option value="pmo">PMO 專案經理 - 重點摘要</option>
              </select>
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
              <div className="flex flex-col items-center gap-3">
                <svg className="w-8 h-8 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="text-center">
                  <p className="font-medium text-[var(--text-primary)]">拖放檔案或點擊上傳</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">支援 MP4、MP3、WAV、PPTX、DOCX</p>
                </div>
              </div>
            </div>

            {/* 已選檔案 */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-md">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button onClick={() => removeFile(index)} className="btn-ghost p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 進度條 */}
            {isUploading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--text-secondary)]">上傳中...</span>
                  <span className="text-[var(--text-tertiary)]">{uploadProgress}%</span>
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
                className="btn-primary w-full mt-4 justify-center disabled:opacity-50"
              >
                開始分析
              </button>
            )}
          </div>

          {/* 會議列表 */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">最近會議</h2>
              <span className="text-xs text-[var(--text-tertiary)]">{meetings.length} 筆</span>
            </div>

            {meetings.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 mx-auto text-[var(--text-disabled)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-[var(--text-tertiary)] mt-4">尚無會議記錄</p>
              </div>
            ) : (
              <table className="meeting-table">
                <thead>
                  <tr>
                    <th>標題</th>
                    <th>日期</th>
                    <th>狀態</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((meeting) => (
                    <tr key={meeting.id}>
                      <td>
                        <div className="font-medium">{meeting.title}</div>
                      </td>
                      <td className="text-[var(--text-secondary)]">{meeting.date || '—'}</td>
                      <td><StatusBadge status={meeting.status} /></td>
                      <td>
                        <div className="flex items-center gap-2 justify-end">
                          <Link href={`/meeting/${meeting.id}`} className="btn-secondary text-xs py-1 px-3">
                            查看
                          </Link>
                          {meeting.status === 'processing' && (
                            <button
                              onClick={() => handleAbort(meeting.id)}
                              className="btn-ghost text-xs py-1 px-3 text-[var(--accent-red)] hover:bg-[rgba(239,68,68,0.1)]"
                            >
                              中斷
                            </button>
                          )}
                          {meeting.status === 'completed' && (
                            <a href={`/api/meetings/${meeting.id}/download`} className="btn-primary text-xs py-1 px-3">
                              下載
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
    </div>
  );
}
