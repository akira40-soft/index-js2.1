/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: BotCore
 * ═══════════════════════════════════════════════════════════════════════
 * Núcleo do bot: Baileys wrapper, event handling, orquestração
 * Main loop e gerenciamento de conexão
 * ═══════════════════════════════════════════════════════════════════════
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  delay,
  getContentType
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const ConfigManager = require('./ConfigManager');
const APIClient = require('./APIClient');
const AudioProcessor = require('./AudioProcessor');
const MediaProcessor = require('./MediaProcessor');
const MessageProcessor = require('./MessageProcessor');
const ModerationSystem = require('./ModerationSystem');
const LevelSystem = require('./LevelSystem');
const CommandHandler = require('./CommandHandler');

class BotCore {
  constructor() {
    this.config = ConfigManager.getInstance();
    this.logger = pino({ level: this.config.LOG_LEVEL });

    // Componentes
    this.apiClient = new APIClient(this.logger);
    this.audioProcessor = new AudioProcessor(this.logger);
    this.mediaProcessor = new MediaProcessor(this.logger);
    this.messageProcessor = new MessageProcessor(this.logger);
    this.moderationSystem = new ModerationSystem(this.logger);
    this.levelSystem = new LevelSystem(this.logger);
    this.commandHandler = new CommandHandler(this);

    // Estado
    this.sock = null;
    this.BOT_JID = null;
    this.currentQR = null;
    this.isConnected = false;
    this.lastProcessedTime = 0;
    this.processadas = new Set();
    this.reconnectAttempts = 0;

    // Armazenamento
    this.store = null;
  }

  /**
   * Inicializa o bot
   */
  async initialize() {
    try {
      this.logger.info('🔧 Inicializando BotCore...');

      // Valida configurações
      if (!this.config.validate()) {
        throw new Error('Configurações inválidas');
      }

      // Cria pastas necessárias
      this.ensureFolders();

      this.logger.info('✅ BotCore inicializado');
      return true;

    } catch (error) {
      this.logger.error('❌ Erro ao inicializar:', error.message);
      throw error;
    }
  }

