/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: BotCore
 * ═══════════════════════════════════════════════════════════════════════
 * Núcleo central do bot Akira.
 * Gerencia conexão, eventos do socket, e orquestra os módulos de processamento.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay, Browsers, getContentType } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import pino from 'pino'; // Logger usado pelo Baileys

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
    public config: any;
    public logger: any;
    public sock: any;
    public isConnected: boolean;
    public reconnectAttempts: number;
    public MAX_RECONNECT_ATTEMPTS: number;
    public connectionStartTime: number | null;
    public qrTimeout: any;
    public currentQR: string | null;
    public BOT_JID: string | null;

    // Componentes
    public advancedPentestingToolkit: any;
    public osintFramework: any;
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
    public cybersecurityToolkit: any;
    public imageEffects: any;
    public permissionManager: any;
    public stickerViewOnceHandler: any;

    // Event listeners externos
    public eventListeners: {
        onQRGenerated: ((qr: string) => void) | null;
        onConnected: ((jid: string) => void) | null;
        onDisconnected: ((reason: any) => void) | null;
    };

    constructor() {
        this.config = ConfigManager.getInstance();
        // Inicializa logger (usa o do config ou cria um novo com pino)
        this.logger = this.config.logger || pino({
            level: this.config.LOG_LEVEL || 'info',
            timestamp: () => `,"time":"${new Date().toISOString()}"`
        });
        this.sock = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 5; // Limite de tentativas antes de desistir temporariamente
        this.connectionStartTime = null;
        this.qrTimeout = null;
        this.currentQR = null;
        this.BOT_JID = null;

        // Componentes
        this.apiClient = null;
        this.audioProcessor = null;
        this.mediaProcessor = null;
        this.messageProcessor = null;
        this.moderationSystem = null;
        this.levelSystem = null;
        this.registrationSystem = null;
        this.paymentManager = null;
        this.subscriptionManager = null;
        this.commandHandler = null;
        this.presenceSimulator = null;
        this.economySystem = null;

        // Event listeners externos
        this.eventListeners = {
            onQRGenerated: null,
            onConnected: null,
            onDisconnected: null
        };
    }

    /**
    * Inicializa o bot (prepara componentes e diretórios) sem conectar
    */
    async initialize(): Promise<boolean> {
        try {
            this.logger.info('🚀 Inicializando BotCore...');

            // Aplica correções para HF Spaces se necessário
            HFCorrections.apply();

            // Valida configurações
            this.config.validate();

            // Inicializa componentes
            await this.initializeComponents();

            return true;
        } catch (error: any) {
            this.logger.error('❌ Erro ao inicializar bot:', error.message);
            throw error;
        }
    }

    /**
    * Conecta o bot (Atalho para start completo)
    */
    async start() {
        await this.initialize();
        await this.connect();
    }

    /**
    * Inicializa módulos auxiliares
    */
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
            this.groupManagement = new GroupManagement(this.sock, this.config);
            this.cybersecurityToolkit = new CybersecurityToolkit(this.config);
            this.imageEffects = new ImageEffects(this.logger);
            this.permissionManager = new PermissionManager(this.logger);
            this.stickerViewOnceHandler = new StickerViewOnceHandler(this.sock, this.config);
            this.advancedPentestingToolkit = new AdvancedPentestingToolkit(this.config);

            // Inicializa PaymentManager (passando this para acessar SubscriptionManager depois)
            this.paymentManager = new PaymentManager(this, this.subscriptionManager);

            // Inicializa PresenceSimulator
            this.presenceSimulator = new PresenceSimulator(this.sock || null);

            // Inicializa EconomySystem
            this.economySystem = new EconomySystem(this.logger);

            // CommandHandler pode falhar no Hugging Face, tratar separadamente
            try {
                this.commandHandler = new CommandHandler(this.sock, this.config, this, this.messageProcessor);
                // Injeta sistemas explicitamente se necessário (embora já passe 'this' como BotContext)
                this.commandHandler.economySystem = this.economySystem;
                this.commandHandler.gameSystem = (await import('./GameSystem.js')).default;

                this.logger.debug('✅ CommandHandler inicializado com injeção de dependência e componentes');
            } catch (commandError) {
                this.logger.warn(`⚠️ CommandHandler falhou: ${commandError.message}`);
                this.logger.warn('⚠️Continuando sem CommandHandler (modo limitado)');
                this.commandHandler = null;
            }

            // Inicializa OSINTFramework (BotCore level)
            try {
                this.osintFramework = new OSINTFramework(this.config, this.sock);
                this.logger.debug('✅ OSINTFramework inicializado');
            } catch (osintError) {
                this.logger.warn(`⚠️ OSINTFramework falhou na inicialização: ${osintError.message || osintError}`);
                // Não impede o boot, apenas deixa sem o framework no nível core
            }

            // Diagnóstico de Bypass YouTube (Diagnóstico Railway 2026)
            const poToken = this.config?.YT_PO_TOKEN;
            const cookiesPath = this.config?.YT_COOKIES_PATH;
            this.logger.info(`📺 YouTube Bypass: PO_TOKEN: ${poToken ? '✅ Configurado' : '❌ Não configurado'}, Cookies: ${cookiesPath ? '✅ Configurado' : '❌ Não configurado'}`);

            this.logger.debug('✅ Componentes inicializados');
        } catch (error: any) {
            this.logger.error('❌ Erro ao inicializar componentes:', error.message);
            // Não lançar erro fatal, tentar continuar com componentes disponíveis
        }
    }

    /**
     * Atualiza o socket em todos os componentes que dependem dele
     * Chamado após a conexão ser estabelecida
     */
    private _updateComponentsSocket(sock: any): void {
        try {
            this.logger.info('🔄 Atualizando socket nos componentes...');

            // Core Handlers
            if (this.commandHandler) {
                if (this.commandHandler.setSocket) this.commandHandler.setSocket(sock);
                this.commandHandler.bot = this; // Garante referência ao BotCore instanciado
            }

            // Modules
            // if (this.stickerViewOnceHandler?.setSocket) this.stickerViewOnceHandler.setSocket(sock); // Não existe no código atual
            if (this.groupManagement?.setSocket) this.groupManagement.setSocket(sock);
            if (this.cybersecurityToolkit?.setSocket) this.cybersecurityToolkit.setSocket(sock);
            if (this.osintFramework?.setSocket) this.osintFramework.setSocket(sock);
            if (this.stickerViewOnceHandler?.setSocket) this.stickerViewOnceHandler.setSocket(sock);
            if (this.botProfile?.setSocket) this.botProfile.setSocket(sock);
            if (this.userProfile?.setSocket) this.userProfile.setSocket(sock);

            // Novos módulos
            if (this.advancedPentestingToolkit?.setSocket) this.advancedPentestingToolkit.setSocket(sock);
            if (this.presenceSimulator) this.presenceSimulator.sock = sock;

            // Não têm setSocket mas podem precisar (verificar implementações futuras)
            // this.advancedPentestingToolkit não usa socket no código atual

            this.logger.info('✅ Socket injetado nos componentes com sucesso');
        } catch (e: any) {
            this.logger.error('❌ Erro ao atualizar socket nos componentes:', e);
        }
    }

    /**
    * Estabelece conexão com WhatsApp
    */
    async connect(): Promise<void> {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.config.AUTH_FOLDER);
            const { version, isLatest } = await fetchLatestBaileysVersion();

            this.logger.info(`📡 Conectando ao WhatsApp v${version.join('.')} (Latest: ${isLatest})`);

            // Configuração do Socket
            const socketConfig: any = {
                version,
                logger: pino({ level: 'silent' }), // Silencia logs internos do Baileys para limpar console
                printQRInTerminal: true, // Útil para dev local
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                browser: Browsers.macOS('Akira-Bot'),
                generateHighQualityLinkPreview: true,
                getMessage: async (key: any) => {
                    // Necessário para suportar mensagens antigas/contexto
                    return { conversation: 'hello' };
                },
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
                emitOwnEvents: false,
                retryRequestDelayMs: 250
            };

            // Ajuste para proxy/agente se estiver no HF Space ou ambiente restrito
            const agent = HFCorrections.createHFAgent();
            if (agent) {
                socketConfig.agent = agent;
                this.logger.info('🌐 Usando agente HTTP personalizado para conexão');
            }

            // Cria o socket
            this.sock = makeWASocket(socketConfig);

            // Atualiza referência do sock nos componentes
            if (this.commandHandler && this.commandHandler.setSocket) {
                this.commandHandler.setSocket(this.sock);
            }
            if (this.presenceSimulator) this.presenceSimulator.sock = this.sock;


            // ═══ EVENTOS DE CONEXÃO ═══
            this.sock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.logger.info('📸 QR Code recebido');
                    this.currentQR = qr;

                    // Notifica listener externo (para frontend/API)
                    if (this.eventListeners.onQRGenerated) {
                        this.eventListeners.onQRGenerated(qr);
                    }
                }

                if (connection === 'close') {
                    this.isConnected = false;
                    this.currentQR = null;
                    const reason = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = reason !== DisconnectReason.loggedOut;

                    this.logger.warn(`🔴 Conexão fechada. Motivo: ${reason}. Reconectar: ${shouldReconnect}`);

                    if (this.eventListeners.onDisconnected) {
                        this.eventListeners.onDisconnected(reason);
                    }

                    if (shouldReconnect) {
                        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                            this.reconnectAttempts++;
                            const delayMs = Math.min(this.reconnectAttempts * 2000, 10000); // Backoff exponencial
                            this.logger.info(`⏳ Tentando reconectar em ${delayMs}ms (Tentativa ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})..`);
                            await delay(delayMs);
                            this.connect();
                        } else {
                            this.logger.error('❌ Muitas falhas de conexão. Reiniciando processo..');
                            // Em containers, sair faz o orquestrador reiniciar
                            // Em dev local, força restart seguro
                            process.exit(1);
                        }
                    } else {
                        this.logger.info('🔒 Desconectado permanentemente (Logout ou Sessão Inválida)');
                        // Limpa auth folder para forçar novo QR na próxima vez
                        this._cleanAuthOnError();
                    }
                } else if (connection === 'open') {
                    this.logger.info('✅ CONEXÃO ESTABELECIDA COM SUCESSO!');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.currentQR = null;
                    this.connectionStartTime = Date.now();

                    // ✅ Atualiza socket em todos os componentes dependentes
                    this._updateComponentsSocket(this.sock);

                    const userJid = this.sock.user?.id;
                    this.BOT_JID = userJid;
                    this.logger.info(`🤖 Logado como: ${userJid}`);

                    if (this.eventListeners.onConnected) {
                        this.eventListeners.onConnected(userJid);
                    }

                    // Envia mensagem de "Estou online" para o número do dono (opcional)
                    const ownerNumber = this.config.BOT_NUMERO_REAL; // ou owner number real
                    // await this.sock.sendMessage(ownerNumber + '@s.whatsapp.net', { text: '🤖 Akira Online!' });
                }
            });

            // ═══ EVENTOS DE CREDENCIAIS ═══
            this.sock.ev.on('creds.update', saveCreds);

            // ═══ EVENTOS DE MENSAGEM ═══
            this.sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
                if (type !== 'notify') return;

                for (const m of messages) {
                    await this.processMessage(m);
                }
            });

            // ═══ EVENTO: ENTRADA/SAÍDA DE MEMBROS ═══
            this.sock.ev.on('group-participants.update', async (update: any) => {
                const { id, participants, action } = update;

                // 1. Anti-Fake (Sempre o primeiro se for entrada)
                if (action === 'add' && this.moderationSystem && this.moderationSystem.isAntiFakeActive(id)) {
                    for (const participant of participants) {
                        if (this.moderationSystem.isFakeNumber(participant)) {
                            this.logger.warn(`🚫 [ANTI-FAKE] Kickando número fake: ${participant} do grupo ${id}`);
                            await this.sock.sendMessage(id, { text: `⚠️ Número fake (+${participant.split('@')[0]}) detectado e removido.` });
                            await this.sock.groupParticipantsUpdate(id, [participant], 'remove');
                            // Se foi removido, não processa boas-vindas para este participante
                            participants.splice(participants.indexOf(participant), 1);
                        }
                    }
                }

                // 2. Boas-vindas (Welcome)
                if (action === 'add' && this.groupManagement && participants.length > 0) {
                    const isWelcomeOn = this.groupManagement.groupSettings?.[id]?.welcome;
                    if (isWelcomeOn) {
                        for (const participant of participants) {
                            const template = this.groupManagement.getCustomMessage(id, 'welcome') || 'Olá @user, seja bem-vindo ao grupo @group!';
                            const formatted = await this.groupManagement.formatMessage(id, participant, template);
                            await this.sock.sendMessage(id, { text: formatted, mentions: [participant] });
                        }
                    }
                }

                // 3. Adeus (Goodbye)
                if (action === 'remove' && this.groupManagement) {
                    const isGoodbyeOn = this.groupManagement.groupSettings?.[id]?.goodbye;
                    if (isGoodbyeOn) {
                        for (const participant of participants) {
                            const template = this.groupManagement.getCustomMessage(id, 'goodbye') || 'Adeus @user, sentiremos sua falta!';
                            const formatted = await this.groupManagement.formatMessage(id, participant, template);
                            await this.sock.sendMessage(id, { text: formatted, mentions: [participant] });
                        }
                    }
                }
            });

            // ═══ CASOS ESPECIAIS (Call, Group Update, etc) ═══
            // Implementar conforme necessidade...

        } catch (error: any) {
            this.logger.error('❌ Erro na função connect:', error.message);
            await delay(5000);
            this.connect(); // Tenta de novo em loop seguro
        }
    }

    /**
    * Processa uma única mensagem recebida
    */
    async processMessage(m: any): Promise<void> {
        try {
            this.logger.warn('🔹 [PIPELINE 1] Iniciando');
            if (!m) {
                this.logger.warn('🔹 [PIPELINE] "m" é null/undefined');
                return;
            }
            if (!m.message) {
                this.logger.warn('🔹 [PIPELINE] Mensagem vazia, retornando');
                return;
            }
            if (m.key.fromMe) return; // Mensagem do próprio bot

            this.logger.warn('🔹 [PIPELINE 2] Mensagem válida');

            // Trata status de 'protocolMessage' (ex: mensagens apagadas)
            if (m.message.protocolMessage) return;

            const remoteJid = m.key.remoteJid;
            const ehGrupo = remoteJid.endsWith('@g.us');
            const ehStatus = remoteJid === 'status@broadcast';

            if (ehStatus) return; // Ignora status updates

            // Extrai dados básicos
            this.logger.warn('🔹 [PIPELINE 3] Extraindo dados básicos');
            if (!this.messageProcessor) throw new Error('messageProcessor não inicializado');

            const nome = m.pushName || 'Usuário';
            const numeroReal = this.messageProcessor.extractUserNumber(m);
            this.logger.warn(`🔹 [PIPELINE 4] Dados extraídos: ${numeroReal}`);
            this.logger.debug(`🔹 [PIPELINE] Nome: ${nome}, Número: ${numeroReal}`);

            // Verifica lista negra
            if (this.moderationSystem && this.moderationSystem.isBlacklisted(numeroReal)) {
                this.logger.debug(`🚫 Mensagem ignorada de usuário banido: ${nome} (${numeroReal})`);
                return;
            }

            // Verifica Mute (apenas grupos)
            if (ehGrupo && this.moderationSystem && this.moderationSystem.isMuted(remoteJid, m.key.participant)) {
                await this.handleMutedUserMessage(m, nome);
                return;
            }

            // Detecta tipo de conteúdo e extrai texto
            this.logger.warn('🔹 [PIPELINE 5] Detectando conteúdo');
            const texto = this.messageProcessor.extractText(m);
            const temImagem = this.messageProcessor.hasImage(m);
            const temAudio = this.messageProcessor.hasAudio(m);
            this.logger.warn(`🔹 [PIPELINE 6] Conteúdo detectado: txt=${!!texto} img=${temImagem} aud=${temAudio}`);

            // Verifica Anti-Link (se tiver texto) - com verificação de admin
            if (ehGrupo && texto && this.moderationSystem) {
                // Verifica se o usuário é admin do grupo
                let isAdmin = false;
                try {
                    if (this.groupManagement) {
                        isAdmin = await this.groupManagement.isUserAdmin(remoteJid, m.key.participant);
                    }
                } catch (e) {
                    // Se falhar a verificação, assume que não é admin
                    isAdmin = false;
                }

                // Se não for admin, verifica se tem link
                if (!isAdmin && this.moderationSystem.checkLink(texto, remoteJid, m.key.participant)) {
                    await this.handleAntiLinkViolation(m, nome);
                    return;
                }
            }

            // Anti-Spam (Rate Limit) -> Verificado dentro do handleTextMessage para economizar calls, 
            // mas poderia ser aqui. Vamos deixar no handleTextMessage para permitir que imagens passem por enquanto ou replicar logica.

            // Extrai informações de Reply
            this.logger.debug('🔹 [PIPELINE] Extraindo replyInfo');
            const replyInfo = this.messageProcessor.extractReplyInfo(m);
            this.logger.debug('🔹 [PIPELINE] ReplyInfo extraído, iniciando roteamento');

            // Roteamento de tipos
            const temSticker = !!m.message?.stickerMessage;

            if (temSticker && ehGrupo && this.moderationSystem.isAntiStickerActive(remoteJid)) {
                await this.handleAntiMediaViolation(m, 'sticker');
                return;
            }

            if (temImagem) {
                if (ehGrupo && this.moderationSystem.isAntiImageActive(remoteJid)) {
                    await this.handleAntiMediaViolation(m, 'imagem');
                    return;
                }
                await this.handleImageMessage(m, nome, numeroReal, replyInfo, ehGrupo);
            } else if (temAudio) {
                await this.handleAudioMessage(m, nome, numeroReal, replyInfo, ehGrupo);
            } else if (texto) {
                await this.handleTextMessage(m, nome, numeroReal, texto, replyInfo, ehGrupo);
            } else if (temSticker) {
                // Se não foi bloqueado e é um sticker, pode processar se quiser
            }
        } catch (error: any) {
            // Log bruto para garantir visibilidade
            console.error('❌ [CRITICAL ERROR RAW]:', error);

            this.logger.error('❌ Erro no pipeline de mensagem:', error?.message || 'SEM MENSAGEM');
            this.logger.error('📍 Stack trace:', error?.stack || 'SEM STACK TRACE');
            this.logger.error('🔍 JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        }
    }

    /**
    * Handle image message (Computer Vision)
    * FLUXO CRÍTICO:
    * 1. Recebe mensagem com imageMessage (criptografada pelo WhatsApp)
    * 2. MediaProcessor baixa e DECIFRA a imagem -> retorna Buffer RAW
    * 3. BotCore converte Buffer RAW -> Base64
    * 4. Envia Base64 para API Python (ComputerVision)
    */
    async handleImageMessage(m: any, nome: string, numeroReal: string, replyInfo: any, ehGrupo: boolean): Promise<void> {
        this.logger.info(`🖼️ [IMAGEM] Iniciando processamento para ${nome}`);

        // Premiar XP por imagem
        if (ehGrupo && this.levelSystem) {
            this.levelSystem.awardXp(m.key.remoteJid, numeroReal, 15);
        }

        try {
            // ✅ VERIFICAÇÃO DE ATIVAÇÃO RIGOROSA (Mesma regra do texto)
            let deveResponder = false;
            const caption = this.messageProcessor.extractText(m) || '';
            const captionLower = caption.toLowerCase();
            const botNameLower = (this.config.BOT_NAME || 'belmira').toLowerCase();
            const hasBotName = captionLower.includes(botNameLower);

            if (!ehGrupo) {
                // Em PV sempre responde
                deveResponder = true;
            } else {
                // Em Grupo: Menção OU Reply ao Bot OU Nome no Caption OU Comando na Legenda
                if (this.messageProcessor.isBotMentioned(m)) {
                    deveResponder = true;
                } else if (replyInfo && replyInfo.ehRespostaAoBot) {
                    deveResponder = true;
                } else if (hasBotName) {
                    deveResponder = true;
                } else if (this.messageProcessor.isCommand(caption)) {
                    deveResponder = true;
                    this.logger.debug(`✅ Ativação por comando na legenda detectada: ${caption.substring(0, 20)}`);
                }
            }

            if (!deveResponder) {
                this.logger.debug(`⏭️ Imagem ignorada em grupo (sem ativação): ${caption.substring(0, 30)}..`);
                return;
            }

            // PRIORIDADE: Se a legenda for um comando, desvia para o CommandHandler
            if (this.commandHandler && this.messageProcessor.isCommand(caption)) {
                try {
                    const handled = await this.commandHandler.handle(m, { nome, numeroReal, texto: caption, replyInfo, ehGrupo });
                    if (handled) {
                        this.logger.info(`⚡ Comando em legenda de imagem tratado: ${caption.substring(0, 30)}..`);
                        return;
                    }
                } catch (cmdErr: any) {
                    this.logger.warn(`⚠️ Falha ao processar comando na legenda: ${cmdErr.message}`);
                }
            }

            // Marca como entregue/lido
            await this.presenceSimulator.simulateTicks(m, true, false);

            // Simula "olhando" a imagem (digitação breve)
            await this.presenceSimulator.simulateTyping(m.key.remoteJid, 1500);

            // Validação de tipo (suporte a viewOnce)
            const tipoMsg = getContentType(m.message);
            let imgMsg = m.message.imageMessage;

            if (tipoMsg === 'viewOnceMessage' || tipoMsg === 'viewOnceMessageV2') {
                imgMsg = m.message[tipoMsg].message?.imageMessage;
            }

            if (!imgMsg) {
                this.logger.error('❌ Mensagem de imagem inválida ou ausente (não foi possível localizar imageMessage)');
                // Se não tem imagem mas chegou aqui, pode ser um comando de texto na legenda que não precisava de imagem
                // Mas geralmente handleImageMessage é para imagens.
                return;
            }

            this.logger.debug('⬇️ Baixando e decifrando imagem...');
            this.logger.debug(`📋 MimeType: ${imgMsg.mimetype || 'desconhecido'}`);
            this.logger.debug(`📏 Tamanho relatado: ${imgMsg.fileLength || 'desconhecido'} bytes`);

            // Baixa a imagem (MediaProcessor cuida da decifragem usando chaves da mensagem)
            const imageBuffer = await this.mediaProcessor.downloadMedia(
                imgMsg,
                'image'
            );

            if (!imageBuffer || imageBuffer.length === 0) {
                this.logger.error('❌ Falha: Buffer de imagem vazio ou nulo após download/decifragem');
                await this.reply(m, '❌ Não consegui baixar essa imagem. Tente enviar novamente em um formato diferente (JPG/PNG)...');
                return;
            }

            this.logger.debug(`✅ Imagem decifrada com sucesso! Tamanho: ${imageBuffer.length} bytes`);

            // Converte para base64 (Formato esperado pelo computervision.py)
            let base64Image;
            try {
                base64Image = imageBuffer.toString('base64');

                // Validação do base64 (deve ter comprimento razoável)
                if (!base64Image || base64Image.length < 100) {
                    throw new Error(`Base64 inválido: comprimento ${base64Image?.length || 0}`);
                }

                this.logger.debug(`✅ Conversão base64 OK: ${base64Image.length} caracteres`);
            } catch (conversionError: any) {
                this.logger.error('❌ Erro na conversão base64:', conversionError.message);
                await this.reply(m, '❌ Erro ao processar imagem...');
                return;
            }

            this.logger.debug('🔄 Convertido para Base64. Preparando payload...');

            // Prepara payload para Computer Vision
            // caption já extraído no início da função
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
                    descricao: caption || 'Imagem enviada'
                },
                mensagem_citada: (replyInfo && replyInfo.textoMensagemCitada) || '',
                reply_metadata: replyInfo ? {
                    is_reply: replyInfo.isReply || true,
                    reply_to_bot: replyInfo.ehRespostaAoBot,
                    quoted_author_name: replyInfo.quemEscreveuCitacao || 'desconhecido'
                } : null
            });

            this.logger.info(`👁️ Enviando imagem para análise (Computer Vision)...`);

            // Chama API
            const resultado = await this.apiClient.processMessage(payload);

            if (!resultado.success) {
                this.logger.error('❌ Erro na API de Visão:', resultado.error);
                await this.sock.sendMessage(m.key.remoteJid, {
                    text: 'Minha visão está embaçada agora... Tenta depois?'
                });
                return;
            }

            let resposta = resultado.resposta || 'Não sei o que dizer sobre isso.';

            // Envia resposta
            await this.presenceSimulator.simulateTyping(m.key.remoteJid, this.presenceSimulator.calculateTypingDuration(resposta));

            // Grupos: SEMPRE reply | PV: reply apenas se usuário respondeu ao bot
            const opcoes = ehGrupo ? { quoted: m } : (replyInfo && replyInfo.ehRespostaAoBot) ? { quoted: m } : {};
            await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);

            // Marca como lido final
            await this.presenceSimulator.simulateTicks(m, true, false);

        } catch (error: any) {
            this.logger.error('❌ Erro ao processar imagem:', error.message);
            this.logger.error(error.stack);
        }
    }

    /**
    * Handle audio message
    */
    async handleAudioMessage(m: any, nome: string, numeroReal: string, replyInfo: any, ehGrupo: boolean): Promise<void> {
        this.logger.info(`🎤 [ÁUDIO] ${nome}`);

        try {
            // Validação de tipo (suporte a viewOnce)
            const tipoMsg = getContentType(m.message);
            let audMsg = m.message.audioMessage;

            if (tipoMsg === 'viewOnceMessage' || tipoMsg === 'viewOnceMessageV2') {
                audMsg = m.message[tipoMsg].message?.audioMessage;
            }

            if (!audMsg) {
                this.logger.error('❌ Mensagem de áudio inválida ou ausente');
                return;
            }

            // Decodifica áudio
            const audioBuffer = await this.mediaProcessor.downloadMedia(
                audMsg,
                'audio'
            );

            await this.handleAudioMessage_internal(m, nome, numeroReal, replyInfo, ehGrupo, audioBuffer);
        } catch (error: any) {
            this.logger.error('❌ Erro ao processar áudio:', error.message);
        }
    }

    /**
     * Lógica interna de áudio (transcrição e resposta)
     */
    async handleAudioMessage_internal(m: any, nome: string, numeroReal: string, replyInfo: any, ehGrupo: boolean, audioBuffer: Buffer | null): Promise<void> {
        try {

            if (!audioBuffer) {
                this.logger.error('❌ Erro ao baixar áudio');
                return;
            }

            // STT
            const transcricao = await this.audioProcessor.speechToText(audioBuffer);

            if (!transcricao.sucesso) {
                this.logger.warn('⚠️ Falha na transcrição');
                return;
            }

            const textoAudio = transcricao.texto;
            this.logger.info(`📝 Transcrição: ${textoAudio.substring(0, 80)}..`);

            // Processa como texto
            await this.handleTextMessage(m, nome, numeroReal, textoAudio, replyInfo, ehGrupo, true);

        } catch (error: any) {
            this.logger.error('❌ Erro ao processar áudio:', error.message);
        }
    }

    /**
    * Handle text message
    */
    async handleTextMessage(m: any, nome: string, numeroReal: string, texto: string, replyInfo: any, ehGrupo: boolean, foiAudio: boolean = false): Promise<void> {
        try {
            // Check rate limit (Spam)
            if (!this.messageProcessor.checkRateLimit(numeroReal)) {
                if (ehGrupo) {
                    await this.handleWarning(m, 'Flood/Spam');
                } else {
                    await this.sock.sendMessage(m.key.remoteJid, {
                        text: '⏰ Você está mandando mensagens muito rápido. Aguarde um pouco.'
                    });
                }
                return;
            }

            // Handle commands centrally (short-circuit if handled)
            try {
                if (this.commandHandler) {
                    const handled = await this.commandHandler.handle(m, { nome, numeroReal, texto, replyInfo, ehGrupo });
                    if (handled) {
                        this.logger.info(`⚡ Comando tratado: ${texto.substring(0, 30)}..`);

                        // Premiar XP por comando (opcional mas bom para engajamento)
                        if (ehGrupo && this.levelSystem) {
                            this.levelSystem.awardXp(m.key.remoteJid, numeroReal, 5);
                        }
                        return;
                    }
                }
            } catch (e: any) {
                this.logger.warn('Erro no CommandHandler:', e.message);
            }

            // Verifica se deve responder
            let deveResponder = false;

            // ═══ DETECÇÃO DE ATIVAÇÃO POR PALAVRA-CHAVE "AKIRA" ═══
            const textoLower = texto.toLowerCase();
            const botNameLower = (this.config.BOT_NAME || 'belmira').toLowerCase();
            const hasBotName = textoLower.includes(botNameLower);

            if (foiAudio) {
                // Audio sempre responde em PV
                if (!ehGrupo) {
                    deveResponder = true;
                } else {
                    // Em grupos, responde se for reply ao bot, menção, ou palavra "akira"
                    if (replyInfo && replyInfo.ehRespostaAoBot) {
                        deveResponder = true;
                    } else if (this.messageProcessor.isBotMentioned(m)) {
                        deveResponder = true;
                    } else if (hasBotName) {
                        deveResponder = true;
                    }
                }
            } else {
                // Texto
                if (replyInfo && replyInfo.ehRespostaAoBot) {
                    deveResponder = true;
                } else if (!ehGrupo) {
                    // ✅ CORREÇÃO: Em PV sempre responde para qualquer mensagem
                    // Removido comportamento anterior que exigia reply ao bot
                    deveResponder = true;
                    this.logger.debug(`✅ [PV] Respondendo a mensagem privada de ${nome}`);
                } else {
                    // Em grupo, responde se mencionado ou se contém palavra "akira"
                    if (this.messageProcessor.isBotMentioned(m)) {
                        deveResponder = true;
                    } else if (hasBotName) {
                        deveResponder = true;
                    }
                }
            }

            if (!deveResponder) {
                this.logger.debug(`⏭️ Mensagem ignorada (sem ativação): ${texto.substring(0, 50)}..`);
                return;
            }

            this.logger.info(`\n🔥 [PROCESSANDO] ${nome}: ${texto.substring(0, 60)}..`);

            // Constrói payload com reply metadata completo (adaptado de akira)
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

            // Premiar XP por mensagem de texto
            if (ehGrupo && this.levelSystem) {
                this.levelSystem.awardXp(m.key.remoteJid, numeroReal, 10);
            }

            const payload = this.apiClient.buildPayload({
                usuario: nome,
                numero: numeroReal,
                mensagem: texto,
                tipo_conversa: ehGrupo ? 'grupo' : 'pv',
                grupo_id: ehGrupo ? m.key.remoteJid : null,
                grupo_nome: ehGrupo ? (m.key.remoteJid.split('@')[0] || 'Grupo') : null,
                tipo_mensagem: foiAudio ? 'audio' : 'texto',
                mensagem_citada: (replyInfo && replyInfo.textoMensagemCitada) || '',
                reply_metadata: replyMetadata
            });

            // Chama API
            const resultado = await this.apiClient.processMessage(payload);

            if (!resultado.success) {
                this.logger.error('❌ Erro na API:', resultado.error);
                await this.sock.sendMessage(m.key.remoteJid, {
                    text: 'Eita! Tive um problema aqui. Tenta de novo em um segundo?'
                });
                return;
            }

            let resposta = resultado.resposta || 'Sem resposta';

            // TTS se foi áudio (ou se quiser forçar áudio para certas respostas)
            if (foiAudio) {
                this.logger.info('🎤 [AUDIO RESPONSE] Iniciando fluxo de resposta por áudio...');

                // 1. Inicia presença "gravando" IMEDIATAMENTE
                if (this.presenceSimulator) {
                    await this.presenceSimulator.safeSendPresenceUpdate('recording', m.key.remoteJid);
                }

                try {
                    // 2. Gera o áudio (TTS) ENQUANTO aparece "gravando"
                    const ttsResult = await this.audioProcessor.textToSpeech(resposta);

                    if (!ttsResult.sucesso) {
                        this.logger.warn('⚠️ Falha no TTS, enviando texto como fallback');
                        if (this.presenceSimulator) await this.presenceSimulator.safeSendPresenceUpdate('paused', m.key.remoteJid);
                        await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, { quoted: m });
                    } else {
                        // 3. Envia o áudio como PTT (Voice Note)
                        this.logger.info('📤 Enviando Voice Note...');
                        await this.sock.sendMessage(m.key.remoteJid, {
                            audio: ttsResult.buffer,
                            mimetype: ttsResult.mimetype || 'audio/ogg; codecs=opus',
                            ptt: true // Is Voice Note
                        }, { quoted: m });

                        this.logger.info('✅ Voice Note enviada com sucesso');
                    }
                } catch (ttsErr: any) {
                    this.logger.error('❌ Erro crítico no fluxo de TTS:', ttsErr);
                    // Fallback
                    await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, { quoted: m });
                } finally {
                    // 4. Garante que para de gravar
                    if (this.presenceSimulator) {
                        await this.presenceSimulator.safeSendPresenceUpdate('paused', m.key.remoteJid);
                    }
                }

                // Marca como lido final se ter simulador
                if (this.presenceSimulator) {
                    await this.presenceSimulator.markAsRead(m);
                }
            } else {
                // Simula comportamento completo para TEXTO (digitação + resposta + ticks)
                if (this.presenceSimulator) {
                    await this.presenceSimulator.simulateFullResponse(this.sock, m, resposta, false);
                } else {
                    // Fallback se simulator não estiver pronto
                    await this.simulateTyping(m.key.remoteJid, Math.min(resposta.length * 50, 5000));
                }

                // Lógica de Reply Otimizada (PV)
                const opcoes = ehGrupo ? { quoted: m } : (replyInfo) ? { quoted: m } : {};

                await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);

                // Marca como lido final se ter simulador
                if (this.presenceSimulator) {
                    await this.presenceSimulator.markAsRead(m);
                }
            }


            this.logger.info(`✅ [RESPONDIDO] ${resposta.substring(0, 80)}..\n`);

        } catch (error: any) {
            this.logger.error('❌ Erro ao processar texto:', error.message);
        }
    }

    /**
    * Simula digitação
    */
    async simulateTyping(jid: string, durationMs: number): Promise<void> {
        try {
            if (!this.sock) return;
            await this.sock.sendPresenceUpdate('available', jid);
            await delay(300);
            await this.sock.sendPresenceUpdate('composing', jid);
            await delay(durationMs);
            await this.sock.sendPresenceUpdate('paused', jid);
        } catch (e: any) {
            // Ignora erros de presença silenciosamente
            this.logger.debug('Erro na simulação de digitação:', e.message);
        }
    }

    /**
    * Helper method para enviar replies (usado pelo CommandHandler)
    */
    async reply(m: any, text: string, options: any = {}): Promise<any> {
        try {
            if (!this.sock) {
                this.logger.warn('⚠️ Socket não disponível para enviar reply');
                return false;
            }

            const jid = m.key.remoteJid;
            return await this.sock.sendMessage(jid, { text, ...options }, { quoted: m });
        } catch (error: any) {
            this.logger.error('❌ Erro ao enviar reply:', error.message);
            return false;
        }
    }

    /**
    * Handle muted user
    */
    async handleMutedUserMessage(m: any, nome: string): Promise<void> {
        try {
            this.logger.warn(`🔇 Usuário ${nome} tentou falar durante mute`);

            await this.sock.groupParticipantsUpdate(
                m.key.remoteJid,
                [m.key.participant],
                'remove'
            );

            await this.sock.sendMessage(m.key.remoteJid, {
                text: `🚫 *${nome} foi removido por enviar mensagem durante período de mute!*`
            });

        } catch (error) {
            this.logger.error('❌ Erro ao remover usuário mutado:', error.message);
        }
    }

    /**
    * Handle antilink violation
    */
    async handleAntiLinkViolation(m: any, nome: string): Promise<void> {
        try {
            if (!this.sock) return;
            const jid = m.key.remoteJid;
            const participant = m.key.participant;

            this.logger.warn(`🔗 [ANTI-LINK] ${nome} enviou link`);

            await this.reply(m, `🚫 @${participant.split('@')[0]}, links não são permitidos neste grupo!`, { mentions: [participant] });

            // Deletar mensagem
            await this.sock.sendMessage(jid, { delete: m.key });

            // Kickar usuário (Anti-Link Pro)
            await delay(1000);
            await this.sock.groupParticipantsUpdate(jid, [participant], 'remove');

        } catch (error: any) {
            this.logger.error('❌ Erro ao banir por link:', error.message);
        }
    }

    /**
     * Limpa credenciais em caso de erro de autenticação
     */
    _cleanAuthOnError(): void {
        try {
            if (fs.existsSync(this.config.AUTH_FOLDER)) {
                fs.rmSync(this.config.AUTH_FOLDER, { recursive: true, force: true });
                this.logger.info('🧹 Credenciais limpas devido a erro de autenticação');
            }
            this.isConnected = false;
            this.currentQR = null;
            this.BOT_JID = null;
            this.reconnectAttempts = 0;
        } catch (error: any) {
            this.logger.error('❌ Erro ao limpar credenciais:', error.message);
        }
    }

    /**
     * Força geração de QR code se não vier automaticamente
     */
    async _forceQRGeneration(): Promise<void> {
        try {
            this.logger.info('🔄 Forçando geração de QR code..');

            this.currentQR = null;
            this.isConnected = false;

            if (this.sock) {
                try {
                    this.sock.ev.removeAllListeners();
                    if (this.sock.ws) {
                        this.sock.ws.close();
                    }
                } catch (e: any) {
                    this.logger.warn('Erro ao limpar socket:', e.message);
                }
                this.sock = null;
            }

            if (this.qrTimeout) {
                clearTimeout(this.qrTimeout);
                this.qrTimeout = null;
            }

            await delay(3000);
            await this.connect();

        } catch (error: any) {
            this.logger.error('❌ Erro ao forçar QR:', error.message);
        }
    }

    /**
     * Obtém QR Code atual
     */
    getQRCode(): string | null {
        try {
            if (this.isConnected) return null;
            if (this.currentQR) return this.currentQR;

            if (this.sock && this.sock.ws) {
                const state = this.sock.ws.readyState;
                if (state === 0 || state === 1) return null;
            }

            return null;
        } catch (error: any) {
            this.logger.error('❌ Erro ao obter QR code:', error.message);
            return null;
        }
    }

    /**
     * Obtém status
     */
    getStatus(): any {
        return {
            isConnected: this.isConnected,
            botJid: this.BOT_JID,
            botNumero: this.config.BOT_NUMERO_REAL,
            botName: this.config.BOT_NAME,
            version: this.config.BOT_VERSION,
            uptime: Math.floor(process.uptime()),
            hasQR: !!this.currentQR,
            reconnectAttempts: this.reconnectAttempts,
            connectionStartTime: this.connectionStartTime
        };
    }

    /**
     * Retorna estatísticas
     */
    getStats(): any {
        const status = this.getStatus();
        return {
            ...status,
            api: this.apiClient?.getStats() || { error: 'API não inicializada' },
            audio: this.audioProcessor?.getStats() || { error: 'AudioProcessor não inicializado' },
            media: this.mediaProcessor?.getStats() || { error: 'MediaProcessor não inicializado' },
            message: this.messageProcessor?.getStats() || { error: 'MessageProcessor não inicializado' },
            moderation: this.moderationSystem?.getStats() || { error: 'ModerationSystem não inicializado' },
            leveling: this.levelSystem?.getStats() || { error: 'LevelSystem não inicializado' },
            componentsInitialized: {
                apiClient: !!this.apiClient,
                audioProcessor: !!this.audioProcessor,
                mediaProcessor: !!this.mediaProcessor,
                messageProcessor: !!this.messageProcessor,
                moderationSystem: !!this.moderationSystem,
                levelSystem: !!this.levelSystem,
                commandHandler: !!this.commandHandler
            }
        };
    }

    /**
     * Registra event listeners
     */
    on(event: string, callback: any): void {
        if (event === 'qr') {
            this.eventListeners.onQRGenerated = callback;
        } else if (event === 'connected') {
            this.eventListeners.onConnected = callback;
        } else if (event === 'disconnected') {
            this.eventListeners.onDisconnected = callback;
        } else {
            this.logger.warn(`⚠️ Evento não suportado: ${event}`);
        }
    }

    /**
     * Limpa cache de componentes
     */
    clearCache(): void {
        try {
            this.audioProcessor?.clearCache?.();
            this.mediaProcessor?.clearCache?.();
            this.messageProcessor?.clearCache?.();
            this.logger.info('✅ Cache limpo');
        } catch (error: any) {
            this.logger.error('❌ Erro ao limpar cache:', error.message);
        }
    }

    /**
     * Verifica se o bot está pronto
     */
    isReady(): boolean {
        return this.isConnected && !!this.sock?.ws && this.sock.ws.readyState === 1;
    }

    /**
     * Desconecta o bot
     */
    async disconnect(): Promise<void> {
        try {
            this.logger.info('🔴 Desconectando bot..');

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
            this.currentQR = null;
            this.BOT_JID = null;

            this.logger.info('✅ Bot desconectado');
        } catch (error: any) {
            this.logger.error('❌ Erro ao desconectar:', error.message);
        }
    }
    // ═══ HANDLERS DE VIOLAÇÃO DE MODERAÇÃO ═══

    async handleAntiMediaViolation(m: any, tipo: string): Promise<void> {
        if (!this.sock) return;
        const jid = m.key.remoteJid;
        const participant = m.key.participant;

        this.logger.warn(`🚫 [ANTI-MEDIA] ${tipo.toUpperCase()} bloqueado de ${participant}`);

        // Deletar mensagem
        await this.sock.sendMessage(jid, { delete: m.key });
    }

    async handleWarning(m: any, reason: string): Promise<void> {
        if (!this.sock || !this.moderationSystem) return;
        const jid = m.key.remoteJid;
        const participant = m.key.participant;
        const nome = m.pushName || 'Usuário';

        const warnCount = this.moderationSystem.addWarning(jid, participant, reason);
        this.logger.warn(`⚠️ [WARN] ${nome} recebeu aviso ${warnCount}/3 por: ${reason}`);

        if (warnCount >= 3) {
            await this.reply(m, `🚫 @${participant.split('@')[0]} atingiu o limite de avisos (3/3) e foi removido.`, { mentions: [participant] });
            await delay(1000);
            await this.sock.groupParticipantsUpdate(jid, [participant], 'remove');
            this.moderationSystem.resetWarnings(jid, participant);
        } else {
            await this.reply(m, `⚠️ @${participant.split('@')[0]}, você recebeu um aviso (${warnCount}/3).\nMotivo: ${reason}`, { mentions: [participant] });
        }
    }
}

export default BotCore;
