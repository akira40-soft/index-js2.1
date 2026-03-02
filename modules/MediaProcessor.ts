/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: MediaProcessor
 * ═══════════════════════════════════════════════════════════════════════
 * Gerencia processamento de mídia: imagens, vídeos, stickers, YouTube
 * Download, conversão, criação de stickers personalizados
 * ═══════════════════════════════════════════════════════════════════════
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import util from 'util';
const execAsync = util.promisify(exec);
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import ConfigManager from './ConfigManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Webpmux para metadados de stickers
let Webpmux: any = null;
try {
    Webpmux = await import('node-webpmux').then(m => m.default || m);
} catch (e: any) {
    console.warn('⚠️ node-webpmux não instalado. Stickers sem metadados EXIF.');
}

class MediaProcessor {
    private config: any;
    private logger: any;
    private tempFolder: string;
    private downloadCache: Map<string, any>;

    constructor(logger: any = null) {
        this.config = ConfigManager.getInstance();
        this.logger = logger || console;
        this.tempFolder = this.config?.TEMP_FOLDER || './temp';
        this.downloadCache = new Map();

        // Garante que a pasta temporária exista
        if (!fs.existsSync(this.tempFolder)) {
            try {
                fs.mkdirSync(this.tempFolder, { recursive: true });
                this.logger?.info(`📁 Diretório temporário criado: ${this.tempFolder}`);
            } catch (dirErr: any) {
                this.logger.error(`❌ Erro ao criar pasta temporária:`, dirErr.message);
            }
        }
    }

    /**
     * Estratégias de bypass para YouTube
     */
    private _getClientStrategies(): Array<{ client: string; args: string }> {
        const cookiesPath = this.config?.YT_COOKIES_PATH || '';
        const cookieArg = (cookiesPath && fs.existsSync(cookiesPath)) ? `--cookies "${cookiesPath}"` : '';

        const possibleCookiePaths = [
            './cookies.txt',
            '/app/cookies.txt',
            './youtube_cookies.txt',
            '/tmp/akira_data/cookies/youtube_cookies.txt'
        ];

        let finalCookieArg = cookieArg;
        if (!finalCookieArg) {
            for (const p of possibleCookiePaths) {
                if (fs.existsSync(p)) {
                    finalCookieArg = `--cookies "${path.resolve(p)}"`;
                    break;
                }
            }
        }

        const baseSleepArgs = '--sleep-requests 1 --sleep-interval 2 --max-sleep-interval 5 --no-check-certificates --ignore-config --no-cache-dir';
        const ua_iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15';
        const ua_android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
        const ua_chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

        const strategies: Array<{ client: string; args: string }> = [];

        strategies.push({ 
            client: 'ios', 
            args: `--extractor-args "youtube:player_client=ios" ${finalCookieArg || ''} ${baseSleepArgs} --user-agent "${ua_iphone}"` 
        });

        if (finalCookieArg) {
            strategies.push({ 
                client: 'web+cookies', 
                args: `--extractor-args "youtube:player_client=web" ${finalCookieArg} ${baseSleepArgs} --user-agent "${ua_chrome}"` 
            });
        }

        strategies.push({ 
            client: 'tv_embedded', 
            args: `--extractor-args "youtube:player_client=tv_embedded" ${baseSleepArgs} --user-agent "${ua_iphone}"` 
        });

        strategies.push({ 
            client: 'android', 
            args: `--extractor-args "youtube:player_client=android" ${baseSleepArgs} --user-agent "${ua_android}"` 
        });

        return strategies;
    }

