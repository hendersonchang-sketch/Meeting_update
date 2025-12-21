// 會議記錄類型定義

export interface MeetingInfo {
    title: string;
    date: string;
    location?: string;
    recorder?: string;
}

export interface Attendees {
    companyLeaders?: string[];
    technicalTeam?: string[];
    pmTeam?: string[];
    ibmTeam?: string[];
    vendors?: string[];
}

export interface KeyPoint {
    category: string;
    content: string[];
}

export interface ActionItem {
    description: string;
    assignee?: string;
    deadline?: string;
    status: 'pending' | 'in-progress' | 'completed';
}

export interface RiskItem {
    description: string;
    mitigation?: string;
    severity?: 'low' | 'medium' | 'high';
}

export interface MeetingMinutes {
    info?: MeetingInfo;
    attendees?: Attendees;
    keyPoints?: KeyPoint[];
    actionItems?: ActionItem[];
    riskItems?: RiskItem[];
    otherNotes?: string[];
    endTime?: string;
}

export interface Meeting {
    id: string;
    title: string;
    date: string;
    status: 'processing' | 'completed' | 'failed';
    created_at: string;
    updated_at: string;
    video_path?: string;
    pptx_path?: string;
    docx_path?: string;
    transcript?: string;
    summary?: string;
    minutes_json?: string;
    output_docx_path?: string;
    customer_type?: string;
    custom_prompt?: string;
    latestLog?: string;
}

export interface MeetingStats {
    total: number;
    completed: number;
    processing: number;
    failed: number;
}

export interface LogEntry {
    id: string;
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    source: string;
    message: string;
    details?: string;
    meeting_id?: string;
}
