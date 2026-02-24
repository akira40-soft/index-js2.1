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
import { exec, execFile, spawn } from 'child_process';
import util from 'util';
const execAsync = util.promisify(exec);
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// yt-dlp ou ytdl-core (prioritário)
let ytdl: any = null;
try {
    ytdl = await import('@distube/ytdl-core').then(m => m.default || m);
} catch (e: any) {
    try {
        ytdl = await import('ytdl-core').then(m => m.default || m);
    } catch (e2: any) {
        ytdl = null;
    }
}

import yts from 'yt-search';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import ConfigManager from './ConfigManager.js';

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
            } catch (dirErr) {
                this.logger.error(`❌ Erro ao criar/verificar pasta temporária ${this.tempFolder}:`, dirErr.message);
            }
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════
     * ESTRATÉGIA DE BYPASS YOUTUBE 2026
     * ═══════════════════════════════════════════════════════════════════
     * Ordem de clientes por menor resistência ao bot-detection:
     * 1. web_embedded   -> Não requer po_token, menos bloqueado em servidores
     * 2. tv_embedded    -> Client da TV, raramente bloqueado
     * 3. android        -> Bypass clássico, ainda funciona
     * 4. ios            -> Fallback mobile
     * 5. mweb           -> Mobile web, último recurso
     *
     * Com cookies: web (mais confiável e completo)
     */
    private _getClientStrategies(): Array<{ client: string; args: string }> {
        const cookiesPath = this.config?.YT_COOKIES_PATH || '';
        const poToken = this.config?.YT_PO_TOKEN || '';
        const cookieArg = (cookiesPath && fs.existsSync(cookiesPath)) ? `--cookies "${cookiesPath}"` : '';

        // Fallback para cookies em local padrão do Railway se não definido
        let finalCookieArg = cookieArg;
        const possibleCookiePaths = [
            '/app/cookies.txt',
            './cookies.txt',
            '/tmp/akira_data/cookies/youtube_cookies.txt',
            './youtube_cookies.txt'
        ];

        if (!finalCookieArg) {
            for (const p of possibleCookiePaths) {
                if (fs.existsSync(p)) {
                    const stats = fs.statSync(p);
                    this.logger?.info(`🍪 Cookies detetados automaticamente em: ${p} (${stats.size} bytes)`);
                    finalCookieArg = `--cookies "${p}"`;
                    break;
                }
            }
        }

        if (finalCookieArg) {
            this.logger?.info(`🎥 YouTube Bypass: Usando cookies via argumento: ${finalCookieArg}`);
        } else {
            this.logger?.warn(`⚠️ YouTube Bypass: Nenhum ficheiro de cookies detetado! Esperados em: ${possibleCookiePaths.join(', ')}`);
        }

        const baseSleepArgs = '--sleep-requests 1 --sleep-interval 2 --max-sleep-interval 5 --no-check-certificates --ignore-config --no-cache-dir';

        // 📱 User-Agents Modernos (Bypass 2026.7)
        const ua_iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
        const ua_android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.230805.019; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36';
        const ua_chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

        const strategies: Array<{ client: string; args: string }> = [];

        // 🟢 1. WEB + COOKIES (mais robusto se cookies válidos)
        if (finalCookieArg) {
            let webArgs = `--extractor-args "youtube:player_client=web" ${finalCookieArg} ${baseSleepArgs} --user-agent "${ua_chrome}"`;
            strategies.push({ client: 'web+cookies', args: webArgs });
            // also try cookies-from-browser as a fallback if exported cookies are invalid
            const cookiesFromBrowserArgs = `--cookies-from-browser chrome,firefox,edge ${baseSleepArgs} --user-agent "${ua_chrome}"`;
            strategies.push({ client: 'web+cookies_from_browser', args: cookiesFromBrowserArgs });
        } else {
            // If no exported cookies, try cookies-from-browser first
            const cookiesFromBrowserArgs = `--cookies-from-browser chrome,firefox,edge ${baseSleepArgs} --user-agent "${ua_chrome}"`;
            strategies.push({ client: 'web+cookies_from_browser', args: cookiesFromBrowserArgs });
        }

        // 🔴 2. TV_EMBEDDED (raro bot-detect, sem cookies para evitar falhas de autenticação)
        let tvArgs = `--extractor-args "youtube:player_client=tv_embedded" ${baseSleepArgs} --user-agent "${ua_iphone}"`;
        strategies.push({ client: 'tv_embedded', args: tvArgs });

        // 🟣 3. ANDROID (classic bypass, sem cookies)
        let androidArgs = `--extractor-args "youtube:player_client=android" ${baseSleepArgs} --user-agent "${ua_android}"`;
        strategies.push({ client: 'android', args: androidArgs });

        // 🔵 4. WEB_EMBEDDED (mais permissivo, sem player_client determinado)
        let webEmbeddedArgs = `${baseSleepArgs} --user-agent "${ua_chrome}"`;
        strategies.push({ client: 'web_embedded_flex', args: webEmbeddedArgs });

        // 🟠 5. IOS (mobile fallback, User-Agent only)
        let iosArgs = `${baseSleepArgs} --user-agent "${ua_iphone}"`;
        strategies.push({ client: 'ios_flex', args: iosArgs });

        return strategies;
    }

    /**
     * Executa yt-dlp com fallback automático entre client strategies.
     * Pode retornar output do stdout (ex: para metadados) ou apenas sucesso de arquivo criado.
     */
    private async _runYtDlpWithFallback(
        buildCommand: (bypassArgs: string) => string,
        expectedOutputPath?: string,
        captureOutput: boolean = false
    ): Promise<{ sucesso: boolean; output?: string; error?: string }> {
        const strategies = this._getClientStrategies();
        let lastError = '';

        for (const strategy of strategies) {
            this.logger?.info(`🔄 Tentando strategy: [${strategy.client}]`);
            const command = buildCommand(strategy.args);

            // Log do comando EXATO para diagnóstico
            this.logger?.info(`📝 Comando: ${command.slice(0, 200)}...`);

            // Quick cookie validation for cookie-based strategies to avoid starting full download
            if (strategy.client.includes('cookies')) {
                try {
                    const testCmd = command + ' --skip-download --no-warnings';
                    this.logger?.debug(`🔎 Testando cookies com: ${testCmd.slice(0,200)}...`);
                    const { stdout: testOut, stderr: testErr } = await execAsync(testCmd, { timeout: 20000, maxBuffer: 10 * 1024 * 1024 });
                    const testMsg = `${testErr || ''}${testOut || ''}`;
                    if (testMsg.includes('Sign in') || testMsg.includes('Requested format') || testMsg.includes('unable to extract') || testMsg.includes('Failed to extract any player response')) {
                        this.logger?.warn(`⛔ [${strategy.client}] Cookie test indica problema, pulando strategy.`);
                        this.logger?.info(`🔍 Test erro: ${testMsg.slice(0,150)}`);
                        lastError = testMsg;
                        continue;
                    }
                } catch (e: any) {
                    const em = (e.stderr || e.message || '').toString();
                    if (em.includes('Sign in') || em.includes('Requested format') || em.includes('unable to extract')) {
                        this.logger?.warn(`⛔ [${strategy.client}] Cookie test falhou: ${em.slice(0,150)}. Pulando.`);
                        lastError = em;
                        continue;
                    }
                    // otherwise fallthrough and try full command
                }
            }

            const result = await new Promise<{ sucesso: boolean; output?: string; error?: string }>((resolve) => {
                exec(command, { timeout: this.config?.YT_TIMEOUT_MS || 300000, maxBuffer: 100 * 1024 * 1024 }, (error, stdout, stderr) => {
                    // Log detalhado para diagnóstico em produção (Bypass 2026)
                    if (stdout) this.logger?.debug(`[${strategy.client}] STDOUT (parcial): ${stdout.slice(0, 200)}`);
                    if (stderr) this.logger?.debug(`[${strategy.client}] STDERR: ${stderr.slice(0, 500)}`);

                    // Se esperamos um arquivo, verificamos a existência
                    if (expectedOutputPath && fs.existsSync(expectedOutputPath)) {
                        return resolve({ sucesso: true, output: stdout });
                    }

                    // Se apenas capturamos output (metadados), verificamos stdout
                    if (captureOutput && stdout && stdout.includes('|')) {
                        return resolve({ sucesso: true, output: stdout });
                    }

                    const errMsg = stderr || (error?.message) || 'Falha na execução';

                    // Detecta bloqueio real de bot-detection
                    if (errMsg.includes('Sign in') || errMsg.includes('bot') || errMsg.includes('403') || errMsg.includes('Requested format is not available')) {
                        this.logger?.warn(`⛔ [${strategy.client}] Bloqueado ou formato indisponível, tentando próximo...`);
                        this.logger?.info(`🔍 Erro detectado: ${errMsg.slice(0, 100)}`);
                    } else if (errMsg.includes('Video unavailable') || errMsg.includes('Private video')) {
                        return resolve({ sucesso: false, error: 'Vídeo indisponível ou privado' });
                    } else {
                        this.logger?.warn(`⚠️ [${strategy.client}] Falhou: ${errMsg.slice(0, 150)}`);
                    }
                    lastError = errMsg;
                    resolve({ sucesso: false, error: errMsg.slice(0, 300) });
                });
            });

            if (result.sucesso) {
                this.logger?.info(`✅ Strategy [${strategy.client}] funcionou!`);
                return result;
            }
        }

        return { sucesso: false, error: lastError || 'Todos os métodos de bypass falharam.' };
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
    * Limpa arquivo
    */
    async cleanupFile(filePath: string): Promise<void> {
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
    async downloadMedia(message: any, mimeType: string = 'image'): Promise<Buffer | null> {
        try {
            // Validação prévia
            if (!message) {
                this.logger?.error('❌ Mensagem é null ou undefined');
                return null;
            }

            /**
             * Extração recursiva para encontrar o conteúdo de mídia real
             * Resolve erro: "Cannot derive from empty media key" em View Once/Editados/Temporários
             */
            const extractMediaContainer = (msgObj: any): any => {
                if (!msgObj || typeof msgObj !== 'object') return null;

                // Match direto: se tiver mediaKey ou directPath, é o objeto alvo
                if (msgObj.mediaKey || msgObj.url || msgObj.directPath) return msgObj;

                if (msgObj.viewOnceMessageV2?.message) return extractMediaContainer(msgObj.viewOnceMessageV2.message);
                if (msgObj.viewOnceMessageV2Extension?.message) return extractMediaContainer(msgObj.viewOnceMessageV2Extension.message);
                if (msgObj.viewOnceMessage?.message) return extractMediaContainer(msgObj.viewOnceMessage.message);
                if (msgObj.ephemeralMessage?.message) return extractMediaContainer(msgObj.ephemeralMessage.message);
                if (msgObj.documentWithCaptionMessage?.message) return extractMediaContainer(msgObj.documentWithCaptionMessage.message);
                if (msgObj.editMessage?.message) return extractMediaContainer(msgObj.editMessage.message);
                if (msgObj.protocolMessage?.editedMessage) return extractMediaContainer(msgObj.protocolMessage.editedMessage);
                if (msgObj.message) return extractMediaContainer(msgObj.message);

                // Busca recursiva em propriedades comuns que terminam com 'Message'
                const knownMessages = ['imageMessage', 'videoMessage', 'stickerMessage', 'audioMessage', 'documentMessage'];
                for (const key of knownMessages) {
                    if (msgObj[key]) return extractMediaContainer(msgObj[key]);
                }

                // Busca genérica fallback
                for (const key in msgObj) {
                    if (key.endsWith('Message') && msgObj[key] && typeof msgObj[key] === 'object') {
                        const res = extractMediaContainer(msgObj[key]);
                        if (res) return res;
                    }
                }

                return null;
            };

            const mediaContent = extractMediaContainer(message);

            if (!mediaContent) {
                this.logger?.error('❌ Mídia não encontrada na estrutura da mensagem');
                return null;
            }

            // ✅ NORMALIZAÇÃO DE MIMETYPE (Crucial para Baileys Decryption)
            // Se mimeType for genérico ('image', 'audio'), tentamos inferir do objeto encontrado
            let finalMimeType = mimeType;
            if (mediaContent.mimetype && (mimeType === 'image' || mimeType === 'video' || mimeType === 'audio')) {
                // Baileys usa as chaves do objeto para decidir o tipo de decifração.
                // Passar o 'mimeType' correto (ex: 'image') é essencial.
                if (mediaContent.mimetype.includes('image')) finalMimeType = 'image';
                else if (mediaContent.mimetype.includes('video')) finalMimeType = 'video';
                else if (mediaContent.mimetype.includes('audio')) finalMimeType = 'audio';
            }

            // Diagnostic log para 'Empty Media Key'
            if (!mediaContent.mediaKey || (!mediaContent.directPath && !mediaContent.url)) {
                this.logger?.warn('⚠️ Mídia encontrada mas incompleta (Empty Media Key):');
                this.logger?.debug('📋 Conteúdo extraído:', JSON.stringify(mediaContent, null, 2));
                this.logger?.debug('📋 Mensagem original:', JSON.stringify(message, null, 2).slice(0, 1000));
            }

            // A Baileys precisa do objeto final (ex: imageMessage) para decifrar a chave
            const targetMessage = mediaContent;

            this.logger?.debug(`⬇️ Baixando mídia (tipo inferido: ${finalMimeType}, original: ${mimeType})...`);
            this.logger?.debug(`📋 Tipo de mensagem: ${typeof message}`);

            // Timeout de 30 segundos para download
            // Retry loop
            let buffer = Buffer.from([]);
            let lastError = null;
            let chunksReceived = 0;

            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const downloadPromise = downloadContentFromMessage(targetMessage, finalMimeType as any);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout ao baixar mídia (30s)')), 30000)
                    );

                    const stream = await Promise.race([downloadPromise, timeoutPromise]);
                    buffer = Buffer.from([]);

                    for await (const chunk of stream as any) {
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
     * Busca buffer de uma URL externa (ex: thumbnail)
     */
    async fetchBuffer(url: string): Promise<Buffer | null> {
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
    async addStickerMetadata(webpBuffer: Buffer, packName: string = 'akira-bot', author: string = 'Akira-Bot'): Promise<Buffer> {
        let tempInput = null;
        let tempOutput = null;
        try {
            if (!Webpmux) return webpBuffer;

            tempInput = this.generateRandomFilename('webp');
            tempOutput = this.generateRandomFilename('webp');

            await fs.promises.writeFile(tempInput, webpBuffer);

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

            const result = await fs.promises.readFile(tempOutput);

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
    async createStickerFromImage(imageBuffer: Buffer, metadata: any = {}): Promise<any> {
        try {
            this.logger?.info('🎨 Criando sticker de imagem (formato quadrado)..');

            const inputPath = this.generateRandomFilename('jpg');
            const outputPath = this.generateRandomFilename('webp');

            await fs.promises.writeFile(inputPath, imageBuffer);

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
                        resolve(void 0);
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

            const stickerBuffer = await fs.promises.readFile(outputPath);

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
    async createAnimatedStickerFromVideo(videoBuffer: Buffer, maxDuration: number | string = 30, metadata: any = {}): Promise<any> {
        try {
            // Use configured max duration if not explicitly provided
            const cfgMax = parseInt(this.config?.STICKER_MAX_ANIMATED_SECONDS || '30');
            maxDuration = parseInt(String(maxDuration || cfgMax));

            this.logger?.info(`🎬 Criando sticker animado (max ${maxDuration}s)`);

            const inputPath = this.generateRandomFilename('mp4');
            const outputPath = this.generateRandomFilename('webp');

            await fs.promises.writeFile(inputPath, videoBuffer);

            // Check input duration and log/trim if necessary
            let inputDuration = 0;
            try {
                await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(inputPath, (err, metadataProbe) => {
                        if (err) return reject(err);
                        inputDuration = metadataProbe?.format?.duration ? Math.floor(metadataProbe.format.duration) : 0;
                        if (inputDuration > Number(maxDuration)) {
                            this.logger?.info(`🛑 Vídeo de entrada tem ${inputDuration}s; será cortado para ${maxDuration}s`);
                        }
                        resolve(void 0);
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
                        resolve(void 0);
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

            let stickerBuffer = await fs.promises.readFile(outputPath);

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
                            '-t', String(Math.min(Number(maxDuration), 10)),
                            '-y'
                        ])
                        .on('end', () => resolve(void 0))
                        .on('error', (err: any) => reject(err))
                        .save(outputPath);
                });

                stickerBuffer = await fs.promises.readFile(outputPath);

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
                    .on('error', (err: any) => reject(err))
                    .save(outputPath);
            });

            const audioBuffer = await fs.promises.readFile(outputPath);

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
    async convertStickerToImage(stickerBuffer: Buffer): Promise<any> {
        try {
            this.logger?.info('🔄 Convertendo sticker para imagem..');

            const inputPath = this.generateRandomFilename('webp');
            const outputPath = this.generateRandomFilename('png');

            await fs.promises.writeFile(inputPath, stickerBuffer);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions('-vcodec', 'png')
                    .on('end', () => {
                        this.logger?.debug('✅ Conversão concluída');
                        resolve(void 0);
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

            const imageBuffer = await fs.promises.readFile(outputPath);

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
    detectViewOnce(message: any): any {
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
    async extractViewOnceContent(quotedMessage: any): Promise<any> {
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

            // Verifica locais comuns sem bloquear (existência via sync é rápida)
            const commonPaths = ['/usr/bin/yt-dlp', '/usr/local/bin/yt-dlp', '/bin/yt-dlp'];
            for (const p of commonPaths) {
                if (fs.existsSync(p)) return { modo: 'exe', cmd: p };
            }

            // Não encontrou binário em locais comuns — assume que está no PATH (retornar binName otimista)
            return { modo: 'exe', cmd: binName };
        } catch (e) {
            return null;
        }
    }

    /**
    * Download via yt-dlp com fallback automático entre múltiplos clients
    */
    async _downloadWithYtDlp(url: string, videoId: string, tool: any): Promise<any> {
        try {
            const outputTemplate = this.generateRandomFilename('').replace(/\\$/, '');
            const maxSizeMB = this.config?.YT_MAX_SIZE_MB || 500;
            const expectedPath = outputTemplate + '.mp3';

            const buildCommand = (bypassArgs: string) => {
                const ytdlpTool = this.findYtDlp();
                const cmd = process.platform === 'win32' ? `"${ytdlpTool.cmd}"` : ytdlpTool.cmd;
                // Sem -f: deixa --extract-audio selecionar automaticamente o melhor áudio
                return `${cmd} ${bypassArgs} --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}.%(ext)s" --no-playlist --max-filesize ${maxSizeMB}M --no-warnings "${url}"`;
            };

            const result = await this._runYtDlpWithFallback(buildCommand, expectedPath);

            if (!result.sucesso) {
                return { sucesso: false, error: result.error };
            }

            if (!fs.existsSync(expectedPath)) {
                return { sucesso: false, error: 'Arquivo MP3 não encontrado após download' };
            }

            const stats = fs.statSync(expectedPath);
            if (stats.size === 0) {
                await this.cleanupFile(expectedPath);
                return { sucesso: false, error: 'Arquivo vazio' };
            }

            return {
                sucesso: true,
                audioPath: expectedPath,
                titulo: 'Áudio do YouTube',
                tamanho: stats.size,
                metodo: 'yt-dlp'
            };
        } catch (e: any) {
            this.logger?.debug('yt-dlp error:', e.message);
            return { sucesso: false, error: e.message };
        }
    }

    /**
    * Download via ytdl-core
    */
    async _downloadWithYtdlCore(url: string, videoId: string): Promise<any> {
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
                writeStream.on('finish', () => resolve(true));
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

            this.logger?.info(`✅ Download ytdl-core completo: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
            return {
                sucesso: true,
                audioPath: outputPath,
                titulo: info?.videoDetails?.title || 'Música do YouTube',
                tamanho: stats.size,
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
    extractYouTubeVideoId(url: string): string | null {
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
        // Fix: Evita colisão com palavras comuns de 11 letras (ex: "darkacademy") exigindo pelo menos um número ou símbolo
        if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url) && /[\d_-]/.test(url)) {
            return url;
        }

        return null;
    }

    async downloadYouTubeAudio(input: string): Promise<any> {
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

                    if (result.fallbackToSearch) {
                        this.logger?.info(`🔍 Executando fallback de busca (Audio) para: ${input}`);
                        const searchRes = await this.searchYouTube(input, 1);
                        if (searchRes.sucesso && searchRes.resultados.length > 0) {
                            const correctUrl = searchRes.resultados[0].url;
                            this.logger?.info(`✅ Fallback encontrou: ${searchRes.resultados[0].titulo}`);
                            return this.downloadYouTubeAudio(correctUrl); // Recursive call
                        }
                    }

                    if (result.sucesso) {
                        return { ...result, ...metadata, titulo: 'Áudio do YouTube', metodo: 'yt-dlp' };
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
                const axiosRes = await this._downloadWithAxios(url, videoId);
                if (axiosRes && axiosRes.sucesso) return axiosRes;
                this.logger?.warn('⚠️ Método direto retornou falha, tentando fallback Invidious...');
            } catch (axiosErr) {
                this.logger?.warn('⚠️ Método direto falhou:', axiosErr.message);
            }

            // Fallback Invidious (pode contornar bot/cookies se estiver disponível)
            try {
                const inv = await this.tryInvidiousFallback(videoId, 'audio');
                if (inv && inv.sucesso) return inv;
                this.logger?.warn('⚠️ Fallback Invidious também falhou:', inv?.error || 'sem detalhe');
            } catch (invErr) {
                this.logger?.warn('⚠️ Erro no fallback Invidious:', invErr.message);
            }

            return {
                sucesso: false,
                error: 'Nenhum método de download funcionou. Verifique:\n1. yt-dlp está instalado\n2. A URL do vídeo é válida\n3. Cookies válidos para YouTube (se necessário)'
            };

        } catch (error) {
            this.logger?.error('❌ Erro geral no download:', error.message);
            return { sucesso: false, error: error.message };
        }
    }

    /**
    * Download de VÍDEO do YouTube
    */
    async downloadYouTubeVideo(input: string): Promise<any> {
        try {
            this.logger?.info('🎬 Iniciando download de VÍDEO do YouTube...');
            let url = input;
            let isSearch = false; // Track if we performed a search

            let videoId = this.extractYouTubeVideoId(url);
            if (!videoId) {
                this.logger?.info(`🔍 Input não é URL, tentando busca: ${input}`);
                const searchRes = await this.searchYouTube(input, 1);
                if (searchRes.sucesso && searchRes.resultados.length > 0) {
                    url = searchRes.resultados[0].url;
                    videoId = this.extractYouTubeVideoId(url);
                    isSearch = true; // Mark as search result
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
            const maxSizeMB = this.config?.YT_MAX_SIZE_MB || 2048;

            // Detecta extensão real após download (pode ser mp4, webm, mkv)
            const findOutputFile = () => {
                for (const ext of ['.mp4', '.mkv', '.webm']) {
                    const p = outputTemplate + ext;
                    if (fs.existsSync(p)) return p;
                }
                return null;
            };

            const buildCommand = (bypassArgs: string) => {
                const cmd = process.platform === 'win32' ? `"${ytdlpTool.cmd}"` : ytdlpTool.cmd;
                // Formato ultra-compatível: tenta video+audio juntos, após tenta qualquer combinação
                // bestvideo+bestaudio = melhor video + melhor audio (padrão youtube-dl)
                // /best = se não conseguir combinar, pega o arquivo único melhor
                const formatStr = "bestvideo+bestaudio/best";
                return `${cmd} ${bypassArgs} -f "${formatStr}" -o "${outputTemplate}.%(ext)s" --no-playlist --max-filesize ${maxSizeMB}M --no-warnings "${url}"`;
            };

            // Usa o mesmo sistema de fallback progressivo do áudio
            const expectedPath = outputTemplate + '.mp4';
            const result = await this._runYtDlpWithFallback(buildCommand, expectedPath);

            if (!result.sucesso) {
                // Tenta detectar qualquer extensão criada
                const anyFile = findOutputFile();
                if (!anyFile) {
                    // Se todos os métodos internos falharam, tenta fallback Invidious
                    try {
                        this.logger?.info('🔁 Tentando fallback Invidious para vídeo...');
                        const inv = await this.tryInvidiousFallback(videoId, 'video');
                        if (inv && inv.sucesso) return { sucesso: true, videoPath: inv.videoPath, metodo: inv.metodo, titulo: inv.titulo, tamanho: inv.tamanho };
                        this.logger?.warn('⚠️ Fallback Invidious não conseguiu obter o vídeo:', inv?.error || 'sem detalhe');
                    } catch (ie) {
                        this.logger?.debug('Erro no fallback Invidious:', ie.message);
                    }

                    if (result.error?.includes('indisponível') && !isSearch) {
                        return { fallbackToSearch: true };
                    }
                    return { sucesso: false, error: result.error };
                }
            }

            const videoPath = findOutputFile();

            if (!videoPath) {
                return { sucesso: false, error: 'Arquivo de vídeo não encontrado após download.' };
            }

            const stats = fs.statSync(videoPath);
            const fileSizeMB = stats.size / (1024 * 1024);

            if (stats.size > this.config?.YT_MAX_SIZE_MB * 1024 * 1024) {
                await this.cleanupFile(videoPath);
                return { sucesso: false, error: `Vídeo muito grande (${fileSizeMB.toFixed(1)}MB > ${this.config?.YT_MAX_SIZE_MB}MB)` };
            }

            // Se for grande (>50MB) e já mp4, envia direto sem processamento pesado
            if (fileSizeMB > 50 && videoPath.endsWith('.mp4')) {
                this.logger?.info(`⏩ Ignorando otimização para arquivo grande (${fileSizeMB.toFixed(1)}MB)`);
                const metaLarge = await this.getYouTubeMetadata(url, ytdlpTool);
                const mdLarge = metaLarge.sucesso ? metaLarge : { titulo: 'Vídeo do YouTube' };
                return { sucesso: true, videoPath, titulo: mdLarge.titulo, size: stats.size, mimetype: 'video/mp4', ...mdLarge };
            }

            // Otimiza vídeo via FFmpeg para compatibilidade WhatsApp
            this.logger?.info(`🛠️ Otimizando vídeo (${fileSizeMB.toFixed(1)}MB)...`);
            const optimizedPath = this.generateRandomFilename('mp4');

            try {
                await new Promise((resolve, reject) => {
                    ffmpeg(videoPath)
                        .outputOptions([
                            '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.0',
                            '-pix_fmt', 'yuv420p', '-threads', '1',
                            '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
                            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                            '-movflags', '+faststart', '-preset', 'ultrafast', '-crf', '26'
                        ])
                        .on('start', (cmd: any) => this.logger?.debug(`FFMPEG: ${cmd}`))
                        .on('end', resolve)
                        .on('error', (err: any) => { this.logger?.error(`Erro FFMPEG: ${err.message}`); reject(err); })
                        .save(optimizedPath);
                });

                const metaOpt = await this.getYouTubeMetadata(url, ytdlpTool);
                const mdOpt = metaOpt.sucesso ? metaOpt : { titulo: 'Vídeo do YouTube' };
                await this.cleanupFile(videoPath);
                return { sucesso: true, videoPath: optimizedPath, titulo: mdOpt.titulo, size: fs.statSync(optimizedPath).size, mimetype: 'video/mp4', ...mdOpt };
            } catch (optErr: any) {
                this.logger?.warn('⚠️ Otimização falhou, enviando original...');
                const metaFall = await this.getYouTubeMetadata(url, ytdlpTool);
                const mdFall = metaFall.sucesso ? metaFall : { titulo: 'Vídeo do YouTube' };
                return { sucesso: true, videoPath, titulo: mdFall.titulo, size: stats.size, mimetype: 'video/mp4', ...mdFall };
            }

        } catch (error: any) {
            this.logger?.error('❌ Erro download vídeo:', error.message);
            return { sucesso: false, error: error.message };
        }
    }


    async getYouTubeMetadata(url: string, tool: any = null): Promise<any> {
        try {
            const ytdlp = tool || this.findYtDlp();
            if (!ytdlp) return { sucesso: false, error: 'yt-dlp não encontrado' };

            // Extrair ID para thumbnail
            const videoId = this.extractYouTubeVideoId(url);
            const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

            const buildCommand = (bypassArgs: string) => {
                const cmd = process.platform === 'win32' ? `"${ytdlp.cmd}"` : ytdlp.cmd;
                return `${cmd} ${bypassArgs} --print "%(title)s|%(uploader)s|%(duration)s|%(view_count)s|%(like_count)s|%(upload_date)s" --no-playlist "${url}"`;
            };

            const result = await this._runYtDlpWithFallback(buildCommand, undefined, true);

            if (!result.sucesso || !result.output) {
                return { sucesso: false, error: result.error || 'Não foi possível extrair metadados' };
            }

            const [title, author, duration, views, likes, date] = result.output.trim().split('|');

            // Formata views para algo legível (ex: 1.5M)
            const formatCount = (count: any) => {
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
    async _downloadWithAxios(url: string, videoId: string): Promise<any> {
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
     * Fallback usando instâncias Invidious públicas para obter URLs diretos
     * Retorna {sucesso, path, metodo, titulo, tamanho}
     */
    async tryInvidiousFallback(videoId: string, prefer: 'audio' | 'video' = 'audio'): Promise<any> {
        try {
            const instances = (this.config?.INVIDIOUS_INSTANCES || 'yewtu.cafe,yewtu.eu,yewtu.snopyta.org').split(',');
            for (const inst of instances) {
                const base = inst.trim();
                if (!base) continue;
                const url = `https://${base}/api/v1/videos/${videoId}`;
                this.logger?.info(`🔎 Tentando Invidious: ${url}`);
                try {
                    const res = await axios.get(url, { timeout: 10000 });
                    const data = res.data;

                    const formats = Array.isArray(data?.formats) ? data.formats : [];
                    const adaptive = Array.isArray(data?.adaptiveFormats) ? data.adaptiveFormats : [];
                    const all = formats.concat(adaptive || []);

                    if (!all || all.length === 0) {
                        this.logger?.warn(`⚠️ Invidious ${base} não retornou formatos válidos`);
                        continue;
                    }

                    // Escolha de formato
                    if (prefer === 'audio') {
                        // Procura o melhor audio (audioonly)
                        const auds = all.filter((f: any) => String(f.mimeType || f.mime_type || '').includes('audio'));
                        if (auds.length === 0) continue;
                        // Priorizar maior bitrate/contentLength
                        auds.sort((a: any, b: any) => (parseInt(b.bitrate || b.audioBitrate || 0) || 0) - (parseInt(a.bitrate || a.audioBitrate || 0) || 0));
                        const chosen = auds[0];
                        const audiourl = chosen.url || chosen.cipher || chosen.signatureCipher;
                        if (!audiourl) continue;

                        const outPath = this.generateRandomFilename('mp3');
                        await this._downloadUrlToFile(audiourl, outPath + '.tmp');

                        // Converter para mp3 com ffmpeg se necessário
                        await new Promise((resolve, reject) => {
                            ffmpeg(outPath + '.tmp')
                                .noVideo()
                                .audioCodec('libmp3lame')
                                .audioBitrate('192k')
                                .on('end', () => resolve(void 0))
                                .on('error', (err) => reject(err))
                                .save(outPath);
                        });

                        await this.cleanupFile(outPath + '.tmp');
                        const stats = fs.statSync(outPath);
                        return { sucesso: true, audioPath: outPath, metodo: `invidious:${base}`, titulo: data?.title || 'YouTube (Invidious)', tamanho: stats.size };
                    } else {
                        // video prefer
                        // procura formatos progressivos (contêm audio+video) primeiro
                        const progressive = all.filter((f: any) => { const mt = String(f.mimeType || f.mime_type || ''); return mt.includes('video') && (f.audioBitrate || mt.includes('audio')) && f.url; });
                        if (progressive.length > 0) {
                            progressive.sort((a: any, b: any) => (parseInt(b.bitrate || 0) || 0) - (parseInt(a.bitrate || 0) || 0));
                            const chosen = progressive[0];
                            const vurl = chosen.url;
                            const outPath = this.generateRandomFilename('mp4');
                            await this._downloadUrlToFile(vurl, outPath);
                            const stats = fs.statSync(outPath);
                            return { sucesso: true, videoPath: outPath, metodo: `invidious:${base}`, titulo: data?.title || 'YouTube (Invidious)', tamanho: stats.size };
                        }

                        // Se não há progressivo, pega melhor video e melhor audio e merge
                        const videos = all.filter((f: any) => String(f.mimeType || '').includes('video') && f.url).sort((a: any, b: any) => (parseInt(b.bitrate || 0) || 0) - (parseInt(a.bitrate || 0) || 0));
                        const audios = all.filter((f: any) => String(f.mimeType || '').includes('audio') && f.url).sort((a: any, b: any) => (parseInt(b.bitrate || b.audioBitrate || 0) || 0) - (parseInt(a.bitrate || a.audioBitrate || 0) || 0));
                        if (videos.length > 0 && audios.length > 0) {
                            const v = videos[0];
                            const a = audios[0];
                            const vPath = this.generateRandomFilename('mp4');
                            const aPath = this.generateRandomFilename('m4a');
                            await this._downloadUrlToFile(v.url, vPath);
                            await this._downloadUrlToFile(a.url, aPath);

                            const outMerged = this.generateRandomFilename('mp4');
                            await new Promise((resolve, reject) => {
                                ffmpeg()
                                    .input(vPath)
                                    .input(aPath)
                                    .outputOptions(['-c:v copy', '-c:a aac', '-strict experimental'])
                                    .on('end', () => resolve(void 0))
                                    .on('error', (err) => reject(err))
                                    .save(outMerged);
                            });

                            await Promise.all([this.cleanupFile(vPath), this.cleanupFile(aPath)]);
                            const stats = fs.statSync(outMerged);
                            return { sucesso: true, videoPath: outMerged, metodo: `invidious:${base}`, titulo: data?.title || 'YouTube (Invidious)', tamanho: stats.size };
                        }
                    }
                } catch (e) {
                    this.logger?.debug(`⚠️ Erro Invidious ${base}: ${e.message}`);
                    continue;
                }
            }

            return { sucesso: false, error: 'Invidious não encontrou formatos válidos' };
        } catch (e) {
            return { sucesso: false, error: e.message };
        }
    }

    // Helper para baixar uma url direta para arquivo via axios stream
    async _downloadUrlToFile(url: string, outPath: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await axios.get(url, { responseType: 'stream', timeout: 60000 });
                const writer = fs.createWriteStream(outPath);
                response.data.pipe(writer);
                writer.on('finish', () => resolve());
                writer.on('error', (err: any) => reject(err));
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
    * Processa link do YouTube (validação)
    */
    isValidYouTubeUrl(url: any): boolean {
        const regex = /^(https?:\/\/(www\.)?)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/.*$/i;
        return regex.test(String(url));
    }

    /**
    * Busca música no YouTube por nome
    */
    async searchYouTube(query: string, limit: number = 5): Promise<any> {
        try {
            this.logger?.info(`🔍 Buscando: ${query}`);

            const result = await yts(query);

            if (!result || !result.videos || result.videos.length === 0) {
                return {
                    sucesso: false,
                    error: 'Nenhum resultado encontrado'
                };
            }

            const videos = result.videos.slice(0, limit).map((v: any) => ({
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
            };
        }
    }


    // ═════════════════════════════════════════════════════════════════
    // DOWNLOADS DE MÍDIA SOCIAL (Pinterest & Facebook)
    // ═════════════════════════════════════════════════════════════════

    /**
     * Download de vídeo do Pinterest (Scraping HTML)
     */
    async downloadPinterestVideo(url: string): Promise<any> {
        try {
            this.logger?.info(`📌 Baixando vídeo do Pinterest: ${url}`);

            // Fazer fetch da página
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const html = response.data;

            // Procurar pelo JSON embutido com dados do vídeo
            const videoDataMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(\{[^<]+)<\/script>/);

            let videoUrl = null;

            if (videoDataMatch) {
                try {
                    const jsonData = JSON.parse(videoDataMatch[1]);
                    videoUrl = jsonData.contentUrl || jsonData.video?.contentUrl;
                } catch (e) {
                    this.logger?.warn('Erro ao parsear JSON do Pinterest:', e.message);
                }
            }

            // Fallback: procurar por URLs de vídeo diretamente no HTML
            if (!videoUrl) {
                const urlMatches = html.match(/https:\/\/v\.pinimg\.com\/videos\/[^"]+\.mp4/);
                if (urlMatches && urlMatches.length > 0) {
                    videoUrl = urlMatches[0];
                }
            }

            if (!videoUrl) {
                return {
                    sucesso: false,
                    error: 'Não foi possível encontrar o vídeo no Pinterest'
                };
            }

            // Download do arquivo de vídeo
            const videoResponse = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const buffer = Buffer.from(videoResponse.data);

            return {
                sucesso: true,
                buffer: buffer,
                ext: 'mp4',
                mime: 'video/mp4'
            };

        } catch (error) {
            this.logger?.error(`❌ Erro no download Pinterest: ${error.message}`);
            return {
                sucesso: false,
                error: error.message
            };
        }
    }

    /**
     * Download de vídeo do Facebook (usando yt-dlp)
     */
    async downloadFacebookVideo(url: string): Promise<any> {
        try {
            this.logger?.info(`📘 Baixando vídeo do Facebook: ${url}`);

            // Buscar binário yt-dlp
            const projectRoot = path.resolve(__dirname, '..');
            const ytdlpPath = path.join(projectRoot, 'node_modules', '@types', 'yt-dlp', 'yt-dlp.exe');

            // Fallback: tentar PATH global
            const ytdlpCommand = fs.existsSync(ytdlpPath) ? ytdlpPath : 'yt-dlp';

            const outputPath = this.generateRandomFilename('mp4');

            const execPromise = util.promisify(exec);

            // Chamar yt-dlp com opções para Facebook
            const command = `"${ytdlpCommand}" -f best -o "${outputPath}" "${url}"`;

            await execPromise(command, {
                maxBuffer: 50 * 1024 * 1024, // 50MB buffer
                timeout: 120000 // 2 minutos timeout
            });

            if (!fs.existsSync(outputPath)) {
                return {
                    sucesso: false,
                    error: 'Arquivo não foi criado pelo yt-dlp'
                };
            }

            const buffer = await fs.promises.readFile(outputPath);

            // Limpar arquivo temporário
            await this.cleanupFile(outputPath);

            return {
                sucesso: true,
                buffer: buffer,
                ext: 'mp4',
                mime: 'video/mp4'
            };

        } catch (error) {
            this.logger?.error(`❌ Erro no download Facebook: ${error.message}`);
            return {
                sucesso: false,
                error: error.message
            };
        }
    }

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

    // ═════════════════════════════════════════════════════════════════
    // EFEITOS DE ÁUDIO
    // ═════════════════════════════════════════════════════════════════

    /**
     * Aplica efeito de áudio usando ffmpeg
     * @param {Buffer|string} audioInput - Buffer ou path do áudio
     * @param {string} effect - Efeito: nightcore, slow, bass, deep, robot, reverse, squirrel, echo, 8d
     * @returns {Promise<Buffer>} Buffer do áudio processado
     */
    async applyAudioEffect(audioInput: Buffer | string, effect: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const inputPath = typeof audioInput === 'string'
                ? audioInput
                : path.join(this.tempFolder, `audio_input_${Date.now()}.mp3`);

            const outputPath = path.join(this.tempFolder, `audio_effect_${Date.now()}.mp3`);

            try {
                // Se for buffer, salvar temporariamente
                if (Buffer.isBuffer(audioInput)) {
                    fs.writeFileSync(inputPath, audioInput);
                }

                const command = ffmpeg(inputPath);

                // Configurar efeito
                switch (effect.toLowerCase()) {
                    case 'nightcore':
                        // Aumenta velocidade e pitch
                        command.audioFilters('atempo=1.25,asetrate=44100*1.25,aresample=44100');
                        break;

                    case 'slow':
                    case 'slowed':
                    case 'slower':
                        // Slowed + Reverb (Estilo Lo-fi/Aesthetic)
                        // atempo=0.85 (85% velocidade), aecho (reverb espacial), lowpass (som abafado lo-fi)
                        command.audioFilters([
                            'atempo=0.85',
                            'aecho=0.8:0.9:1000:0.3',
                            'lowpass=f=3000',
                            'volume=1.2'
                        ]);
                        break;

                    case 'bass':
                    case 'bassboost':
                        // Bass Boost Premium (Parametric EQ)
                        // Foca nos sub-graves (60Hz) sem distorcer os médios + Limiter para evitar clipping
                        command.audioFilters([
                            'equalizer=f=60:width_type=h:width=50:g=15',
                            'equalizer=f=120:width_type=h:width=100:g=5',
                            'limiter=threshold=-1dB'
                        ]);
                        break;

                    case 'deep':
                    case 'deepvoice':
                        // Voz profunda (pitch baixo) sem perder qualidade
                        command.audioFilters([
                            'asetrate=44100*0.75',
                            'aresample=44100',
                            'atempo=1.25'
                        ]);
                        break;

                    case 'robot':
                    case 'robotic':
                        // Efeito robótico
                        command.audioFilters('chorus=0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3');
                        break;

                    case 'reverse':
                    case 'reverso':
                        // Áudio reverso
                        command.audioFilters('areverse');
                        break;

                    case 'squirrel':
                    case 'chipmunk':
                        // Voz de esquilo (pitch alto)
                        command.audioFilters('asetrate=44100*1.5,aresample=44100');
                        break;

                    case 'echo':
                        // Eco
                        command.audioFilters('aecho=0.8:0.9:1000:0.3');
                        break;

                    case '8d':
                    case '8daudio':
                        // Áudio 8D (pan esquerda-direita)
                        command.audioFilters('apulsator=hz=0.125');
                        break;

                    default:
                        throw new Error(`Efeito desconhecido: ${effect}`);
                }

                command
                    .audioCodec('libmp3lame')
                    .audioBitrate('128k')
                    .format('mp3')
                    .on('end', () => {
                        try {
                            fs.promises.readFile(outputPath).then((buffer) => {
                                        // Limpar arquivos temporários (não-bloqueante)
                                        const cleanupPromises: Promise<any>[] = [];
                                        if (Buffer.isBuffer(audioInput)) {
                                            cleanupPromises.push(fs.promises.unlink(inputPath).catch(() => {}));
                                        }
                                        cleanupPromises.push(fs.promises.unlink(outputPath).catch(() => {}));
                                        Promise.all(cleanupPromises).then(() => resolve(buffer)).catch(() => resolve(buffer));
                                    }).catch((e) => reject(e));
                        } catch (e) {
                            reject(e);
                        }
                    })
                    .on('error', (err) => {
                        this.logger.error('Erro ao aplicar efeito de áudio:', err);

                        // Limpar em caso de erro
                        try {
                            if (Buffer.isBuffer(audioInput) && fs.existsSync(inputPath)) {
                                fs.unlinkSync(inputPath);
                            }
                            if (fs.existsSync(outputPath)) {
                                fs.unlinkSync(outputPath);
                            }
                        } catch (e) { }

                        reject(err);
                    })
                    .save(outputPath);

            } catch (error) {
                this.logger.error('Erro ao configurar efeito:', error);
                reject(error);
            }
        });
    }
}

export default MediaProcessor;