    /**
     * Executa yt-dlp com fallback entre strategies
     */
    private async _runYtDlpWithFallback(
        buildCommand: (bypassArgs: string) => string,
        expectedOutputPath?: string,
        captureOutput: boolean = false
    ): Promise<{ sucesso: boolean; output?: string; error?: string }> {
        const strategies = this._getClientStrategies();
        let lastError = '';

        for (const strategy of strategies) {
            const command = buildCommand(strategy.args);
            
            const result = await new Promise<{ sucesso: boolean; output?: string; error?: string }>((resolve) => {
                exec(command, { timeout: 300000, maxBuffer: 100 * 1024 * 1024 }, (error, stdout, stderr) => {
                    // First check: if we expect an output file, check if it exists
                    if (expectedOutputPath && fs.existsSync(expectedOutputPath)) {
                        return resolve({ sucesso: true, output: stdout });
                    }

                    // Second check: if we want to capture stdout (like for JSON metadata)
                    if (captureOutput && stdout && stdout.trim()) {
                        return resolve({ sucesso: true, output: stdout });
                    }

                    // Error handling
                    const errMsg = (stderr || error?.message || 'Falha').trim();
                    
                    // For specific errors that should trigger fallback
                    if (errMsg.includes('Sign in') || errMsg.includes('bot') || errMsg.includes('403') || 
                        errMsg.includes('HTTP Error 403') || errMsg.includes('Unable to extract')) {
                        lastError = errMsg;
                        resolve({ sucesso: false, error: errMsg });
                    } else if (!captureOutput && expectedOutputPath) {
                        // For file downloads, any error is a failure
                        resolve({ sucesso: false, error: errMsg });
                    } else if (captureOutput && !stdout) {
                        // For output capture, empty stdout with error is a failure
                        resolve({ sucesso: false, error: errMsg || 'Saída vazia' });
                    } else if (captureOutput && stdout) {
                        // We have some output, consider it success even with some stderr
                        resolve({ sucesso: true, output: stdout });
                    } else {
                        resolve({ sucesso: false, error: errMsg });
                    }
                });
            });

            if (result.sucesso) return result;
        }

        return { sucesso: false, error: lastError || 'Todos os métodos falharam' };
    }

    /**
     * Simplified yt-dlp execution for metadata only
     * Uses direct execution without complex fallback for better debugging
     */
    private async _getYouTubeMetadataSimple(url: string): Promise<{ sucesso: boolean; output?: string; error?: string }> {
        const strategies = this._getClientStrategies();
        
        for (const strategy of strategies) {
            const args = strategy.args;
            // Don't suppress stderr for metadata - we need to see errors
            const command = `yt-dlp ${args} --dump-json --no-download "${url}"`;
            
            try {
                const { stdout, stderr } = await execAsync(command, { 
                    timeout: 60000,
                    maxBuffer: 10 * 1024 * 1024 
                });
                
                if (stdout && stdout.trim()) {
                    return { sucesso: true, output: stdout };
                }
                
                if (stderr && (stderr.includes('403') || stderr.includes('Sign in'))) {
                    continue; // Try next strategy
                }
            } catch (err: any) {
                const errMsg = err.message || '';
                if (errMsg.includes('403') || errMsg.includes('Sign in') || errMsg.includes('bot')) {
                    continue; // Try next strategy
                }
                // For other errors, log but continue
                this.logger?.warn(`⚠️ Metadata attempt failed: ${errMsg.substring(0, 100)}`);
            }
        }
        
        return { sucesso: false, error: 'Não foi possível obter metadados após várias tentativas' };
    }

