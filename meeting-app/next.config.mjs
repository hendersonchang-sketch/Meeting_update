/** @type {import('next').NextConfig} */
const nextConfig = {
    // 啟用實驗性功能
    experimental: {
        serverActions: {
            bodySizeLimit: '100mb',
        },
    },
};

export default nextConfig;
