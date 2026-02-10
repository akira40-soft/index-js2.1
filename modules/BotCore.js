 /**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: BotCore
 * ═══════════════════════════════════════════════════════════════════════
 * Núcleo do bot: Baileys wrapper, event handling, orquestração
 * Main loop e gerenciamento de conexão
 * ═══════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// HF SPACES DNS CORRECTIONS - CORREÇÃO CRÍTICA PARA QR CODE
// ═══════════════════════════════════════════════════════════════════════
import HFCorrections from './HFCorrections.js';

// Inicializa correções DNS para HF Spaces
HFCorrections.configureDNS();

// Função helper para obter IP direto do WhatsApp
function getWhatsAppFallbackIP() {
 return HFCorrections.getWhatsAppIP();
}

import {
 default as makeWASocket,
 useMultiFileAuthState,
 fetchLatestBaileysVersion,
 Browsers,
 delay,
 getContentType
} from '@whiskeysockets/baileys';
import pino from 'pino';
import ConfigManager from './ConfigManager.js';
import APIClient from './APIClient.js';
import AudioProcessor from './AudioProcessor.js';
import MediaProcessor from './MediaProcessor.js';
import MessageProcessor from './MessageProcessor.js';
import ModerationSystem from './ModerationSystem.js';
import LevelSystem from './LevelSystem.js';
import CommandHandler from './CommandHandler.js';
import fs from 'fs';
import path from 'path';

class BotCore {
 constructor() {
 this.config = ConfigManager.getInstance();
 // Pino configuration optimized for Railway - SIMPLIFIED
 // Remove pino-pretty transport to avoid "unable to determine transport target" error
 this.logger = pino({
 level: this.config.LOG_LEVEL || 'info'
 });

 // Componentes
 this.apiClient = null;
 this.audioProcessor = null;
 this.mediaProcessor = null;
 this.messageProcessor = null;
 this.moderationSystem = null;
 this.levelSystem = null;
 this.commandHandler = null;

 // Estado
 this.sock = null;
 this.BOT_JID = null;
 this.currentQR = null;
 this.isConnected = false;
 this.lastProcessedTime = 0;
 this.processadas = new Set();
 this.reconnectAttempts = 0;
 this.qrTimeout = null;
 this.connectionStartTime = null;

 // Armazenamento
 this.store = null;

 // Event listeners
 this.eventListeners = {
 onQRGenerated: null,
 onConnected: null,
 onDisconnected: null
 };
 }

 /**
 * Inicializa o bot
 */
 async initialize() {
 try {
 this.logger.info('🔧 Inicializando BotCore..');
 
 // Log da porta do servidor
 this.logger.info(`🌐 Porta do servidor: ${this.config.PORT}`);

 // Valida configurações
 if (!this.config.validate()) {
 throw new Error('Configurações inválidas');
 }

 // Mostra configurações
 this.config.logConfig();

 // Cria pastas necessárias com tratamento de erro
 this.ensureFolders();

 // Inicializa componentes
 this.initializeComponents();

 this.logger.info('✅ BotCore inicializado');
 return true;

 } catch (error) {
 this.logger.error('❌ Erro ao inicializar:', error.message);
 throw error;
 }
 }

 /**
 * Cria pastas necessárias com tratamento robusto para Hugging Face
 */
 ensureFolders() {
 // Primeiro, tenta os caminhos padrão
 const defaultFolders = [
 this.config.TEMP_FOLDER,
 this.config.AUTH_FOLDER,
 this.config.DATABASE_FOLDER,
 this.config.LOGS_FOLDER
 ];

 // Lista de fallbacks para Hugging Face
 const fallbackBase = '/tmp/akira_data';
 const fallbackFolders = [
 path.join(fallbackBase, 'temp'),
 path.join(fallbackBase, 'auth_info_baileys'),
 path.join(fallbackBase, 'database'),
 path.join(fallbackBase, 'logs')
 ];

 this.logger.info('📁 Criando diretórios necessários..');

 // Tentar criar diretórios padrão primeiro
 let useFallback = false;
 for (let i = 0; i < defaultFolders.length; i++) {
 const folder = defaultFolders[i];
 try {
 if (!fs.existsSync(folder)) {
 fs.mkdirSync(folder, { recursive: true });
 this.logger.debug(`✅ Pasta criada (padrão): ${folder}`);
 } else {
 this.logger.debug(`✅ Pasta já existe: ${folder}`);
 }
 } catch (error) {
 this.logger.warn(`⚠️ Erro ao criar pasta padrão ${folder}: ${error.message}`);
 useFallback = true;
 break;
 }
 }

 // Se falhou em algum diretório padrão, usar fallback para Hugging Face
 if (useFallback) {
 this.logger.info('🔄 Usando diretórios de fallback para Hugging Face Spaces..');
 
 // Primeiro cria a pasta base de fallback
 try {
 if (!fs.existsSync(fallbackBase)) {
 fs.mkdirSync(fallbackBase, { recursive: true });
 this.logger.info(`✅ Pasta base de fallback criada: ${fallbackBase}`);
 }
 } catch (error) {
 this.logger.error(`❌ Erro crítico ao criar pasta base de fallback: ${error.message}`);
 throw error;
 }

 // Cria todas as subpastas de fallback
 fallbackFolders.forEach(folder => {
 try {
 if (!fs.existsSync(folder)) {
 fs.mkdirSync(folder, { recursive: true });
 this.logger.info(`✅ Pasta de fallback criada: ${folder}`);
 }
 } catch (error) {
 this.logger.error(`❌ Erro ao criar pasta de fallback ${folder}: ${error.message}`);
 }
 });

 // Atualiza configurações para usar os caminhos de fallback
 this.config.TEMP_FOLDER = fallbackFolders[0];
 this.config.AUTH_FOLDER = fallbackFolders[1];
 this.config.DATABASE_FOLDER = fallbackFolders[2];
 this.config.LOGS_FOLDER = fallbackFolders[3];
 
 this.logger.info('🔄 Configurações atualizadas para usar caminhos de fallback');
 } else {
 this.logger.info('✅ Todos os diretórios criados com sucesso');
 }
 }

 /**
 * Inicializa todos os componentes
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
 
 // CommandHandler pode falhar no Hugging Face, tratar separadamente
 try {
 this.commandHandler = new CommandHandler(this);
 this.logger.debug('✅ CommandHandler inicializado');
 } catch (commandError) {
 this.logger.warn(`⚠️ CommandHandler falhou: ${commandError.message}`);
 this.logger.warn('⚠️ Continuando sem CommandHandler (modo limitado)');
 this.commandHandler = null;
 }
 
 this.logger.debug('✅ Componentes inicializados');
 } catch (error) {
 this.logger.error('❌ Erro ao inicializar componentes:', error.message);
 // Não lançar erro fatal, tentar continuar com componentes disponíveis
 }
 }

 /**
 * Cria agente HTTP personalizado para ambientes restritos (HF Spaces)
 */
 _createCustomAgent() {
 return HFCorrections.createHFAgent();
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

 this.logger.info(`📄 Credenciais encontradas (${ageHours.toFixed(1)}h atrás)`);

 // REMOVIDO: Limpeza automática após 24h - Mantém conexão estável no HF
 // Credenciais são mantidas indefinidamente para evitar QR code diário

 // Verifica se o arquivo de credenciais é válido
 const credsContent = fs.readFileSync(credsPath, 'utf8');
 const creds = JSON.parse(credsContent);

 if (!creds || !creds.me) {
 this.logger.warn('📄 Credenciais inválidas detectadas. Forçando novo login..');
 fs.rmSync(authPath, { recursive: true, force: true });
 this.isConnected = false;
 this.currentQR = null;
 this.BOT_JID = null;
 return;
 }

 this.logger.info('✅ Credenciais válidas encontradas');
 this.logger.info(`🤖 Bot registrado como: ${creds.me.id || 'Desconhecido'}`);
 } else {
 this.logger.info('📱 Nenhuma credencial salva. Aguardando QR code..');
 this.isConnected = false;
 this.BOT_JID = null;
 }
 } catch (error) {
 this.logger.warn('⚠️ Erro ao verificar credenciais:', error.message);
 // Em caso de erro, limpa tudo e força novo login
 try {
 if (fs.existsSync(authPath)) {
 fs.rmSync(authPath, { recursive: true, force: true });
 }
 } catch (e) {
 this.logger.warn('Erro ao limpar pasta auth:', e.message);
 }
 this.isConnected = false;
 this.currentQR = null;
 this.BOT_JID = null;
 }
 }

 /**
 * Conecta ao WhatsApp
 */
 async connect() {
 try {
 // Marca o tempo de início da conexão
 this.connectionStartTime = Date.now();
 
 // Limpa timeout anterior se existir
 if (this.qrTimeout) {
 clearTimeout(this.qrTimeout);
 this.qrTimeout = null;
 }

 // Evita múltiplas conexões simultâneas
 if (this.sock && this.sock.ws && this.sock.ws.readyState === 1) {
 this.logger.info('🔄 Já conectado, ignorando tentativa de reconexão');
 return;
 }

 this.logger.info('🔗 Conectando ao WhatsApp..');
 this.logger.info(`📁 Usando pasta de auth: ${this.config.AUTH_FOLDER}`);

 // ═══ VERIFICAÇÃO DE DNS OTIMIZADA PARA HF SPACES ═══
 console.log('🔍 Verificando resolução DNS (via HFCorrections)..');
 
 // Verifica conectividade de rede antes de tentar conectar
 try {
 await HFCorrections.verifyHFNetwork();
 } catch (netError) {
 console.log('⚠️ Verificação de rede ignorada, continuando..');
 }

 // Verifica se devemos limpar credenciais antigas
 await this._checkAndCleanOldAuth();

 const { state, saveCreds } = await useMultiFileAuthState(this.config.AUTH_FOLDER);
 const { version } = await fetchLatestBaileysVersion();

 this.logger.info(`📦 Versão Baileys: ${version}`);

 // Configurações otimizadas para Hugging Face Spaces
 const socketConfig = {
 version,
 auth: state,
 logger: pino({ level: 'silent' }), // Silencia logs do Baileys
 browser: Browsers.ubuntu('Chrome'), // Alterado para Ubuntu/Chrome (mais estável em container)
 markOnlineOnConnect: true,
 syncFullHistory: false,
 printQRInTerminal: false, // Não mostra QR no terminal (usamos web)
 connectTimeoutMs: 180000, // Aumentado para 3 minutos para ambientes lentos
 qrTimeout: 120000, // 120 segundos para QR
 defaultQueryTimeoutMs: 60000,
 // Configurações otimizadas para ambientes com conectividade limitada
 keepAliveIntervalMs: 45000, // Aumentado para manter conexão
 retryRequestDelayMs: 8000, // Aumentado delay entre retentativas
 maxRetries: 3, // Reduzido número de retentativas
 // Configurações específicas para ambientes restritos
 agent: this._createCustomAgent(),
 // Força uso de IPv4
 fetchAgent: this._createCustomAgent(),
 // Configurações de WebSocket otimizadas
 wsOptions: HFCorrections.createWebSocketOptions(),
 getMessage: async (key) => {
 if (!key) return undefined;
 try {
 if (this.store && typeof this.store.loadMessage === 'function') {
 const msg = await this.store.loadMessage(key.remoteJid, key.id);
 return msg ? msg.message : undefined;
 }
 } catch (e) {
 this.logger.debug('Erro ao carregar mensagem:', e.message);
 }
 return undefined;
 }
 };

 this.logger.debug('⚙️ Configuração do socket:', JSON.stringify(socketConfig, null, 2));

 this.sock = makeWASocket(socketConfig);

 // Vincula store se existir
 try {
 if (this.store && typeof this.store.bind === 'function') {
 this.store.bind(this.sock.ev);
 this.logger.debug('✅ Store vinculada ao socket');
 }
 } catch (e) {
 this.logger.warn('⚠️ Erro ao vincular store:', e.message);
 }

 // Event listeners
 this.sock.ev.on('creds.update', saveCreds);
 this.sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
 this.sock.ev.on('messages.upsert', this.handleMessagesUpsert.bind(this));

 // Timeout para forçar geração de QR se não vier automaticamente
 this.qrTimeout = setTimeout(() => {
 if (!this.currentQR && !this.isConnected) {
 this.logger.warn('⏰ QR não gerado automaticamente. Tentando forçar..');
 this._forceQRGeneration();
 }
 }, 25000); // Aumentado para 25 segundos

 this.logger.info('✅ Conexão inicializada - Aguardando QR code ou conexão..');

 } catch (error) {
 this.logger.error('❌ Erro na conexão:', error.message);
 this.logger.error(error.stack);
 
 // Reconecta automaticamente após erro
 this._scheduleReconnect();
 throw error;
 }
 }

 /**
 * Agenda reconexão automática
 */
 _scheduleReconnect() {
 const reconnectDelay = Math.min(10000 * Math.pow(1.5, this.reconnectAttempts), 120000);
 this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;

 this.logger.info(`🔄 Reconectando em ${reconnectDelay/1000}s.. (tentativa ${this.reconnectAttempts})`);
 
 setTimeout(() => {
 this.logger.info('🔄 Iniciando reconexão..');
 this.connect().catch(e => this.logger.error('Erro na reconexão:', e.message));
 }, reconnectDelay);
 }

 /**
 * Handle connection update
 */
 async handleConnectionUpdate(update) {
 try {
 const { connection, lastDisconnect, qr } = update;

 // Log detalhado para debugging
 this.logger.debug(`🔄 Connection update received:`, { 
 connection, 
 hasQR: !!qr, 
 lastDisconnect: lastDisconnect ? 'yes' : 'no'
 });

 if (qr) {
 this.currentQR = qr;
 this.logger.info('📱 QR Code gerado - pronto para scan!');
 this.logger.info(`🔗 Acesse: http://localhost:${this.config.PORT}/qr`);
 
 // Log extra para web
 console.log('\n' + '═'.repeat(70));
 console.log('📱 QR CODE DISPONÍVEL NA WEB!');
 console.log('═'.repeat(70));
 console.log(`🔗 URL: http://localhost:${this.config.PORT}/qr`);
 console.log('⏳ Válido por 120 segundos');
 console.log('📱 Abra essa URL no seu navegador');
 console.log('═'.repeat(70) + '\n');

 // Chama callback se existir
 if (this.eventListeners.onQRGenerated) {
 this.eventListeners.onQRGenerated(qr);
 }

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
 this.currentQR = null; // Limpa QR após conexão
 this.reconnectAttempts = 0; // Reseta contador de tentativas

 // Calcula tempo de conexão
 const connectionTime = Date.now() - this.connectionStartTime;
 
 // Limpa timeout de força
 if (this.qrTimeout) {
 clearTimeout(this.qrTimeout);
 this.qrTimeout = null;
 }

 this.logger.info('\n' + '═'.repeat(70));
 this.logger.info('✅ AKIRA BOT V21 ONLINE!');
 this.logger.info('═'.repeat(70));
 this.logger.info(`🤖 Nome: ${this.config.BOT_NAME}`);
 this.logger.info(`📱 Número: ${this.config.BOT_NUMERO_REAL}`);
 this.logger.info(`🔗 JID: ${this.BOT_JID}`);
 this.logger.info(`⏱️ Tempo de conexão: ${connectionTime}ms`);
 this.logger.info('═'.repeat(70) + '\n');

 // Chama callback se existir
 if (this.eventListeners.onConnected) {
 this.eventListeners.onConnected(this.BOT_JID);
 }

 // Log extra para web
 console.log('\n' + '═'.repeat(70));
 console.log('✅ BOT CONECTADO COM SUCESSO!');
 console.log('═'.repeat(70));
 console.log(`🤖 Bot está online e pronto para uso`);
 console.log(`📱 Número: ${this.config.BOT_NUMERO_REAL}`);
 console.log(`🔗 JID: ${this.BOT_JID}`);
 console.log('═'.repeat(70) + '\n');

 } else if (connection === 'close') {
 this.isConnected = false;
 this.currentQR = null;
 
 const code = (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode) || undefined;
 const reason = (lastDisconnect && lastDisconnect.error && lastDisconnect.error.message) || 'desconhecido';

 this.logger.warn(`⚠️ Conexão perdida (código: ${code}, motivo: ${reason})`);

 // Códigos de erro específicos
 if (code === 408) {
 this.logger.warn('⏰ Timeout de conexão - possível problema de rede');
 } else if (code === 401) {
 this.logger.warn('🔐 Credenciais rejeitadas - será necessário novo login');
 // Limpa credenciais em caso de auth error
 this._cleanAuthOnError();
 } else if (code === 403) {
 this.logger.warn('🚫 Conta banida ou bloqueada');
 } else if (code === 503) {
 this.logger.warn('🌐 Serviço indisponível - servidor WhatsApp offline');
 }

 // Chama callback se existir
 if (this.eventListeners.onDisconnected) {
 this.eventListeners.onDisconnected(code, reason);
 }

 // Reconecta com backoff exponencial otimizado
 const reconnectDelay = Math.min(8000 * Math.pow(1.5, this.reconnectAttempts || 0), 90000); // Máximo 90 segundos
 this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;

 this.logger.info(`🔄 Reconectando em ${reconnectDelay/1000}s.. (tentativa ${this.reconnectAttempts})`);
 
 // Limpa socket atual
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

 setTimeout(() => {
 this.logger.info('🔄 Iniciando reconexão..');
 this.connect().catch(e => this.logger.error('Erro na reconexão:', e.message));
 }, reconnectDelay);

 } else if (connection === 'connecting') {
 this.logger.info('🔄 Conectando ao WhatsApp..');
 // Limpa QR code anterior ao tentar nova conexão
 this.currentQR = null;
 }

 } catch (error) {
 this.logger.error('❌ Erro em handleConnectionUpdate:', error.message);
 this.logger.error(error.stack);
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

 // Ignorar mensagens antigas (mais de 10 segundos)
 const messageTime = m.messageTimestamp * 1000;
 const currentTime = Date.now();
 if (messageTime && messageTime < currentTime - 10000) {
 this.logger.debug(`⏭️ Mensagem antiga ignorada: ${messageTime}`);
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

 // Log da mensagem recebida
 this.logger.info(`📩 [${ehGrupo ? 'GRUPO' : 'PV'}] ${nome}: ${texto.substring(0, 50)}${texto.length > 50 ? '..' : ''}`);

 // Verifica ban
 if (this.moderationSystem.isBanned(numeroReal)) {
 this.logger.warn(`🚫 Mensagem de usuário banido ignorada: ${nome}`);
 return;
 }

 // Verifica spam
 if (this.moderationSystem.checkSpam(numeroReal)) {
 this.logger.warn(`⚠️ Spam detectado de ${nome}`);
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

 // Award group XP (auto XP system) - DESATIVADO POR PADRÃO
 // O dono do grupo deve ativar com #level on
 try {
 if (ehGrupo) {
 const gid = m.key.remoteJid;
 const togglesPath = path.join(this.config.DATABASE_FOLDER, 'group_settings.s.json');
 let toggles = {};
 
 if (fs.existsSync(togglesPath)) {
 try {
 toggles = JSON.parse(fs.readFileSync(togglesPath, 'utf8') || '{}');
 } catch (e) {
 toggles = {};
 }
 }
 
 // Verifica se leveling está ativado para este grupo
 const isLevelingEnabled = toggles[gid] && toggles[gid].levelingEnabled === true;
 
 if (isLevelingEnabled) {
 const uid = m.key.participant || m.key.remoteJid;
 const xpAmount = Math.floor(Math.random() * (25 - 15 + 1)) + 15;
 const { rec, leveled } = this.levelSystem.awardXp(m.key.remoteJid, uid, xpAmount);
 if (leveled) {
 const patente = this.levelSystem.getPatente(rec.level);
 await this.sock.sendMessage(m.key.remoteJid, {
 text: `🎉 @${uid.split('@')[0]} você foi elevado ao nível ${rec.level} e a ${patente}`,
 contextInfo: { mentionedJid: [uid] }
 });
 if (rec.level >= this.levelSystem.maxLevel) {
 const maxRes = await this.levelSystem.registerMaxLevelUser(m.key.remoteJid, uid, m.pushName || uid, this.sock);
 if (maxRes && maxRes.promoted) {
 await this.sock.sendMessage(m.key.remoteJid, { 
 text: `🎊 ${m.pushName || uid} foi promovido automaticamente a ADM!` 
 });
 }
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
 const temImagem = this.messageProcessor.hasImage(m);
 if (temImagem) {
 await this.handleImageMessage(m, nome, numeroReal, replyInfo, ehGrupo);
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
 // Em PV: NÃO responde se não for reply ao bot
 // O usuário deve responder em reply para Akira responder em reply no PV
 deveResponder = false;
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
 // Simula digitação
 const tempoDigitacao = Math.min(
 Math.max(resposta.length * this.config.TYPING_SPEED_MS, this.config.MIN_TYPING_TIME_MS),
 this.config.MAX_TYPING_TIME_MS
 );
 
 await this.simulateTyping(m.key.remoteJid, tempoDigitacao);

 const opcoes = ehGrupo || (replyInfo && replyInfo.ehRespostaAoBot) ? { quoted: m } : {};
 await this.sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);
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
 const fs = require('fs');
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
