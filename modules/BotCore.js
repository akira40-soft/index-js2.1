/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: BotCore
 * ═══════════════════════════════════════════════════════════════════════
 * Núcleo central do bot Akira.
 * Gerencia conexão, eventos do socket, e orquestra os módulos de processamento.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, delay } from '@whiskeysockets/baileys';
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
import PaymentManager from './PaymentManager.js';
import CommandHandler from './CommandHandler.js';
import HFCorrections from './HFCorrections.js';
import PresenceSimulator from './PresenceSimulator.js';
import SubscriptionManager from './SubscriptionManager.js';

class BotCore {
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
    async initialize() {
        try {
            this.logger.info('🚀 Inicializando BotCore...');

            // Aplica correções para HF Spaces se necessário
            HFCorrections.apply();

            // Valida configurações
            this.config.validate();

            // Inicializa componentes
            this.initializeComponents();

            return true;
        } catch (error) {
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
    initializeComponents() {
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

            // Inicializa PaymentManager (passando this para acessar SubscriptionManager depois)
            // Nota: PaymentManager precisa de this.subscriptionManager que já foi init acima
            this.paymentManager = new PaymentManager(this, this.subscriptionManager);

            // Inicializa PresenceSimulator
            this.presenceSimulator = new PresenceSimulator(this.sock || null);

            // CommandHandler pode falhar no Hugging Face, tratar separadamente
            try {
                this.commandHandler = new CommandHandler(this.sock, this.config, this, this.messageProcessor);
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

            this.logger.debug('✅ Componentes inicializados');
        } catch (error) {
            this.logger.error('❌ Erro ao inicializar componentes:', error.message);
            // Não lançar erro fatal, tentar continuar com componentes disponíveis
        }
    }

    /**
     * Atualiza o socket em todos os componentes que dependem dele
     * Chamado após a conexão ser estabelecida
     */
    _updateComponentsSocket(sock) {
        try {
            this.logger.info('🔄 Atualizando socket nos componentes...');

            // Core Handlers
            if (this.commandHandler?.setSocket) this.commandHandler.setSocket(sock);

            // Modules
            // if (this.stickerViewOnceHandler?.setSocket) this.stickerViewOnceHandler.setSocket(sock); // Não existe no código atual
            // if (this.groupManagement?.setSocket) this.groupManagement.setSocket(sock); // Não existe no código atual
            if (this.osintFramework?.setSocket) this.osintFramework.setSocket(sock);

            // Não têm setSocket mas podem precisar (verificar implementações futuras)
            // this.advancedPentestingToolkit não usa socket no código atual

            this.logger.info('✅ Socket injetado nos componentes com sucesso');
        } catch (e) {
            this.logger.error('❌ Erro ao atualizar socket nos componentes:', e);
        }
    }

    /**
    * Estabelece conexão com WhatsApp
    */
    async connect() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.config.AUTH_FOLDER);
            const { version, isLatest } = await fetchLatestBaileysVersion();

            this.logger.info(`📡 Conectando ao WhatsApp v${version.join('.')} (Latest: ${isLatest})`);

            // Configuração do Socket
            const socketConfig = {
                version,
                logger: pino({ level: 'silent' }), // Silencia logs internos do Baileys para limpar console
                printQRInTerminal: true, // Útil para dev local
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                browser: ['Akira Bot', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: true,
                getMessage: async (key) => {
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
            if (this.commandHandler) this.commandHandler.bot = this.sock;
            if (this.presenceSimulator) this.presenceSimulator.sock = this.sock;


            // ═══ EVENTOS DE CONEXÃO ═══
            this.sock.ev.on('connection.update', async (update) => {
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
            this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type !== 'notify') return;

                for (const m of messages) {
                    await this.processMessage(m);
                }
            });

            // ═══ CASOS ESPECIAIS (Call, Group Update, etc) ═══
            // Implementar conforme necessidade...

        } catch (error) {
            this.logger.error('❌ Erro na função connect:', error.message);
            await delay(5000);
            this.connect(); // Tenta de novo em loop seguro
        }
    }

    /**
    * Processa uma única mensagem recebida
    */
    async processMessage(m) {
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

            // Verifica Anti-Link (se tiver texto)
            if (ehGrupo && texto && this.moderationSystem && this.moderationSystem.checkLink(texto, remoteJid, m.key.participant)) {
                await this.handleAntiLinkViolation(m, nome);
                return;
            }

            // Anti-Spam (Rate Limit) -> Verificado dentro do handleTextMessage para economizar calls, 
            // mas poderia ser aqui. Vamos deixar no handleTextMessage para permitir que imagens passem por enquanto ou replicar logica.

            // Extrai informações de Reply
            this.logger.debug('🔹 [PIPELINE] Extraindo replyInfo');
            const replyInfo = this.messageProcessor.extractReplyInfo(m);
            this.logger.debug('🔹 [PIPELINE] ReplyInfo extraído, iniciando roteamento');

            // Roteamento de tipos
            if (temImagem) {
                await this.handleImageMessage(m, nome, numeroReal, replyInfo, ehGrupo);
            } else if (temAudio) {
                await this.handleAudioMessage(m, nome, numeroReal, replyInfo, ehGrupo);
            } else if (texto) {
                await this.handleTextMessage(m, nome, numeroReal, texto, replyInfo, ehGrupo);
            } else {
                // Outros tipos (stickers, videos, documentos) - por enquanto ignora ou loga
                // this.logger.debug('Tipo de mensagem não tratado:', Object.keys(m.message));
            }

        } catch (error) {
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
    async handleImageMessage(m, nome, numeroReal, replyInfo, ehGrupo) {
        this.logger.info(`🖼️ [IMAGEM] Iniciando processamento para ${nome}`);

        try {
            // Marca como entregue/lido
            await this.presenceSimulator.simulateTicks(m, true, false);

            // Simula "olhando" a imagem (digitação breve)
            await this.presenceSimulator.simulateTyping(m.key.remoteJid, 1500);

            // Validação prévia da mensagem
            if (!m.message || !m.message.imageMessage) {
                this.logger.error('❌ Mensagem de imagem inválida ou ausente');
                await this.reply(m, '❌ Formato de imagem não suportado...');
                return;
            }

            this.logger.debug('⬇️ Baixando e decifrando imagem...');
            this.logger.debug(`📋 MimeType: ${m.message.imageMessage.mimetype || 'desconhecido'}`);
            this.logger.debug(`📏 Tamanho relatado: ${m.message.imageMessage.fileLength || 'desconhecido'} bytes`);

            // Baixa a imagem (MediaProcessor cuida da decifragem usando chaves da mensagem)
            const imageBuffer = await this.mediaProcessor.downloadMedia(
                m.message.imageMessage,
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
            } catch (conversionError) {
                this.logger.error('❌ Erro na conversão base64:', conversionError.message);
                await this.reply(m, '❌ Erro ao processar imagem...');
                return;
            }

            this.logger.debug('🔄 Convertido para Base64. Preparando payload...');

            // Prepara payload para Computer Vision
            const caption = this.messageProcessor.extractText(m) || '';

            const payload = this.apiClient.buildPayload({
                usuario: nome,
                numero: numeroReal,
                mensagem: caption || 'O que tem nesta imagem?', // Prompt default se vazio
                tipo_conversa: ehGrupo ? 'grupo' : 'pv',
                grupo_id: ehGrupo ? m.key.remoteJid : null,
                grupo_nome: ehGrupo ? (m.key.remoteJid.split('@')[0] || 'Grupo') : null,
                tipo_mensagem: 'imagem', // Importante para API saber que deve usar CV
                imagem_base64: base64Image, // Campo específico para imagem
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

        } catch (error) {
            this.logger.error('❌ Erro ao processar imagem:', error.message);
            this.logger.error(error.stack);
        }
    }

    /**
    * Handle audio message
    */
    async handleAudioMessage(m, nome, numeroReal, replyInfo, ehGrupo) {
        this.logger.info(`🎤 [ÁUDIO] ${nome}`);

        try {
            // Decodifica áudio
            const audioBuffer = await this.mediaProcessor.downloadMedia(
                m.message.audioMessage,
                'audio'
            );

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

        } catch (error) {
            this.logger.error('❌ Erro ao processar áudio:', error.message);
        }
    }

    /**
    * Handle text message
    */
    async handleTextMessage(m, nome, numeroReal, texto, replyInfo, ehGrupo, foiAudio = false) {
        try {
            // Check rate limit
            if (!this.messageProcessor.checkRateLimit(numeroReal)) {
                await this.sock.sendMessage(m.key.remoteJid, {
                    text: '⏰ Você está usando comandos muito rápido.o. Aguarde um pouco.o.'
                });
                return;
            }

            // Handle commands centrally (short-circuit if handled)
            try {
                if (this.commandHandler) {
                    const handled = await this.commandHandler.handle(m, { nome, numeroReal, texto, replyInfo, ehGrupo });
                    if (handled) {
                        this.logger.info(`⚡ Comando tratado: ${texto.substring(0, 30)}..`);
                        return;
                    }
                }
            } catch (e) {
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

            // TTS se foi áudio
            if (foiAudio) {
                const ttsResult = await this.audioProcessor.textToSpeech(resposta);
                if (!ttsResult.sucesso) {
                    await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, { quoted: m });
                } else {
                    await this.sock.sendMessage(m.key.remoteJid, {
                        audio: ttsResult.buffer,
                        mimetype: 'audio/mp4',
                        ptt: true
                    }, { quoted: m });
                }
            } else {
                // Simula comportamento completo (digitação + resposta + ticks)
                // Usa o novo PresenceSimulator
                if (this.presenceSimulator) {
                    await this.presenceSimulator.simulateFullResponse(this.sock, m, resposta, false);
                } else {
                    // Fallback se simulator não estiver pronto
                    await this.simulateTyping(m.key.remoteJid, Math.min(resposta.length * 50, 5000));
                }

                // Lógica de Reply Otimizada
                // Grupos: SEMPRE reply (contexto visual obrigatório)
                // PV: Reply apenas se usuário respondeu em reply ao bot
                const opcoes = ehGrupo ? { quoted: m } : (replyInfo && replyInfo.ehRespostaAoBot) ? { quoted: m } : {};

                await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);

                // Marca como lido final se ter simulador
                if (this.presenceSimulator) {
                    await this.presenceSimulator.markAsRead(m);
                }
            }


            this.logger.info(`✅ [RESPONDIDO] ${resposta.substring(0, 80)}..\n`);

        } catch (error) {
            this.logger.error('❌ Erro ao processar texto:', error.message);
        }
    }

    /**
    * Simula digitação
    */
    async simulateTyping(jid, durationMs) {
        try {
            await this.sock.sendPresenceUpdate('available', jid);
            await delay(300);
            await this.sock.sendPresenceUpdate('composing', jid);
            await delay(durationMs);
            await this.sock.sendPresenceUpdate('paused', jid);
        } catch (e) {
            // Ignora erros de presença silenciosamente
            this.logger.debug('Erro na simulação de digitação:', e.message);
        }
    }

    /**
    * Helper method para enviar replies (usado pelo CommandHandler)
    */
    async reply(m, text, options = {}) {
        try {
            if (!this.sock) {
                this.logger.warn('⚠️ Socket não disponível para enviar reply');
                return false;
            }

            const jid = m.key.remoteJid;
            await this.sock.sendMessage(jid, { text }, { quoted: m, ...options });
            return true;
        } catch (error) {
            this.logger.error('❌ Erro ao enviar reply:', error.message);
            return false;
        }
    }

    /**
    * Handle muted user
    */
    async handleMutedUserMessage(m, nome) {
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
    async handleAntiLinkViolation(m, nome) {
        try {
            this.logger.warn(`🔗 [ANTI-LINK] ${nome} enviou link`);

            await this.sock.groupParticipantsUpdate(
                m.key.remoteJid,
                [m.key.participant],
                'remove'
            );

            await this.sock.sendMessage(m.key.remoteJid, {
                text: `🚫 *${nome} foi removido por enviar link!*\n🔒 Anti-link está ativado neste grupo.o.`
            });

        } catch (error) {
            this.logger.error('❌ Erro ao banir por link:', error.message);
        }
    }

    /**
    * Limpa credenciais em caso de erro de autenticação
    */
    _cleanAuthOnError() {
        try {
            if (fs.existsSync(this.config.AUTH_FOLDER)) {
                fs.rmSync(this.config.AUTH_FOLDER, { recursive: true, force: true });
                this.logger.info('🧹 Credenciais limpas devido a erro de autenticação');
            }
            this.isConnected = false;
            this.currentQR = null;
            this.BOT_JID = null;
            this.reconnectAttempts = 0;
        } catch (error) {
            this.logger.error('❌ Erro ao limpar credenciais:', error.message);
        }
    }

    /**
    * Força geração de QR code se não vier automaticamente
    */
    async _forceQRGeneration() {
        try {
            this.logger.info('🔄 Forçando geração de QR code..');

            // Limpa estado atual
            this.currentQR = null;
            this.isConnected = false;

            if (this.sock) {
                try {
                    this.sock.ev.removeAllListeners();
                    if (this.sock.ws) {
                        this.sock.ws.close();
                    }
                } catch (e) {
                    this.logger.warn('Erro ao limpar socket:', e.message);
                }
                this.sock = null;
            }

            // Limpa timeout se existir
            if (this.qrTimeout) {
                clearTimeout(this.qrTimeout);
                this.qrTimeout = null;
            }

            // Pequeno delay antes de reconectar
            await delay(3000);

            // Reconecta
            await this.connect();

        } catch (error) {
            this.logger.error('❌ Erro ao forçar QR:', error.message);
        }
    }

    /**
    * Obtém QR Code atual
    */
    getQRCode() {
        try {
            // Se já está conectado, não precisa de QR
            if (this.isConnected) {
                this.logger.debug('✅ Bot já conectado, sem necessidade de QR code');
                return null;
            }

            // Se tem QR code armazenado, retorna
            if (this.currentQR) {
                this.logger.debug(`📱 QR code disponível (${this.currentQR.length} caracteres)`);
                return this.currentQR;
            }

            // Se não está conectado e não tem QR, verifica estado
            this.logger.debug('🔄 Bot não conectado e sem QR code disponível');

            // Verifica se a conexão está em andamento
            if (this.sock && this.sock.ws) {
                const state = this.sock.ws.readyState;
                if (state === 0) { // CONNECTING
                    this.logger.debug('🔄 Conexão em andamento.. aguarde QR code');
                    return null;
                } else if (state === 1) { // OPEN
                    this.logger.debug('✅ Conexão já aberta, mas isConnected não atualizado');
                    return null;
                }
            }

            // Se chegou aqui, precisa reconectar
            this.logger.debug('⚠️ Bot desconectado e sem QR. Talvez seja necessário reiniciar a conexão.');
            return null;

        } catch (error) {
            this.logger.error('❌ Erro ao obter QR code:', error.message);
            return null;
        }
    }

    /**
    * Obtém status
    */
    getStatus() {
        return {
            isConnected: this.isConnected,
            botJid: this.BOT_JID,
            botNumero: this.config.BOT_NUMERO_REAL,
            botName: this.config.BOT_NAME,
            version: this.config.BOT_VERSION,
            uptime: Math.floor(process.uptime()),
            hasQR: this.currentQR !== null && this.currentQR !== undefined,
            reconnectAttempts: this.reconnectAttempts,
            connectionStartTime: this.connectionStartTime
        };
    }

    /**
    * Retorna estatísticas
    */
    getStats() {
        const status = this.getStatus();

        return {
            ...status,
            api: this.apiClient ? this.apiClient.getStats() : { error: 'API não inicializada' },
            audio: this.audioProcessor ? this.audioProcessor.getStats() : { error: 'AudioProcessor não inicializado' },
            media: this.mediaProcessor ? this.mediaProcessor.getStats() : { error: 'MediaProcessor não inicializado' },
            message: this.messageProcessor ? this.messageProcessor.getStats() : { error: 'MessageProcessor não inicializado' },
            moderation: this.moderationSystem ? this.moderationSystem.getStats() : { error: 'ModerationSystem não inicializado' },
            leveling: this.levelSystem ? this.levelSystem.getStats() : { error: 'LevelSystem não inicializado' },
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
    on(event, callback) {
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
    clearCache() {
        try {
            if (this.audioProcessor && typeof this.audioProcessor.clearCache === 'function') {
                this.audioProcessor.clearCache();
            }
            if (this.mediaProcessor && typeof this.mediaProcessor.clearCache === 'function') {
                this.mediaProcessor.clearCache();
            }
            if (this.messageProcessor && typeof this.messageProcessor.clearCache === 'function') {
                this.messageProcessor.clearCache();
            }
            this.logger.info('✅ Cache limpo');
        } catch (error) {
            this.logger.error('❌ Erro ao limpar cache:', error.message);
        }
    }

    /**
    * Verifica se o bot está pronto
    */
    isReady() {
        return this.isConnected && this.sock && this.sock.ws && this.sock.ws.readyState === 1;
    }

    /**
    * Desconecta o bot
    */
    async disconnect() {
        try {
            this.logger.info('🔴 Desconectando bot..');

            if (this.sock) {
                try {
                    this.sock.ev.removeAllListeners();
                    if (this.sock.ws) {
                        this.sock.ws.close();
                    }
                } catch (e) {
                    this.logger.warn('Erro ao limpar socket:', e.message);
                }
                this.sock = null;

            }

            this.isConnected = false;
            this.currentQR = null;
            this.BOT_JID = null;

            this.logger.info('✅ Bot desconectado');
        } catch (error) {
            this.logger.error('❌ Erro ao desconectar:', error.message);
        }
    }
}

export default BotCore;