    /**
     * ═══════════════════════════════════════════════════════════════════
     * DOWNLOAD DE ÁUDIO DO YOUTUBE - MÉTODO PRINCIPAL
     * ═══════════════════════════════════════════════════════════════════
     */
    async downloadYouTubeAudio(url: string): Promise<{ sucesso: boolean; buffer?: Buffer; filePath?: string; error?: string; metadata?: any }> {
        try {
            this.logger?.info(`🎵 Download áudio: ${url}`);

            const metadata = await this.getYouTubeMetadata(url);
            if (!metadata.sucesso) {
                return { sucesso: false, error: metadata.error || 'Metadados não obtidos' };
            }

            const outputPath = this.generateRandomFilename('mp3');

            const result = await this._runYtDlpWithFallback(
                (bypassArgs) => `yt-dlp ${bypassArgs} -f "bestaudio[ext=m4a]/bestaudio/best" --extract-audio --audio-format mp3 --audio-quality 2 -o "${outputPath}" "${url}"`,
                outputPath
            );

            if (!result.sucesso || !fs.existsSync(outputPath)) {
                return { sucesso: false, error: result.error || 'Falha no download' };
            }

            const buffer = await fs.promises.readFile(outputPath);
            await this.cleanupFile(outputPath);

            return {
                sucesso: true,
                buffer,
                metadata: {
                    titulo: metadata.titulo,
                    canal: metadata.canal,
                    duracao: metadata.duracao,
                    duracaoFormatada: metadata.duracaoFormatada,
                    thumbnail: metadata.thumbnail
                }
            };
        } catch (error: any) {
            return { sucesso: false, error: error.message };
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════
     * DOWNLOAD DE VÍDEO DO YOUTUBE
     * ═══════════════════════════════════════════════════════════════════
     */
    async downloadYouTubeVideo(url: string, quality: string = '720'): Promise<{ sucesso: boolean; buffer?: Buffer; error?: string; metadata?: any }> {
        try {
            this.logger?.info(`🎬 Download vídeo: ${url}`);

            const metadata = await this.getYouTubeMetadata(url);
            if (!metadata.sucesso) {
                return { sucesso: false, error: metadata.error };
            }

            const outputPath = this.generateRandomFilename('mp4');
            const formatSelector = quality === '1080' ? 'bestvideo[height<=1080]+bestaudio/best' :
                                   quality === '720' ? 'bestvideo[height<=720]+bestaudio/best' :
                                   'bestvideo[height<=480]+bestaudio/best';

            const result = await this._runYtDlpWithFallback(
                (bypassArgs) => `yt-dlp ${bypassArgs} -f "${formatSelector}" --merge-output-format mp4 -o "${outputPath}" "${url}"`,
                outputPath
            );

            if (!result.sucesso || !fs.existsSync(outputPath)) {
                return { sucesso: false, error: result.error || 'Falha no download' };
            }

            const buffer = await fs.promises.readFile(outputPath);
            await this.cleanupFile(outputPath);

            return {
                sucesso: true,
                buffer,
                metadata: {
                    titulo: metadata.titulo,
                    canal: metadata.canal,
                    duracao: metadata.duracao,
                    duracaoFormatada: metadata.duracaoFormatada,
                    thumbnail: metadata.thumbnail
                }
            };
        } catch (error: any) {
            return { sucesso: false, error: error.message };
        }
    }

    /**
     * Obtém metadados de vídeo do YouTube
     * Usa método simplificado para melhor reliability
     */
    async getYouTubeMetadata(url: string): Promise<any> {
        try {
            // First try with the simple method
            let result = await this._getYouTubeMetadataSimple(url);
            
            // If simple method fails, try with the fallback method
            if (!result.sucesso || !result.output) {
                result = await this._runYtDlpWithFallback(
                    (bypassArgs) => `yt-dlp ${bypassArgs} --dump-json --no-download "${url}"`,
                    undefined,
                    true
                );
            }

            if (!result.sucesso || !result.output) {
                // Try one more time with a simple approach
                try {
                    const simpleCommand = `yt-dlp --dump-json --no-download "${url}"`;
                    const { stdout } = await execAsync(simpleCommand, { timeout: 30000 });
                    if (stdout && stdout.trim()) {
                        result = { sucesso: true, output: stdout };
                    }
                } catch (e) {
                    // Ignore and return error
                }
                
                if (!result.sucesso || !result.output) {
                    return { sucesso: false, error: result.error || 'Não foi possível obter metadados' };
                }
            }

            // Parse JSON output from yt-dlp
            let data;
            try {
                data = JSON.parse(result.output.trim());
            } catch (parseError) {
                // If JSON parsing fails, try to extract from multi-line output
                const lines = result.output.trim().split('\n');
                for (const line of lines) {
                    try {
                        data = JSON.parse(line.trim());
                        break;
                    } catch (e) {
                        continue;
                    }
                }
                if (!data) {
                    return { sucesso: false, error: 'Formato de resposta inválido' };
                }
            }

            return {
                sucesso: true,
                titulo: data.title || 'Título desconhecido',
                canal: data.channel || data.uploader || 'Canal desconhecido',
                duracao: data.duration || 0,
                duracaoFormatada: this._formatDuration(data.duration || 0),
                views: this._formatCount(data.view_count || 0),
                thumbnail: data.thumbnail || '',
                url: data.webpage_url || url,
                id: data.id || ''
            };
        } catch (error: any) {
            return { sucesso: false, error: error.message };
        }
    }

    /**
     * Formata duração em segundos para MM:SS ou HH:MM:SS
     */
    private _formatDuration(seconds: number): string {
        if (!seconds || seconds <= 0) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Formata números grandes (K, M, B)
     */
    private _formatCount(num: number): string {
        if (!num || num <= 0) return '0';
        if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    }

    /**
     * Gera nome de arquivo aleatório
     */
    generateRandomFilename(ext: string = ''): string {
        return path.join(
            this.tempFolder,
            `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? '.' + ext : ''}`
        );
    }

    /**
     * Limpa arquivo temporário
     */
    async cleanupFile(filePath: string): Promise<void> {
        try {
            if (!filePath || !fs.existsSync(filePath)) return;
            await fs.promises.unlink(filePath).catch(() => {});
        } catch (e) {
            // Silencioso
        }
    }

    /**
     * Download de mídia via Baileys
     */
    async downloadMedia(message: any, mimeType: string = 'image'): Promise<Buffer | null> {
        try {
            if (!message) {
                this.logger?.error('❌ Mensagem é null');
                return null;
            }

            const extractMediaContainer = (msgObj: any): any => {
                if (!msgObj || typeof msgObj !== 'object') return null;
                if (msgObj.mediaKey && (msgObj.url || msgObj.directPath)) return msgObj;

                const wraps = [
                    msgObj.viewOnceMessageV2?.message,
                    msgObj.viewOnceMessageV2Extension?.message,
                    msgObj.viewOnceMessage?.message,
                    msgObj.ephemeralMessage?.message,
                    msgObj.documentWithCaptionMessage?.message,
                    msgObj.editMessage?.message,
                    msgObj.protocolMessage?.editedMessage,
                    msgObj.message
                ];

                for (const w of wraps) {
                    if (w) {
                        const found = extractMediaContainer(w);
                        if (found) return found;
                    }
                }

                const subKeys = ['imageMessage', 'videoMessage', 'stickerMessage', 'audioMessage', 'documentMessage'];
                for (const k of subKeys) {
                    if (msgObj[k]) {
                        const found = extractMediaContainer(msgObj[k]);
                        if (found) return found;
                    }
                }

                return null;
            };

            const mediaContent = extractMediaContainer(message);
            if (!mediaContent) {
                this.logger?.error('❌ Mídia não encontrada');
                return null;
            }

            let finalMimeType = mimeType;
            if (mediaContent.mimetype) {
                if (mediaContent.mimetype.includes('image')) finalMimeType = 'image';
                else if (mediaContent.mimetype.includes('video')) finalMimeType = 'video';
                else if (mediaContent.mimetype.includes('audio')) finalMimeType = 'audio';
            }

            let buffer = Buffer.from([]);
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const stream = await downloadContentFromMessage(mediaContent, finalMimeType as any);
                    for await (const chunk of stream as any) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }
                    if (buffer.length > 0) break;
                } catch (err: any) {
                    this.logger?.warn(`⚠️ Tentativa ${attempt} falhou: ${err.message}`);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            if (buffer.length < 100) {
                this.logger?.error(`❌ Buffer muito pequeno: ${buffer.length} bytes`);
                return null;
            }

            return buffer;
        } catch (e: any) {
            this.logger?.error('❌ Erro ao baixar mídia:', e.message);
            return null;
        }
    }

    /**
     * Converte buffer para base64
     */
    bufferToBase64(buffer: Buffer): string | null {
        if (!buffer) return null;
        return buffer.toString('base64');
    }

    /**
     * Converte base64 para buffer
     */
    base64ToBuffer(base64String: string): Buffer | null {
        if (!base64String) return null;
        return Buffer.from(base64String, 'base64');
    }

    /**
     * Busca buffer de URL externa
     */
    async fetchBuffer(url: string): Promise<Buffer | null> {
        try {
            const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
            return Buffer.from(res.data);
        } catch (e) {
            return null;
        }
    }

    /**
     * Adiciona metadados EXIF ao sticker
     */
    async addStickerMetadata(webpBuffer: Buffer, packName: string = 'akira-bot', author: string = 'Akira-Bot'): Promise<Buffer> {
        let tempInput: string | null = null;
        let tempOutput: string | null = null;
        
        try {
            if (!Webpmux) return webpBuffer;

            tempInput = this.generateRandomFilename('webp');
            tempOutput = this.generateRandomFilename('webp');

            await fs.promises.writeFile(tempInput, webpBuffer);

            const img = new Webpmux.Image();
            await img.load(tempInput);

            const json = {
                'sticker-pack-id': `akira-${crypto.randomBytes(8).toString('hex')}`,
                'sticker-pack-name': String(packName).trim().slice(0, 30),
                'sticker-pack-publisher': String(author).trim().slice(0, 30),
                'emojis': ['🎨', '🤖']
            };

            const exifAttr = Buffer.from([
                0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
                0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x16, 0x00, 0x00, 0x00
            ]);

            const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
            const exif = Buffer.concat([exifAttr, jsonBuff]);
            exif.writeUIntLE(jsonBuff.length, 14, 4);

            img.exif = exif;

            if (img.anim?.frames?.length > 0) {
                await img.muxAnim({
                    path: tempOutput,
                    frames: img.anim.frames,
                    loops: img.anim.loops || 0,
                    exif: exif
                });
            } else {
                await img.save(tempOutput);
            }

            const result = await fs.promises.readFile(tempOutput);

            if (tempInput) await this.cleanupFile(tempInput);
            if (tempOutput) await this.cleanupFile(tempOutput);

            return result;
        } catch (e: any) {
            if (tempInput) await this.cleanupFile(tempInput);
            if (tempOutput) await this.cleanupFile(tempOutput);
            return webpBuffer;
        }
    }

    /**
     * Cria sticker de imagem
     */
    async createStickerFromImage(imageBuffer: Buffer, metadata: any = {}): Promise<any> {
        try {
            const inputPath = this.generateRandomFilename('jpg');
            const outputPath = this.generateRandomFilename('webp');

            await fs.promises.writeFile(inputPath, imageBuffer);

            const { packName = 'akira-bot', author = 'Akira-Bot' } = metadata;
            const videoFilter = 'scale=512:512:flags=lanczos:force_original_aspect_ratio=increase,crop=512:512';

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions([
                        '-vcodec', 'libwebp',
                        '-vf', videoFilter,
                        '-s', '512x512',
                        '-lossless', '0',
                        '-compression_level', '4',
                        '-q:v', '75',
                        '-preset', 'default',
                        '-y'
                    ])
                    .on('end', () => resolve(void 0))
                    .on('error', (err) => reject(err))
                    .save(outputPath);
            });

            if (!fs.existsSync(outputPath)) {
                throw new Error('Arquivo não criado');
            }

            const stickerBuffer = await fs.promises.readFile(outputPath);
            const stickerComMetadados = await this.addStickerMetadata(stickerBuffer, packName, author);

            await this.cleanupFile(inputPath);
            await this.cleanupFile(outputPath);

            return {
                sucesso: true,
                buffer: stickerComMetadados,
                tipo: 'sticker_image',
                size: stickerComMetadados.length
            };
        } catch (error: any) {
            return { sucesso: false, error: error.message };
        }
    }

