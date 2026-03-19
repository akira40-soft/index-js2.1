/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLASSE: BotCore
 * ═══════════════════════════════════════════════════════════════════════════
 * Núcleo central do bot Akira.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/// <reference path="./declarations.d.ts" />
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay, Browsers, getContentType, generateMessageID } from '@whiskeysockets/baileys';
import fs from 'fs';
// @ts-ignore
import path from 'path';
import pino from 'pino';
import { exec } from 'child_process';
import util from 'util';
const _execAsync = util.promisify(exec);

import ConfigManager from './ConfigManager.js';
import APIClient from './APIClient.js';
import AudioProcessor from './AudioProcessor.js';
import MediaProcessor from './MediaProcessor.js';
import MessageProcessor from './MessageProcessor.js';
import ModerationSystem from './ModerationSystem.js';
import LevelSystem from './LevelSystem.js';
import RegistrationSystem from './RegistrationSystem.js';
import EconomySystem from './EconomySystem.js';
import PaymentManager from './PaymentManager.js';
import CommandHandler from './CommandHandler.js';
import HFCorrections from './HFCorrections.js';
import PresenceSimulator from './PresenceSimulator.js';
import SubscriptionManager from './SubscriptionManager.js';
import UserProfile from './UserProfile.js';
import BotProfile from './BotProfile.js';
import GroupManagement from './GroupManagement.js';
import ImageEffects from './ImageEffects.js';
import StickerViewOnceHandler from './StickerViewOnceHandler.js';
import PermissionManager from './PermissionManager.js';

class BotCore {
    public config: any;
    public logger: any;
    public sock: any;
    public isConnected: boolean = false;
    public reconnectAttempts: number = 0;
    public MAX_RECONNECT_ATTEMPTS: number = 15;
    public connectionStartTime: number | null = null;
    public currentQR: string | null = null;
    public BOT_JID: string | null = null;

    // Componentes
    public registrationSystem: any;
    public moderationSystem: any;
    public mediaProcessor: any;
    public messageProcessor: any;
    public levelSystem: any;
    public apiClient: any;
    public audioProcessor: any;
    public paymentManager: any;
    public subscriptionManager: any;
    public commandHandler: any;
    public presenceSimulator: any;
    public economySystem: any;
    public userProfile: any;
    public botProfile: any;
    public groupManagement: any;
    public imageEffects: any;
    public permissionManager: any;
    public stickerViewOnceHandler: any;

    // Event listeners
    public eventListeners: {
        onQRGenerated: ((qr: string) => void) | null;
        onConnected: ((jid: string) => void) | null;
        onDisconnected: ((reason: any) => void) | null;
    } = {
            onQRGenerated: null,
            onConnected: null,
            onDisconnected: null
        };

    // Deduplicação
    private processedMessages: Set<string> = new Set();
    private readonly MAX_PROCESSED_MESSAGES = 1000;
    private pipelineLogCounter: number = 0;
    private readonly PIPELINE_LOG_INTERVAL = 10;

    constructor() {
        this.config = ConfigManager.getInstance();
        this.logger = this.config.logger || pino({
            level: this.config.LOG_LEVEL || 'info',
            timestamp: () => `,"time":"${new Date().toISOString()}"`
        });
        this.sock = null;
    }

    async initialize(): Promise<boolean> {
        try {
            this.logger.info('🚀 Inicializando BotCore...');
            HFCorrections.apply();
            this.config.validate();
            await this.initializeComponents();
            return true;
        } catch (error: any) {
            this.logger.error('❌ Erro ao inicializar:', error.message);
            throw error;
        }
    }

    async start() {
        await this.initialize();
        await this.connect();
    }

    /**
     * Auto-atualiza o yt-dlp em background para garantir downloads funcionando
     * Essencial para Railway onde o build envelhece mas o bot continua rodando
     */
    private async _selfUpdateYtdlp(): Promise<void> {
        try {
            this.logger.info('🔄 [yt-dlp] Verificando atualizações...');
            const { stdout } = await _execAsync('yt-dlp -U 2>&1', { timeout: 120000 });
            if (stdout.includes('up to date')) {
                this.logger.info('✅ [yt-dlp] Já está atualizado');
            } else {
                this.logger.info('✅ [yt-dlp] Atualizado com sucesso!');
            }
        } catch (err: any) {
            // Falha silenciosa — não bloqueia o startup
            this.logger.warn(`⚠️ [yt-dlp] Não foi possível atualizar: ${err.message?.substring(0, 80)}`);
        }
    }

    async initializeComponents() {
        try {
            this.logger.debug('🔧 Inicializando componentes..');

            // Auto-atualiza yt-dlp em background (não bloqueia o startup)
            this._selfUpdateYtdlp().catch(() => { });

            this.apiClient = new APIClient(this.logger);
            this.audioProcessor = new AudioProcessor(this.logger);
            this.mediaProcessor = new MediaProcessor(this.logger);
            this.messageProcessor = new MessageProcessor(this.logger);
            this.moderationSystem = new ModerationSystem(this.logger);
            this.levelSystem = new LevelSystem(this.logger);
            this.registrationSystem = new RegistrationSystem(this.logger);
            this.subscriptionManager = new SubscriptionManager(this.config);
            this.userProfile = new UserProfile(this.sock, this.config);
            this.botProfile = new BotProfile(this.sock, this.logger);
            this.groupManagement = new GroupManagement(this.sock, this.config, this.moderationSystem);
            this.imageEffects = new ImageEffects(this.logger);
            this.permissionManager = new PermissionManager(this.logger);
            this.stickerViewOnceHandler = new StickerViewOnceHandler(this.sock, this.config);

            this.paymentManager = new PaymentManager(this, this.subscriptionManager);
            this.presenceSimulator = new PresenceSimulator(this.sock || null);
            this.economySystem = new EconomySystem(this.logger);

            try {
                this.commandHandler = new CommandHandler(this.sock, this.config, this, this.messageProcessor);
                this.commandHandler.economySystem = this.economySystem;
                this.commandHandler.gameSystem = (await import('./GameSystem.js')).default;
                this.logger.debug('✅ CommandHandler inicializado');
            } catch (err: any) {
                this.logger.warn(`⚠️ CommandHandler: ${err.message}`);
                this.commandHandler = null;
            }

            const poToken = this.config?.YT_PO_TOKEN;
            const cookiesPath = this.config?.YT_COOKIES_PATH;
            this.logger.info(`📺 YouTube: PO_TOKEN=${poToken ? '✅' : '❌'}, Cookies=${cookiesPath ? '✅' : '❌'}`);

            this.logger.debug('✅ Componentes inicializados');
        } catch (error: any) {
            this.logger.error('❌ Erro componentes:', error.message);
        }
    }

