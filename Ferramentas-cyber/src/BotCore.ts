/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BOT CORE - FERRAMENTAS CYBER BOT
 * ═══════════════════════════════════════════════════════════════════════════
 * WhatsApp bot for cybersecurity tools
 * Separate from main Akira bot
 * Same permission logic: owner, subscriber, free tier
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import express from 'express';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import ConfigManager from './ConfigManager';
import CybersecurityToolkit from './CybersecurityToolkit';
import OSINTFramework from './OSINTFramework';
import AdvancedPentestingToolkit from './AdvancedPentestingToolkit';
import PermissionManager from './PermissionManager';
import SubscriptionManager from './SubscriptionManager';
import RegistrationSystem from './RegistrationSystem';
import RateLimiter from './RateLimiter';
import CommandHandler from './CommandHandler';
import PresenceSimulator from './PresenceSimulator';
import HFCorrections from './HFCorrections';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CyberBotCore { 
    public config: any;
    public logger: any;
    public sock: any;
    public isConnected: boolean = false;
    public reconnectAttempts: number = 0;
    public MAX_RECONNECT_ATTEMPTS: number = 5;
    public connectionStartTime: number | null = null;
    public currentQR: string | null = null;
    public BOT_JID: string | null = null;
    
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

    // Components
    public cybersecurityToolkit: any;
    public osintFramework: any;
    public advancedPentestingToolkit: any;
    public permissionManager: any;
    public subscriptionManager: any;
    public registrationSystem: any;
    public rateLimiter: any;
    public commandHandler: any;
    public presenceSimulator: any;

    // Deduplication
    private processedMessages: Set<string> = new Set();
    private readonly MAX_PROCESSED_MESSAGES = 1000;

    constructor() {
        this.config = ConfigManager.getInstance();
        this.logger = pino({
            level: this.config.LOG_LEVEL || 'info',
            timestamp: () => `,"time":"${new Date().toISOString()}"`
        });
    }

    async initialize(): Promise<boolean> {
        try {
            this.logger.info('🚀 Inicializando Ferramentas Cyber Bot...');
            
            // Apply HF corrections
            HFCorrections.apply();
            
            // Validate config
            this.config.validate();
            
            // Initialize components
            await this.initializeComponents();
            
            return true;
        } catch (error: any) {
            this.logger.error('❌ Erro ao inicializar:', error.message);
            throw error;
        }
    }

    async initializeComponents() {
        try {
            this.logger.info('🔧 Inicializando componentes...');

            // Permission & Subscription
            this.permissionManager = new PermissionManager(this.logger);
            this.subscriptionManager = new SubscriptionManager(this.config);
            this.registrationSystem = new RegistrationSystem(this.logger);
            this.rateLimiter = new RateLimiter();

            // Cybersecurity tools
            this.advancedPentestingToolkit = new AdvancedPentestingToolkit(this.config);
            this.cybersecurityToolkit = new CybersecurityToolkit(this.config);
            this.osintFramework = new OSINTFramework(this.config, null);

            // Command handler
            this.presenceSimulator = new PresenceSimulator(null);
            this.commandHandler = new CommandHandler(null, this.config, this);
            
            this.logger.info('✅ Componentes inicializados');
        } catch (error: any) {
            this.logger.error('❌ Erro componentes:', error.message);
        }
    }

    async start() {
        await this.initialize();
        await this.connect();
    }

    async connect(): Promise<void> {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.config.AUTH_FOLDER);
            const { version } = await fetchLatestBaileysVersion();

            this.logger.info(`📡 WhatsApp v${version.join('.')}`);

            const socketConfig: any = {
                version,
                logger: pino({ level: 'silent' }),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                browser: Browsers.macOS('Ferramentas-Cyber'),
                generateHighQualityLinkPreview: true,
                getMessage: async (key: any) => ({ conversation: 'hello' }),
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 10000
            };

            // Apply HTTP agent if available
            const agent = HFCorrections.createHFAgent();
            if (agent) {
                socketConfig.agent = agent;
            }

            this.sock = makeWASocket(socketConfig);

            // Update socket in components
            this._updateComponentsSocket(this.sock);
            
            // Update command handler socket
            if (this.commandHandler?.setSocket) {
                this.commandHandler.setSocket(this.sock);
            }

            this.sock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.logger.info('📸 QR Code recebido');
                    this.currentQR = qr;
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

                    if (shouldReconnect && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                        this.reconnectAttempts++;
                        const delayMs = Math.min(this.reconnectAttempts * 2000, 10000);
                        this.logger.info(`⏳ Reconectando em ${delayMs}ms (Tentativa ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
                        setTimeout(() => this.connect(), delayMs);
                    }
                } else if (connection === 'open') {
                    this.logger.info('✅ CONEXÃO ESTABELECIDA!');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.currentQR = null;
                    this.connectionStartTime = Date.now();
                    this.BOT_JID = this.sock.user?.id;
                    
                    if (this.eventListeners.onConnected && this.BOT_JID) {
                        this.eventListeners.onConnected(this.BOT_JID!);
                    }
                }
            });

            this.sock.ev.on('creds.update', saveCreds);

            this.sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
                if (type !== 'notify') return;
                for (const m of messages) {
                    await this.processMessage(m);
                }
            });

        } catch (error: any) {
            this.logger.error('❌ Erro conexão:', error.message);
            setTimeout(() => this.connect(), 5000);
        }
    }

    private _updateComponentsSocket(sock: any): void {
        if (this.cybersecurityToolkit?.setSocket) {
            this.cybersecurityToolkit.setSocket(sock);
        }
        if (this.osintFramework?.setSocket) {
            this.osintFramework.setSocket(sock);
        }
        if (this.presenceSimulator) {
            this.presenceSimulator.sock = sock;
        }
    }

    private isMessageProcessed(key: any): boolean {
        if (!key?.id) return false;
        const messageId = key.id;
        
        if (this.processedMessages.has(messageId)) {
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
            if (!m.message) return;
            if (m.key.fromMe) return;
            if (m.message.protocolMessage) return;

            const remoteJid = m.key.remoteJid;
            const ehGrupo = remoteJid.endsWith('@g.us');
            
            // Ignore group messages - cyber tools only work in private
            if (ehGrupo) return;

            const senderId = m.key.participant || remoteJid;
            const userNumber = senderId.split('@')[0];

            // Extract text
            const texto = m.message.conversation || 
                         m.message.extendedTextMessage?.text || 
                         m.message.imageMessage?.caption ||
                         '';

            if (!texto.startsWith(this.config.PREFIXO)) return;

            // Parse command
            const args = texto.slice(this.config.PREFIXO.length).trim().split(/ +/);
            const comando = args.shift().toLowerCase();

            this.logger.info(`[CMD] ${comando} de ${userNumber}`);

            // Check if owner
            const isOwner = this.config.isDono(userNumber, '');

            // Check if registered (for non-owners)
            if (!isOwner && !this.registrationSystem.isRegistered(senderId)) {
                await this.reply(m, '❌ *ACESSO RESTRITO*\n\nVocê precisa se registrar para usar as ferramentas cyber.\n\nUse: *#registrar SeuNome*');
                return;
            }

            // Rate limiting
            if (!isOwner) {
                const rateCheck = this.rateLimiter.check(senderId, isOwner);
                if (!rateCheck.allowed) {
                    await this.reply(m, `⏳ Aguarde ${rateCheck.wait} minutos antes de usar outro comando.`);
                    return;
                }
            }

            // Handle command
            await this.handleCommand(m, comando, args);

        } catch (error: any) {
            this.logger.error('❌ Erro processMessage:', error.message);
        }
    }

    async handleCommand(m: any, comando: string, args: string[]): Promise<void> {
        // Simulate typing
        if (this.presenceSimulator) {
            await this.presenceSimulator.simulateTyping(m.key.remoteJid, 2000);
        }

        const senderId = m.key.participant || m.key.remoteJid;
        const userNumber = senderId.split('@')[0];
        const isOwner = this.config.isDono(userNumber, '');

        switch (comando) {
            case 'ping':
                await this.reply(m, '🏓 *PONG*\n\n🛡️ Ferramentas Cyber Bot Online!');
                break;

            case 'menu':
            case 'help':
                await this.showMenu(m, 'main');
                break;

            case 'menucyber':
                await this.showMenu(m, 'cyber');
                break;

            case 'menuosint':
                await this.showMenu(m, 'osint');
                break;

            case 'menuinfo':
                await this.showMenu(m, 'info');
                break;

            // Registration
            case 'registrar':
            case 'register':
                await this.handleRegister(m, args, senderId);
                break;

            // ==================== CYBERSECURITY TOOLS ====================
            // Only for owners
            case 'nmap':
            case 'sqlmap':
            case 'hydra':
            case 'nuclei':
            case 'nikto':
            case 'masscan':
            case 'commix':
            case 'searchsploit':
            case 'whois':
            case 'dns':
            case 'geo':
                if (!isOwner) {
                    await this.reply(m, '🚫 Este comando é apenas para o DONO.');
                    return;
                }
                await this.cybersecurityToolkit.handleCommand(m, comando, args);
                break;

            // ==================== OSINT TOOLS ====================
            case 'dork':
            case 'email':
            case 'phone':
            case 'username':
                if (!isOwner) {
                    await this.reply(m, '🚫 Este comando é apenas para o DONO.');
                    return;
                }
                await this.osintFramework.handleCommand(m, comando, args);
                break;

            // ==================== NEW TOOLS ====================
            case 'socialfish':
            case 'blackeye':
            case 'theharvester':
            case 'sherlock':
            case 'holehe':
            case 'netexec':
            case 'winrm':
                if (!isOwner) {
                    await this.reply(m, '🚫 Este comando é apenas para o DONO.');
                    return;
                }
                await this.cybersecurityToolkit.handleCommand(m, comando, args);
                break;

            case 'shodan':
            case 'cve':
                if (!isOwner) {
                    await this.reply(m, '🚫 Este comando é apenas para o DONO.');
                    return;
                }
                await this.cybersecurityToolkit.handleCommand(m, comando, args);
                break;

            default:
                await this.reply(m, '❓ Comando não reconhecido.\n\nUse *#menu* para ver os comandos disponíveis.');
        }
    }

    async showMenu(m: any, category: string = 'main'): Promise<void> {
        const senderId = m.key.participant || m.key.remoteJid;
        const userNumber = senderId.split('@')[0];
        const isOwner = this.config.isDono(userNumber, '');

        let menuText = '';

        if (category === 'main') {
            menuText = `🛡️ *FERRAMENTAS CYBER BOT*\n\n` +
                `┌─────────────────────────────┐\n` +
                `│ 🤖 Bot de Ferramentas de Segurança\n` +
                `│ 📱 Versão: ${this.config.BOT_VERSION}\n` +
                `│ 🟢 Status: Online\n` +
                `└─────────────────────────────┘\n\n` +
                `*MENU PRINCIPAL*\n\n` +
                `• *#menucyber* - Ferramentas de Pentesting\n` +
                `• *#menuosint* - Ferramentas OSINT\n` +
                `• *#menuinfo* - Informações do Bot\n\n` +
                `⚠️ *ATENÇÃO*: Use apenas em ambientes autorizados!`;
        } 
        else if (category === 'cyber') {
            menuText = `🛡️ *FERRAMENTAS DE PENTESTING*\n\n` +
                `🔍 *Scanners*\n` +
                `• #nmap <target> - Scanner de portas\n` +
                `• #masscan <target> - Scanner rápido\n` +
                `• #nikto <url> - Scanner web\n` +
                `• #nuclei <target> - Vulnerabilidades\n\n` +
                `💉 *Injection*\n` +
                `• #sqlmap <url> - SQL Injection\n` +
                `• #commix <url> - Command Injection\n\n` +
                `🔓 *Password*\n` +
                `• #hydra <target> - Brute Force\n\n` +
                `🔎 *Exploits*\n` +
                `• #searchsploit <termo> - Banco de exploits\n\n` +
                `🌐 *Phishing*\n` +
                `• #socialfish - Social Engineering\n` +
                `• #blackeye - Phishing Pages\n\n` +
                `⚠️ *APENAS DONO*`;
        }
        else if (category === 'osint') {
            menuText = `🔍 *FERRAMENTAS OSINT*\n\n` +
                `🌐 *Busca*\n` +
                `• #dork <query> - Google Dorking\n` +
                `• #username <user> - Buscar username\n\n` +
                `📧 *Email*\n` +
                `• #email <email> - Verificar vazamentos\n` +
                `• #holehe <email> - Email reconnaissance\n\n` +
                `📱 *Telefone*\n` +
                `• #phone <número> - Lookup\n\n` +
                `🌍 *IP/Rede*\n` +
                `• #geo <ip> - Geolocalização\n` +
                `• #shodan <ip> - Shodan search\n` +
                `• #theharvester <domain> - Coleta emails\n\n` +
                `⚠️ *APENAS DONO*`;
        }
        else if (category === 'info') {
            menuText = `ℹ️ *INFORMAÇÕES*\n\n` +
                `🛡️ *Ferramentas Cyber Bot*\n\n` +
                `Este bot contém ferramentas de segurança para:\n\n` +
                `• Pentesting\n` +
                `• OSINT\n` +
                `• Análise de vulnerabilidades\n\n` +
                `⚠️ *AVISO IMPORTANTE*\n\n` +
                `Use apenas em:\n` +
                `• Ambientes de teste autorizados\n` +
                `• Seus próprios sistemas\n` +
                `• Sistemas com permissão explícita\n\n` +
                `O uso não autorizado pode ser crime!`;
        }

        await this.reply(m, menuText);
    }

    async handleRegister(m: any, args: string[], senderId: string): Promise<void> {
        if (args.length === 0) {
            await this.reply(m, '❌ Uso: #registrar SeuNome\n\nExemplo: #registrar João');
            return;
        }

        const nome = args.join(' ');
        const result = this.registrationSystem.register(senderId, nome, 0);

        if (result.success) {
            await this.reply(m, `✅ *REGISTRO CONCLUÍDO!*\n\n👤 Nome: ${nome}\n🔑 Serial: ${result.user.serial}\n\nBem-vindo ao Ferramentas Cyber Bot!`);
        } else {
            await this.reply(m, result.message || '❌ Erro ao registrar.');
        }
    }

    async reply(m: any, text: string): Promise<void> {
        try {
            if (!this.sock) return;
            await this.sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
        } catch (error: any) {
            this.logger.error('❌ Erro ao responder:', error.message);
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            botNumero: this.config.BOT_NUMERO_REAL,
            botJid: this.BOT_JID,
            uptime: this.connectionStartTime ? Math.floor((Date.now() - this.connectionStartTime) / 1000) : 0,
            version: this.config.BOT_VERSION
        };
    }
}

export default CyberBotCore;
