/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: BotCore
 * ═══════════════════════════════════════════════════════════════════════
 * Núcleo central do bot Akira.
 * ═══════════════════════════════════════════════════════════════════════
 */
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay, Browsers, getContentType } from '@whiskeysockets/baileys';
import fs from 'fs';
import pino from 'pino';
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
import CybersecurityToolkit from './CybersecurityToolkit.js';
import OSINTFramework from './OSINTFramework.js';
import ImageEffects from './ImageEffects.js';
import StickerViewOnceHandler from './StickerViewOnceHandler.js';
import PermissionManager from './PermissionManager.js';
import AdvancedPentestingToolkit from './AdvancedPentestingToolkit.js';
class BotCore {
    config;
    logger;
    sock;
    isConnected = false;
    reconnectAttempts = 0;
    MAX_RECONNECT_ATTEMPTS = 5;
    connectionStartTime = null;
    currentQR = null;
    BOT_JID = null;
    // Componentes
    advancedPentestingToolkit;
    osintFramework;
    registrationSystem;
    moderationSystem;
    mediaProcessor;
    messageProcessor;
    levelSystem;
    apiClient;
    audioProcessor;
    paymentManager;
    subscriptionManager;
    commandHandler;
    presenceSimulator;
    economySystem;
    userProfile;
    botProfile;
    groupManagement;
    cybersecurityToolkit;
    imageEffects;
    permissionManager;
    stickerViewOnceHandler;
    // Event listeners
    eventListeners = {
        onQRGenerated: null,
        onConnected: null,
        onDisconnected: null
    };
    // Deduplicação
    processedMessages = new Set();
    MAX_PROCESSED_MESSAGES = 1000;
    pipelineLogCounter = 0;
    PIPELINE_LOG_INTERVAL = 10;
    constructor() {
        this.config = ConfigManager.getInstance();
        this.logger = this.config.logger || pino({
            level: this.config.LOG_LEVEL || 'info',
            timestamp: () => `,"time":"${new Date().toISOString()}"`
        });
        this.sock = null;
    }
    async initialize() {
        try {
            this.logger.info('🚀 Inicializando BotCore...');
            HFCorrections.apply();
            this.config.validate();
            await this.initializeComponents();
            return true;
        }
        catch (error) {
            this.logger.error('❌ Erro ao inicializar:', error.message);
            throw error;
        }
    }
    async start() {
        await this.initialize();
        await this.connect();
    }
    async initializeComponents() {
        try {
            this.logger.debug('🔧 Inicializando componentes..');
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
            this.cybersecurityToolkit = new CybersecurityToolkit(this.config);
            this.imageEffects = new ImageEffects(this.logger);
            this.permissionManager = new PermissionManager(this.logger);
            this.stickerViewOnceHandler = new StickerViewOnceHandler(this.sock, this.config);
            this.advancedPentestingToolkit = new AdvancedPentestingToolkit(this.config);
            this.paymentManager = new PaymentManager(this, this.subscriptionManager);
            this.presenceSimulator = new PresenceSimulator(this.sock || null);
            this.economySystem = new EconomySystem(this.logger);
            try {
                this.commandHandler = new CommandHandler(this.sock, this.config, this, this.messageProcessor);
                this.commandHandler.economySystem = this.economySystem;
                this.commandHandler.gameSystem = (await import('./GameSystem.js')).default;
                this.logger.debug('✅ CommandHandler inicializado');
            }
            catch (err) {
                this.logger.warn(`⚠️ CommandHandler: ${err.message}`);
                this.commandHandler = null;
            }
            try {
                this.osintFramework = new OSINTFramework(this.config, this.sock);
                this.logger.debug('✅ OSINTFramework inicializado');
            }
            catch (err) {
                this.logger.warn(`⚠️ OSINTFramework: ${err.message}`);
            }
            const poToken = this.config?.YT_PO_TOKEN;
            const cookiesPath = this.config?.YT_COOKIES_PATH;
            this.logger.info(`📺 YouTube: PO_TOKEN=${poToken ? '✅' : '❌'}, Cookies=${cookiesPath ? '✅' : '❌'}`);
            this.logger.debug('✅ Componentes inicializados');
        }
        catch (error) {
            this.logger.error('❌ Erro componentes:', error.message);
        }
    }
    _updateComponentsSocket(sock) {
        try {
            this.logger.info('🔄 Atualizando socket...');
            if (this.commandHandler?.setSocket)
                this.commandHandler.setSocket(sock);
            if (this.groupManagement?.setSocket)
                this.groupManagement.setSocket(sock);
            if (this.cybersecurityToolkit?.setSocket)
                this.cybersecurityToolkit.setSocket(sock);
            if (this.osintFramework?.setSocket)
                this.osintFramework.setSocket(sock);
            if (this.stickerViewOnceHandler?.setSocket)
                this.stickerViewOnceHandler.setSocket(sock);
            if (this.botProfile?.setSocket)
                this.botProfile.setSocket(sock);
            if (this.userProfile?.setSocket)
                this.userProfile.setSocket(sock);
            if (this.presenceSimulator)
                this.presenceSimulator.sock = sock;
            this.logger.info('✅ Socket atualizado');
        }
        catch (e) {
            this.logger.error('❌ Erro socket:', e);
        }
    }
    async connect() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.config.AUTH_FOLDER);
            const { version, isLatest } = await fetchLatestBaileysVersion();
            this.logger.info(`📡 WhatsApp v${version.join('.')} (Latest: ${isLatest})`);
            const socketConfig = {
                version,
                logger: pino({ level: 'silent' }),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                browser: Browsers.macOS('Akira-Bot'),
                generateHighQualityLinkPreview: true,
                getMessage: async (key) => ({ conversation: 'hello' }),
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
                emitOwnEvents: false,
                retryRequestDelayMs: 250
            };
            const agent = HFCorrections.createHFAgent();
            if (agent) {
                socketConfig.agent = agent;
                this.logger.info('🌐 Agente HTTP personalizado');
            }
            this.sock = makeWASocket(socketConfig);
            if (this.commandHandler?.setSocket)
                this.commandHandler.setSocket(this.sock);
            if (this.presenceSimulator)
                this.presenceSimulator.sock = this.sock;
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    this.logger.info('📸 QR Code recebido');
                    this.currentQR = qr;
                    if (this.eventListeners.onQRGenerated)
                        this.eventListeners.onQRGenerated(qr);
                }
                if (connection === 'close') {
                    this.isConnected = false;
                    this.currentQR = null;
                    const reason = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = reason !== DisconnectReason.loggedOut;
                    this.logger.warn(`🔴 Conexão fechada. Motivo: ${reason}. Reconectar: ${shouldReconnect}`);
                    if (this.eventListeners.onDisconnected)
                        this.eventListeners.onDisconnected(reason);
                    if (shouldReconnect) {
                        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                            this.reconnectAttempts++;
                            const delayMs = Math.min(this.reconnectAttempts * 2000, 10000);
                            this.logger.info(`⏳ Reconectando em ${delayMs}ms (Tentativa ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
                            await delay(delayMs);
                            this.connect();
                        }
                        else {
                            this.logger.error('❌ Muitas falhas. Reiniciando...');
                            process.exit(1);
                        }
                    }
                    else {
                        this.logger.info('🔒 Desconectado permanentemente');
                        this._cleanAuthOnError();
                    }
                }
                else if (connection === 'open') {
                    this.logger.info('✅ CONEXÃO ESTABELECIDA!');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.currentQR = null;
                    this.connectionStartTime = Date.now();
                    this._updateComponentsSocket(this.sock);
                    this.BOT_JID = this.sock.user?.id;
                    this.logger.info(`🤖 Logado como: ${this.BOT_JID}`);
                    if (this.eventListeners.onConnected)
                        this.eventListeners.onConnected(this.BOT_JID);
                }
            });
            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type !== 'notify')
                    return;
                for (const m of messages)
                    await this.processMessage(m);
            });
            this.sock.ev.on('group-participants.update', async (update) => {
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
        }
        catch (error) {
            this.logger.error('❌ Erro conexão:', error.message);
            await delay(5000);
            this.connect();
        }
    }
    isMessageProcessed(key) {
        if (!key?.id)
            return false;
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
    async processMessage(m) {
        try {
            if (this.isMessageProcessed(m.key))
                return;
            this.pipelineLogCounter++;
            const shouldLog = this.pipelineLogCounter % this.PIPELINE_LOG_INTERVAL === 1;
            if (shouldLog)
                this.logger.debug('🔹 [PIPELINE] Iniciando');
            if (!m) {
                this.logger.debug('🔹 [PIPELINE] m null');
                return;
            }
            if (!m.message) {
                this.logger.debug('🔹 [PIPELINE] msg vazia');
                return;
            }
            if (m.key.fromMe)
                return;
            if (m.message.protocolMessage)
                return;
            if (shouldLog)
                this.logger.debug('🔹 [PIPELINE] Válida');
            const remoteJid = m.key.remoteJid;
            const ehGrupo = remoteJid.endsWith('@g.us');
            const ehStatus = remoteJid === 'status@broadcast';
            if (ehStatus)
                return;
            if (!this.messageProcessor)
                throw new Error('messageProcessor não inicializado');
            const nome = m.pushName || 'Usuário';
            const numeroReal = this.messageProcessor.extractUserNumber(m);
            if (shouldLog)
                this.logger.debug(`🔹 [PIPELINE] ${numeroReal}`);
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
            if (shouldLog)
                this.logger.debug(`🔹 [PIPELINE] txt=${!!texto} img=${temImagem} aud=${temAudio}`);
            if (ehGrupo && texto && this.moderationSystem) {
                let isAdmin = false;
                try {
                    if (this.groupManagement)
                        isAdmin = await this.groupManagement.isUserAdmin(remoteJid, m.key.participant);
                }
                catch (e) {
                    isAdmin = false;
                }
                if (!isAdmin && this.moderationSystem.checkLink(texto, remoteJid, m.key.participant)) {
                    await this.handleAntiLinkViolation(m, nome);
                    return;
                }
            }
            const replyInfo = this.messageProcessor.extractReplyInfo(m);
            const temSticker = !!m.message?.stickerMessage;
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
            }
            else if (temAudio) {
                await this.handleAudioMessage(m, nome, numeroReal, replyInfo, ehGrupo);
            }
            else if (texto) {
                await this.handleTextMessage(m, nome, numeroReal, texto, replyInfo, ehGrupo);
            }
        }
        catch (error) {
            console.error('❌ [CRITICAL]:', error);
            this.logger.error('❌ Erro pipeline:', error?.message);
        }
    }
    async handleImageMessage(m, nome, numeroReal, replyInfo, ehGrupo) {
        this.logger.info(`🖼️ [IMAGEM] ${nome}`);
        if (ehGrupo && this.levelSystem) {
            const xp = this.levelSystem.awardXp(m.key.remoteJid, numeroReal, 15);
            if (xp)
                this.logger.info(`📈 [LEVEL] ${nome} +15 XP`);
        }
        try {
            let deveResponder = false;
            const caption = this.messageProcessor.extractText(m) || '';
            const captionLower = caption.toLowerCase();
            const botNameLower = (this.config.BOT_NAME || 'belmira').toLowerCase();
            if (!ehGrupo)
                deveResponder = true;
            else if (this.messageProcessor.isBotMentioned(m))
                deveResponder = true;
            else if (replyInfo?.ehRespostaAoBot)
                deveResponder = true;
            else if (captionLower.includes(botNameLower))
                deveResponder = true;
            else if (this.messageProcessor.isCommand(caption))
                deveResponder = true;
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
                }
                catch (err) {
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
            if (!imgMsg) {
                this.logger.error('❌ Imagem inválida');
                return;
            }
            this.logger.debug('⬇️ Baixando imagem...');
            const imageBuffer = await this.mediaProcessor.downloadMedia(imgMsg, 'image');
            if (!imageBuffer?.length) {
                this.logger.error('❌ Buffer vazio');
                await this.reply(m, '❌ Não consegui baixar a imagem.');
                return;
            }
            this.logger.debug(`✅ Imagem: ${imageBuffer.length} bytes`);
            let base64Image;
            try {
                base64Image = imageBuffer.toString('base64');
                if (!base64Image || base64Image.length < 100)
                    throw new Error('Base64 inválido');
            }
            catch (err) {
                this.logger.error('❌ Erro base64:', err.message);
                await this.reply(m, '❌ Erro ao processar imagem.');
                return;
            }
            const payload = this.apiClient.buildPayload({
                usuario: nome,
                numero: numeroReal,
                mensagem: caption || 'O que tem nesta imagem?',
                tipo_conversa: ehGrupo ? 'grupo' : 'pv',
                grupo_id: ehGrupo ? m.key.remoteJid : null,
                grupo_nome: ehGrupo ? (m.key.remoteJid.split('@')[0] || 'Grupo') : null,
                tipo_mensagem: 'image',
                imagem_dados: {
                    dados: base64Image,
                    mime_type: imgMsg.mimetype || 'image/jpeg',
                    descricao: caption || 'Imagem'
                },
                mensagem_citada: replyInfo?.textoMensagemCitada || '',
                reply_metadata: replyInfo ? {
                    is_reply: replyInfo.isReply || true,
                    reply_to_bot: replyInfo.ehRespostaAoBot,
                    quoted_author_name: replyInfo.quemEscreveuCitacao || 'desconhecido'
                } : null
            });
            this.logger.info(`👁️ Analisando imagem...`);
            const resultado = await this.apiClient.processMessage(payload);
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
        }
        catch (error) {
            this.logger.error('❌ Erro imagem:', error.message);
        }
    }
    async handleAudioMessage(m, nome, numeroReal, replyInfo, ehGrupo) {
        this.logger.info(`🎤 [ÁUDIO] ${nome}`);
        try {
            const tipoMsg = getContentType(m.message);
            let audMsg = m.message.audioMessage;
            if (tipoMsg === 'viewOnceMessage' || tipoMsg === 'viewOnceMessageV2') {
                audMsg = m.message[tipoMsg].message?.audioMessage;
            }
            if (!audMsg) {
                this.logger.error('❌ Áudio inválido');
                return;
            }
            const audioBuffer = await this.mediaProcessor.downloadMedia(audMsg, 'audio');
            await this.handleAudioMessage_internal(m, nome, numeroReal, replyInfo, ehGrupo, audioBuffer);
        }
        catch (error) {
            this.logger.error('❌ Erro áudio:', error.message);
        }
    }
    async handleAudioMessage_internal(m, nome, numeroReal, replyInfo, ehGrupo, audioBuffer) {
        try {
            if (!audioBuffer) {
                this.logger.error('❌ Buffer áudio vazio');
                return;
            }
            const transcricao = await this.audioProcessor.speechToText(audioBuffer);
            if (!transcricao.sucesso) {
                this.logger.warn('⚠️ Falha transcrição');
                return;
            }
            this.logger.info(`📝 Transcrição: ${transcricao.texto.substring(0, 80)}`);
            await this.handleTextMessage(m, nome, numeroReal, transcricao.texto, replyInfo, ehGrupo, true);
        }
        catch (error) {
            this.logger.error('❌ Erro áudio interno:', error.message);
        }
    }
    async handleTextMessage(m, nome, numeroReal, texto, replyInfo, ehGrupo, foiAudio = false) {
        try {
            let allowed = true;
            try {
                const isDono = typeof this.config?.isDono === 'function' ? this.config.isDono(numeroReal, nome) : false;
                if (this.moderationSystem?.checkAndLimitHourlyMessages) {
                    const res = this.moderationSystem.checkAndLimitHourlyMessages(numeroReal, nome, numeroReal, texto, null, isDono);
                    allowed = !!res?.allowed;
                    if (!allowed) {
                        const msg = res?.reason === 'LIMITE_HORARIO_EXCEDIDO' ? '⏰ Limite por hora excedido.' : '⏰ Muitas mensagens. Aguarde.';
                        await this.sock.sendMessage(m.key.remoteJid, { text: msg });
                        return;
                    }
                }
                else if (!this.messageProcessor.checkRateLimit(numeroReal)) {
                    await this.sock.sendMessage(m.key.remoteJid, { text: '⏰ Muitas mensagens. Aguarde.' });
                    return;
                }
            }
            catch (err) {
                this.logger?.warn('Erro rate limit:', err?.message);
                if (!this.messageProcessor.checkRateLimit(numeroReal)) {
                    await this.sock.sendMessage(m.key.remoteJid, { text: '⏰ Muitas mensagens. Aguarde.' });
                    return;
                }
            }
            try {
                if (this.commandHandler) {
                    const handled = await this.commandHandler.handle(m, { nome, numeroReal, texto, replyInfo, ehGrupo });
                    if (handled) {
                        this.logger.info(`⚡ Comando: ${texto.substring(0, 30)}`);
                        if (ehGrupo && this.levelSystem && this.groupManagement?.groupSettings[m.key.remoteJid]?.leveling) {
                            const xp = this.levelSystem.awardXp(m.key.remoteJid, numeroReal, 5);
                            if (xp)
                                this.logger.info(`📈 [LEVEL] ${nome} +5 XP`);
                        }
                        return;
                    }
                }
            }
            catch (err) {
                this.logger.warn('Erro CommandHandler:', err.message);
            }
            let deveResponder = false;
            const textoLower = texto.toLowerCase();
            const botNameLower = (this.config.BOT_NAME || 'belmira').toLowerCase();
            if (foiAudio) {
                if (!ehGrupo)
                    deveResponder = true;
                else if (replyInfo?.ehRespostaAoBot)
                    deveResponder = true;
                else if (this.messageProcessor.isBotMentioned(m))
                    deveResponder = true;
                else if (textoLower.includes(botNameLower))
                    deveResponder = true;
            }
            else {
                if (replyInfo?.ehRespostaAoBot)
                    deveResponder = true;
                else if (!ehGrupo)
                    deveResponder = true;
                else if (this.messageProcessor.isBotMentioned(m))
                    deveResponder = true;
                else if (textoLower.includes(botNameLower))
                    deveResponder = true;
            }
            if (!deveResponder) {
                this.logger.debug(`⏭️ Ignorado: ${texto.substring(0, 50)}`);
                return;
            }
            this.logger.info(`\n🔥 [PROCESSANDO] ${nome}: ${texto.substring(0, 60)}`);
            const replyMetadata = replyInfo ? {
                is_reply: replyInfo.isReply || true,
                reply_to_bot: replyInfo.ehRespostaAoBot,
                quoted_author_name: replyInfo.quemEscreveuCitacao || 'desconhecido',
                quoted_author_numero: replyInfo.quotedAuthorNumero || 'desconhecido',
                quoted_type: replyInfo.quotedType || 'texto',
                quoted_text_original: replyInfo.quotedTextOriginal || '',
                context_hint: replyInfo.contextHint || '',
                priority_level: replyInfo.priorityLevel || 2
            } : { is_reply: false, reply_to_bot: false };
            if (ehGrupo && this.levelSystem) {
                const xp = this.levelSystem.awardXp(m.key.remoteJid, numeroReal, 10);
                if (xp)
                    this.logger.info(`📈 [LEVEL] ${nome} +10 XP`);
            }
            const payload = this.apiClient.buildPayload({
                usuario: nome,
                numero: numeroReal,
                mensagem: texto,
                tipo_conversa: ehGrupo ? 'grupo' : 'pv',
                grupo_id: ehGrupo ? m.key.remoteJid : null,
                grupo_nome: ehGrupo ? (m.key.remoteJid.split('@')[0] || 'Grupo') : null,
                tipo_mensagem: foiAudio ? 'audio' : 'texto',
                mensagem_citada: replyInfo?.textoMensagemCitada || '',
                reply_metadata: replyMetadata
            });
            const resultado = await this.apiClient.processMessage(payload);
            if (!resultado.success) {
                this.logger.error('❌ Erro API:', resultado.error);
                await this.sock.sendMessage(m.key.remoteJid, { text: 'Tive um problema. Tenta de novo?' });
                return;
            }
            const resposta = resultado.resposta || 'Sem resposta';
            if (foiAudio) {
                this.logger.info('🎤 [AUDIO RESPONSE]');
                if (this.presenceSimulator)
                    await this.presenceSimulator.safeSendPresenceUpdate('recording', m.key.remoteJid);
                try {
                    const tts = await this.audioProcessor.textToSpeech(resposta);
                    if (!tts.sucesso) {
                        this.logger.warn('⚠️ Falha TTS');
                        if (this.presenceSimulator)
                            await this.presenceSimulator.safeSendPresenceUpdate('paused', m.key.remoteJid);
                        await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, { quoted: m });
                    }
                    else {
                        this.logger.info('📤 Voice Note...');
                        await this.sock.sendMessage(m.key.remoteJid, {
                            audio: tts.buffer,
                            mimetype: tts.mimetype || 'audio/ogg; codecs=opus',
                            ptt: true
                        }, { quoted: m });
                    }
                }
                catch (err) {
                    this.logger.error('❌ Erro TTS:', err);
                    await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, { quoted: m });
                }
                finally {
                    if (this.presenceSimulator)
                        await this.presenceSimulator.safeSendPresenceUpdate('paused', m.key.remoteJid);
                }
                if (this.presenceSimulator)
                    await this.presenceSimulator.markAsRead(m);
            }
            else {
                if (this.presenceSimulator) {
                    await this.presenceSimulator.simulateFullResponse(this.sock, m, resposta, false);
                }
                else {
                    await this.simulateTyping(m.key.remoteJid, Math.min(resposta.length * 50, 5000));
                }
                const opcoes = ehGrupo ? { quoted: m } : replyInfo ? { quoted: m } : {};
                await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);
                if (this.presenceSimulator)
                    await this.presenceSimulator.markAsRead(m);
            }
            this.logger.info(`✅ [RESPONDIDO] ${resposta.substring(0, 80)}`);
        }
        catch (error) {
            this.logger.error('❌ Erro texto:', error.message);
        }
    }
    async simulateTyping(jid, durationMs) {
        try {
            if (!this.sock)
                return;
            await this.sock.sendPresenceUpdate('available', jid);
            await delay(300);
            await this.sock.sendPresenceUpdate('composing', jid);
            await delay(durationMs);
            await this.sock.sendPresenceUpdate('paused', jid);
        }
        catch (e) {
            this.logger.debug('Erro typing:', e.message);
        }
    }
    async reply(m, text, options = {}) {
        try {
            if (!this.sock) {
                this.logger.warn('⚠️ Socket não disponível');
                return false;
            }
            return await this.sock.sendMessage(m.key.remoteJid, { text, ...options }, { quoted: m });
        }
        catch (error) {
            this.logger.error('❌ Erro reply:', error.message);
            return false;
        }
    }
    async handleMutedUserMessage(m, nome) {
        try {
            this.logger.warn(`🔇 ${nome} falou durante mute`);
            await this.sock.groupParticipantsUpdate(m.key.remoteJid, [m.key.participant], 'remove');
            await this.sock.sendMessage(m.key.remoteJid, { text: `🚫 *${nome} removido por mute!*` });
        }
        catch (error) {
            this.logger.error('❌ Erro mute:', error.message);
        }
    }
    async handleAntiLinkViolation(m, nome) {
        try {
            if (!this.sock)
                return;
            const jid = m.key.remoteJid;
            const participant = m.key.participant;
            this.logger.warn(`🔗 [ANTI-LINK] ${nome}`);
            await this.reply(m, `🚫 @${participant.split('@')[0]}, links não permitidos!`, { mentions: [participant] });
            await this.sock.sendMessage(jid, { delete: m.key });
            await delay(1000);
            await this.sock.groupParticipantsUpdate(jid, [participant], 'remove');
        }
        catch (error) {
            this.logger.error('❌ Erro antilink:', error.message);
        }
    }
    _cleanAuthOnError() {
        try {
            if (fs.existsSync(this.config.AUTH_FOLDER)) {
                fs.rmSync(this.config.AUTH_FOLDER, { recursive: true, force: true });
                this.logger.info('🧹 Credenciais limpas');
            }
            this.isConnected = false;
            this.currentQR = null;
            this.BOT_JID = null;
            this.reconnectAttempts = 0;
        }
        catch (error) {
            this.logger.error('❌ Erro limpar credenciais:', error.message);
        }
    }
    async handleAntiMediaViolation(m, tipo) {
        if (!this.sock)
            return;
        const jid = m.key.remoteJid;
        const participant = m.key.participant;
        this.logger.warn(`🚫 [ANTI-MEDIA] ${tipo} de ${participant}`);
        await this.sock.sendMessage(jid, { delete: m.key });
    }
    getStatus() {
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
    getQRCode() {
        return this.currentQR;
    }
    getStats() {
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
    async _forceQRGeneration() {
        this.logger.info('🔄 Forçando geração de novo QR code...');
        this.currentQR = null;
        if (this.sock) {
            try {
                this.sock.ev.removeAllListeners();
                this.sock.ws?.close();
            }
            catch (e) {
                this.logger.warn('Erro ao limpar socket:', e.message);
            }
            this.sock = null;
        }
        this.isConnected = false;
        this.BOT_JID = null;
        await delay(1000);
        await this.connect();
    }
    async disconnect() {
        try {
            this.logger.info('🔴 Desconectando...');
            if (this.sock) {
                try {
                    this.sock.ev.removeAllListeners();
                    this.sock.ws?.close();
                }
                catch (e) {
                    this.logger.warn('Erro limpar socket:', e.message);
                }
                this.sock = null;
            }
            this.isConnected = false;
            this.currentQR = null;
            this.BOT_JID = null;
            this.logger.info('✅ Desconectado');
        }
        catch (error) {
            this.logger.error('❌ Erro desconectar:', error.message);
        }
    }
}
export default BotCore;