    private _updateComponentsSocket(sock: any): void {
        try {
            this.logger.info('🔄 Atualizando socket...');
            if (this.commandHandler?.setSocket) this.commandHandler.setSocket(sock);
            if (this.groupManagement?.setSocket) this.groupManagement.setSocket(sock);
            if (this.stickerViewOnceHandler?.setSocket) this.stickerViewOnceHandler.setSocket(sock);
            if (this.botProfile?.setSocket) this.botProfile.setSocket(sock);
            if (this.userProfile?.setSocket) this.userProfile.setSocket(sock);
            if (this.presenceSimulator) this.presenceSimulator.sock = sock;
            this.logger.info('✅ Socket atualizado');
        } catch (e: any) {
            this.logger.error('❌ Erro socket:', e);
        }
    }

    async connect(): Promise<void> {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.config.AUTH_FOLDER);
            const { version, isLatest } = await fetchLatestBaileysVersion();

            this.logger.info(`📡 WhatsApp v${version.join('.')} (Latest: ${isLatest})`);

            const socketConfig: any = {
                version,
                logger: pino({ level: 'silent' }),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                browser: Browsers.macOS('Akira-Bot'),
                generateHighQualityLinkPreview: true,
                getMessage: async (key: any) => ({ conversation: 'hello' }),
                connectTimeoutMs: 120000,
                defaultQueryTimeoutMs: 120000,
                keepAliveIntervalMs: 15000,
                markOnlineOnConnect: true,
                emitOwnEvents: false,
                retryRequestDelayMs: 500,
                shouldIgnoreJid: (jid: string) => jid === 'status@broadcast'
            };

            const agent = HFCorrections.createHFAgent();
            if (agent) {
                socketConfig.agent = agent;
                this.logger.info('🌐 Agente HTTP personalizado');
            }

            this.sock = makeWASocket(socketConfig);

            if (this.commandHandler?.setSocket) this.commandHandler.setSocket(this.sock);
            if (this.presenceSimulator) this.presenceSimulator.sock = this.sock;