    /**
     * Cria sticker animado de vídeo
     */
    async createAnimatedStickerFromVideo(videoBuffer: Buffer, maxDuration: number | string = 30, metadata: any = {}): Promise<any> {
        try {
            const cfgMax = parseInt(this.config?.STICKER_MAX_ANIMATED_SECONDS || '30');
            const duration = Math.min(parseInt(String(maxDuration || cfgMax)), 10);

            const inputPath = this.generateRandomFilename('mp4');
            const outputPath = this.generateRandomFilename('webp');

            await fs.promises.writeFile(inputPath, videoBuffer);

            const { packName = 'akira-bot', author = 'Akira-Bot' } = metadata;
            const videoFilter = `fps=15,scale=512:512:flags=lanczos:force_original_aspect_ratio=increase,crop=512:512`;

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions([
                        '-vcodec', 'libwebp',
                        '-vf', videoFilter,
                        '-s', '512x512',
                        '-loop', '0',
                        '-lossless', '0',
                        '-compression_level', '6',
                        '-q:v', '75',
                        '-preset', 'default',
                        '-an',
                        '-t', String(duration),
                        '-y'
                    ])
                    .on('end', () => resolve(void 0))
                    .on('error', (err) => reject(err))
                    .save(outputPath);
            });

            if (!fs.existsSync(outputPath)) {
                throw new Error('Arquivo não criado');
            }