  /**
   * Cria pastas necessárias
   */
  ensureFolders() {
    const fs = require('fs');
    const folders = [
      this.config.TEMP_FOLDER,
      this.config.AUTH_FOLDER,
      this.config.DATABASE_FOLDER,
      this.config.LOGS_FOLDER
    ];

    folders.forEach(folder => {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        this.logger.debug(`📁 Pasta criada: ${folder}`);
      }
    });
  }

  /**
   * Verifica e limpa credenciais antigas se necessário
   */
  async _checkAndCleanOldAuth() {
    const fs = require('fs');
    const path = require('path');

    const authPath = this.config.AUTH_FOLDER;
    const credsPath = path.join(authPath, 'creds.json');

    try {
      if (fs.existsSync(credsPath)) {
        const stats = fs.statSync(credsPath);
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

        // Se as credenciais têm mais de 24 horas, força novo login
        if (ageHours > 24) {
          this.logger.warn(`🧹 Credenciais antigas detectadas (${ageHours.toFixed(1)}h). Forçando novo login...`);
          fs.rmSync(authPath, { recursive: true, force: true });
          this.isConnected = false;
          this.currentQR = null;
          return;
        }

        // Verifica se o arquivo de credenciais é válido
        const credsContent = fs.readFileSync(credsPath, 'utf8');
        const creds = JSON.parse(credsContent);

        if (!creds || !creds.me) {
          this.logger.warn('📄 Credenciais inválidas detectadas. Forçando novo login...');
          fs.rmSync(authPath, { recursive: true, force: true });
          this.isConnected = false;
          this.currentQR = null;
          return;
        }

        this.logger.info('✅ Credenciais válidas encontradas');
      } else {
        this.logger.info('📱 Nenhuma credencial salva. Aguardando QR code...');
        this.isConnected = false;
      }
    } catch (error) {
      this.logger.warn('⚠️ Erro ao verificar credenciais:', error.message);
      // Em caso de erro, limpa tudo e força novo login
      try {
        if (fs.existsSync(authPath)) {
          fs.rmSync(authPath, { recursive: true, force: true });
        }
      } catch (e) { }
      this.isConnected = false;
      this.currentQR = null;
    }
  }

  /**
   * Conecta ao WhatsApp
   */
  async connect() {
    try {
      // Evita múltiplas conexões simultâneas
      if (this.sock && this.sock.ws && this.sock.ws.readyState === 1) {
        this.logger.info('🔄 Já conectado, ignorando tentativa de reconexão');
        return;
      }

      this.logger.info('🔗 Conectando ao WhatsApp...');

      // Verifica conectividade de rede antes de tentar conectar
      await this._checkNetworkConnectivity();

      // Verifica se devemos limpar credenciais antigas
      await this._checkAndCleanOldAuth();

      const { state, saveCreds } = await useMultiFileAuthState(this.config.AUTH_FOLDER);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS(this.config.BOT_NAME),
        markOnlineOnConnect: true,
        syncFullHistory: false,
        printQRInTerminal: false,
        connectTimeoutMs: 120000, // Aumentado para 2 minutos
        qrTimeout: 90000, // 90 segundos para QR
        defaultQueryTimeoutMs: 60000,
        // Configurações para ambientes com conectividade limitada
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 5000,
        maxRetries: 5,
        // Configurações específicas para ambientes restritos
        agent: this._createCustomAgent(),
        getMessage: async (key) => {
          if (!key) return undefined;
          try {
            if (this.store && typeof this.store.loadMessage === 'function') {
              const msg = await this.store.loadMessage(key.remoteJid, key.id);
              return msg ? msg.message : undefined;
            }
          } catch (e) { }
          return undefined;
        }
      });

      // Vincula store
      try {
        if (this.store && typeof this.store.bind === 'function') {
          this.store.bind(this.sock.ev);
        }
      } catch (e) { }

      // Event listeners
      this.sock.ev.on('creds.update', saveCreds);
      this.sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
      this.sock.ev.on('messages.upsert', this.handleMessagesUpsert.bind(this));

      // Timeout para forçar geração de QR se não vier automaticamente
      this.qrTimeout = setTimeout(() => {
        if (!this.currentQR && !this.isConnected) {
          this.logger.warn('⏰ QR não gerado automaticamente. Tentando forçar...');
          this._forceQRGeneration();
        }
      }, 10000); // 10 segundos

      this.logger.info('✅ Conexão inicializada');

    } catch (error) {
      this.logger.error('❌ Erro na conexão:', error.message);
      throw error;
    }
  }

  /**
   * Handle connection update
   */
  async handleConnectionUpdate(update) {
    try {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.currentQR = qr;
        this.logger.info('📱 QR Code gerado - pronto para scan!');
        this.logger.info('🔗 Acesse http://localhost:7860/qr para ver o QR code');

        // Limpa timeout de força
        if (this.qrTimeout) {
          clearTimeout(this.qrTimeout);
          this.qrTimeout = null;
        }
      }

      if (connection === 'open') {
        this.BOT_JID = (this.sock.user && this.sock.user.id) || null;
        this.isConnected = true;
        this.lastProcessedTime = Date.now();
        this.currentQR = null;
        this.reconnectAttempts = 0; // Reseta contador de tentativas

        // Limpa timeout de força
        if (this.qrTimeout) {
          clearTimeout(this.qrTimeout);
          this.qrTimeout = null;
        }

        this.logger.info('\n' + '═'.repeat(70));
        this.logger.info('✅ AKIRA BOT V21 ONLINE!');
        this.logger.info('═'.repeat(70));
        this.config.logConfig();
        this.logger.info('═'.repeat(70) + '\n');

      } else if (connection === 'close') {
        this.isConnected = false;
        const code = (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode) || undefined;
        const reason = (lastDisconnect && lastDisconnect.error && lastDisconnect.error.message) || 'desconhecido';

        this.logger.warn(`⚠️  Conexão perdida (código: ${code}, motivo: ${reason})`);

        // Códigos de erro específicos
        if (code === 408) {
          this.logger.warn('⏰ Timeout de conexão - possível problema de rede');
        } else if (code === 401) {
          this.logger.warn('🔐 Credenciais rejeitadas - será necessário novo login');
          // Limpa credenciais em caso de auth error
          this._cleanAuthOnError();
        } else if (code === 403) {
          this.logger.warn('🚫 Conta banida ou bloqueada');
        }

        // Reconecta com backoff exponencial
        const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts || 0), 30000);
        this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;

        this.logger.info(`🔄 Reconectando em ${delay / 1000}s... (tentativa ${this.reconnectAttempts})`);
        setTimeout(() => this.connect().catch(e => this.logger.error('Erro na reconexão:', e)), delay);

      } else if (connection === 'connecting') {
        this.logger.info('🔄 Conectando ao WhatsApp...');
      }

    } catch (error) {
      this.logger.error('❌ Erro em handleConnectionUpdate:', error.message);
    }
  }

  /**
   * Handle messages upsert
   */
  async handleMessagesUpsert({ messages }) {
    try {
      const m = messages[0];
      if (!m || !m.message || m.key.fromMe) return;

      // Deduplicação
      if (this.processadas.has(m.key.id)) return;
      this.processadas.add(m.key.id);
      setTimeout(() => this.processadas.delete(m.key.id), this.config.MESSAGE_DEDUP_TIME_MS);

      // Ignorar mensagens antigas
      if (m.messageTimestamp && m.messageTimestamp * 1000 < this.lastProcessedTime - 10000) {
        return;
      }

      // Processa mensagem
      await this.processMessage(m);

    } catch (error) {
      this.logger.error('❌ Erro em handleMessagesUpsert:', error.message);
    }
  }

  /**
   * Processa mensagem
   */
  async processMessage(m) {
    try {
      const ehGrupo = String(m.key.remoteJid || '').endsWith('@g.us');
      const numeroReal = this.messageProcessor.extractUserNumber(m);
      const nome = m.pushName || numeroReal;
      const texto = this.messageProcessor.extractText(m).trim();
      const temAudio = this.messageProcessor.hasAudio(m);
      const temImagem = this.messageProcessor.hasImage(m);

      // Verifica ban
      if (this.moderationSystem.isBanned(numeroReal)) {
        this.logger.warn(`🚫 Mensagem de usuário banido ignorada: ${nome}`);
        return;
      }

      // Verifica spam
      if (this.moderationSystem.checkSpam(numeroReal)) {
        this.logger.warn(`⚠️  Spam detectado de ${nome}`);
        return;
      }

      // Moderação em grupos
      if (ehGrupo && m.key.participant) {
        if (this.moderationSystem.isUserMuted(m.key.remoteJid, m.key.participant)) {
          await this.handleMutedUserMessage(m, nome);
          return;
        }

        if (this.moderationSystem.isAntiLinkActive(m.key.remoteJid) && texto && this.moderationSystem.containsLink(texto)) {
          await this.handleAntiLinkViolation(m, nome);
          return;
        }
      }

      // Award group XP (auto XP system)
      try {
        if (ehGrupo && this.config.FEATURE_LEVELING) {
          const uid = m.key.participant || m.key.remoteJid;
          const xpAmount = Math.floor(Math.random() * (25 - 15 + 1)) + 15;
          const { rec, leveled } = this.levelSystem.awardXp(m.key.remoteJid, uid, xpAmount);
          if (leveled) {
            const patente = typeof this.getPatente === 'function' ? this.getPatente(rec.level) : `Nível ${rec.level}`;
            await this.sock.sendMessage(m.key.remoteJid, { text: `🎉 @${uid.split('@')[0]} subiu para o nível ${rec.level}! 🏅 ${patente}`, contextInfo: { mentionedJid: [uid] } });
            if (rec.level >= this.levelSystem.maxLevel) {
              const maxRes = await this.levelSystem.registerMaxLevelUser(m.key.remoteJid, uid, m.pushName || uid, this.sock);
              if (maxRes && maxRes.promoted) {
                await this.sock.sendMessage(m.key.remoteJid, { text: `🎊 ${m.pushName || uid} foi promovido automaticamente a ADM!` });
              }
            }
          }
        }
      } catch (e) {
        this.logger.warn('Erro awarding XP:', e.message);
      }

      // Obtém contexto de reply
      const replyInfo = this.messageProcessor.extractReplyInfo(m);

      // Processa áudio
      if (temAudio) {
        await this.handleAudioMessage(m, nome, numeroReal, replyInfo, ehGrupo);
        return;
      }

      // Processa imagem
      if (temImagem) {
        await this.handleImageMessage(m, nome, numeroReal, texto, replyInfo, ehGrupo);
        return;
      }

      // Processa texto
      if (texto) {
        await this.handleTextMessage(m, nome, numeroReal, texto, replyInfo, ehGrupo);
      }

    } catch (error) {
      this.logger.error('❌ Erro ao processar mensagem:', error.message);
    }
  }

  /**
   * Handle audio message
   */
  async handleAudioMessage(m, nome, numeroReal, replyInfo, ehGrupo) {
    this.logger.info(`🎤 [ÁUDIO] ${nome}`);

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
      this.logger.warn('⚠️  Falha na transcrição');
      return;
    }

    const textoAudio = transcricao.texto;
    this.logger.info(`📝 Transcrição: ${textoAudio.substring(0, 80)}...`);

    // Processa como texto
    await this.handleTextMessage(m, nome, numeroReal, textoAudio, replyInfo, ehGrupo, true);
  }

  /**
   * Handle image message
   */
  async handleImageMessage(m, nome, numeroReal, texto, replyInfo, ehGrupo) {
    this.logger.info(`📸 [IMAGEM] ${nome}: ${texto.substring(0, 50)}...`);

    try {
      // Determina onde está a imagem (pode ser view-once)
      let imageMessage = m.message.imageMessage;

      if (!imageMessage) {
        const unwrapped = this.mediaProcessor.detectViewOnce(m.message);
        if (unwrapped && unwrapped.imageMessage) {
          imageMessage = unwrapped.imageMessage;
        }
      }

      if (!imageMessage) {
        this.logger.warn('⚠️ Imagem não encontrada na mensagem');
        return;
      }

      // Download da imagem
      const buffer = await this.mediaProcessor.downloadMedia(imageMessage, 'image');
      if (!buffer) {
        this.logger.error('❌ Erro ao baixar imagem');
        return;
      }

      const base64 = this.mediaProcessor.bufferToBase64(buffer);

      // Constrói payload com imagem
      const payload = {
        usuario: nome,
        numero: numeroReal,
        mensagem: texto || 'O que você vê nessa imagem?',
        tipo_conversa: ehGrupo ? 'grupo' : 'pv',
        tipo_mensagem: 'image',
        mensagem_citada: (replyInfo && replyInfo.textoMensagemCitada) || '',
        reply_metadata: replyInfo ? {
          reply_to_bot: replyInfo.ehRespostaAoBot,
          quoted_author_name: replyInfo.quemEscreveuCitacao || 'desconhecido',
          quoted_author_numero: replyInfo.quemEscreveuCitacao || 'desconhecido',
          quoted_type: replyInfo.tipoMidia || 'texto',
          quoted_text_original: replyInfo.textoMensagemCitada || '',
          context_hint: ''
        } : { is_reply: false, reply_to_bot: false },
        imagem_dados: {
          dados: base64,
          mime_type: imageMessage.mimetype || 'image/jpeg',
          descricao: texto || 'Imagem enviada'
        }
      };

      // Simula digitação (análise de visão demora um pouco mais)
      await this.simulateTyping(m.key.remoteJid, 4000);

      // Chama API
      const resultado = await this.apiClient.processMessage(payload);

      if (!resultado.success) {
        this.logger.error('❌ Erro na API (Vision):', resultado.error);
        await this.sock.sendMessage(m.key.remoteJid, {
          text: 'Epa! Tentei ver a imagem mas meus olhos eletrônicos falharam. Tenta de novo?'
        }, { quoted: m });
        return;
      }

      let resposta = resultado.resposta || 'Não consegui analisar essa imagem.';

      const opcoes = ehGrupo || (replyInfo && replyInfo.ehRespostaAoBot) ? { quoted: m } : {};
      await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);

      this.logger.info(`✅ [IMAGEM RESPONDIDA] ${resposta.substring(0, 80)}...\n`);

    } catch (error) {
      this.logger.error('❌ Erro ao processar imagem:', error.message);
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
          text: '⏰ Você está usando comandos muito rápido. Aguarde um pouco.'
        });
        return;
      }

      // Handle commands centrally (short-circuit if handled)
      try {
        if (this.commandHandler) {
          const handled = await this.commandHandler.handle(m, { nome, numeroReal, texto, replyInfo, ehGrupo });
          if (handled) return;
        }
      } catch (e) {
        this.logger.warn('Erro no CommandHandler:', e.message);
      }

      // Verifica se deve responder
      let deveResponder = false;

      if (foiAudio) {
        // Audio sempre responde em PV
        if (!ehGrupo) {
          deveResponder = true;
        } else {
          // Em grupos, responde se for reply ao bot ou menção
          if (replyInfo && replyInfo.ehRespostaAoBot) {
            deveResponder = true;
          } else if (this.messageProcessor.isBotMentioned(m)) {
            deveResponder = true;
          }
        }
      } else {
        // Texto
        if (replyInfo && replyInfo.ehRespostaAoBot) {
          deveResponder = true;
        } else if (!ehGrupo) {
          // Em PV sempre responde
          deveResponder = true;
        } else {
          // Em grupo, responde se mencionado
          if (this.messageProcessor.isBotMentioned(m)) {
            deveResponder = true;
          }
        }
      }

      if (!deveResponder) {
        this.logger.info(`⏭️  Mensagem ignorada (sem ativação): ${texto.substring(0, 50)}...`);
        return;
      }

      this.logger.info(`\n🔥 [PROCESSANDO] ${nome}: ${texto.substring(0, 60)}...`);

      // Constrói payload
      const payload = this.apiClient.buildPayload({
        usuario: nome,
        numero: numeroReal,
        mensagem: texto,
        tipo_conversa: ehGrupo ? 'grupo' : 'pv',
        tipo_mensagem: foiAudio ? 'audio' : 'texto',
        mensagem_citada: (replyInfo && replyInfo.textoMensagemCitada) || '',
        reply_metadata: replyInfo ? {
          reply_to_bot: replyInfo.ehRespostaAoBot,
          quoted_author_name: replyInfo.quemEscreveuCitacao || 'desconhecido'
        } : { is_reply: false, reply_to_bot: false }
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
        // Simula digitação
        const tempoDigitacao = Math.min(
          Math.max(resposta.length * this.config.TYPING_SPEED_MS, this.config.MIN_TYPING_TIME_MS),
          this.config.MAX_TYPING_TIME_MS
        );

        await this.simulateTyping(m.key.remoteJid, tempoDigitacao);

        const opcoes = ehGrupo || (replyInfo && replyInfo.ehRespostaAoBot) ? { quoted: m } : {};
        await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);
      }

      this.logger.info(`✅ [RESPONDIDO] ${resposta.substring(0, 80)}...\n`);

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
      // Silenciosamente ignora
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
        text: `🚫 *${nome} foi removido por enviar link!*\n🔒 Anti-link está ativado neste grupo.`
      });

    } catch (error) {
      this.logger.error('❌ Erro ao banir por link:', error.message);
    }
  }

  /**
   * Limpa credenciais em caso de erro de autenticação
   */
  _cleanAuthOnError() {
    const fs = require('fs');
    try {
      if (fs.existsSync(this.config.AUTH_FOLDER)) {
        fs.rmSync(this.config.AUTH_FOLDER, { recursive: true, force: true });
        this.logger.info('🧹 Credenciais limpas devido a erro de autenticação');
      }
      this.isConnected = false;
      this.currentQR = null;
      this.BOT_JID = null;
    } catch (error) {
      this.logger.error('❌ Erro ao limpar credenciais:', error.message);
    }
  }

  /**
   * Força geração de QR code se não vier automaticamente
   */
  async _forceQRGeneration() {
    try {
      this.logger.info('🔄 Forçando geração de QR code...');

      if (this.sock) {
        this.sock.ev.removeAllListeners();
        if (this.sock.ws) {
          this.sock.ws.close();
        }
      }

      // Pequeno delay antes de reconectar
      await delay(2000);

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
    // Se não está conectado E não tem QR, significa que precisa de login
    if (!this.isConnected && !this.currentQR) {
      this.logger.warn('⚠️ Bot não conectado e sem QR code. Verifique se as credenciais expiraram.');
    }
    return this.currentQR;
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
      uptime: Math.floor(process.uptime())
    };
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    return {
      ...this.getStatus(),
      api: this.apiClient.getStats(),
      audio: this.audioProcessor.getStats(),
      media: this.mediaProcessor.getStats(),
      message: this.messageProcessor.getStats(),
      moderation: this.moderationSystem.getStats()
    };
  }
}

module.exports = BotCore;
