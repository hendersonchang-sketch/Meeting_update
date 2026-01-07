import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from './logger';

const logger = createLogger('VideoUtils');

// 設定 FFmpeg 路徑
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

/**
 * 影片分析配置
 */
export const VIDEO_CONFIG = {
    // 單段影片最大安全長度（秒）
    MAX_SAFE_DURATION: 20 * 60, // 20 分鐘

    // 切分時每段長度（秒）
    SEGMENT_DURATION: 18 * 60, // 18 分鐘（保留緩衝）

    // 臨時檔案目錄
    TEMP_DIR: process.env.TEMP_DIR || os.tmpdir(),
};

/**
 * 取得影片長度（秒）
 */
export async function getVideoDuration(filePath: string): Promise<number> {
    logger.info('正在偵測影片長度...', { filePath });

    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                logger.error('影片長度偵測失敗', { error: err });
                reject(err);
            } else {
                const duration = metadata.format.duration || 0;
                logger.info(`影片長度：${Math.floor(duration / 60)} 分 ${Math.floor(duration % 60)} 秒`, { duration });
                resolve(duration);
            }
        });
    });
}

/**
 * 取得影片資訊
 */
export async function getVideoInfo(filePath: string): Promise<{
    duration: number;
    durationMinutes: number;
    size: number;
    format: string;
    resolution?: string;
}> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                const duration = metadata.format.duration || 0;
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');

                resolve({
                    duration,
                    durationMinutes: Math.floor(duration / 60),
                    size: metadata.format.size || 0,
                    format: metadata.format.format_name || 'unknown',
                    resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : undefined,
                });
            }
        });
    });
}

/**
 * 切分影片為多個片段
 */
export async function splitVideo(
    inputPath: string,
    segmentDuration: number = VIDEO_CONFIG.SEGMENT_DURATION,
    outputDir?: string
): Promise<string[]> {
    const logger = createLogger('VideoUtils.Split');

    // 建立輸出目錄
    const tempDir = outputDir || path.join(VIDEO_CONFIG.TEMP_DIR, `video_split_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    logger.info('開始切分影片', { inputPath, tempDir, segmentDuration });

    try {
        const duration = await getVideoDuration(inputPath);
        const segmentCount = Math.ceil(duration / segmentDuration);

        logger.info(`計畫切分為 ${segmentCount} 段`);

        const outputPaths: string[] = [];

        for (let i = 0; i < segmentCount; i++) {
            const startTime = i * segmentDuration;
            const outputPath = path.join(tempDir, `segment_${i + 1}.mp4`);

            logger.info(`正在切分第 ${i + 1}/${segmentCount} 段...`, { startTime, outputPath });

            await new Promise<void>((resolve, reject) => {
                ffmpeg(inputPath)
                    .setStartTime(startTime)
                    .setDuration(segmentDuration)
                    .outputOptions([
                        '-c copy',  // 複製編碼（快速，不重新編碼）
                        '-avoid_negative_ts make_zero',  // 避免時間戳問題
                    ])
                    .output(outputPath)
                    .on('end', () => {
                        logger.info(`第 ${i + 1}/${segmentCount} 段切分完成`, { outputPath });
                        resolve();
                    })
                    .on('error', (err) => {
                        logger.error(`第 ${i + 1}/${segmentCount} 段切分失敗`, { error: err });
                        reject(err);
                    })
                    .on('progress', (progress) => {
                        logger.debug(`第 ${i + 1}/${segmentCount} 段切分進度：${progress.percent?.toFixed(1)}%`);
                    })
                    .run();
            });

            outputPaths.push(outputPath);
        }

        logger.info(`影片切分完成，共 ${outputPaths.length} 段`);
        return outputPaths;

    } catch (error) {
        logger.error('影片切分失敗', { error });
        // 清理失敗的臨時檔案
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }
        throw error;
    }
}

/**
 * 清理臨時檔案
 */
export async function cleanupTempFiles(dirPath: string): Promise<void> {
    try {
        logger.info('清理臨時檔案', { dirPath });
        await fs.rm(dirPath, { recursive: true, force: true });
        logger.info('臨時檔案清理完成');
    } catch (error) {
        logger.warn('臨時檔案清理失敗', { error });
    }
}