            let stickerBuffer = await fs.promises.readFile(outputPath);

            // Reduz qualidade se muito grande
            if (stickerBuffer.length > 500 * 1024) {
                await this.cleanupFile(outputPath);
                
                await new Promise((resolve, reject) => {
                    ffmpeg(inputPath)
                        .outputOptions([
                            '-vcodec', 'libwebp',
                            '-vf', videoFilter,
                            '-s', '512x512',
                            '-loop', '0',
                            '-lossless', '0',
                            '-compression_level', '9',
                            '-q:v', '50',
                            '-preset', 'picture',
                            '-an',
                            '-t', String(duration),
                            '-y'
                        ])
                        .on('end', () => resolve(void 0))
                        .on('error', reject)
                        .save(outputPath);
                });

                stickerBuffer = await fs.promises.readFile(outputPath);
                
                if (stickerBuffer.length > 500 * 1024) {
                    await this.cleanupFile(inputPath);
                    await this.cleanupFile(outputPath);
                    return { sucesso: false, error: 'Sticker muito grande (>500KB)' };
                }
            }

            const stickerComMetadados = await this.addStickerMetadata(stickerBuffer, packName, author);

            await this.cleanupFile(inputPath);
            await this.cleanupFile(outputPath);

            return {
                sucesso: true,
                buffer: stickerComMetadados,
                tipo: 'sticker_animado',
                size: stickerComMetadados.length
            };
        } catch (error: any) {
            return { sucesso: false, error: error.message };
        }
    }

    /**
     * Converte vídeo para áudio
     */
    async convertVideoToAudio(videoBuffer: Buffer): Promise<any> {
        try {
            const inputPath = this.generateRandomFilename('mp4');
            const outputPath = this.generateRandomFilename('mp3');

            await fs.promises.writeFile(inputPath, videoBuffer);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .toFormat('mp3')
                    .audioCodec('libmp3lame')
                    .on('end', () => resolve(void 0))
                    .on('error', reject)
                    .save(outputPath);
            });

            const audioBuffer = await fs.promises.readFile(outputPath);
            await this.cleanupFile(inputPath);
            await this.cleanupFile(outputPath);

            return { sucesso: true, buffer: audioBuffer };
        } catch (e: any) {
            return { sucesso: false, error: e.message };
        }
    }

    /**
     * Converte sticker para imagem
     */
    async convertStickerToImage(stickerBuffer: Buffer): Promise<any> {
        try {
            const inputPath = this.generateRandomFilename('webp');
            const outputPath = this.generateRandomFilename('png');

            await fs.promises.writeFile(inputPath, stickerBuffer);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions('-vcodec', 'png')
                    .on('end', () => resolve(void 0))
                    .on('error', reject)
                    .save(outputPath);
            });

            if (!fs.existsSync(outputPath)) {
                throw new Error('Arquivo não criado');
            }

            const imageBuffer = await fs.promises.readFile(outputPath);
            await this.cleanupFile(inputPath);
            await this.cleanupFile(outputPath);

            return { sucesso: true, buffer: imageBuffer, tipo: 'imagem' };
        } catch (error: any) {
            return { sucesso: false, error: error.message };
        }
    }

    /**
     * Detecta view-once na mensagem
     */
    detectViewOnce(message: any): any {
        if (!message) return null;
        try {
            if (message.viewOnceMessageV2?.message) return message.viewOnceMessageV2.message;
            if (message.viewOnceMessageV2Extension?.message) return message.viewOnceMessageV2Extension.message;
            if (message.viewOnceMessage?.message) return message.viewOnceMessage.message;
            if (message.ephemeralMessage?.message) return message.ephemeralMessage.message;
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Extrai conteúdo de view-once
     */
    async extractViewOnceContent(quoted: any): Promise<any> {
        try {
            if (!quoted) {
                return { sucesso: false, error: 'Nenhuma mensagem citada' };
            }

            let target = quoted;
            if (quoted.viewOnceMessageV2?.message) target = quoted.viewOnceMessageV2.message;
            else if (quoted.viewOnceMessageV2Extension?.message) target = quoted.viewOnceMessageV2Extension.message;
            else if (quoted.viewOnceMessage?.message) target = quoted.viewOnceMessage.message;
            else if (quoted.ephemeralMessage?.message) target = quoted.ephemeralMessage.message;

            const hasImage = target.imageMessage;
            const hasVideo = target.videoMessage;
            const hasAudio = target.audioMessage;
            const hasSticker = target.stickerMessage;

            if (!hasImage && !hasVideo && !hasAudio && !hasSticker) {
                return { sucesso: false, error: 'Não é view-once ou não contém mídia' };
            }

            let buffer: Buffer | null = null;
            let tipo = '';
            let mimeType = '';

            if (hasImage) {
                buffer = await this.downloadMedia(target.imageMessage, 'image');
                tipo = 'image';
                mimeType = target.imageMessage.mimetype || 'image/jpeg';
            } else if (hasVideo) {
                buffer = await this.downloadMedia(target.videoMessage, 'video');
                tipo = 'video';
                mimeType = target.videoMessage.mimetype || 'video/mp4';
            } else if (hasAudio) {
                buffer = await this.downloadMedia(target.audioMessage, 'audio');
                tipo = 'audio';
                mimeType = target.audioMessage.mimetype || 'audio/mpeg';
            } else if (hasSticker) {
                buffer = await this.downloadMedia(target.stickerMessage, 'sticker');
                tipo = 'sticker';
                mimeType = target.stickerMessage.mimetype || 'image/webp';
            }

            if (!buffer) {
                return { sucesso: false, error: 'Erro ao baixar conteúdo' };
            }

            return { sucesso: true, tipo, buffer, size: buffer.length, mimeType };
        } catch (error: any) {
            return { sucesso: false, error: error.message };
        }
    }
}

export default MediaProcessor;
