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

        // 🍪 Prioridade 1: Caminho configurado no .env ou detectado pelo ConfigManager
        const cookieArg = (cookiesPath && fs.existsSync(cookiesPath)) ? `--cookies "${cookiesPath}"` : '';

        const possibleCookiePaths = [
            './cookies.txt',               // Raiz local
            '/app/cookies.txt',           // Raiz Railway
            './youtube_cookies.txt',
            '/tmp/akira_data/cookies/youtube_cookies.txt'
        ];

        // 🍪 Fallback: Procura automática na raiz se não estiver configurado
        let finalCookieArg = cookieArg;
        if (!finalCookieArg) {
            for (const p of possibleCookiePaths) {
                if (fs.existsSync(p)) {
                    const stats = fs.statSync(p);
                    this.logger?.info(`🍪 Cookies detetados automaticamente em: ${p} (${stats.size} bytes)`);
                    finalCookieArg = `--cookies "${path.resolve(p)}"`;
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

        // 🟠 1. IOS (Melhor bypass atual para 2026, evita bot-detection na maioria dos vídeos)
        let iosArgs = `--extractor-args "youtube:player_client=ios" ${finalCookieArg || ''} ${baseSleepArgs} --user-agent "${ua_iphone}"`;
        strategies.push({ client: 'ios', args: iosArgs });

        // 🟢 2. WEB + COOKIES (Robusto se os cookies forem válidos)
        if (finalCookieArg) {
            let webArgs = `--extractor-args "youtube:player_client=web" ${finalCookieArg} ${baseSleepArgs} --user-agent "${ua_chrome}"`;
            strategies.push({ client: 'web+cookies', args: webArgs });
        }

        // 🔴 3. TV_EMBEDDED (Fallback clássico sem cookies para evitar erros de autenticação)
        let tvArgs = `--extractor-args "youtube:player_client=tv_embedded" ${baseSleepArgs} --user-agent "${ua_iphone}"`;
        strategies.push({ client: 'tv_embedded', args: tvArgs });

        // 🟣 4. ANDROID (Android bypass)
        let androidArgs = `--extractor-args "youtube:player_client=android" ${baseSleepArgs} --user-agent "${ua_android}"`;
        strategies.push({ client: 'android', args: androidArgs });

        // 🔵 5. COOKIES FROM BROWSER (Último recurso se disponível no ambiente)
        if (process.platform !== 'linux') { // No Linux/Docker raramente funciona sem config extra
            strategies.push({
                client: 'cookies_from_browser',
                args: `--cookies-from-browser chrome,firefox,edge ${baseSleepArgs} --user-agent "${ua_chrome}"`
            });
        }

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
                    this.logger?.debug(`🔎 Testando cookies com: ${testCmd.slice(0, 200)}...`);
                    const { stdout: testOut, stderr: testErr } = await execAsync(testCmd, { timeout: 20000, maxBuffer: 10 * 1024 * 1024 });
                    const testMsg = `${testErr || ''}${testOut || ''}`;
                    if (testMsg.includes('Sign in') || testMsg.includes('Requested format') || testMsg.includes('unable to extract') || testMsg.includes('Failed to extract any player response')) {
                        this.logger?.warn(`⛔ [${strategy.client}] Cookie test indica problema, pulando strategy.`);
                        this.logger?.info(`🔍 Test erro: ${testMsg.slice(0, 150)}`);
                        lastError = testMsg;
                        continue;
                    }
                } catch (e: any) {
                    const em = (e.stderr || e.message || '').toString();
                    if (em.includes('Sign in') || em.includes('Requested format') || em.includes('unable to extract')) {
                        this.logger?.warn(`⛔ [${strategy.client}] Cookie test falhou: ${em.slice(0, 150)}. Pulando.`);
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

            // Se o erro foi 'Requested format is not available', tenta com formato mais flexível na próxima iteração
            if (lastError.includes('Requested format is not available')) {
                this.logger?.info(`🔄 Format error detectado, tentando com formato 'best' na próxima strategy...`);
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

                // Match direto prioritário: se tiver mediaKey e (url ou directPath), é o objeto alvo final
                if (msgObj.mediaKey && (msgObj.url || msgObj.directPath)) return msgObj;

                // Wrappers conhecidos
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

                // Sub-mensagens típicas
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
            if (message.ephemeralMessage?.message) return message.ephemeralMessage.message;
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Extrai conteúdo de view-once (imagem, vídeo, áudio, sticker)
     * Usado pelo comando #reveal e #vosticker
     */
    async extractViewOnceContent(quoted: any): Promise<any> {
        try {
            if (!quoted) {
                return { sucesso: false, error: 'Nenhuma mensagem citada' };
            }

            // Verifica view-once wrappers
            let target = quoted;
            if (quoted.viewOnceMessageV2?.message) target = quoted.viewOnceMessageV2.message;
            else if (quoted.viewOnceMessageV2Extension?.message) target = quoted.viewOnceMessageV2Extension.message;
            else if (quoted.viewOnceMessage?.message) target = quoted.viewOnceMessage.message;
            else if (quoted.ephemeralMessage?.message) target = quoted.ephemeralMessage.message;

            // Verifica tipo de mídia
            const hasImage = target.imageMessage;
            const hasVideo = target.videoMessage;
            const hasAudio = target.audioMessage;
            const hasSticker = target.stickerMessage;

            if (!hasImage && !hasVideo && !hasAudio && !hasSticker) {
                return { sucesso: false, error: 'Mensagem citada não é view-once ou não contém mídia' };
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
                return { sucesso: false, error: 'Erro ao baixar conteúdo view-once' };
            }

            return {
                sucesso: true,
                tipo,
                buffer,
                size: buffer.length,
                mimeType
            };

        } catch (error) {
            this.logger?.error('❌ Erro ao extrair view-once:', error.message);
            return {
                sucesso: false,
                error: error.message || 'Erro desconhecido ao extrair view-once'
            };
        }
    }


    /**
     * Obtém metadados de vídeo do YouTube usando yt-dlp
     */
    async getYouTubeMetadata(url: string): Promise<any> {
        try {
            this.logger?.info(`🔍 Obtendo metadados do YouTube: ${url}`);

            // Usa yt-dlp para obter metadados em formato JSON
            const result = await this._runYtDlpWithFallback(
                (bypassArgs) => `yt-dlp ${bypassArgs} --dump-json --no-download "${url}" 2>/dev/null`,
                undefined,
                true
            );

            if (!result.sucesso || !result.output) {
                // Fallback para método antigo
                return this._getYouTubeMetadataFallback(url);
            }

            // Parse do JSON retornado
            try {
                // yt-dlp pode retornar múltiplas linhas JSON para playlists, pegamos a primeira
                const lines = result.output.trim().split('\n').filter(line => line.trim());
                const jsonLine = lines.find(line => line.startsWith('{'));
                
                if (!jsonLine) {
                    throw new Error('Nenhum JSON válido encontrado na saída');
                }

                const data = JSON.parse(jsonLine);

                // Extrai metadados com fallbacks para diferentes nomes de campos
                const metadata = {
                    titulo: data.title || data.fulltitle || 'Título desconhecido',
                    canal: data.channel || data.uploader || data.creator || 'Canal desconhecido',
                    duracao: data.duration || 0,
                    duracaoFormatada: this._formatDuration(data.duration || 0),
                    views: this._formatCount(data.view_count || data.viewCount || data.views || 0),
                    viewsRaw: data.view_count || data.viewCount || data.views || 0,
                    likes: this._formatCount(data.like_count || data.likeCount || data.likes || 0),
                    likesRaw: data.like_count || data.likeCount || data.likes || 0,
                    thumbnail: data.thumbnail || data.thumbnails?.[0]?.url || '',
                    descricao: data.description || '',
                    url: data.webpage_url || data.url || url,
                    id: data.id || data.video_id || '',
                    formato: data.format || 'Desconhecido',
                    tamanho: data.filesize || data.filesize_approx || 0
                };

                this.logger?.info(`✅ Metadados obtidos: "${metadata.titulo}" por ${metadata.canal}`);
                return {
                    sucesso: true,
                    ...metadata
                };

            } catch (parseError) {
                this.logger?.warn('⚠️ Erro ao parsear JSON, usando fallback:', parseError.message);
                return this._getYouTubeMetadataFallback(url);
            }

        } catch (error) {
            this.logger?.error('❌ Erro ao obter metadados do YouTube:', error.message);
            return {
                sucesso: false,
                error: error.message
            };
        }
    }

    /**
     * Método fallback para metadados (formato antigo pipe-separated)
     */
    private async _getYouTubeMetadataFallback(url: string): Promise<any> {
        try {
            this.logger?.info(`🔄 Usando fallback para metadados: ${url}`);

            const result = await this._runYtDlpWithFallback(
                (bypassArgs) => `yt-dlp ${bypassArgs} --print "%(title)s|%(channel)s|%(duration)s|%(view_count)s|%(like_count)s|%(thumbnail)s" "${url}" 2>/dev/null`,
                undefined,
                true
            );

            if (!result.sucesso || !result.output) {
                throw new Error('Não foi possível obter metadados');
            }

            const parts = result.output.trim().split('|');
            
            return {
                sucesso: true,
                titulo: parts[0] || 'Título desconhecido',
                canal: parts[1] || 'Canal desconhecido',
                duracao: parseInt(parts[2]) || 0,
                duracaoFormatada: this._formatDuration(parseInt(parts[2]) || 0),
                views: this._formatCount(parseInt(parts[3]) || 0),
                viewsRaw: parseInt(parts[3]) || 0,
                likes: this._formatCount(parseInt(parts[4]) || 0),
                likesRaw: parseInt(parts[4]) || 0,
                thumbnail: parts[5] || '',
                descricao: '',
                url: url,
                id: '',
                formato: 'Desconhecido',
                tamanho: 0
            };

        } catch (error) {
            this.logger?.error('❌ Erro no fallback de metadados:', error.message);
            return {
                sucesso: false,
                error: error.message
            };
        }
    }

    /**
     * Formata segundos para formato legível (MM:SS ou HH:MM:SS)
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
        
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        }
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return num.toString();
    }
}

export default MediaProcessor;
