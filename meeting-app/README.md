# 🎙️ 智能會議記錄系統

上傳會議影音檔，自動生成專業會議記錄、摘要和追蹤事項。

## ✨ 功能特色

- 📹 **影音分析** - 支援 MP4、MP3、WAV、WebM、MOV 等格式
- 🎤 **語音轉文字** - 使用 Google Gemini AI 進行高精度轉錄
- 👥 **發言人辨識** - 自動識別不同發言者
- 📝 **智能摘要** - 自動生成會議重點摘要
- ✅ **追蹤事項** - 提取待辦事項和負責人
- 📄 **Word 輸出** - 按照固定格式生成 Word 文件
- 💾 **歷史記錄** - 儲存所有會議記錄

## 🚀 快速開始

### 1. 安裝依賴

```bash
cd meeting-app
npm install
```

### 2. 設定環境變數

編輯 `.env.local` 檔案，填入您的 Gemini API Key：

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

您可以在 [Google AI Studio](https://aistudio.google.com/) 免費取得 API Key。

### 3. 啟動開發伺服器

```bash
npm run dev
```

開啟瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

## 📁 專案結構

```
meeting-app/
├── app/
│   ├── api/
│   │   ├── meetings/        # 會議記錄 API
│   │   │   ├── route.ts     # GET 所有會議
│   │   │   └── [id]/
│   │   │       ├── route.ts      # GET/PATCH/DELETE 單一會議
│   │   │       └── download/
│   │   │           └── route.ts  # 下載 Word 文件
│   │   └── upload/
│   │       └── route.ts     # 檔案上傳
│   ├── meeting/
│   │   └── [id]/
│   │       └── page.tsx     # 會議詳情頁面
│   ├── globals.css          # 全域樣式
│   ├── layout.tsx           # 根佈局
│   └── page.tsx             # 首頁
├── lib/
│   ├── database.ts          # SQLite 資料庫模組
│   ├── docx-generator.ts    # Word 文件生成器
│   ├── gemini.ts            # Gemini API 整合
│   └── types.ts             # TypeScript 型別定義
├── data/                    # SQLite 資料庫檔案
├── uploads/                 # 上傳的檔案
├── outputs/                 # 生成的 Word 文件
└── .env.local               # 環境變數設定
```

## 📋 Word 輸出格式

系統會按照以下固定格式生成 Word 文件：

```
南山人壽
114年度新機房基礎架構建置技術小組進度會議紀錄

時間：民國XXX年X月X日（星期X）下午X時X分
地點：XXX        記錄：XXX
出席：南山長官：XXX
      技術小組代表：XXX
      PM代表：XXX
      IBM代表：XXX
      參與廠商：XXX

討論紀錄與重點紀錄：

一 重點紀錄
  • 機房搬遷：
    - 詳細內容...
  • 機房服務：
    - 詳細內容...
  ...

二 待辦事項：
  - 項目列表...

三 風險管理事項：
＊必要時風險評估需依循南山內部程序進行（如風管、法遵、資安等）
  - 無/有風險項目...

四 其他事項紀錄
  - 無/其他事項...

散會：下午X時X分
```

## 🔧 技術架構

- **前端**: Next.js 16 + React 19 + Tailwind CSS
- **後端**: Next.js API Routes
- **AI**: Google Gemini 2.0 Flash
- **資料庫**: SQLite (better-sqlite3)
- **文件生成**: docx

## ⚠️ 注意事項

1. 影片檔案大小限制：500MB
2. 支援的影音格式：MP4、MP3、WAV、WebM、MOV、M4A
3. 支援的文件格式：PPTX、DOCX
4. 處理時間視影片長度而定，通常需要 2-5 分鐘

## 📝 License

MIT License
