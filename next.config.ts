import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 支援大檔案上傳（最大 500MB）
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // 關閉嚴格模式以避免重複渲染
  reactStrictMode: false,
  // 設定伺服器端逾時時間（10 分鐘）
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
