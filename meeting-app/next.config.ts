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
  serverExternalPackages: ['better-sqlite3', 'fluent-ffmpeg'],

  // Turbopack 配置（Next.js 16 需要）
  turbopack: {},

  // Webpack 配置：排除 FFmpeg/FFprobe 二進位檔案
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 排除 FFmpeg 安裝器的二進位檔案
      config.externals = config.externals || [];
      config.externals.push({
        '@ffmpeg-installer/ffmpeg': 'commonjs @ffmpeg-installer/ffmpeg',
        '@ffprobe-installer/ffprobe': 'commonjs @ffprobe-installer/ffprobe',
        'fluent-ffmpeg': 'commonjs fluent-ffmpeg',
      });
    }

    return config;
  },
};

export default nextConfig;
