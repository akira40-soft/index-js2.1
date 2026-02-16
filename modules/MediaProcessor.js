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
import { exec, execFile, spawn, execSync } from 'child_process';
import util from 'util';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// yt-dlp ou ytdl-core (prioritário)
let ytdl = null;
try {
    ytdl = await import('@distube/ytdl-core').then(m => m.default || m);
} catch (e) {
    try {
        ytdl = await import('ytdl-core').then(m => m.default || m);
    } catch (e2) {
        ytdl = null;
    }
}

import yts from 'yt-search';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import ConfigManager from './ConfigManager.js';

// Webpmux para metadados de stickers
let Webpmux = null;
try {
    Webpmux = await import('node-webpmux').then(m => m.default || m);
} catch (e) {
    console.warn('⚠️ node-webpmux não instalado. Stickers sem metadados EXIF.');
}

class MediaProcessor {
    constructor(logger = null) {
        this.config = ConfigManager.getInstance();
        this.logger = logger || console;
        this.tempFolder = this.config?.TEMP_FOLDER || './temp';
        this.downloadCache = new Map();

        // Garante que a pasta temporária exista
        if (!fs.existsSync(this.tempFolder)) {
            try {
                fs.mkdirSync(this.tempFolder, { recursive: true });
                this.logger?.info(`📁 Diretório temporário criado: ${this.tempFolder}`);
            } catch (dirErr) {
                this.logger?.error(`❌ Erro ao criar diretório temporário: ${dirErr.message}`);
            }
        }
    }

    /**
    * Gera nome de arquivo aleatório
    */
    generateRandomFilename(ext = '') {
        return path.join(
            this.tempFolder,
            `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? '.' + ext : ''}`
        );
    }

    /**
    * Limpa arquivo
    */
    async cleanupFile(filePath) {
        try {
            if (!filePath || !fs.existsSync(filePath)) return;

            return new Promise((resolve) => {
                fs.unlink(filePath, (err) => {
                    if (err && err.code !== 'ENOENT') {
                        this.logger?.warn(`⚠️ Erro ao limpar ${path.basename(filePath)}`);
                    }
                    resolve();
                });
            });
        } catch (e) {
            this.logger?.error('Erro ao limpar arquivo:', e.message);
        }
    }

    /**
    * Download de mídia via Baileys
    */
    async downloadMedia(message, mimeType = 'image') {
        try {
            // Validação prévia
            if (!message) {
                this.logger?.error('❌ Mensagem é null ou undefined');
                return null;
            }

            this.logger?.debug(`⬇️ Baixando mídia (mime: ${mimeType})...`);
            this.logger?.debug(`📋 Tipo de mensagem: ${typeof message}`);

            // Timeout de 30 segundos para download
            // Retry loop
            let buffer = Buffer.from([]);
            let lastError = null;
            let chunksReceived = 0;

            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const downloadPromise = downloadContentFromMessage(message, mimeType);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout ao baixar mídia (30s)')), 30000)
                    );

                    const stream = await Promise.race([downloadPromise, timeoutPromise]);
                    buffer = Buffer.from([]);

                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }

                    if (buffer.length > 0) break; // Sucesso
                } catch (err) {
                    lastError = err;
                    this.logger?.warn(`⚠️ Tentativa ${attempt} falhou: ${err.message}`);
                    await new Promise(r => setTimeout(r, 1000)); // Wait 1s
                }
            }

            if (buffer.length === 0 && lastError) throw lastError;

            this.logger?.debug(`✅ Download concluído: ${buffer.length} bytes (${chunksReceived} chunks)`);

            // Validação de tamanho mínimo (imagens válidas têm pelo menos 100 bytes)
            if (buffer.length < 100) {
                this.logger?.error(`❌ Buffer muito pequeno: ${buffer.length} bytes`);
                return null;
            }

            return buffer;
        } catch (e) {
            this.logger?.error('❌ Erro ao baixar/decifrar mídia:', e.message);
            this.logger?.error('Stack trace:', e.stack);
            return null;
        }
    }

    /**
    * Converte buffer para base64
    */
    bufferToBase64(buffer) {
        if (!buffer) return null;
        return buffer.toString('base64');
    }

    /**
    * Converte base64 para buffer
    */
    base64ToBuffer(base64String) {
        if (!base64String) return null;
        return Buffer.from(base64String, 'base64');
    }

    /**
     * Busca buffer de uma URL externa (ex: thumbnail)
     */
    async fetchBuffer(url) {
        try {
            const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
            return Buffer.from(res.data);
        } catch (e) {
            this.logger?.debug('Erro ao buscar buffer da URL:', e.message);
            return null;
        }
    }

    /**
    * Adiciona metadados EXIF ao sticker
    * Pack Name = nome do usuário que solicitou
    * Author = Akira-Bot
    */
    async addStickerMetadata(webpBuffer, packName = 'akira-bot', author = 'Akira-Bot') {
        let tempInput = null;
        let tempOutput = null;
        try {
            if (!Webpmux) return webpBuffer;

            tempInput = this.generateRandomFilename('webp');
            tempOutput = this.generateRandomFilename('webp');

            fs.writeFileSync(tempInput, webpBuffer);

            const img = new Webpmux.Image();
            await img.load(tempInput); // Carrega do arquivo físico para evitar erro de Buffer no node-webpmux

            const json = {
                'sticker-pack-id': `akira-${crypto.randomBytes(8).toString('hex')}`,
                'sticker-pack-name': String(packName || 'akira-bot').trim().slice(0, 30),
                'sticker-pack-publisher': String(author || 'Akira-Bot').trim().slice(0, 30),
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

            // Diferenciação entre sticker estático e animado para o método de salvamento
            if (img.anim && img.anim.frames && img.anim.frames.length > 0) {
                this.logger?.debug(`🎞️ [ANIMADO] Usando muxAnim para preservar frames.`);
                // Correção: muxAnim espera um único objeto com a propriedade 'path'
                await img.muxAnim({
                    path: tempOutput,
                    frames: img.anim.frames,
                    loops: img.anim.loops || 0,
                    exif: exif
                });
            } else {
                this.logger?.debug(`🖼️ [ESTÁTICO] Usando save normal.`);
                await img.save(tempOutput);
            }

            const result = fs.readFileSync(tempOutput);

            this.logger?.debug(`✅ Metadados EXIF inseridos via Arquivo: "${packName}" | "${author}"`);

            // Cleanup imediato
            await Promise.all([
                this.cleanupFile(tempInput),
                this.cleanupFile(tempOutput)
            ]);

            return result;
        } catch (e) {
            this.logger?.warn('⚠️ Erro ao adicionar EXIF:', e.message);
            if (tempInput) await this.cleanupFile(tempInput);
            if (tempOutput) await this.cleanupFile(tempOutput);
            return webpBuffer;
        }
    }

    /**
    * Cria sticker de imagem - FORMATO QUADRADO PADRONIZADO
    * Pack Name = nome do usuário
    * Author = Akira-Bot
    * 
    * Melhorias:
    * - Sempre gera sticker 512x512 (quadrado) independente da proporção da imagem
    * - Usa padding transparente para manter proporção original
    * - Compatibilidade total entre PC e mobile
    */
    async createStickerFromImage(imageBuffer, metadata = {}) {
        try {
            this.logger?.info('🎨 Criando sticker de imagem (formato quadrado)..');

            const inputPath = this.generateRandomFilename('jpg');
            const outputPath = this.generateRandomFilename('webp');

            fs.writeFileSync(inputPath, imageBuffer);

            const { packName = 'akira-bot', author = 'Akira-Bot' } = metadata;

            // Filtro otimizado: Preenchimento total (Fill) sem barras pretas
            // Usa force_original_aspect_ratio=increase seguido de crop para preencher 512x512
            const videoFilter = 'scale=512:512:flags=lanczos:force_original_aspect_ratio=increase,crop=512:512';

            // Configuração do FFmpeg path (se necessário, mas fluent-ffmpeg geralmente acha no PATH)
            // Se o usuário tem ffmpeg no sistema, isso deve funcionar direto
            // this.logger?.info('🔧 Usando FFmpeg do sistema...');

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .inputOptions(['-y']) // Forçar overwrite no input se precisar
                    .outputOptions([
                        '-y',
                        '-v', 'error',
                        '-c:v', 'libwebp',
                        '-lossless', '0',
                        '-compression_level', '4', // Mais rápido
                        '-q:v', '75', // Qualidade boa
                        '-preset', 'default',
                        '-vf', videoFilter,
                        '-s', '512x512'
                    ])
                    .on('start', (cmdLine) => {
                        this.logger?.debug(`⚡ FFmpeg comando: ${cmdLine}`);
                    })
                    .on('end', () => {
                        this.logger?.debug('✅ Sticker criado com sucesso (FFmpeg)');
                        resolve();
                    })
                    .on('error', (err) => {
                        this.logger?.error(`❌ Erro crítico FFmpeg: ${err.message}`);
                        reject(err);
                    })
                    .save(outputPath);
            });

            // Verifica se arquivo foi criado
            if (!fs.existsSync(outputPath)) {
                throw new Error('Arquivo de saída não foi criado');
            }

            const stickerBuffer = fs.readFileSync(outputPath);

            // Validação: verificar dimensões (se possível)
            if (stickerBuffer.length === 0) {
                throw new Error('Sticker gerado está vazio');
            }

            // Adiciona metadados EXIF: packName configurado, author configurado
            const stickerComMetadados = await this.addStickerMetadata(stickerBuffer, packName, author);

            await Promise.all([
                this.cleanupFile(inputPath),
                this.cleanupFile(outputPath)
            ]);

            this.logger?.info(`✅ Sticker criado: ${(stickerComMetadados.length / 1024).toFixed(2)}KB`);

            return {
                sucesso: true,
                buffer: stickerComMetadados,
                tipo: 'sticker_image',
                size: stickerComMetadados.length,
                packName,
                author
            };

        } catch (error) {
            this.logger?.error('❌ Erro ao criar sticker:', error.message);
            return {
                sucesso: false,
                error: error.message
            };
        }
    }

    /**
    * Cria sticker animado de vídeo - FORMATO QUADRADO PADRONIZADO
    * 
    * Melhorias:
    * - Sempre gera sticker 512x512 (quadrado) independente da proporção do vídeo
    * - Usa padding transparente para manter proporção original (sem distorção)
    * - Compatibilidade total entre PC e mobile
    * - Redução automática de qualidade se exceder 500KB
    */
    async createAnimatedStickerFromVideo(videoBuffer, maxDuration = 30, metadata = {}) {
        try {
            // Use configured max duration if not explicitly provided
            const cfgMax = parseInt(this.config?.STICKER_MAX_ANIMATED_SECONDS || 30);
            maxDuration = parseInt(maxDuration || cfgMax);

            this.logger?.info(`🎬 Criando sticker animado (max ${maxDuration}s)`);

            const inputPath = this.generateRandomFilename('mp4');
            const outputPath = this.generateRandomFilename('webp');

            fs.writeFileSync(inputPath, videoBuffer);

            // Check input duration and log/trim if necessary
            let inputDuration = 0;
            try {
                await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(inputPath, (err, metadataProbe) => {
                        if (err) return reject(err);
                        inputDuration = metadataProbe?.format?.duration ? Math.floor(metadataProbe.format.duration) : 0;
                        if (inputDuration > maxDuration) {
                            this.logger?.info(`🛑 Vídeo de entrada tem ${inputDuration}s; será cortado para ${maxDuration}s`);
                        }
                        resolve();
                    });
                });
            } catch (probeErr) {
                this.logger?.debug('⚠️ Não foi possível obter duração do vídeo antes da conversão:', probeErr.message);
            }

            // Pack name e Author vindos do metadata (fornecidos pelo Handler)
            const { packName = 'akira-bot', author = 'Akira-Bot' } = metadata;

            // Filtro otimizado: escala aumentando para preencher + crop para 512x512
            // Isso garante formato quadrado preenchido
            const videoFilter = `fps=15,scale=512:512:flags=lanczos:force_original_aspect_ratio=increase,crop=512:512`;

            const stickerDuration = Math.min(maxDuration, 10); // Máximo 10s para WhatsApp mobile

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
                        '-t', String(stickerDuration),
                        '-y'
                    ])
                    .on('end', () => {
                        this.logger?.debug('✅ FFmpeg processamento concluído');
                        resolve();
                    })
                    .on('error', (err) => {
                        this.logger?.error('❌ Erro FFmpeg:', err.message);
                        reject(err);
                    })
                    .save(outputPath);
            });

            // Verifica se arquivo foi criado
            if (!fs.existsSync(outputPath)) {
                throw new Error('Arquivo de saída não foi criado');
            }

            let stickerBuffer = fs.readFileSync(outputPath);

            // Validação de tamanho
            if (stickerBuffer.length === 0) {
                throw new Error('Sticker gerado está vazio');
            }

            // Se maior que 500KB, tenta reprocessar com qualidade reduzida
            if (stickerBuffer.length > 500 * 1024) {
                this.logger?.warn(`⚠️ Sticker muito grande (${(stickerBuffer.length / 1024).toFixed(2)}KB), reduzindo qualidade...`);

                await this.cleanupFile(outputPath);

                // Reprocessa com qualidade reduzida
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
                            '-t', String(Math.min(maxDuration, 10)),
                            '-y'
                        ])
                        .on('end', resolve)
                        .on('error', reject)
                        .save(outputPath);
                });

                stickerBuffer = fs.readFileSync(outputPath);

                if (stickerBuffer.length > 500 * 1024) {
                    await Promise.all([
                        this.cleanupFile(inputPath),
                        this.cleanupFile(outputPath)
                    ]);
                    return {
                        sucesso: false,
                        error: 'Sticker animado muito grande (>500KB) mesmo com qualidade reduzida. Use um vídeo mais curto.'
                    };
                }
            }

            // Adiciona metadados EXIF ao sticker animado
            const stickerComMetadados = await this.addStickerMetadata(stickerBuffer, packName, author);

            await Promise.all([
                this.cleanupFile(inputPath),
                this.cleanupFile(outputPath)
            ]);

            this.logger?.info(`✅ Sticker animado criado: ${(stickerComMetadados.length / 1024).toFixed(2)}KB`);

            return {
                sucesso: true,
                buffer: stickerComMetadados,
                tipo: 'sticker_animado',
                size: stickerComMetadados.length,
                packName,
                author
            };

        } catch (error) {
            this.logger?.error('❌ Erro ao criar sticker animado:', error.message);
            return {
                sucesso: false,
                error: error.message
            };
        }
    }

    /**
     * Converte vídeo para áudio (MP3)
     */
    async convertVideoToAudio(videoBuffer) {
        try {
            const inputPath = this.generateRandomFilename('mp4');
            const outputPath = this.generateRandomFilename('mp3');

            fs.writeFileSync(inputPath, videoBuffer);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .toFormat('mp3')
                    .audioCodec('libmp3lame')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            const audioBuffer = fs.readFileSync(outputPath);

            // Cleanup
            this.cleanupFile(inputPath);
            this.cleanupFile(outputPath);

            return { sucesso: true, buffer: audioBuffer };
        } catch (e) {
            return { sucesso: false, error: e.message };
        }
    }

    /**
    * Converte sticker para imagem
    */
    async convertStickerToImage(stickerBuffer) {
        try {
            this.logger?.info('🔄 Convertendo sticker para imagem..');

            const inputPath = this.generateRandomFilename('webp');
            const outputPath = this.generateRandomFilename('png');

            fs.writeFileSync(inputPath, stickerBuffer);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions('-vcodec', 'png')
                    .on('end', () => {
                        this.logger?.debug('✅ Conversão concluída');
                        resolve();
                    })
                    .on('error', (err) => {
                        this.logger?.error('❌ Erro FFmpeg:', err.message);
                        reject(err);
                    })
                    .save(outputPath);
            });

            if (!fs.existsSync(outputPath)) {
                throw new Error('Arquivo de saída não foi criado');
            }

            const imageBuffer = fs.readFileSync(outputPath);

            await Promise.all([
                this.cleanupFile(inputPath),
                this.cleanupFile(outputPath)
            ]);

            this.logger?.info('✅ Sticker convertido para imagem');

            return {
                sucesso: true,
                buffer: imageBuffer,
                tipo: 'imagem',
                size: imageBuffer.length
            };

        } catch (error) {
            this.logger?.error('❌ Erro ao converter sticker:', error.message);
            return {
                sucesso: false,
                error: error.message
            };
        }
    }

    /**
    * Detecta se buffer é view-once
    */
    detectViewOnce(message) {
        if (!message) return null;
        try {
            if (message.viewOnceMessageV2?.message) return message.viewOnceMessageV2.message;
            if (message.viewOnceMessageV2Extension?.message) return message.viewOnceMessageV2Extension.message;
            if (message.viewOnceMessage?.message) return message.viewOnceMessage.message;
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
    * Extrai conteúdo de view-once e retorna tipo + buffer
    */
    async extractViewOnceContent(quotedMessage) {
        try {
            const unwrapped = this.detectViewOnce(quotedMessage);
            if (!unwrapped) {
                return { sucesso: false, error: 'Não é uma mensagem view-once' };
            }

            const tipo = unwrapped.imageMessage ? 'image' :
                unwrapped.videoMessage ? 'video' :
                    unwrapped.audioMessage ? 'audio' :
                        unwrapped.stickerMessage ? 'sticker' : null;

            if (!tipo) {
                return { sucesso: false, error: 'Tipo de view-once não suportado' };
            }

            const mimeMap = {
                'image': 'image',
                'video': 'video',
                'audio': 'audio',
                'sticker': 'sticker'
            };

            const buffer = await this.downloadMedia(unwrapped[tipo + 'Message'], mimeMap[tipo]);

            if (!buffer) {
                return { sucesso: false, error: 'Erro ao extrair conteúdo' };
            }

            return {
                sucesso: true,
                buffer,
                tipo,
                size: buffer.length
            };
        } catch (e) {
            this.logger?.error('❌ Erro ao extrair view-once:', e.message);
            return { sucesso: false, error: e.message };
        }
    }

    /**
    * Localiza yt-dlp no sistema
    */
    findYtDlp() {
        try {
            const binName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
            const localPath = path.resolve(__dirname, '..', 'bin', binName);

            if (fs.existsSync(localPath)) {
                return { modo: 'exe', cmd: localPath };
            }

            // Tenta no PATH
            try {
                execSync(`${binName} --version`, { stdio: 'pipe', shell: true });
                return { modo: 'exe', cmd: binName };
            } catch (_) { }

            return null;
        } catch (e) {
            return null;
        }
    }

    /**
    * Download via yt-dlp
    */
    async _downloadWithYtDlp(url, videoId, tool) {
        try {
            const outputTemplate = this.generateRandomFilename('').replace(/\\$/, '');

            // Bypass de Captcha: Usa extractor-args para simular cliente android/ios
            const bypassArgs = '--extractor-args "youtube:player_client=android,ios" --extractor-args "youtube:player_skip=web,web_music,mweb" --no-check-certificates';
            const command = process.platform === 'win32'
                ? `"${tool.cmd}" ${bypassArgs} --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}.%(ext)s" --no-playlist --max-filesize 25M --no-warnings "${url}"`
                : `${tool.cmd} ${bypassArgs} --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}.%(ext)s" --no-playlist --max-filesize 25M --no-warnings "${url}"`;

            await new Promise((resolve, reject) => {
                exec(command, { timeout: 120000, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
                    const actualPath = outputTemplate + '.mp3';
                    if (fs.existsSync(actualPath)) {
                        resolve();
                    } else if (error) {
                        reject(error);
                    } else {
                        reject(new Error('Arquivo não foi criado'));
                    }
                });
            });

            const actualPath = outputTemplate + '.mp3';
            const stats = fs.statSync(actualPath);

            if (stats.size === 0) {
                await this.cleanupFile(actualPath);
                return { sucesso: false, error: 'Arquivo vazio' };
            }

            const audioBuffer = fs.readFileSync(actualPath);
            await this.cleanupFile(actualPath);

            this.logger?.info(`✅ Download yt-dlp completo: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
            return {
                sucesso: true,
                buffer: audioBuffer,
                titulo: 'Música do YouTube',
                tamanho: audioBuffer.length,
                metodo: 'yt-dlp'
            };
        } catch (e) {
            this.logger?.debug('yt-dlp error:', e.message);
            return { sucesso: false, error: e.message };
        }
    }

    /**
    * Download via ytdl-core
    */
    async _downloadWithYtdlCore(url, videoId) {
        try {
            const outputPath = this.generateRandomFilename('mp3');

            this.logger?.info('🔄 Obtendo informações do vídeo...');

            const info = await ytdl.getInfo(videoId, {
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
                    }
                }
            });

            // Verifica duração máxima
            try {
                const videoLength = parseInt(info?.videoDetails?.lengthSeconds || 0);
                const maxAllowed = parseInt(this.config?.YT_MAX_DURATION_SECONDS || 3600);
                if (videoLength > 0 && videoLength > maxAllowed) {
                    return { sucesso: false, error: `Vídeo muito longo (${videoLength}s). Limite: ${maxAllowed}s` };
                }
            } catch (lenErr) {
                this.logger?.debug('Aviso de duração:', lenErr.message);
            }

            const audioFormat = ytdl.chooseFormat(info.formats, {
                quality: 'highestaudio',
                filter: 'audioonly'
            });

            if (!audioFormat) {
                return { sucesso: false, error: 'Nenhum formato de áudio encontrado' };
            }

            this.logger?.info(`📦 Formato: ${audioFormat.container}`);
            const writeStream = fs.createWriteStream(outputPath);
            const stream = ytdl.downloadFromInfo(info, { format: audioFormat });

            await new Promise((resolve, reject) => {
                stream.pipe(writeStream);
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
                stream.on('error', reject);
            });

            if (!fs.existsSync(outputPath)) {
                throw new Error(`Arquivo não encontrado após download (ENOENT): ${outputPath}`);
            }

            const stats = fs.statSync(outputPath);
            if (stats.size === 0) {
                await this.cleanupFile(outputPath);
                throw new Error('Arquivo baixado está vazio');
            }

            if (stats.size > this.config?.YT_MAX_SIZE_MB * 1024 * 1024) {
                await this.cleanupFile(outputPath);
                return { sucesso: false, error: `Arquivo muito grande (>${this.config?.YT_MAX_SIZE_MB}MB)` };
            }

            const audioBuffer = fs.readFileSync(outputPath);
            await this.cleanupFile(outputPath);

            this.logger?.info(`✅ Download ytdl-core completo: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
            return {
                sucesso: true,
                buffer: audioBuffer,
                titulo: info?.videoDetails?.title || 'Música do YouTube',
                tamanho: audioBuffer.length,
                metodo: 'ytdl-core'
            };

        } catch (e) {
            this.logger?.debug('ytdl-core error:', e.message);
            return { sucesso: false, error: e.message };
        }
    }

    /**
     * Extrai Video ID do YouTube de várias formas
     */
    extractYouTubeVideoId(url) {
        // Formato padrão: https://www.youtube.com/watch?v=VIDEO_ID
        let match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];

        // Formato curto: https://youtu.be/VIDEO_ID
        match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];

        // Formato embed: https://www.youtube.com/embed/VIDEO_ID
        match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];

        // Formato shorts: https://www.youtube.com/shorts/VIDEO_ID
        match = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];

        // Se a URL já é apenas o ID (11 caracteres)
        if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
            return url;
        }

        return null;
    }

    async downloadYouTubeAudio(input) {
        try {
            this.logger?.info('🎵 Iniciando download de áudio do YouTube...');
            let url = input;

            // Extrair video ID
            let videoId = this.extractYouTubeVideoId(url);

            if (!videoId) {
                this.logger?.info(`🔍 Input não é URL, tentando busca: ${input}`);
                const searchRes = await this.searchYouTube(input, 1);
                if (searchRes.sucesso && searchRes.resultados.length > 0) {
                    url = searchRes.resultados[0].url;
                    videoId = this.extractYouTubeVideoId(url);
                    this.logger?.info(`✅ Encontrado via busca: ${searchRes.resultados[0].titulo} (${url})`);
                } else {
                    return {
                        sucesso: false,
                        error: 'URL inválida e nenhum resultado encontrado para a busca. Formatos suportados:\n- youtube.com/watch?v=ID\n- youtu.be/ID\n- youtube.com/shorts/ID'
                    };
                }
            }

            this.logger?.info(`📹 Video ID: ${videoId}`);

            // Tenta yt-dlp primeiro (mais robusto)
            const ytdlpTool = this.findYtDlp();
            let metadata = { titulo: 'Música do YouTube', autor: 'Desconhecido', duracao: 0, videoId };

            if (ytdlpTool) {
                this.logger?.info('🔧 Tentando yt-dlp (método 1 - mais robusto)');

                // Busca metadados antes ou durante
                const metaRes = await this.getYouTubeMetadata(url, ytdlpTool);
                if (metaRes.sucesso) {
                    metadata = metaRes;
                }

                try {
                    const result = await this._downloadWithYtDlp(url, videoId, ytdlpTool);
                    if (result.sucesso) {
                        return { ...result, ...metadata };
                    }
                } catch (ytErr) {
                    this.logger?.warn('⚠️ yt-dlp falhou:', ytErr.message);
                }
                this.logger?.info('⚠️ yt-dlp falhou, tentando ytdl-core...');
            }

            // Fallback para ytdl-core
            if (ytdl) {
                this.logger?.info('🔧 Tentando ytdl-core (método 2 - fallback)');
                try {
                    const res = await this._downloadWithYtdlCore(url, videoId);
                    if (res.sucesso) {
                        return { ...res, ...metadata };
                    }
                } catch (ytErr) {
                    this.logger?.warn('⚠️ ytdl-core falhou:', ytErr.message);
                }
            }

            // Fallback para axios direto (método 3)
            this.logger?.info('🔧 Tentando método direto com axios (método 3)');
            try {
                return await this._downloadWithAxios(url, videoId);
            } catch (axiosErr) {
                this.logger?.warn('⚠️ Método direto falhou:', axiosErr.message);
            }

            return {
                sucesso: false,
                error: 'Nenhum método de download funcionou. Verifique:\n1. yt-dlp está instalado\n2. A URL do vídeo é válida'
            };

        } catch (error) {
            this.logger?.error('❌ Erro geral no download:', error.message);
            return { sucesso: false, error: error.message };
        }
    }

    /**
    * Download de VÍDEO do YouTube
    */
    async downloadYouTubeVideo(input) {
        try {
            this.logger?.info('🎬 Iniciando download de VÍDEO do YouTube...');
            let url = input;

            let videoId = this.extractYouTubeVideoId(url);
            if (!videoId) {
                this.logger?.info(`🔍 Input não é URL, tentando busca: ${input}`);
                const searchRes = await this.searchYouTube(input, 1);
                if (searchRes.sucesso && searchRes.resultados.length > 0) {
                    url = searchRes.resultados[0].url;
                    videoId = this.extractYouTubeVideoId(url);
                    this.logger?.info(`✅ Encontrado via busca: ${searchRes.resultados[0].titulo} (${url})`);
                } else {
                    return { sucesso: false, error: 'URL do YouTube inválida ou nenhum vídeo encontrado.' };
                }
            }

            const ytdlpTool = this.findYtDlp();
            if (!ytdlpTool) {
                return { sucesso: false, error: 'yt-dlp não encontrado. Necessário para baixar vídeos.' };
            }

            const outputTemplate = this.generateRandomFilename('').replace(/\\$/, '');
            // Bypass de Captcha e Limite 720p
            const bypassArgs = '--extractor-args "youtube:player_client=android,ios" --extractor-args "youtube:player_skip=web,web_music,mweb" --no-check-certificates';
            const formatStr = "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best";

            // Força o yt-dlp a ser mais verboso e explícito no output
            const command = process.platform === 'win32'
                ? `"${ytdlpTool.cmd}" ${bypassArgs} -f "${formatStr}" -o "${outputTemplate}.%(ext)s" --no-playlist --max-filesize 50M --verbose "${url}"`
                : `${ytdlpTool.cmd} ${bypassArgs} -f "${formatStr}" -o "${outputTemplate}.%(ext)s" --no-playlist --max-filesize 50M --verbose "${url}"`;

            this.logger?.info(`🚀 Executando download: ${command}`);

            await new Promise((resolve, reject) => {
                exec(command, { timeout: 180000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
                    if (error) {
                        this.logger?.error(`❌ Erro no yt-dlp: ${error.message}`);
                        this.logger?.debug(`STDOUT: ${stdout}`);
                        this.logger?.debug(`STDERR: ${stderr}`);
                        return reject(error);
                    }

                    // Busca o arquivo gerado com várias extensões possíveis (yt-dlp pode mudar conforme o merge)
                    const possibleExts = ['.mp4', '.mkv', '.webm'];
                    let foundFile = null;
                    for (const ext of possibleExts) {
                        const checkPath = outputTemplate + ext;
                        if (fs.existsSync(checkPath)) {
                            foundFile = checkPath;
                            break;
                        }
                    }

                    if (foundFile) {
                        this.logger?.info(`✅ Arquivo baixado encontrado: ${path.basename(foundFile)}`);
                        resolve(foundFile);
                    } else {
                        this.logger?.warn(`⚠️ yt-dlp terminou mas arquivo não foi localizado. STDOUT: ${stdout.substring(stdout.length - 500)}`);
                        reject(new Error('Arquivo de vídeo não encontrado no sistema após o download.'));
                    }
                });
            }).then(async (foundFile) => {
                const actualPath = foundFile;
                const stats = fs.statSync(actualPath);

                if (stats.size > this.config?.YT_MAX_SIZE_MB * 1024 * 1024) {
                    await this.cleanupFile(actualPath);
                    throw new Error(`Vídeo muito grande (>${this.config?.YT_MAX_SIZE_MB}MB)`);
                }

                // 🛠️ ESTÁGIO DE OTIMIZAÇÃO PARA MOBILE (H.264 Baseline)
                this.logger?.info('🛠️ Otimizando vídeo para compatibilidade mobile...');
                const optimizedPath = this.generateRandomFilename('mp4');

                try {
                    await new Promise((resolve, reject) => {
                        ffmpeg(actualPath)
                            .outputOptions([
                                '-c:v', 'libx264',
                                '-profile:v', 'baseline',
                                '-level', '3.0',
                                '-pix_fmt', 'yuv420p',
                                '-threads', '1',
                                '-c:a', 'aac',
                                '-b:a', '128k',
                                '-ar', '44100',
                                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                                '-movflags', '+faststart',
                                '-preset', 'ultrafast',
                                '-crf', '26' // Aumentado ligeiramente para garantir tamanho menor e mais rápido
                            ])
                            .on('start', (cmd) => this.logger?.debug(`FFMPEG: ${cmd}`))
                            .on('end', resolve)
                            .on('error', (err) => {
                                this.logger?.error(`Erro FFMPEG: ${err.message}`);
                                reject(err);
                            })
                            .save(optimizedPath);
                    });

                    const videoBuffer = fs.readFileSync(optimizedPath);
                    const metaRes = await this.getYouTubeMetadata(url, ytdlpTool);
                    const metadata = metaRes.sucesso ? metaRes : { titulo: 'Vídeo do YouTube' };

                    await Promise.all([
                        this.cleanupFile(actualPath),
                        this.cleanupFile(optimizedPath)
                    ]);

                    return {
                        sucesso: true,
                        buffer: videoBuffer,
                        titulo: metadata.titulo,
                        size: videoBuffer.length,
                        mimetype: 'video/mp4',
                        ...metadata
                    };
                } catch (optError) {
                    this.logger?.warn('⚠️ Otimização falhou, tentando enviar original se for MP4...');
                    if (actualPath.endsWith('.mp4')) {
                        const videoBuffer = fs.readFileSync(actualPath);
                        const metaRes = await this.getYouTubeMetadata(url, ytdlpTool);
                        const metadata = metaRes.sucesso ? metaRes : { titulo: 'Vídeo do YouTube' };
                        await this.cleanupFile(actualPath);
                        return {
                            sucesso: true,
                            buffer: videoBuffer,
                            titulo: metadata.titulo,
                            size: videoBuffer.length,
                            mimetype: 'video/mp4',
                            ...metadata
                        };
                    } else {
                        await this.cleanupFile(actualPath);
                        throw new Error(`Falha na conversão e formato original (${path.extname(actualPath)}) incompatível.`);
                    }
                }
            });


        } catch (error) {
            this.logger?.error('❌ Erro download vídeo:', error.message);
            return { sucesso: false, error: error.message };
        }
    }

    async getYouTubeMetadata(url, tool = null) {
        try {
            const ytdlp = tool || this.findYtDlp();
            if (!ytdlp) return { sucesso: false, error: 'yt-dlp não encontrado' };

            // Extrair ID para thumbnail
            const videoId = this.extractYouTubeVideoId(url);
            const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

            const bypassArgs = '--extractor-args "youtube:player_client=android,ios" --extractor-args "youtube:player_skip=web,web_music,mweb" --no-check-certificates';
            const command = process.platform === 'win32'
                ? `"${ytdlp.cmd}" ${bypassArgs} --print "%(title)s|%(uploader)s|%(duration)s|%(view_count)s|%(like_count)s|%(upload_date)s" --no-playlist "${url}"`
                : `${ytdlp.cmd} ${bypassArgs} --print "%(title)s|%(uploader)s|%(duration)s|%(view_count)s|%(like_count)s|%(upload_date)s" --no-playlist "${url}"`;

            const output = execSync(command, { encoding: 'utf8', timeout: 30000, stdio: 'pipe' }).trim();
            const [title, author, duration, views, likes, date] = output.split('|');

            // Formata views para algo legível (ex: 1.5M)
            const formatCount = (count) => {
                const n = parseInt(count);
                if (isNaN(n)) return '0';
                if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
                if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
                return n.toString();
            };

            return {
                sucesso: true,
                titulo: title || 'Música do YouTube',
                autor: author || 'Desconhecido',
                duracao: parseInt(duration) || 0,
                views: formatCount(views),
                likes: formatCount(likes),
                data: date || '',
                thumbnail: thumbnailUrl,
                videoId
            };
        } catch (e) {
            this.logger?.debug('Erro ao obter metadados:', e.message);
            return { sucesso: false, error: e.message };
        }
    }

    /**
    * Download direto via axios (fallback)
    */
    async _downloadWithAxios(url, videoId) {
        try {
            // Usar API pública do YouTube para obter info
            const apiUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
            const apiResponse = await axios.get(apiUrl, { timeout: 10000 });

            const titulo = apiResponse.data?.title || 'Música do YouTube';

            // Tentar obter URL de áudio direto (muitas vezes não funciona, mas worth a try)
            // Este é um fallback limitado - yt-dlp é sempre preferível

            this.logger?.info('⚠️ Método direto limitado - considere instalar yt-dlp para melhor qualidade');

            return {
                sucesso: false,
                error: `Método direto não suporta download. Instale yt-dlp:\napt install yt-dlp\nou\nnpm install -g yt-dlp`
            };
        } catch (e) {
            return { sucesso: false, error: e.message };
        }
    }

    /**
    * Processa link do YouTube (validação)
    */
    isValidYouTubeUrl(url) {
        const regex = /^(https?:\/\/(www\.)?)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/.*$/i;
        return regex.test(String(url));
    }

    /**
    * Busca música no YouTube por nome
    */
    async searchYouTube(query, limit = 5) {
        try {
            this.logger?.info(`🔍 Buscando: ${query}`);

            const result = await yts(query);

            if (!result || !result.videos || result.videos.length === 0) {
                return {
                    sucesso: false,
                    error: 'Nenhum resultado encontrado'
                };
            }

            const videos = result.videos.slice(0, limit).map(v => ({
                titulo: v.title,
                url: v.url,
                duracao: v.duration?.toString(),
                views: v.views || 0,
                uploadedAt: v.uploadedAt || 'unknown'
            }));

            this.logger?.info(`✅ Encontrados ${videos.length} resultados`);

            return {
                sucesso: true,
                resultados: videos,
                query
            };

        } catch (error) {
            this.logger?.error('❌ Erro na busca:', error.message);
            return {
                sucesso: false,
                error: error.message
            };
        }
    }

    /**
    * Limpa cache
    */
    clearCache() {
        this.downloadCache?.clear();
        this.logger?.info('💾 Cache de mídia limpo');
    }

    /**
    * Retorna estatísticas
    */
    getStats() {
        return {
            cacheSize: this.downloadCache?.size,
            ytDownloadEnabled: this.config?.FEATURE_YT_DOWNLOAD,
            stickerEnabled: this.config?.FEATURE_STICKERS,
            maxVideoSize: `${this.config?.YT_MAX_SIZE_MB}MB`,
            stickerSize: this.config?.STICKER_SIZE,
            stickerAnimatedMax: `${this.config?.STICKER_MAX_ANIMATED_SECONDS}s`
        };
    }
}

export default MediaProcessor;