            this.sock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.logger.info('📸 QR Code recebido');
                    this.currentQR = qr;
                    if (this.eventListeners.onQRGenerated) this.eventListeners.onQRGenerated(qr);
                }

                if (connection === 'close') {
                    this.isConnected = false;
                    this.currentQR = null;
                    const reason = lastDisconnect?.error?.output?.statusCode;
                    let shouldReconnect = reason !== DisconnectReason.loggedOut;
                    // 401/500: force auth recovery
                    if (reason === 401 || reason === 500) {
                      this.logger.warn('🔄 401/500 detected → Clearing auth & forcing QR regen');
                      this._cleanAuthOnError();
                      shouldReconnect = true;
                      this.reconnectAttempts = 0; // Reset for auth recovery
                    }
                    this.logger.warn(`🔴 Conexão fechada. Motivo: ${reason}. Reconectar: ${shouldReconnect}`);

                    if (this.eventListeners.onDisconnected) this.eventListeners.onDisconnected(reason);

                    if (shouldReconnect) {
                        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                            this.reconnectAttempts++;
                            // Exponential backoff com jitter (até 30s)
                            const baseDelay = Math.min(Math.pow(1.8, this.reconnectAttempts) * 1000, 300000); // Up to 5min
                            const delayMs = Math.floor(baseDelay + Math.random() * 5000); // More jitter

                            this.logger.info(`⏳ Reconectando em ${delayMs}ms (Tentativa ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
                            await delay(delayMs);
                            this.connect();
                        } else {
                            this.logger.error('❌ Muitas falhas. Reiniciando...');
                            process.exit(1);
                        }
                    } else {
                        this.logger.info('🔒 Desconectado permanentemente');
                        this._cleanAuthOnError();
                    }
                } else if (connection === 'open') {
                    this.logger.info('✅ CONEXÃO ESTABELECIDA!');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.currentQR = null;
                    this.connectionStartTime = Date.now();

                    // Warm-up delay: Aguarda 3s para o socket estabilizar antes de permitir comandos pesados
                    this.logger.info('⏳ Aguardando warm-up de 3s...');
                    await delay(3000);

                    this._updateComponentsSocket(this.sock);
                    this.BOT_JID = this.sock.user?.id;
                    this.logger.info(`🤖 Logado como: ${this.BOT_JID}`);
                    if (this.eventListeners.onConnected) this.eventListeners.onConnected(this.BOT_JID);
                }
            });

            this.sock.ev.on('creds.update', saveCreds);

            this.sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
                if (type !== 'notify') return;
                for (const m of messages) await this.processMessage(m);
            });

            this.sock.ev.on('group-participants.update', async (update: any) => {
                const { id, participants, action } = update;

                if (action === 'add' && this.moderationSystem?.isAntiFakeActive(id)) {
                    for (const participant of participants) {
                        if (this.moderationSystem.isFakeNumber(participant)) {
                            this.logger.warn(`🚫 [ANTI-FAKE] ${participant}`);
                            await this.sock.sendMessage(id, { text: '⚠️ Número fake removido.' });
                            await this.sock.groupParticipantsUpdate(id, [participant], 'remove');
                            participants.splice(participants.indexOf(participant), 1);
                        }
                    }
                }

                if (action === 'add' && this.groupManagement && participants.length > 0) {
                    const isWelcomeOn = this.groupManagement.groupSettings?.[id]?.welcome;
                    if (isWelcomeOn) {
                        for (const p of participants) {
                            const template = this.groupManagement.getCustomMessage(id, 'welcome') || 'Olá @user!';
                            const formatted = await this.groupManagement.formatMessage(id, p, template);
                            await this.sock.sendMessage(id, { text: formatted, mentions: [p] });
                        }
                    }
                }

                if (action === 'remove' && this.groupManagement) {
                    const isGoodbyeOn = this.groupManagement.groupSettings?.[id]?.goodbye;
                    if (isGoodbyeOn) {
                        for (const p of participants) {
                            const template = this.groupManagement.getCustomMessage(id, 'goodbye') || 'Adeus @user!';
                            const formatted = await this.groupManagement.formatMessage(id, p, template);
                            await this.sock.sendMessage(id, { text: formatted, mentions: [p] });
                        }
                    }
                }
            });

        } catch (error: any) {
            this.logger.error('❌ Erro conexão:', error.message);
            await delay(5000);
            this.connect();
        }
    }

    private isMessageProcessed(key: any): boolean {
        if (!key?.id) return false;
        const messageId = key.id;
        if (this.processedMessages.has(messageId)) {
            this.logger.debug(`⏭️ Já processada: ${messageId.substring(0, 15)}`);
            return true;
        }
        this.processedMessages.add(messageId);
        if (this.processedMessages.size > this.MAX_PROCESSED_MESSAGES) {
            const arr = Array.from(this.processedMessages);
            this.processedMessages = new Set(arr.slice(-this.MAX_PROCESSED_MESSAGES / 2));
        }
        return false;
    }

    async processMessage(m: any): Promise<void> {
        try {
            if (this.isMessageProcessed(m.key)) return;

            this.pipelineLogCounter++;
            const shouldLog = this.pipelineLogCounter % this.PIPELINE_LOG_INTERVAL === 1;

            if (shouldLog) this.logger.debug('🔹 [PIPELINE] Iniciando');
            if (!m) { this.logger.debug('🔹 [PIPELINE] m null'); return; }
            if (!m.message) { this.logger.debug('🔹 [PIPELINE] msg vazia'); return; }
            if (m.key.fromMe) return;
            if (m.message.protocolMessage) return;

            if (shouldLog) this.logger.debug('🔹 [PIPELINE] Válida');

            const remoteJid = m.key.remoteJid;
            const ehGrupo = remoteJid.endsWith('@g.us');
            const ehStatus = remoteJid === 'status@broadcast';
            if (ehStatus) return;

            if (!this.messageProcessor) throw new Error('messageProcessor não inicializado');

            const nome = m.pushName || 'Usuário';
            const numeroReal = this.messageProcessor.extractUserNumber(m);
            if (shouldLog) this.logger.debug(`🔹 [PIPELINE] ${numeroReal}`);

            if (this.moderationSystem?.isBlacklisted(numeroReal)) {
                this.logger.debug(`🚫 Banido: ${nome}`);
                return;
            }

            if (ehGrupo && this.moderationSystem?.isMuted(remoteJid, m.key.participant)) {
                await this.handleMutedUserMessage(m, nome);
                return;
            }

            const texto = this.messageProcessor.extractText(m);
            const temImagem = this.messageProcessor.hasImage(m);
            const temAudio = this.messageProcessor.hasAudio(m);
            if (shouldLog) this.logger.debug(`🔹 [PIPELINE] txt=${!!texto} img=${temImagem} aud=${temAudio}`);

            if (ehGrupo && texto && this.moderationSystem) {
                let isAdmin = false;
                try {
                    if (this.groupManagement) isAdmin = await this.groupManagement.isUserAdmin(remoteJid, m.key.participant);
                } catch (e) { isAdmin = false; }
                if (!isAdmin && this.moderationSystem.checkLink(texto, remoteJid, m.key.participant, isAdmin)) {
                    await this.handleAntiLinkViolation(m, nome);
                    return;
                }
            }

            const replyInfo = this.messageProcessor.extractReplyInfo(m);
            const temSticker = !!m.message?.stickerMessage;
            const temVideo = this.messageProcessor.hasVideo(m);

            if (temSticker && ehGrupo && this.moderationSystem?.isAntiStickerActive(remoteJid)) {
                await this.handleAntiMediaViolation(m, 'sticker');
                return;
            }

            if (temImagem) {
                if (ehGrupo && this.moderationSystem?.isAntiImageActive(remoteJid)) {
                    await this.handleAntiMediaViolation(m, 'imagem');
                    return;
                }
                await this.handleImageMessage(m, nome, numeroReal, replyInfo, ehGrupo);
            } else if (temVideo) {
                if (ehGrupo && this.moderationSystem?.isAntiVideoActive(remoteJid)) {
                    await this.handleAntiMediaViolation(m, 'video');
                    return;
                }
                await this.handleVideoMessage(m, nome, numeroReal, replyInfo, ehGrupo);
            } else if (this.messageProcessor.hasDocument(m)) {
                await this.handleDocumentMessage(m, nome, numeroReal, replyInfo, ehGrupo);
            } else if (temAudio) {
                await this.handleAudioMessage(m, nome, numeroReal, replyInfo, ehGrupo);
            } else if (texto) {
                await this.handleTextMessage(m, nome, numeroReal, texto, replyInfo, ehGrupo);
            }
        } catch (error: any) {
            console.error('❌ [CRITICAL]:', error);
            this.logger.error('❌ Erro pipeline:', error?.message);
        }
    }

    async handleImageMessage(m: any, nome: string, numeroReal: string, replyInfo: any, ehGrupo: boolean): Promise<void> {
        const caption = this.messageProcessor.extractText(m) || '';
        const allowed = await this.handleRateLimitAndBlacklist(m, nome, numeroReal, caption || '<IMAGEM>', ehGrupo);
        if (!allowed) return;

        this.logger.info(`🖼️ [IMAGEM] ${nome}`);
        if (ehGrupo && this.config.FEATURE_LEVELING && this.levelSystem && this.groupManagement?.groupSettings[m.key.remoteJid]?.leveling !== false) {
            const xp = this.levelSystem.awardXp(m.key.remoteJid, numeroReal, 15);
            if (xp) this.logger.info(`📈 [LEVEL] ${nome} +15 XP`);
        }

        try {
            let deveResponder = false;
            const caption = this.messageProcessor.extractText(m) || '';
            const captionLower = caption.toLowerCase();
            const botNameLower = (this.config.BOT_NAME || 'akira').toLowerCase();

            if (!ehGrupo) deveResponder = true;
            else if (this.messageProcessor.isBotMentioned(m)) deveResponder = true;
            else if (replyInfo?.ehRespostaAoBot) deveResponder = true;
            else if (captionLower.includes(botNameLower)) deveResponder = true;
            else if (this.messageProcessor.isCommand(caption)) deveResponder = true;

            if (!deveResponder) {
                this.logger.debug(`⏭️ Imagem ignorada: ${caption.substring(0, 30)}`);
                return;
            }

            if (this.commandHandler && this.messageProcessor.isCommand(caption)) {
                try {
                    const handled = await this.commandHandler.handle(m, { nome, numeroReal, texto: caption, replyInfo, ehGrupo });
                    if (handled) {
                        this.logger.info(`⚡ Comando imagem: ${caption.substring(0, 30)}`);
                        return;
                    }
                } catch (err: any) {
                    this.logger.warn(`⚠️ Comando legenda: ${err.message}`);
                }
            }

            await this.presenceSimulator.simulateTicks(m, true, false);
            await this.presenceSimulator.simulateTyping(m.key.remoteJid, 1500);

            const tipoMsg = getContentType(m.message);
            let imgMsg = m.message.imageMessage;
            if (tipoMsg === 'viewOnceMessage' || tipoMsg === 'viewOnceMessageV2') {
                imgMsg = m.message[tipoMsg].message?.imageMessage;
            }
            if (!imgMsg) { this.logger.error('❌ Imagem inválida'); return; }

            // Passa m.message completo para que o downloadMedia possa usar extractMediaContainer
            // e encontrar a mediaKey e URL correctamente. Passar imgMsg (já extraído) fazia falhar.
            this.logger.debug('⬇️ Baixando imagem...');
            const imageBuffer = await this.mediaProcessor.downloadMedia(m.message, 'image');
            if (!imageBuffer?.length) {
                this.logger.error('❌ Buffer vazio');
                await this.reply(m, '❌ Não consegui baixar a imagem.');
                return;
            }

            this.logger.debug(`✅ Imagem: ${imageBuffer.length} bytes`);

            // Salvando a imagem localmente para envio por Path em vez de Base64
            let tempMediaPath = '';
            try {
                const dir = this.config.DATA_DIR ? path.join(this.config.DATA_DIR, 'media') : './temp/akira_media';
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                const ext = (imgMsg.mimetype || 'image/jpeg').split('/')[1] || 'jpeg';
                const filename = `img_${Date.now()}_${numeroReal.split('@')[0]}.${ext}`;
                tempMediaPath = path.join(dir, filename);

                fs.writeFileSync(tempMediaPath, imageBuffer);
                this.logger.debug(`💾 Imagem salva em: ${tempMediaPath}`);
            } catch (err: any) {
                this.logger.error('❌ Erro salvando imagem no disco:', err.message);
                tempMediaPath = ''; // Fallback de emergência (ou skip)
                // Fallback para Base64 apenas se o ficheiro falhar dramaticamente
                try {
                    tempMediaPath = imageBuffer.toString('base64');
                } catch (e: any) {
                    await this.reply(m, '❌ Erro ao processar arquivo de imagem localmente.');
                    return;
                }
            }

            this.logger.info(`👁️ Analisando imagem...`);
            const resultado = await this.apiClient.processMessage({
                usuario: nome,
                numero: numeroReal,
                mensagem: caption || 'O que tem nesta imagem?',
                tipo_conversa: ehGrupo ? 'grupo' : 'pv',
                grupo_id: ehGrupo ? m.key.remoteJid : null,
                grupo_nome: ehGrupo ? (this.groupManagement?.groupMetadata?.[m.key.remoteJid]?.subject || m.key.remoteJid.split('@')[0]) : null,
                tipo_mensagem: 'image',
                imagem_dados: {
                    dados: tempMediaPath,
                    path: fs.existsSync(tempMediaPath) ? tempMediaPath : null,
                    mime_type: imgMsg.mimetype || 'image/jpeg',
                    descricao: caption || 'Imagem'
                },
                mensagem_citada: replyInfo?.textoMensagemCitada || '',
                reply_metadata: replyInfo ? {
                    is_reply: replyInfo.isReply || true,
                    reply_to_bot: replyInfo.ehRespostaAoBot,
                    quoted_author_name: replyInfo.quemEscreveuCitacaoName || 'Usuário',
                    quoted_author_numero: replyInfo.quotedAuthorNumero || 'desconhecido',
                    quoted_type: replyInfo.quotedType || 'texto',
                    quoted_text_original: replyInfo.quotedTextOriginal || '',
                    context_hint: replyInfo.contextHint || ''
                } : { is_reply: false, reply_to_bot: false }
            });

            if (!resultado.success) {
                this.logger.error('❌ Erro API:', resultado.error);
                await this.sock.sendMessage(m.key.remoteJid, { text: 'Não consegui analisar a imagem.' });
                return;
            }

            const resposta = resultado.resposta || 'Sem resposta.';
            await this.presenceSimulator.simulateTyping(m.key.remoteJid, this.presenceSimulator.calculateTypingDuration(resposta));
            const opcoes = ehGrupo ? { quoted: m } : (replyInfo?.ehRespostaAoBot) ? { quoted: m } : {};
            await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);
            await this.presenceSimulator.simulateTicks(m, true, false);
        } catch (error: any) {
            this.logger.error('❌ Erro imagem:', error.message);
        }
    }

    async handleVideoMessage(m: any, nome: string, numeroReal: string, replyInfo: any, ehGrupo: boolean): Promise<void> {
        const caption = this.messageProcessor.extractText(m) || '';
        const allowed = await this.handleRateLimitAndBlacklist(m, nome, numeroReal, caption || '<VÍDEO>', ehGrupo);
        if (!allowed) return;

        this.logger.info(`🎥 [VÍDEO] ${nome}`);
        if (ehGrupo && this.config.FEATURE_LEVELING && this.levelSystem && this.groupManagement?.groupSettings[m.key.remoteJid]?.leveling !== false) {
            const xp = this.levelSystem.awardXp(m.key.remoteJid, numeroReal, 20);
            if (xp) this.logger.info(`📈 [LEVEL] ${nome} +20 XP`);
        }

        try {
            let deveResponder = false;
            const captionLower = caption.toLowerCase();
            const botNameLower = (this.config.BOT_NAME || 'akira').toLowerCase();

            if (!ehGrupo) deveResponder = true;
            else if (this.messageProcessor.isBotMentioned(m)) deveResponder = true;
            else if (replyInfo?.ehRespostaAoBot) deveResponder = true;
            else if (captionLower.includes(botNameLower)) deveResponder = true;
            else if (this.messageProcessor.isCommand(caption)) deveResponder = true;

            if (!deveResponder) {
                this.logger.debug(`⏭️ Vídeo ignorado: ${caption.substring(0, 30)}`);
                return;
            }

            if (this.commandHandler && this.messageProcessor.isCommand(caption)) {
                try {
                    const handled = await this.commandHandler.handle(m, { nome, numeroReal, texto: caption, replyInfo, ehGrupo });
                    if (handled) {
                        this.logger.info(`⚡ Comando vídeo: ${caption.substring(0, 30)}`);
                        return;
                    }
                } catch (err: any) {
                    this.logger.warn(`⚠️ Comando legenda vídeo: ${err.message}`);
                }
            }

            await this.presenceSimulator.simulateTicks(m, true, false);
            await this.presenceSimulator.simulateTyping(m.key.remoteJid, 2000);

            const tipoMsg = getContentType(m.message);
            let vidMsg = m.message.videoMessage;
            if (tipoMsg === 'viewOnceMessage' || tipoMsg === 'viewOnceMessageV2') {
                vidMsg = m.message[tipoMsg].message?.videoMessage;
            }
            if (!vidMsg) { this.logger.error('❌ Vídeo inválido'); return; }

            this.logger.debug('⬇️ Baixando vídeo...');
            // Passa m.message para que extractMediaContainer funcione correctamente
            const videoBuffer = await this.mediaProcessor.downloadMedia(m.message, 'video');
            if (!videoBuffer?.length) {
                this.logger.error('❌ Buffer vídeo vazio');
                await this.reply(m, '❌ Não consegui baixar o vídeo.');
                return;
            }

            let tempMediaPath = '';
            try {
                const dir = this.config.DATA_DIR ? path.join(this.config.DATA_DIR, 'media') : './temp/akira_media';
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                const ext = (vidMsg.mimetype || 'video/mp4').split('/')[1] || 'mp4';
                const filename = `vid_${Date.now()}_${numeroReal.split('@')[0]}.${ext}`;
                tempMediaPath = path.join(dir, filename);

                fs.writeFileSync(tempMediaPath, videoBuffer);
                this.logger.debug(`💾 Vídeo salvo em: ${tempMediaPath}`);
            } catch (err: any) {
                this.logger.error('❌ Erro salvando vídeo no disco:', err.message);
                tempMediaPath = videoBuffer.toString('base64');
            }

            this.logger.info(`👁️ Analisando vídeo...`);
            const resultado = await this.apiClient.processMessage({
                usuario: nome,
                numero: numeroReal,
                mensagem: caption || 'O que tem neste vídeo?',
                tipo_conversa: ehGrupo ? 'grupo' : 'pv',
                grupo_id: ehGrupo ? m.key.remoteJid : null,
                grupo_nome: ehGrupo ? (this.groupManagement?.groupMetadata?.[m.key.remoteJid]?.subject || m.key.remoteJid.split('@')[0]) : null,
                tipo_mensagem: 'video',
                video_dados: {
                    dados: tempMediaPath,
                    path: fs.existsSync(tempMediaPath) ? tempMediaPath : null,
                    mime_type: vidMsg.mimetype || 'video/mp4',
                    descricao: caption || 'Vídeo'
                },
                mensagem_citada: replyInfo?.textoMensagemCitada || '',
                reply_metadata: replyInfo ? {
                    is_reply: replyInfo.isReply || true,
                    reply_to_bot: replyInfo.ehRespostaAoBot,
                    quoted_author_name: replyInfo.quemEscreveuCitacaoName || 'Usuário',
                    quoted_author_numero: replyInfo.quotedAuthorNumero || 'desconhecido',
                    quoted_type: replyInfo.quotedType || 'texto',
                    quoted_text_original: replyInfo.quotedTextOriginal || '',
                    context_hint: replyInfo.contextHint || ''
                } : { is_reply: false, reply_to_bot: false }
            });

            if (!resultado.success) {
                this.logger.error('❌ Erro API:', resultado.error);
                await this.sock.sendMessage(m.key.remoteJid, { text: 'Não consegui analisar o vídeo.' });
                return;
            }

            const resposta = resultado.resposta || 'Sem resposta.';
            await this.presenceSimulator.simulateTyping(m.key.remoteJid, this.presenceSimulator.calculateTypingDuration(resposta));
            const opcoes = ehGrupo || replyInfo?.ehRespostaAoBot ? { quoted: m } : {};
            await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);
            await this.presenceSimulator.simulateTicks(m, true, false);
        } catch (error: any) {
            this.logger.error('❌ Erro vídeo:', error.message);
        }
    }

    async handleDocumentMessage(m: any, nome: string, numeroReal: string, replyInfo: any, ehGrupo: boolean): Promise<void> {
        const allowed = await this.handleRateLimitAndBlacklist(m, nome, numeroReal, '<DOCUMENTO>', ehGrupo);
        if (!allowed) return;

        this.logger.info(`📄 [DOCUMENTO] ${nome}`);
        try {
            const caption = this.messageProcessor.extractText(m) || '';
            const contentType = getContentType(m.message);
            const docMsg = contentType === 'documentWithCaptionMessage'
                ? m.message.documentWithCaptionMessage.message.documentMessage
                : m.message.documentMessage;

            if (!docMsg) { this.logger.error('❌ Documento inválido'); return; }

            const fileName = docMsg.fileName || 'document';
            const mimeType = docMsg.mimetype || 'application/octet-stream';

            // Passa m.message para que extractMediaContainer funcione correctamente
            const bufferDoc = await this.mediaProcessor.downloadMedia(m.message, 'document');
            if (!bufferDoc) {
                this.logger.error('❌ Documento não pôde ser baixado');
                await this.sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao baixar o arquivo.' });
                return;
            }

            let tempMediaPath = '';
            try {
                const dir = this.config.DATA_DIR ? path.join(this.config.DATA_DIR, 'media') : './temp/akira_media';
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                // Extrai a extensão do MimeType ou do Nome original.
                const ext = mimeType.split('/')[1] || fileName.split('.').pop() || 'tmp';
                const ts = Date.now();
                const saveName = `doc_${ts}_${numeroReal.split('@')[0]}.${ext}`;
                tempMediaPath = path.join(dir, saveName);

                fs.writeFileSync(tempMediaPath, bufferDoc);
                this.logger.debug(`💾 Documento salvo em: ${tempMediaPath}`);
            } catch (err: any) {
                this.logger.error('❌ Erro salvando documento no disco:', err.message);
                tempMediaPath = bufferDoc.toString('base64');
            }

            // Simula presença
            await this.presenceSimulator.simulateTicks(m, true, false);
            await this.presenceSimulator.simulateTyping(m.key.remoteJid, 1000);

            // Processar Mensagem
            const resultado = await this.apiClient.processMessage({
                usuario: nome,
                numero: numeroReal,
                mensagem: caption || `Analise o documento: ${fileName}`,
                tipo_conversa: ehGrupo ? 'grupo' : 'pv',
                grupo_id: ehGrupo ? m.key.remoteJid : null,
                grupo_nome: ehGrupo ? (this.groupManagement?.groupMetadata?.[m.key.remoteJid]?.subject || m.key.remoteJid.split('@')[0]) : null,
                tipo_mensagem: caption ? 'documentWithCaption' : 'document',
                analise_doc: `[Arquivo: ${fileName} | Tipo: ${mimeType}]`,
                documento_dados: {
                    dados: tempMediaPath,
                    path: fs.existsSync(tempMediaPath) ? tempMediaPath : null,
                    mime_type: mimeType,
                    nome_arquivo: fileName
                },
                reply_metadata: replyInfo ? {
                    is_reply: replyInfo.isReply || true,
                    reply_to_bot: replyInfo.ehRespostaAoBot,
                    quoted_author_name: replyInfo.quemEscreveuCitacaoName || 'Usuário',
                    quoted_author_numero: replyInfo.quotedAuthorNumero || 'desconhecido',
                    quoted_type: replyInfo.quotedType || 'texto',
                    quoted_text_original: replyInfo.quotedTextOriginal || '',
                    context_hint: replyInfo.contextHint || ''
                } : { is_reply: false, reply_to_bot: false }
            });

            if (resultado.success) {
                const resposta = resultado.resposta || 'Recebi o documento.';
                await this.presenceSimulator.simulateTyping(m.key.remoteJid, this.presenceSimulator.calculateTypingDuration(resposta));
                const opcoes = ehGrupo || replyInfo?.ehRespostaAoBot ? { quoted: m } : {};
                await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);
            }
        } catch (error: any) {
            this.logger.error('❌ Erro documento:', error.message);
        }
    }

    async handleAudioMessage(m: any, nome: string, numeroReal: string, replyInfo: any, ehGrupo: boolean): Promise<void> {
        this.logger.info(`🎤 [ÁUDIO] ${nome}`);
        try {
            const tipoMsg = getContentType(m.message);
            let audMsg = m.message.audioMessage;
            if (tipoMsg === 'viewOnceMessage' || tipoMsg === 'viewOnceMessageV2') {
                audMsg = m.message[tipoMsg].message?.audioMessage;
            }
            if (!audMsg) { this.logger.error('❌ Áudio inválido'); return; }

            const audioBuffer = await this.mediaProcessor.downloadMedia(audMsg, 'audio');
            await this.handleAudioMessage_internal(m, nome, numeroReal, replyInfo, ehGrupo, audioBuffer);
        } catch (error: any) {
            this.logger.error('❌ Erro áudio:', error.message);
        }
    }

    async handleAudioMessage_internal(m: any, nome: string, numeroReal: string, replyInfo: any, ehGrupo: boolean, audioBuffer: Buffer | null): Promise<void> {
        const allowed = await this.handleRateLimitAndBlacklist(m, nome, numeroReal, '<AUDIO/VOZ>', ehGrupo);
        if (!allowed) return;

        try {
            if (!audioBuffer) { this.logger.error('❌ Buffer áudio vazio'); return; }

            const transcricao = await this.audioProcessor.speechToText(audioBuffer);
            if (!transcricao.sucesso) { this.logger.warn('⚠️ Falha transcrição'); return; }

            this.logger.info(`📝 Transcrição: ${transcricao.texto.substring(0, 80)}`);
            await this.handleTextMessage(m, nome, numeroReal, transcricao.texto, replyInfo, ehGrupo, true);
        } catch (error: any) {
            this.logger.error('❌ Erro áudio interno:', error.message);
        }
    }

    private async handleRateLimitAndBlacklist(m: any, nome: string, numeroReal: string, texto: string, ehGrupo: boolean): Promise<boolean> {
        // Retorna FALSE se for para bloquear a mensagem. Retorna TRUE se for permitido continuar.
        try {
            const isDono = typeof this.config?.isDono === 'function' ? this.config.isDono(numeroReal, nome) : false;

            if (this.moderationSystem?.checkAndLimitHourlyMessages) {
                const res = this.moderationSystem.checkAndLimitHourlyMessages(m.key.participant || numeroReal, nome, numeroReal, texto, null, isDono, ehGrupo, m.key.remoteJid);

                if (!res?.allowed) {

                    if (res?.action === 'KICK_SILENT' && ehGrupo) {
                        // Tenta expulsar o usuário silenciosamente se for grupo
                        try {
                            const participantId = m.key.participant || `${numeroReal}@s.whatsapp.net`;
                            await this.sock.groupParticipantsUpdate(m.key.remoteJid, [participantId], 'remove');
                            this.logger.info(`🚨 [KICK_SILENT] Flood/Blacklist: Usuário ${numeroReal} removido de ${m.key.remoteJid}`);
                        } catch (kickErr) {
                            this.logger.warn(`⚠️ Não foi possível kickar o usuário ${numeroReal}: Pode não ser admin`);
                        }
                        return false; // Aborta processamento
                    }

                    if (res?.action === 'WARN_STOP') {
                        await this.sock.sendMessage(m.key.remoteJid, { text: `⚠️ *AVISO FINAL* @${numeroReal.split('@')[0]}!\n\nVocê está a enviar mensagens demasiado rápido e já esgotou a sua quota horária de segurança.\n\nPare de chatear a Akira imediatamente, ou será *Bloqueado e Expulso* do sistema e dos grupos blindados!`, mentions: [m.key.participant || `${numeroReal}@s.whatsapp.net`] }, { quoted: m });
                        return false;
                    }

                    if (res?.reason === 'LIMITE_HORARIO_EXCEDIDO') {
                        const mins = res?.blockDurationMinutes || 30;
                        await this.sock.sendMessage(m.key.remoteJid, { text: `⏰ *LIMITE EXCEDIDO*\n\nVocê enviou demasiadas mensagens nas últimas horas. Por favor, aguarde ${mins} minutos antes de usar a Akira novamente.`, mentions: [m.key.participant || `${numeroReal}@s.whatsapp.net`] }, { quoted: m });
                        return false;
                    }

                    // Bloqueios silenciosos residuais (eg: repetição do estagio 1)
                    return false;
                }
            } else if (!this.messageProcessor.checkRateLimit(numeroReal)) {
                await this.sock.sendMessage(m.key.remoteJid, { text: '⏰ Muitas mensagens. Aguarde.' });
                return false;
            }
            return true;
        } catch (err: any) {
            this.logger?.warn('Erro rate limit:', err?.message);
            // Se as coisas derem erro, recai no antigo
            if (!this.messageProcessor.checkRateLimit(numeroReal)) {
                await this.sock.sendMessage(m.key.remoteJid, { text: '⏰ Muitas mensagens. Aguarde.' });
                return false;
            }
            return true;
        }
    }

    async handleTextMessage(m: any, nome: string, numeroReal: string, texto: string, replyInfo: any, ehGrupo: boolean, foiAudio: boolean = false): Promise<void> {
        try {
            const allowed = await this.handleRateLimitAndBlacklist(m, nome, numeroReal, texto, ehGrupo);
            if (!allowed) return;

            try {
                if (this.commandHandler) {
                    const handled = await this.commandHandler.handle(m, { nome, numeroReal, texto, replyInfo, ehGrupo });
                    if (handled) {
                        this.logger.info(`⚡ Comando: ${texto.substring(0, 30)}`);
                        if (ehGrupo && this.config.FEATURE_LEVELING && this.levelSystem && this.groupManagement?.groupSettings[m.key.remoteJid]?.leveling !== false) {
                            const xp = this.levelSystem.awardXp(m.key.remoteJid, numeroReal, 5);
                            if (xp) this.logger.info(`📈 [LEVEL] ${nome} +5 XP`);
                        }
                        return;
                    }
                }
            } catch (err: any) {
                this.logger.warn('Erro CommandHandler:', err.message);
            }

            let deveResponder = false;
            const textoLower = texto.toLowerCase();
            const botNameLower = (this.config.BOT_NAME || 'akira').toLowerCase();

            if (foiAudio) {
                if (!ehGrupo) deveResponder = true;
                else if (replyInfo?.ehRespostaAoBot) deveResponder = true;
                else if (this.messageProcessor.isBotMentioned(m)) deveResponder = true;
                else if (textoLower.includes(botNameLower)) deveResponder = true;
            } else {
                if (replyInfo?.ehRespostaAoBot) deveResponder = true;
                else if (!ehGrupo) deveResponder = true;
                else if (this.messageProcessor.isBotMentioned(m)) deveResponder = true;
                else if (textoLower.includes(botNameLower)) deveResponder = true;
            }

            if (!deveResponder) {
                this.logger.debug(`⏭️ Ignorado: ${texto.substring(0, 50)}`);
                return;
            }

            this.logger.info(`\n🔥 [PROCESSANDO] ${nome}: ${texto.substring(0, 60)}`);

            const replyMetadata = replyInfo ? {
                is_reply: replyInfo.isReply || true,
                reply_to_bot: replyInfo.ehRespostaAoBot,
                quoted_author_name: replyInfo.quemEscreveuCitacaoName || 'Usuário',
                quoted_author_numero: replyInfo.quotedAuthorNumero || 'desconhecido',
                quoted_type: replyInfo.quotedType || 'texto',
                quoted_text_original: replyInfo.quotedTextOriginal || '',
                context_hint: replyInfo.contextHint || '',
                priority_level: replyInfo.priorityLevel || 2
            } : { is_reply: false, reply_to_bot: false };

            if (ehGrupo && this.config.FEATURE_LEVELING && this.levelSystem && this.groupManagement?.groupSettings[m.key.remoteJid]?.leveling !== false) {
                const xp = this.levelSystem.awardXp(m.key.remoteJid, numeroReal, 10);
                if (xp) this.logger.info(`📈 [LEVEL] ${nome} +10 XP`);
            }

            const resultado = await this.apiClient.processMessage({
                usuario: nome,
                numero: numeroReal,
                mensagem: texto,
                tipo_conversa: ehGrupo ? 'grupo' : 'pv',
                grupo_id: ehGrupo ? m.key.remoteJid : null,
                grupo_nome: ehGrupo ? (this.groupManagement?.groupMetadata?.[m.key.remoteJid]?.subject || m.key.remoteJid.split('@')[0]) : null,
                tipo_mensagem: foiAudio ? 'audio' : 'texto',
                mensagem_citada: replyInfo?.textoMensagemCitada || '',
                reply_metadata: replyMetadata
            });
            if (!resultado.success) {
                this.logger.error('❌ Erro API:', resultado.error);
                await this.sock.sendMessage(m.key.remoteJid, { text: 'Tive um problema. Tenta de novo?' });
                return;
            }

            const resposta = resultado.resposta || 'Sem resposta';

            if (foiAudio) {
                this.logger.info('🎤 [AUDIO RESPONSE]');
                if (this.presenceSimulator) await this.presenceSimulator.safeSendPresenceUpdate('recording', m.key.remoteJid);
                try {
                    const tts = await this.audioProcessor.textToSpeech(resposta);
                    if (!tts.sucesso) {
                        this.logger.warn('⚠️ Falha TTS');
                        if (this.presenceSimulator) await this.presenceSimulator.safeSendPresenceUpdate('paused', m.key.remoteJid);
                        await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, { quoted: m });
                    } else {
                        this.logger.info('📤 Voice Note...');
                        await this.sock.sendMessage(m.key.remoteJid, {
                            audio: tts.buffer,
                            mimetype: tts.mimetype || 'audio/ogg; codecs=opus',
                            ptt: true
                        }, { quoted: m });
                    }
                } catch (err: any) {
                    this.logger.error('❌ Erro TTS:', err);
                    await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, { quoted: m });
                } finally {
                    if (this.presenceSimulator) await this.presenceSimulator.safeSendPresenceUpdate('paused', m.key.remoteJid);
                }
                if (this.presenceSimulator) await this.presenceSimulator.markAsRead(m);
            } else {
                if (this.presenceSimulator) {
                    await this.presenceSimulator.simulateFullResponse(this.sock, m, resposta, false);
                } else {
                    await this.simulateTyping(m.key.remoteJid, Math.min(resposta.length * 50, 5000));
                }
                const opcoes = ehGrupo ? { quoted: m } : replyInfo ? { quoted: m } : {};
                await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);
                if (this.presenceSimulator) await this.presenceSimulator.markAsRead(m);
            }

            this.logger.info(`✅ [RESPONDIDO] ${resposta.substring(0, 80)}`);
        } catch (error: any) {
            this.logger.error('❌ Erro texto:', error.message);
        }
    }

    async simulateTyping(jid: string, durationMs: number): Promise<void> {
        try {
            if (!this.sock) return;
            await this.sock.sendPresenceUpdate('available', jid);
            await delay(300);
            await this.sock.sendPresenceUpdate('composing', jid);
            await delay(durationMs);
            await this.sock.sendPresenceUpdate('paused', jid);
        } catch (e: any) {
            this.logger.debug('Erro typing:', e.message);
        }
    }

    async reply(m: any, text: string, options: any = {}): Promise<any> {
        try {
            if (!this.sock) { this.logger.warn('⚠️ Socket não disponível'); return false; }
            return await this.sock.sendMessage(m.key.remoteJid, { text, ...options }, { quoted: m });
        } catch (error: any) {
            this.logger.error('❌ Erro reply:', error.message);
            return false;
        }
    }

    async handleMutedUserMessage(m: any, nome: string): Promise<void> {
        try {
            this.logger.warn(`🔇 ${nome} falou durante mute`);
            await this.sock.groupParticipantsUpdate(m.key.remoteJid, [m.key.participant], 'remove');
            await this.sock.sendMessage(m.key.remoteJid, { text: `🚫 *${nome} removido por mute!*` });
        } catch (error: any) {
            this.logger.error('❌ Erro mute:', error.message);
        }
    }

    async handleAntiLinkViolation(m: any, nome: string): Promise<void> {
        try {
            if (!this.sock) return;
            const jid = m.key.remoteJid;
            const participant = m.key.participant;
            this.logger.warn(`🔗 [ANTI-LINK] ${nome}`);
            await this.reply(m, `🚫 @${participant.split('@')[0]}, links não permitidos!`, { mentions: [participant] });
            await this.sock.sendMessage(jid, { delete: m.key });
            await delay(1000);
            await this.sock.groupParticipantsUpdate(jid, [participant], 'remove');
        } catch (error: any) {
            this.logger.error('❌ Erro antilink:', error.message);
        }
    }

    _cleanAuthOnError(): void {
        try {
            if (fs.existsSync(this.config.AUTH_FOLDER)) {
                fs.rmSync(this.config.AUTH_FOLDER, { recursive: true, force: true });
                this.logger.info('🧹 Credenciais limpas');
            }
            this.isConnected = false;
            this.currentQR = null;
            this.BOT_JID = null;
            this.reconnectAttempts = 0;
        } catch (error: any) {
            this.logger.error('❌ Erro limpar credenciais:', error.message);
        }
    }

    async handleAntiMediaViolation(m: any, tipo: string): Promise<void> {
        if (!this.sock) return;
        const jid = m.key.remoteJid;
        const participant = m.key.participant;
        this.logger.warn(`🚫 [ANTI-MEDIA] ${tipo} de ${participant}`);
        await this.sock.sendMessage(jid, { delete: m.key });
    }

    getStatus(): any {
        return {
            isConnected: this.isConnected,
            botJid: this.BOT_JID,
            botNumero: this.config.BOT_NUMERO_REAL,
            botName: this.config.BOT_NAME,
            version: this.config.BOT_VERSION,
            uptime: Math.floor(process.uptime()),
            hasQR: !!this.currentQR,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    getQRCode(): string | null {
        return this.currentQR;
    }

    getStats(): any {
        return {
            isConnected: this.isConnected,
            botJid: this.BOT_JID,
            botNumero: this.config.BOT_NUMERO_REAL,
            botName: this.config.BOT_NAME,
            version: this.config.BOT_VERSION,
            uptime: Math.floor(process.uptime()),
            hasQR: !!this.currentQR,
            reconnectAttempts: this.reconnectAttempts,
            connectionStartTime: this.connectionStartTime,
            features: {
                stt: this.config.FEATURE_STT_ENABLED,
                tts: this.config.FEATURE_TTS_ENABLED,
                youtube: this.config.FEATURE_YT_DOWNLOAD,
                stickers: this.config.FEATURE_STICKERS,
                moderation: this.config.FEATURE_MODERATION,
                leveling: this.config.FEATURE_LEVELING,
                vision: this.config.FEATURE_VISION
            }
        };
    }

    async _forceQRGeneration(): Promise<void> {
        this.logger.info('🔄 Forçando geração de novo QR code...');
        this.currentQR = null;
        if (this.sock) {
            try {
                this.sock.ev.removeAllListeners();
                this.sock.ws?.close();
            } catch (e: any) {
                this.logger.warn('Erro ao limpar socket:', e.message);
            }
            this.sock = null;
        }
        this.isConnected = false;
        this.BOT_JID = null;
        await delay(1000);
        await this.connect();
    }

    async disconnect(): Promise<void> {
        try {
            this.logger.info('🔴 Desconectando...');
            if (this.sock) {
                try {
                    this.sock.ev.removeAllListeners();
                    this.sock.ws?.close();
                } catch (e: any) {
                    this.logger.warn('Erro limpar socket:', e.message);
                }
                this.sock = null;
            }
            this.isConnected = false;
            this.currentQR = null;
            this.BOT_JID = null;
            this.logger.info('✅ Desconectado');
        } catch (error: any) {
            this.logger.error('❌ Erro desconectar:', error.message);
        }
    }
}

export default BotCore;

