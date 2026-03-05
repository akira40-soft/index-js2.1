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

// Webpmux para metadados de stickers - carregado dinamicamente
let Webpmux: any = null;

async function loadWebpmux() {
    try {
        Webpmux = await import('node-webpmux').then(m => m.default || m);
    } catch (e: any) {
        console.warn('⚠️ node-webpmux não instalado. Stickers sem metadados EXIF.');
    }
}

// Carrega Webpmux asynchronously
loadWebpmux();

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
     * Encontra o caminho do cookie válido
     */
    private _findCookiePath(): string {
        const possiblePaths = [
            './cookies.txt',
            '/app/cookies.txt',
            './youtube_cookies.txt',
            '/tmp/akira_data/cookies/youtube_cookies.txt',
            process.env.YT_COOKIES_PATH
        ].filter(Boolean);

        for (const p of possiblePaths) {
            if (p && fs.existsSync(p)) {
                this.logger?.info(`✅ Cookie encontrado em: ${p}`);
                return p;
            }
        }
        return '';
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * DOWNLOAD DE ÁUDIO DO YOUTUBE - VERSÃO SIMPLIFICADA
     * ═══════════════════════════════════════════════════════════════════════
     */
    async downloadYouTubeAudio(url: string): Promise<{ sucesso: boolean; buffer?: Buffer; filePath?: string; error?: string; metadata?: any }> {
        try {
            this.logger?.info(`🎵 Download áudio: ${url}`);

            // Primeiro tenta obter metadados
            const metadata = await this._getYouTubeMetadataSimple(url);
            if (!metadata.sucesso) {
                // Tenta com ytdl-core se yt-dlp falhar na metadata (apenas se for link)
                if (url.startsWith('http')) {
                    this.logger?.warn('⚠️ Metadata falhou, tentando download direto com ytdl-core...');
                    return await this._downloadWithYtdlCore(url, 'audio');
                }
                return { sucesso: false, error: 'Não foi possível encontrar metadados para este termo ou URL.' };
            }

            const outputPath = this.generateRandomFilename('mp3');
            const cookiePath = this._findCookiePath();
            const cookieArg = cookiePath ? `--cookies "${cookiePath}"` : '';

            // Usa a URL já resolvida pela metadata
            const finalUrl = metadata.url || url;

            // Tenta download com yt-dlp básico
            const bypassArgs = '--extractor-args "youtube:player_client=android,web" --no-check-certificates';
            const command = `yt-dlp ${cookieArg} ${bypassArgs} -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${finalUrl}"`;
            this.logger?.info(`📥 Executando: ${command.replace(cookieArg, '[COOKIES]')}`);

            try {
                await execAsync(command, { timeout: 300000, maxBuffer: 200 * 1024 * 1024 });
            } catch (execErr: any) {
                this.logger?.warn(`⚠️ yt-dlp falhou no download: ${execErr.message}`);
            }

            // Se o arquivo não foi criado, tenta com ytdl-core
            if (!fs.existsSync(outputPath)) {
                this.logger?.warn('⚠️ Arquivo não criado, tentando ytdl-core...');
                return await this._downloadWithYtdlCore(url, 'audio', metadata);
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
            this.logger?.error(`❌ Erro no download: ${error.message}`);
            return { sucesso: false, error: error.message };
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * DOWNLOAD DE VÍDEO DO YOUTUBE
     * ═══════════════════════════════════════════════════════════════════════
     */
    async downloadYouTubeVideo(url: string, quality: string = '720'): Promise<{ sucesso: boolean; buffer?: Buffer; error?: string; metadata?: any }> {
        try {
            this.logger?.info(`🎬 Download vídeo: ${url} (qualidade: ${quality})`);

            // Obtém metadados
            const metadata = await this._getYouTubeMetadataSimple(url);
            if (!metadata.sucesso) {
                if (url.startsWith('http')) {
                    return await this._downloadWithYtdlCore(url, 'video');
                }
                return { sucesso: false, error: 'Metadados não encontrados para busca.' };
            }

            const finalUrl = metadata.url || url;

            const outputPath = this.generateRandomFilename('mp4');
            const cookiePath = this._findCookiePath();
            const cookieArg = cookiePath ? `--cookies "${cookiePath}"` : '';

            // Formato de vídeo
            const formatSelector = quality === '1080' ? 'bestvideo[height<=1080]+bestaudio/best[ext=m4a]/best' :
                quality === '720' ? 'bestvideo[height<=720]+bestaudio/best[ext=m4a]/best' :
                    'bestvideo[height<=480]+bestaudio/best[ext=m4a]/best';

            const bypassArgs = '--extractor-args "youtube:player_client=android,web" --no-check-certificates';
            const command = `yt-dlp ${cookieArg} ${bypassArgs} -f "${formatSelector}" --merge-output-format mp4 -o "${outputPath}" "${finalUrl}"`;

            try {
                await execAsync(command, { timeout: 300000, maxBuffer: 500 * 1024 * 1024 });
            } catch (execErr: any) {
                this.logger?.warn(`⚠️ yt-dlp falhou no download: ${execErr.message}`);
                // Tenta com force-ipv4 se o erro sugerir bloqueio
                if (execErr.message.includes('Sign in') || execErr.message.includes('403') || execErr.message.includes('410')) {
                    this.logger?.info('🔄 Tentando com force-ipv4...');
                    try {
                        const ipv4Cmd = `yt-dlp --force-ipv4 ${cookieArg} ${bypassArgs} -f "${formatSelector}" --merge-output-format mp4 -o "${outputPath}" "${finalUrl}"`;
                        await execAsync(ipv4Cmd, { timeout: 300000, maxBuffer: 500 * 1024 * 1024 });
                    } catch (e2) { }
                }
            }

            if (!fs.existsSync(outputPath)) {
                // Tenta com ytdl-core usando a URL resolvida
                return await this._downloadWithYtdlCore(finalUrl, 'video', metadata);
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
     * Obtém metadados usando método simples - VERSÃO ROBUSTA
     * Tenta múltiplas fontes: yt-dlp, Invidious, Piped, ytdl-core
     */
    private async _getYouTubeMetadataSimple(url: string): Promise<any> {
        const cookiePath = this._findCookiePath();
        const cookieArg = cookiePath ? `--cookies "${cookiePath}"` : '';

        // Extrai video ID da URL
        const videoId = this._extractVideoId(url);
        this.logger?.info(`🔍 Extraindo metadados para video ID: ${videoId}`);

        // PRIORIDADE 1: Invidious API (mais confiável sem cookies)
        if (videoId) {
            const invidiousResult = await this._getMetadataFromInvidious(videoId);
            if (invidiousResult.sucesso) {
                this.logger?.info(`✅ Metadados obtidos via Invidious: ${invidiousResult.titulo}`);
                return invidiousResult;
            }

            // PRIORIDADE 2: Piped API
            const pipedResult = await this._getMetadataFromPiped(videoId);
            if (pipedResult.sucesso) {
                this.logger?.info(`✅ Metadados obtidos via Piped: ${pipedResult.titulo}`);
                return pipedResult;
            }
        }

        let targetUrl = url;
        const isSearch = !url.startsWith('http');
        if (isSearch) {
            targetUrl = `ytsearch1:${url}`;
        }

        // PRIORIDADE 3: yt-dlp com comandos variados
        const commands = [
            `yt-dlp ${cookieArg} --extractor-args "youtube:player_client=android,web" --no-check-certificates --dump-json --no-download "${targetUrl}"`,
            `yt-dlp --extractor-args "youtube:player_client=android,web" --no-check-certificates --dump-json --no-download "${targetUrl}"`,
            `yt-dlp ${cookieArg} --dump-json --no-download "${targetUrl}"`,
            `yt-dlp --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --dump-json --no-download "${targetUrl}"`,
            `yt-dlp --force-ipv4 --dump-json --no-download "${targetUrl}"`
        ];

        for (const cmd of commands) {
            try {
                const { stdout } = await execAsync(cmd, { timeout: 45000 });
                if (stdout && stdout.trim()) {
                    const data = JSON.parse(stdout.split('\n')[0].trim()); // Pega a primeira linha caso venha mais de um JSON
                    const resolvedUrl = data.webpage_url || (data.id ? `https://www.youtube.com/watch?v=${data.id}` : url);

                    return {
                        sucesso: true,
                        titulo: data.title || 'Título desconhecido',
                        canal: data.channel || data.uploader || 'Canal desconhecido',
                        duracao: data.duration || 0,
                        duracaoFormatada: this._formatDuration(data.duration || 0),
                        thumbnail: data.thumbnail || '',
                        url: resolvedUrl,
                        videoId: data.id || videoId
                    };
                }
            } catch (err: any) {
                this.logger?.debug(`⚠️ Tentativa yt-dlp falhou: ${err.message.substring(0, 50)}`);
            }
        }

        // PRIORIDADE 4: ytdl-core (apenas se for url válida ou se conseguimos extrair um ID antes)
        const finalUrlForYtdl = (isSearch && videoId) ? `https://www.youtube.com/watch?v=${videoId}` : url;
        if (finalUrlForYtdl.startsWith('http')) {
            const ytdlResult = await this._getMetadataYtdlCore(finalUrlForYtdl);
            if (ytdlResult.sucesso) {
                return ytdlResult;
            }
        }

        // Ultimo recurso: retorna metadados básicos apenas se for uma URL
        if (url.startsWith('http')) {
            this.logger?.warn('⚠️ Todas as tentativas de metadata falharam, retornando dados básicos para URL');
            return {
                sucesso: true,
                titulo: this._extractTitleFromUrl(url),
                canal: 'Canal desconhecido',
                duracao: 0,
                duracaoFormatada: '0:00',
                thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                url: url
            };
        }

        this.logger?.error('❌ Falha total ao obter metadados para busca:', url);
        return { sucesso: false, error: 'Não foi possível resolver o termo de busca em uma URL válida.' };
    }

    /**
     * Extrai video ID da URL do YouTube
     */
    private _extractVideoId(url: string): string {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
            /^([a-zA-Z0-9_-]{11})$/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return '';
    }

    /**
     * Extrai título básico da URL (último recurso)
     */
    private _extractTitleFromUrl(url: string): string {
        try {
            const videoId = this._extractVideoId(url);
            return `YouTube Video (${videoId})`;
        } catch {
            return 'Vídeo do YouTube';
        }
    }

    /**
     * Obtém metadados via Invidious API
     */
    private async _getMetadataFromInvidious(videoId: string): Promise<any> {
        // Lista de instâncias Invidious públicas e atualizadas (2025)
        const invidiousInstances = [
            'https://invidious.nerdvpn.de',
            'https://invidious.privacydev.net',
            'https://inv.tux.pizza',
            'https://invidious.perennialte.ch',
            'https://yewtu.be'
        ];

        for (const instance of invidiousInstances) {
            try {
                const response = await axios.get(`${instance}/api/v1/videos/${videoId}`, {
                    timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });

                if (response.data) {
                    const data = response.data;
                    return {
                        sucesso: true,
                        titulo: data.title || 'Título desconhecido',
                        canal: data.author || 'Canal desconhecido',
                        duracao: data.lengthSeconds || 0,
                        duracaoFormatada: this._formatDuration(data.lengthSeconds || 0),
                        thumbnail: data.thumbnails?.[data.thumbnails?.length - 1]?.url || '',
                        url: `https://youtube.com/watch?v=${videoId}`,
                        views: data.viewCount,
                        published: data.published
                    };
                }
            } catch (err: any) {
                this.logger?.debug(`⚠️ Invidious ${instance} falhou: ${err.message.substring(0, 30)}`);
            }
        }

        return { sucesso: false, error: 'Todas as instâncias Invidious falharam' };
    }

    /**
     * Obtém metadados via Piped API
     */
    private async _getMetadataFromPiped(videoId: string): Promise<any> {
        const pipedInstances = [
            'https://pipedapi.kavin.rocks',
            'https://api.piped.yt',
            'https://pipedapi.adminforge.de',
            'https://piped-api.lunar.icu'
        ];

        for (const instance of pipedInstances) {
            try {
                const response = await axios.get(`${instance}/streams/${videoId}`, {
                    timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });

                if (response.data) {
                    const data = response.data;
                    return {
                        sucesso: true,
                        titulo: data.title || 'Título desconhecido',
                        canal: data.uploader || 'Canal desconhecido',
                        duracao: data.duration || 0,
                        duracaoFormatada: this._formatDuration(data.duration || 0),
                        thumbnail: data.thumbnailUrl || '',
                        url: `https://youtube.com/watch?v=${videoId}`,
                        views: data.views,
                        uploadedDate: data.uploadedDate
                    };
                }
            } catch (err: any) {
                this.logger?.debug(`⚠️ Piped ${instance} falhou: ${err.message.substring(0, 30)}`);
            }
        }

        return { sucesso: false, error: 'Todas as instâncias Piped falharam' };
    }

    /**
     * Obtém metadados usando ytdl-core
     */
    private async _getMetadataYtdlCore(url: string): Promise<any> {
        try {
            const ytdl = await import('ytdl-core').then(m => m.default || m);

            const info = await ytdl.getInfo(url);
            const videoDetails = info.videoDetails;

            return {
                sucesso: true,
                titulo: videoDetails.title || 'Título desconhecido',
                canal: videoDetails.author?.name || 'Canal desconhecido',
                duracao: parseInt(videoDetails.lengthSeconds) || 0,
                duracaoFormatada: this._formatDuration(parseInt(videoDetails.lengthSeconds) || 0),
                thumbnail: videoDetails.thumbnails?.[0]?.url || '',
                url: videoDetails.video_url || url
            };
        } catch (err: any) {
            this.logger?.warn(`⚠️ ytdl-core falhou: ${err.message}`);
            return { sucesso: false, error: err.message };
        }
    }

    /**
     * Download usando ytdl-core como fallback
     */
    private async _downloadWithYtdlCore(url: string, type: 'audio' | 'video', metadata?: any): Promise<{ sucesso: boolean; buffer?: Buffer; error?: string; metadata?: any }> {
        try {
            this.logger?.info(`📥 Usando ytdl-core para ${type}...`);

            const ytdl = await import('ytdl-core').then(m => m.default || m);

            const info = await ytdl.getInfo(url);
            const formats = info.formats;

            let format;
            if (type === 'audio') {
                format = ytdl.chooseFormat(formats, { quality: 'highestaudio', filter: 'audioonly' });
            } else {
                format = ytdl.chooseFormat(formats, { quality: 'highest' });
            }

            if (!format || !format.url) {
                return { sucesso: false, error: 'Não foi possível obter URL de download' };
            }

            // Download usando axios
            const response = await axios.get(format.url, {
                responseType: 'arraybuffer',
                timeout: 300000,
                maxContentLength: 500 * 1024 * 1024
            });

            let buffer = Buffer.from(response.data);

            // Se for áudio, converte para MP3
            if (type === 'audio') {
                const inputPath = this.generateRandomFilename('webm');
                const outputPath = this.generateRandomFilename('mp3');

                await fs.promises.writeFile(inputPath, buffer);

                await new Promise((resolve, reject) => {
                    ffmpeg(inputPath)
                        .toFormat('mp3')
                        .audioCodec('libmp3lame')
                        .on('end', () => resolve(void 0))
                        .on('error', reject)
                        .save(outputPath);
                });

                buffer = await fs.promises.readFile(outputPath);
                await this.cleanupFile(inputPath);
                await this.cleanupFile(outputPath);
            }

            const videoMeta = metadata || {
                titulo: info.videoDetails.title,
                canal: info.videoDetails.author?.name,
                duracao: parseInt(info.videoDetails.lengthSeconds),
                duracaoFormatada: this._formatDuration(parseInt(info.videoDetails.lengthSeconds) || 0),
                thumbnail: info.videoDetails.thumbnails?.[0]?.url
            };

            return {
                sucesso: true,
                buffer,
                metadata: videoMeta
            };

        } catch (error: any) {
            this.logger?.error(`❌ Erro ytdl-core: ${error.message}`);
            return { sucesso: false, error: error.message };
        }
    }

    /**
     * Obtém metadados de vídeo do YouTube (compatibilidade)
     */
    async getYouTubeMetadata(url: string): Promise<any> {
        return await this._getYouTubeMetadataSimple(url);
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
            await fs.promises.unlink(filePath).catch(() => { });
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

            // Fallback de tipos para evitar erro de bad decrypt (1C800064)
            let typesToTry = [finalMimeType];
            if (finalMimeType === 'audio') typesToTry.push('document', 'video');
            else if (finalMimeType === 'image') typesToTry.push('document', 'sticker');
            else if (finalMimeType === 'video') typesToTry.push('document');
            else if (finalMimeType === 'document') typesToTry.push('image', 'video', 'audio', 'sticker');
            else typesToTry.push('document', 'image', 'video', 'audio', 'sticker');

            typesToTry = [...new Set(typesToTry)]; // Remove duplicatas

            let buffer = Buffer.from([]);
            let success = false;

            for (const tryType of typesToTry) {
                if (success) break;

                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        let stream;
                        try {
                            stream = await downloadContentFromMessage(mediaContent, tryType as any);
                        } catch (err: any) {
                            if (err.message?.includes('bad decrypt') || err.message?.includes('1C800064')) {
                                this.logger?.warn(`⚠️ Decrypt falhou com tipo '${tryType}'. Tentando outro tipo...`);
                                break; // Quebra o loop de attempt para pular para o próximo tipo
                            }
                            throw err;
                        }

                        buffer = Buffer.from([]);
                        for await (const chunk of stream as any) {
                            buffer = Buffer.concat([buffer, chunk]);
                        }
                        if (buffer.length > 0) {
                            success = true;
                            // Se um tipo não inicial foi bem sucedido, notifica log
                            if (tryType !== finalMimeType) {
                                this.logger?.info(`✅ Download mídia sucedeu usando tipo alternativo: ${tryType}`);
                            }
                            break;
                        }
                    } catch (err: any) {
                        this.logger?.warn(`⚠️ Tentativa ${attempt} (tipo: ${tryType}) falhou: ${err.message}`);
                        await new Promise(r => setTimeout(r, 1000));
                    }
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
