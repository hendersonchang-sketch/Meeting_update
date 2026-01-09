// 會議記錄系統的型別定義

// 會議基本資訊
export interface MeetingInfo {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
    recorder: string;
    chairman?: string;
}

// 出席者分類
export interface Attendees {
    companyLeaders: string[];      // 南山長官
    technicalTeam: string[];       // 技術小組代表
    pmTeam: string[];              // PM代表
    ibmTeam: string[];             // IBM代表
    vendors: string[];             // 參與廠商
}

// 重點紀錄項目
export interface KeyPoint {
    category: string;              // 分類（如：機房搬遷、機房服務等）
    content: string[];             // 詳細內容列表
}

// 待辦事項
export interface ActionItem {
    description: string;           // 事項描述
    assignee?: string;             // 負責人
    dueDate?: string;              // 預計完成日期
    status: 'pending' | 'in-progress' | 'completed';
}

// 風險管理事項
export interface RiskItem {
    description: string;
    severity?: 'low' | 'medium' | 'high';
    mitigation?: string;
}

// 完整會議記錄
export interface MeetingMinutes {
    info: MeetingInfo;
    attendees: Attendees;
    keyPoints: KeyPoint[];
    actionItems: ActionItem[];
    riskItems: RiskItem[];
    otherNotes: string[];
    endTime: string;
}

// 資料庫儲存的會議記錄
export interface MeetingRecord {
    id: string;
    created_at: string;
    updated_at: string;
    title: string;
    date: string;
    status: 'processing' | 'completed' | 'failed' | 'aborted';
    video_path?: string;
    pptx_path?: string;
    docx_path?: string;
    transcript?: string;
    summary?: string;
    minutes_json?: string;
    output_docx_path?: string;
}

// API 回應格式
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// 檔案上傳資訊
export interface UploadedFile {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    path: string;
}

// Gemini 分析結果
export interface GeminiAnalysisResult {
    transcript: string;            // 逐字稿
    summary: string;               // 摘要
    minutes: MeetingMinutes;       // 結構化會議記錄
    speakers: string[];            // 發言者列表
    emotions?: Record<string, string>; // 情緒分析
}
