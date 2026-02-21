/**
 * ═══════════════════════════════════════════════════════════════════════════
 * COMMAND HANDLER - AKIRA BOT V21 - ENTERPRISE EDITION
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ Sistema completo de comandos com permissões por tier
 * ✅ Rate limiting inteligente e proteção contra abuso
 * ✅ Menus profissionais e formatados em ASCII art
 * ✅ Funcionalidades enterprise-grade
 * ✅ Logging de ações administrativas
 * ✅ Simulações realistas de presença (digitação, gravação, ticks)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Módulos Core
import ConfigManager from './ConfigManager.js';
import PresenceSimulator from './PresenceSimulator.js';
import StickerViewOnceHandler from './StickerViewOnceHandler.js';
import MediaProcessor from './MediaProcessor.js';

// Ferramentas Enterprise
import CybersecurityToolkit from './CybersecurityToolkit.js';
import OSINTFramework from './OSINTFramework.js';
import SubscriptionManager from './SubscriptionManager.js';
import SecurityLogger from './SecurityLogger.js';

// Novos módulos
import GroupManagement from './GroupManagement.js';
import UserProfile from './UserProfile.js';
import BotProfile from './BotProfile.js';
import ImageEffects from './ImageEffects.js';
import PermissionManager from './PermissionManager.js';
import RegistrationSystem from './RegistrationSystem.js';
import LevelSystem from './LevelSystem.js';
import EconomySystem from './EconomySystem.js';
import GameSystem from './GameSystem.js';

// Sistema de rate limiting para features premium (1x a cada 3 meses para users)
const premiumFeatureUsage = new Map();

// Log de ações administrativas
const adminLog = new Map();

// O PresenceSimulator é gerenciado via instância do BotCore ou localmente

class CommandHandler {
    public sock: any;
    public config: any;
    public bot: any;
    public messageProcessor: any;
    public permissionManager: any;
    public registrationSystem: any;
    public levelSystem: any;
    public economySystem: any;
    public stickerHandler: any;
    public mediaProcessor: any;
    public cybersecurityToolkit: any;
    public osintFramework: any;
    public subscriptionManager: any;
    public securityLogger: any;
    public groupManagement: any;
    public userProfile: any;
    public botProfile: any;
    public imageEffects: any;
    public presenceSimulator: any;
    public logger: any;

    constructor(sock: any, config: any, bot: any = null, messageProcessor: any = null) {
        this.sock = sock;
        this.config = config;
        this.bot = bot; // Referência para o BotCore
        // Injeção robusta: tenta usar o passado explicitamente, ou pega do bot, ou tenta instanciar (não recomendado)
        this.messageProcessor = messageProcessor || bot?.messageProcessor;
        console.log(`[DEBUG] CommandHandler init. MP injetado: ${!!messageProcessor}, Bot.MP: ${!!bot?.messageProcessor}, Final: ${!!this.messageProcessor}`);

        // Inicializa sistemas de permissões e registro
        this.permissionManager = new PermissionManager();
        this.registrationSystem = new RegistrationSystem();
        this.levelSystem = new LevelSystem();
        this.economySystem = new EconomySystem();
        console.log('✅ Sistemas de permissões, registro, level e economia inicializados');

        // Inicializa handlers de mídia
        if (sock) {
            this.stickerHandler = new StickerViewOnceHandler(sock, this.config);
            // Removido: this.mediaProcessor = new MediaProcessor(); // Redundante e perigoso
        }
        // console.log('✅ Handlers de mídia inicializados');

        // Inicializa ferramentas de cybersecurity (ENTERPRISE)
        this.cybersecurityToolkit = new CybersecurityToolkit(this.config);
        this.osintFramework = new OSINTFramework(this.config, sock);
        this.subscriptionManager = new SubscriptionManager(this.config);
        this.securityLogger = new SecurityLogger(this.config);
        // console.log('✅ Ferramentas ENTERPRISE inicializadas');

        // Inicializa novos módulos
        if (sock) {
            this.groupManagement = new GroupManagement(sock, this.config);
            this.userProfile = new UserProfile(sock, this.config);
            this.botProfile = new BotProfile(sock, this.config);
            this.imageEffects = new ImageEffects(this.config);
        }

        if (!this.presenceSimulator && sock) {
            this.presenceSimulator = new PresenceSimulator(sock);
        }

        this.logger = config?.logger || console;
    }

    public setSocket(sock: any): void {
        this.sock = sock;

        // Inicializa handlers de mídia se ainda não foram
        if (!this.stickerHandler) {
            this.stickerHandler = new StickerViewOnceHandler(sock, this.config);
            this.mediaProcessor = new MediaProcessor();
        }

        // Inicializa novos módulos se ainda não foram
        if (!this.groupManagement) {
            this.groupManagement = new GroupManagement(sock, this.config);
            this.userProfile = new UserProfile(sock, this.config);
            this.botProfile = new BotProfile(sock, this.config);
            this.imageEffects = new ImageEffects(this.config);
        }

        if (!this.presenceSimulator && sock) {
            this.presenceSimulator = new PresenceSimulator(sock);
        }

        // Atualiza referências nos módulos que precisam do socket
        if (this.cybersecurityToolkit && typeof this.cybersecurityToolkit.setSocket === 'function') {
            this.cybersecurityToolkit.setSocket(sock);
        }
        if (this.osintFramework && typeof this.osintFramework.setSocket === 'function') {
            this.osintFramework.setSocket(sock);
        }
    }

    public async handle(m: any, meta: any): Promise<boolean | void> {
        // meta: { nome, numeroReal, texto, replyInfo, ehGrupo }
        try {
            const { nome, numeroReal, texto, replyInfo, ehGrupo } = meta;
            // Extrai comando e argumentos
            let mp = this.messageProcessor || this.bot?.messageProcessor;

            if (!mp) {
                // Tentativa desesperada de recuperar do bot
                if (this.bot?.messageProcessor) {
                    this.messageProcessor = this.bot.messageProcessor;
                    mp = this.messageProcessor;
                }
            }

            if (!mp) {
                console.error(`❌ [CRITICAL] messageProcessor não acessível. Bot: ${!!this.bot}, MP Reference: ${!!this.messageProcessor}, Bot.MP: ${!!this.bot?.messageProcessor}`);
                return false;
            }

            const parsed = mp.parseCommand(texto);
            if (!parsed) return false;

            const chatJid = m.key.remoteJid;
            const senderId = numeroReal;
            const command = parsed.comando.toLowerCase();
            const args = parsed.args;
            const fullArgs = parsed.textoCompleto;

            // Log de comando
            // this.logger?.debug(`[CMD] ${command} por ${nome} em ${chatJid}`);

            // Simulador de presença (digitação)
            const simulator = this.presenceSimulator || (this.bot && this.bot.presenceSimulator);
            if (simulator) {
                // Calcula duração realista baseada no comando ou usa padrão
                const duration = simulator.calculateTypingDuration(command);
                await simulator.simulateTyping(chatJid, duration);
            }

            // Verifica permissões de dono
            const isOwner = this.config.isDono(senderId, nome);
            const userId = m.key.participant || senderId;

            // VERIFICAÇÃO DE REGISTRO GLOBAL
            const isReg = this.registrationSystem.isRegistered(userId);
            if (!isReg && !isOwner && !['registrar', 'register', 'reg', 'menu', 'help', 'ajuda', 'comandos', 'dono', 'owner', 'criador', 'creator'].includes(command.toLowerCase())) {
                await this.bot.reply(m, '❌ *ACESSO NEGADO!*\n\nVocê precisa se registrar para usar os comandos do bot.\n\nUse: *#registrar SeuNome|SuaIdade*');
                return true;
            }

            // NOVO: Verifica se o usuário é admin do grupo
            let isAdminUsers = false;
            if (ehGrupo && this.groupManagement) {
                isAdminUsers = await this.groupManagement.isUserAdmin(chatJid, userId);
            }

            // ══════════════════════════════════════════
            // VERIFICAÇÃO DE PERMISSÕES
            // ══════════════════════════════════════════
            const groupJid = ehGrupo ? chatJid : null;

            const permissionCheck = this.permissionManager.canExecuteCommand(
                command,
                userId,
                nome,
                ehGrupo,
                groupJid
            );

            if (!permissionCheck.allowed) {
                await this.bot.reply(m, permissionCheck.reason);
                return true;
            }

            // ══════════════════════════════════════════
            // DESPACHO DE COMANDOS
            // ══════════════════════════════════════════

            switch (command) {
                case 'ping': {
                    const uptime = Math.floor(process.uptime());
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = uptime % 60;

                    const stats = this.bot?.getStats?.() || { api: {}, message: {}, audio: {} };
                    const latencia = Date.now() - (m.messageTimestamp * 1000 || Date.now());

                    const statusMsg = `🏓 *PONG!* \n\n` +
                        `⚡ *Latência:* ${Math.abs(latencia)}ms\n` +
                        `📡 *Uptime:* ${hours}h ${minutes}m ${seconds}s\n` +
                        `🤖 *Bot:* ${this.config.BOT_NAME} V${this.config.BOT_VERSION}\n` +
                        `📊 *Status:* Online e Operacional\n` +
                        `🔗 *API:* ${stats.api?.error ? '⚠️ Offline' : '✅ Conectada'}\n` +
                        `🎤 *STT/TTS:* ${stats.audio?.error ? '⚠️ Inativo' : '✅ Ativo'}\n\n` +
                        `_Sistema respondendo normalmente!_`;

                    await this.bot.reply(m, statusMsg);
                    return true;
                }

                case 'registrar':
                case 'register':
                case 'reg':
                    return await this._handleRegister(m, fullArgs, userId);

                case 'level':
                case 'lvl':
                case 'nivel':
                    return await this._handleLevel(m, userId, chatJid, ehGrupo);

                case 'rank':
                case 'ranking':
                case 'top':
                    return await this._handleRank(m, chatJid, ehGrupo);

                case 'daily':
                case 'diario':
                    return await this._handleDaily(m, userId);

                case 'atm':
                case 'banco':
                case 'saldo':
                case 'balance':
                    return await this._handleATM(m, userId);

                case 'transfer':
                case 'transferir':
                case 'pagar':
                    return await this._handleTransfer(m, userId, args, fullArgs);

                case 'menu':
                case 'help':
                case 'ajuda':
                case 'comandos':
                    return await this._showMenu(m);

                case 'pinterest':
                case 'pin':
                case 'image':
                case 'img':
                    return await this._handlePinterest(m, fullArgs, args);

                case 'ship':
                    return await this._handleShip(m);

                case 'dado':
                case 'moeda':
                case 'caracoroa':
                case 'slot':
                case 'chance':
                case 'gay':
                    return await this._handleGames(m, command, args);

                case 'ttt':
                case 'tictactoe':
                case 'jogodavelha': {
                    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    const gameRes = await GameSystem.handleTicTacToe(chatJid, userId, args[0] || 'start', mentioned);
                    return await this._reply(m, gameRes.text, { mentions: [userId, ...(mentioned ? [mentioned] : [])] });
                }

                case 'tagall':
                case 'hidetag':
                case 'totag':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
                        return true;
                    }
                    return await this._handleTagAll(m, fullArgs, command === 'hidetag');

                case 'welcome':
                case 'bemvindo':
                case 'setwelcome':
                case 'setgoodbye':
                case 'goodbye':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
                        return true;
                    }
                    return await this._handleWelcome(m, command, args, fullArgs);

                case 'broadcast':
                    if (!isOwner) {
                        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
                        return true;
                    }
                    return await this._handleBroadcast(m, fullArgs);

                case 'hd':
                case 'upscale':
                case 'remini':
                case 'enhance':
                    return await this._handleImageEffect(m, 'hd', args);

                case 'removebg':
                case 'bg':
                case 'rmbg':
                    return await this._handleImageEffect(m, 'removebg', args);

                case 'wasted':
                case 'jail':
                case 'triggered':
                case 'communism':
                case 'sepia':
                case 'grey':
                case 'invert':
                case 'mission':
                case 'angola':
                case 'addbg':
                    return await this._handleImageEffect(m, command, args);

                case 'sticker':
                case 's':
                case 'fig':
                    return await this._handleSticker(m, nome);

                case 'take':
                case 'roubar':
                    return await this._handleTakeSticker(m, fullArgs, nome);

                case 'toimg':
                    return await this._handleStickerToImage(m);

                case 'play':
                case 'p':
                    return await this._handlePlay(m, fullArgs);

                case 'video':
                case 'playvid':
                case 'ytmp4':
                    return await this._handleVideo(m, fullArgs);

                case 'tomp3':
                case 'mp3':
                    return await this._handleVideoToAudio(m);

                case 'nightcore':
                case 'slow':
                case 'bass':
                case 'bassboost':
                case 'deep':
                case 'robot':
                case 'reverse':
                case 'squirrel':
                case 'echo':
                case '8d':
                    return await this._handleAudioEffect(m, command);

                case 'perfil':
                case 'profile':
                case 'info':
                    return await this._handleProfile(m, meta);

                case 'del':
                case 'apagar':
                case 'delete':
                    return await this._handleDelete(m, isOwner || isAdminUsers);

                case 'dono':
                case 'owner':
                case 'criador':
                case 'creator':
                    return await this._handleDono(m);

                case 'report':
                case 'bug':
                case 'reportar':
                    return await this._handleReport(m, fullArgs, nome, senderId, ehGrupo);

                case 'premium':
                case 'vip':
                    return await this._handlePremiumInfo(m, senderId);

                case 'addpremium':
                case 'addvip':
                    if (!isOwner) return false;
                    return await this._handleAddPremium(m, args);

                case 'delpremium':
                case 'delvip':
                    if (!isOwner) return false;
                    return await this._handleDelPremium(m, args);

                case 'donate':
                case 'doar':
                case 'buy':
                case 'comprar':
                    return await this._handlePaymentCommand(m, args);

                case 'nmap':
                case 'sqlmap':
                case 'hydra':
                case 'nuclei':
                case 'whois':
                case 'dns':
                case 'geo':
                case 'setoolkit':
                case 'metasploit':
                    if (!isOwner) {
                        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
                        return true;
                    }
                    return await this.cybersecurityToolkit.handleCommand(m, command, args);

                case 'mute':
                case 'desmute':
                case 'unmute':
                case 'kick':
                case 'ban':
                case 'add':
                case 'promote':
                case 'demote':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Apenas administradores do grupo ou o dono do bot podem gerenciar o grupo.');
                        return true;
                    }
                    return await this.groupManagement.handleCommand(m, command, args);

                // COMANDOS DE GRUPO — ADMIN OU DONO
                case 'fechar':
                case 'close':
                case 'abrir':
                case 'open':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Apenas admins podem abrir/fechar o grupo.');
                        return true;
                    }
                    return await this.groupManagement.handleCommand(m, command, args);

                case 'fixar':
                case 'pin':
                case 'desafixar':
                case 'unpin':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Apenas admins podem fixar/desafixar mensagens.');
                        return true;
                    }
                    return await this.groupManagement.handleCommand(m, command, args);

                case 'reagir':
                case 'react':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Apenas admins podem usar reações administrativas.');
                        return true;
                    }
                    return await this.groupManagement.handleCommand(m, command, args);

                case 'link':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Apenas admins podem obter o link do grupo.');
                        return true;
                    }
                    return await this.groupManagement.handleCommand(m, 'link', args);

                case 'revlink':
                case 'revogar':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Apenas admins podem revogar o link do grupo.');
                        return true;
                    }
                    return await this.groupManagement.handleCommand(m, command, args);

                case 'setdesc':
                case 'descricao':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Apenas admins podem alterar a descrição do grupo.');
                        return true;
                    }
                    return await this.groupManagement.handleCommand(m, 'setdesc', args);

                case 'setfoto':
                case 'fotodogrupo':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Apenas admins podem alterar a foto do grupo.');
                        return true;
                    }
                    return await this.groupManagement.handleCommand(m, 'setfoto', args);

                // INFO DO GRUPO — QUALQUER MEMBRO REGISTRADO
                case 'groupinfo':
                case 'infogrupo':
                case 'ginfo': {
                    if (!ehGrupo) { await this.bot.reply(m, '❌ Este comando só funciona em grupos.'); return true; }
                    const isReg3 = this.registrationSystem?.isRegistered?.(userId);
                    if (!isReg3 && !isOwner) { await this.bot.reply(m, '❌ Use *#registrar Nome|Idade* primeiro!'); return true; }
                    return await this.groupManagement.handleCommand(m, 'groupinfo', args);
                }

                case 'listar':
                case 'membros': {
                    if (!ehGrupo) { await this.bot.reply(m, '❌ Este comando só funciona em grupos.'); return true; }
                    if (!isOwner && !isAdminUsers) { await this.bot.reply(m, '🚫 Apenas admins podem listar membros.'); return true; }
                    return await this.groupManagement.handleCommand(m, 'listar', args);
                }

                case 'admins':
                case 'listadmins': {
                    if (!ehGrupo) { await this.bot.reply(m, '❌ Este comando só funciona em grupos.'); return true; }
                    const isReg4 = this.registrationSystem?.isRegistered?.(userId);
                    if (!isReg4 && !isOwner) { await this.bot.reply(m, '❌ Use *#registrar Nome|Idade* primeiro!'); return true; }
                    return await this.groupManagement.handleCommand(m, 'admins', args);
                }

                case 'antispam':
                    if (!isOwner && !isAdminUsers) {
                        await this.bot.reply(m, '🚫 Apenas admins podem configurar antispam.');
                        return true;
                    }
                    return await this.groupManagement.handleCommand(m, 'antispam', args);

                // DIVERSÃO & UTILIDADES — REQUER REGISTRO
                case 'enquete':
                case 'poll': {
                    const isReg5 = this.registrationSystem?.isRegistered?.(userId);
                    if (!isReg5 && !isOwner) { await this.bot.reply(m, '❌ Use *#registrar Nome|Idade* primeiro!'); return true; }
                    return await this._handlePoll(m, fullArgs);
                }

                case 'sortear':
                case 'raffle':
                case 'sorteio': {
                    if (!ehGrupo) { await this.bot.reply(m, '❌ Este comando só funciona em grupos.'); return true; }
                    if (!isOwner && !isAdminUsers) { await this.bot.reply(m, '🚫 Apenas admins podem fazer sorteios.'); return true; }
                    return await this._handleRaffle(m, chatJid, args);
                }

                case 'tts': {
                    const isReg6 = this.registrationSystem?.isRegistered?.(userId);
                    if (!isReg6 && !isOwner) { await this.bot.reply(m, '❌ Use *#registrar Nome|Idade* primeiro!'); return true; }
                    return await this._handleTTSCommand(m, args, fullArgs);
                }

                case 'piada':
                case 'joke': {
                    const isReg7 = this.registrationSystem?.isRegistered?.(userId);
                    if (!isReg7 && !isOwner) { await this.bot.reply(m, '❌ Use *#registrar Nome|Idade* primeiro!'); return true; }
                    return await this._handleFun(m, 'piada');
                }

                case 'frases':
                case 'quote':
                case 'motivar': {
                    const isReg8 = this.registrationSystem?.isRegistered?.(userId);
                    if (!isReg8 && !isOwner) { await this.bot.reply(m, '❌ Use *#registrar Nome|Idade* primeiro!'); return true; }
                    return await this._handleFun(m, 'frase');
                }

                case 'fatos':
                case 'curiosidade': {
                    const isReg9 = this.registrationSystem?.isRegistered?.(userId);
                    if (!isReg9 && !isOwner) { await this.bot.reply(m, '❌ Use *#registrar Nome|Idade* primeiro!'); return true; }
                    return await this._handleFun(m, 'fato');
                }

                case 'setbotphoto':
                case 'setbotpic':
                case 'setphoto':
                    if (!isOwner) return false;
                    return await this._handleSetBotPhoto(m);

                case 'setbotname':
                case 'setname':
                    if (!isOwner) return false;
                    return await this._handleSetBotName(m, fullArgs);

                case 'setbotstatus':
                case 'setbio':
                    if (!isOwner) return false;
                    return await this._handleSetBotStatus(m, fullArgs);

                case 'getprofile':
                case 'getuser':
                    if (!isOwner) return false;
                    return await this._handleGetProfileAdmin(m, args);

                case 'antilink':
                case 'antifake':
                case 'antiimage':
                case 'antisticker':
                    if (!isOwner && !isAdminUsers) return false;
                    return await this._handleToggleModeration(m, command, args);

                case 'warn':
                    if (!isOwner && !isAdminUsers) return false;
                    return await this._handleManualWarn(m, args);

                case 'unwarn':
                case 'resetwarns':
                    if (!isOwner && !isAdminUsers) return false;
                    return await this._handleResetWarns(m, args);

                case 'restart':
                    if (!isOwner) return false;
                    await this.bot.reply(m, '🔄 Reiniciando sistemas Akira...');
                    process.exit(0);
                    return true;

                default:
                    if (isOwner && await this.osintFramework.handleCommand(m, command, args)) return true;
                    return false;
            }

        } catch (error) {
            console.error('❌ Erro no handlesCommand:', error);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MÉTODOS AUXILIARES DE COMANDO
    // ═══════════════════════════════════════════════════════════════════════

    public async _reply(m: any, text: string, options: any = {}): Promise<any> {
        try {
            if (this.sock) {
                return await this.sock.sendMessage(m.key.remoteJid, { text, ...options }, { quoted: m });
            }
            // Fallback para bot.reply se sock falhar (mas sock deveria estar lá)
            if (this.bot && typeof this.bot.reply === 'function') {
                return await this.bot.reply(m, text, options);
            }
            console.error('❌ CommandHandler: Sem meio de responder (sock/bot ausente)');
        } catch (e: any) {
            console.error('❌ Erro no _reply:', e.message);
        }
    }

    public async _showMenu(m: any): Promise<boolean> {
        const menuText = `╔══════════════════════════════════════╗
║      🤖 *AKIRA BOT V21* 🤖           ║
║      *Enterprise Edition*            ║
╚══════════════════════════════════════╝

📱 *PREFIXO:* #
⚠️ _Comandos marcados com 🔒 exigem registro._

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *REGISTRO & PERFIL*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #registrar Nome|Idade — Cadastre-se
• #perfil — Seus dados e XP
• #level — Nível e progresso 🔒
• #rank — Top 10 do grupo 🔒

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *ECONOMIA*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #daily — Recompensa diária 🔒
• #atm — Ver saldo 🔒
• #transfer @user valor — Transferir 🔒

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 *MÍDIA & CRIAÇÃO*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #sticker | #s — Criar figurinha
• #take — Roubar figurinha
• #play [nome] — Baixar música 🔒
• #video [nome] — Baixar vídeo 🔒
• #toimg — Sticker → imagem
• #tomp3 — Vídeo → áudio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔊 *ÁUDIO & EFEITOS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #tts [idioma] texto — Texto p/ voz 🔒
• #nightcore — Rápido + agudo
• #slow — Lento + grave
• #bass | #bassboost — Graves
• #deep — Voz profunda
• #robot — Robótico
• #reverse — Reverso
• #squirrel — Voz de esquilo
• #echo — Eco
• #8d — Áudio 8D

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖼️ *EFEITOS DE IMAGEM*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #hd | #upscale — Melhorar qualidade
• #removebg — Remover fundo
• #wasted — Efeito GTA
• #jail | #triggered | #gay | #communism
• #sepia | #grey | #invert | #mission

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕹️ *DIVERSÃO*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #pinterest [busca] — Buscar imagens 🔒
• #ship @user @user — Compatibilidade
• #slot — Máquina de cassino
• #dado | #moeda — Sorteio
• #chance [pergunta] — Probabilidade
• #gay — Medidor de gayzice
• #piada — Piada aleatória 🔒
• #frases | #motivar — Frases inspiradoras 🔒
• #fatos | #curiosidade — Fatos curiosos 🔒

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 *GRUPOS (ADMIN)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #groupinfo — Info completa do grupo 🔒
• #admins — Listar admins 🔒
• #listar | #membros — Listar membros 👑
• #mute @user [min] — Silenciar 👑
• #desmute @user — Des-silenciar 👑
• #fechar | #abrir — Fechar/abrir grupo 👑
• #kick | #ban @user — Remover 👑
• #add [número] — Adicionar 👑
• #promote | #demote @user — ADM 👑
• #tagall | #totag [msg] — Mencionar 👑
• #sortear | #sorteio — Sortear membros 👑
• #enquete Pergunta | A | B — Criar poll 🔒
• #link — Link do grupo 👑
• #revlink | #revogar — Revog. link 👑
• #setdesc [texto] — Descrição 👑
• #setfoto — Foto (envie imagem) 👑
• #welcome on/off — Boas-vindas 👑
• #antilink on/off — Anti-links 👑
• #antispam on/off — Anti-spam 👑
• #warn @user — Advertir 👑
• #unwarn @user — Remover advertência 👑

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 *AUTONOMIA & PERSONALIZAÇÃO (DONO)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #setname [nome] — Mudar nome do bot 👑
• #setbio [bio] — Mudar recado do bot 👑
• #setfoto — Mudar foto do bot (enviar img) 👑
• #fixar [tempo] — Fixar mensagem 👑
• #desafixar — Desafixar mensagem 👑
• #reagir [emoji] — Reagir 👑
• #lido — Marcar como lido 👑
• #restart — Reiniciar sistema 👑

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ *CYBERSECURITY (DONO)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #nmap | #sqlmap | #dns | #whois
• #geo [ip] | #nuclei | #hydra
• #setoolkit | #metasploit | #nikto

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *UTILIDADES*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #ping — Status do sistema
• #report [bug] — Reportar problema

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 *LEGENDA:*
• 🔒 Requer registro (#registrar)
• 👑 Requer ser Admin/Dono

*Desenvolvido por Isaac Quarenta*
*AKIRA V21 ULTIMATE — Enterprise Edition*`;


        await this._reply(m, menuText);

        // Simula leitura após enviar menu
        if (this.presenceSimulator) {
            await this.presenceSimulator.markAsRead(m);
        }

        return true;
    }


    public async _handleSticker(m: any, nome: string): Promise<boolean> {
        try {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const targetMessage = quoted || m.message;

            if (!targetMessage) {
                await this._reply(m, '❌ Responda a uma imagem ou vídeo curto para criar o sticker.');
                return true;
            }

            const packName = 'akira-bot';
            const author = nome || 'Akira-Bot';

            const isVideo = !!(targetMessage.videoMessage || targetMessage.viewOnceMessageV2?.message?.videoMessage);
            const isImage = !!(targetMessage.imageMessage || targetMessage.viewOnceMessageV2?.message?.imageMessage);

            if (!isImage && !isVideo) {
                const buf = await this.mediaProcessor.downloadMedia(targetMessage, 'image');
                if (buf) {
                    const res = await this.mediaProcessor.createStickerFromImage(buf, { packName, author });
                    if (res && res.sucesso && res.buffer) {
                        await this.sock.sendMessage(m.key.remoteJid, { sticker: res.buffer }, { quoted: m });
                        return true;
                    }
                }
                await this._reply(m, '❌ Conteúdo de mídia não encontrado ou formato não suportado.');
                return true;
            }

            let res;
            if (isImage) {
                const buf = await this.mediaProcessor.downloadMedia(targetMessage, 'image');
                res = await this.mediaProcessor.createStickerFromImage(buf, { packName, author });
            } else if (isVideo) {
                const buf = await this.mediaProcessor.downloadMedia(targetMessage, 'video');
                res = await this.mediaProcessor.createAnimatedStickerFromVideo(buf, 10, { packName, author });
            }

            if (res && res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, { sticker: res.buffer }, { quoted: m });
            } else {
                await this._reply(m, `❌ Erro ao criar sticker: ${res?.error || 'falha interna'} `);
            }
        } catch (e: any) {
            console.error('Erro em _handleSticker:', e);
            await this._reply(m, '❌ Erro no processamento do sticker.');
        }
        return true;
    }

    public async _handleTakeSticker(m: any, args: string, nome: string): Promise<boolean> {
        try {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const targetMessage = quoted || m.message;

            if (!targetMessage) {
                await this._reply(m, '❌ Responda a uma figurinha para usar o *take.');
                return true;
            }

            const buf = await this.mediaProcessor.downloadMedia(targetMessage, 'sticker');
            if (!buf) {
                await this._reply(m, '❌ Não foi possível baixar a figurinha.');
                return true;
            }

            // Converte para imagem
            const res = await this.mediaProcessor.convertStickerToImage(buf);

            if (res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, {
                    image: res.buffer,
                    caption: `✅ Figurinha "roubada" com sucesso por ${nome} !`
                }, { quoted: m });
            } else {
                await this._reply(m, `❌ Erro ao converter figurinha: ${res.error || 'falha interna'} `);
            }
        } catch (e: any) {
            console.error('Erro em _handleTakeSticker:', e);
            await this._reply(m, '❌ Erro ao processar o take.');
        }
        return true;
    }

    public async _handleStickerToImage(m: any): Promise<boolean> {
        try {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const targetMessage = quoted || m.message;

            if (!targetMessage) {
                await this._reply(m, '❌ Responda a uma figurinha para converter em imagem.');
                return true;
            }

            const buf = await this.mediaProcessor.downloadMedia(targetMessage, 'sticker');
            if (!buf) {
                await this._reply(m, '❌ Não foi possível baixar a figurinha.');
                return true;
            }

            const res = await this.mediaProcessor.convertStickerToImage(buf);

            if (res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, {
                    image: res.buffer,
                    caption: '✅ Figurinha convertida em imagem!'
                }, { quoted: m });
            } else {
                await this._reply(m, `❌ Erro na conversão: ${res.error || 'falha interna'} `);
            }
        } catch (e: any) {
            console.error('Erro em _handleStickerToImage:', e);
            await this._reply(m, '❌ Erro ao converter sticker para imagem.');
        }
        return true;
    }


    public async _handlePlay(m: any, query: string): Promise<boolean> {
        if (!query) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}play <nome da música ou link>`);
            return true;
        }
        await this._reply(m, '⏳ baixando');

        try {
            const res = await this.mediaProcessor.downloadYouTubeAudio(query);

            if (!res.sucesso || res.error) {
                await this._reply(m, `❌ ${res.error || 'Erro desconhecido ao baixar áudio.'}`);
                return true;
            }

            // Enviar thumbnail e metadados se disponíveis
            if (res.thumbnail) {
                const thumbBuf = await this.mediaProcessor.fetchBuffer(res.thumbnail).catch((): any => null);
                if (thumbBuf) {
                    const duracaoMin = res.duracao ? `${Math.floor(res.duracao / 60)}:${(res.duracao % 60).toString().padStart(2, '0')}` : '??';
                    const caption = `🎵 *${res.titulo || 'Música'}*\n\n` +
                        `👤 *Canal:* ${res.autor}\n` +
                        `⏱️ *Duração:* ${duracaoMin}\n` +
                        `👁️ *Views:* ${res.views}\n` +
                        `👍 *Likes:* ${res.likes}\n\n` +
                        `🎧 _Enviando áudio..._`;

                    await this.sock.sendMessage(m.key.remoteJid, {
                        image: thumbBuf,
                        caption: caption
                    }, { quoted: m });
                }
            }

            // Verifica se o arquivo existe antes de enviar
            if (res.audioPath && !fs.existsSync(res.audioPath)) {
                await this._reply(m, '❌ Erro interno: Arquivo de áudio não encontrado após download.');
                return true;
            }

            const fileSizeMB = res.tamanho ? (res.tamanho / (1024 * 1024)).toFixed(1) : '??';
            const isLargeFile = res.tamanho > 64 * 1024 * 1024;

            if (isLargeFile) {
                this.logger?.info(`📄 Áudio grande(${fileSizeMB}MB), enviando como documento para evitar erro de limite.`);
                await this.sock.sendMessage(m.key.remoteJid, {
                    document: { url: res.audioPath },
                    fileName: `${res.titulo || 'audio'}.mp3`,
                    mimetype: 'audio/mpeg',
                    caption: `🎵 *${res.titulo}*\n📦 *Tamanho:* ${fileSizeMB} MB\n\n💡 _Enviado como documento devido ao tamanho._`
                }, { quoted: m });
            } else {
                await this.sock.sendMessage(m.key.remoteJid, {
                    audio: { url: res.audioPath },
                    mimetype: 'audio/mpeg',
                    ptt: false,
                    fileName: `${res.titulo || 'audio'}.mp3`
                }, { quoted: m });
            }

            if (res.audioPath) {
                // Delay cleanup para dar tempo do Baileys ler/streamar o arquivo
                const cleanupDelay = isLargeFile ? 60000 : 20000;
                setTimeout(() => {
                    this.mediaProcessor.cleanupFile(res.audioPath).catch(console.error);
                }, cleanupDelay);
            }

        } catch (e: any) {
            console.error('Erro no play:', e);
            await this._reply(m, `❌ Erro crítico ao processar o comando play: ${e.message}`);
        }
        return true;
    }

    public async _handleProfile(m: any, meta: any): Promise<boolean> {
        const { nome, numeroReal } = meta;
        const uid = m.key.participant || m.key.remoteJid;

        try {
            if (!this.bot?.levelSystem) {
                throw new Error('LevelSystem não inicializado');
            }
            // Obtém dados do levelSystem
            const record = this.bot.levelSystem.getGroupRecord(m.key.remoteJid, uid, true);

            // Obtém dados extras do UserProfile (Bio, Foto, etc)
            const userInfo = await this.userProfile.getUserInfo(uid);

            let msg = `👤 *PERFIL DE USUÁRIO* 👤\n\n`;
            msg += `📝 *Nome:* ${nome}\n`;
            msg += `📱 *Número:* ${numeroReal}\n`;
            msg += `🎮 *Nível:* ${record.level || 0}\n`;
            msg += `⭐ *XP:* ${record.xp || 0}\n`;
            msg += `📜 *Bio:* ${userInfo.status || 'Sem biografia'}\n\n`;

            msg += `🏆 *CONQUISTAS:* ${record.level > 10 ? '🎖️ Veterano' : '🐣 Novato'}\n`;
            msg += `💎 *Status:* ${this.bot.subscriptionManager.isPremium(uid) ? 'PREMIUM 💎' : 'FREE'}\n`;

            if (userInfo.picture) {
                await this.sock.sendMessage(m.key.remoteJid, {
                    image: { url: userInfo.picture },
                    caption: msg
                }, { quoted: m });
            } else {
                await this._reply(m, msg);
            }
        } catch (e: any) {
            console.error('Erro no _handleProfile:', e);
            await this._reply(m, '❌ Erro ao carregar perfil.');
        }
        return true;
    }



    public async _handleDono(m: any): Promise<boolean> {
        const donos = this.config.DONO_USERS;
        if (!donos || donos.length === 0) {
            await this._reply(m, '❌ Nenhum dono configurado.');
            return true;
        }

        // Prioriza o número solicitado pelo usuário: 244937035662
        const principal = donos.find((d: any) => d.numero === '244937035662') || donos[0];

        // Envia contato (VCard)
        const vcard = 'BEGIN:VCARD\n' + // metadata of the contact card
            'VERSION:3.0\n' +
            `FN:${principal.nomeExato}\n` + // full name
            `ORG:Akira Enterprise;\n` + // the organization of the contact
            `TEL;type=CELL;type=VOICE;waid=${principal.numero}:${principal.numero}\n` + // WhatsApp ID + phone number
            'END:VCARD';

        await this.sock.sendMessage(m.key.remoteJid, {
            contacts: {
                displayName: principal.nomeExato,
                contacts: [{ vcard }]
            }
        }, { quoted: m });

        // Mensagem de texto de apoio com link wa.me explícito
        await this._reply(m, `👑 *DONO DO BOT*\n\nDesenvolvido por: *${principal.nomeExato}*\n📱 *Contato Direto:* https://wa.me/${principal.numero}\n\nPowered by: *Akira V21 Ultimate*`);
        return true;
    }

    public async _handleReport(m: any, fullArgs: string, nome: string, senderId: string, ehGrupo: boolean): Promise<boolean> {
        if (!fullArgs) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}report <bug/sugestão>`);
            return true;
        }

        const reportId = Math.random().toString(36).substring(7).toUpperCase();
        const origem = ehGrupo ? `Grupo (${m.key.remoteJid.split('@')[0]})` : 'Privado (PV)';
        const timestamp = new Date().toLocaleString('pt-BR');

        const reportMsg = `🚨 *NOVO REPORT [${reportId}]* 🚨\n\n` +
            `👤 *De:* ${nome}\n` +
            `📱 *Número:* ${senderId.split('@')[0]}\n` +
            `📍 *Origem:* ${origem}\n` +
            `🕒 *Data:* ${timestamp}\n\n` +
            `📝 *Conteúdo:*\n${fullArgs}`;

        const donos = this.config.DONO_USERS;
        let sentCount = 0;

        for (const dono of donos) {
            if (dono.numero) {
                const donoJid = dono.numero + '@s.whatsapp.net';
                await this.sock.sendMessage(donoJid, { text: reportMsg });
                sentCount++;
            }
        }

        if (sentCount > 0) {
            await this._reply(m, `✅ *Report enviado com sucesso!*\nID: #${reportId}\n\nObrigado por colaborar.`);
        } else {
            await this._reply(m, '⚠️ Erro ao enviar report: Nenhum administrador disponível.');
            console.warn(`[REPORT FALHO] ${reportMsg}`);
        }
        return true;
    }



    public async _handlePremiumInfo(m: any, senderId: string): Promise<boolean> {
        const info = this.bot.subscriptionManager.getSubscriptionInfo(senderId);
        let msg = `💎 *STATUS PREMIUM*\n\n`;
        msg += `🏷️ Nível: ${info.tier}\n`;
        msg += `📊 Status: ${info.status}\n`;
        msg += `📅 Expira em: ${info.expiraEm || 'N/A'}\n\n`;
        msg += `✨ *Recursos:* \n${info.recursos.join('\n')}`;

        await this._reply(m, msg);
        return true;
    }

    public async _handleAddPremium(m: any, args: string[]): Promise<boolean> {
        if (args.length < 2) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}addpremium <numero> <dias>`);
            return true;
        }

        let targetUser = args[0].replace(/\D/g, '');
        let days = parseInt(args[1]);

        if (!targetUser || isNaN(days)) {
            await this._reply(m, '❌ Formato inválido.');
            return true;
        }

        // Adiciona sufixo se necessário para a chave do mapa (embora o SubscriptionManager use apenas o ID geralmente, vamos padronizar)
        // O SubscriptionManager usa a chave que passamos. Se passarmos só numero, ele usa só numero.
        // O senderId vem como numero@s.whatsapp.net. Vamos manter consistência.
        const targetJid = targetUser + '@s.whatsapp.net';

        const res = this.bot.subscriptionManager.subscribe(targetJid, days);

        if (res.sucesso) {
            await this._reply(m, `✅ Premium adicionado para ${targetUser} por ${days} dias.\nExpira em: ${res.expiraEm}`);
        } else {
            await this._reply(m, `❌ Erro: ${res.erro}`);
        }
        return true;
    }

    public async _handleDelPremium(m: any, args: string[]): Promise<boolean> {
        if (args.length < 1) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}delpremium <numero>`);
            return true;
        }

        let targetUser = args[0].replace(/\D/g, '');
        const targetJid = targetUser + '@s.whatsapp.net';

        const res = this.bot.subscriptionManager.unsubscribe(targetJid);

        if (res.sucesso) {
            await this._reply(m, `✅ Premium removido de ${targetUser}`);
        } else {
            await this._reply(m, `❌ Erro: ${res.erro}`);
        }
        return true;
    }





    public async _handleVideo(m: any, query: string): Promise<boolean> {
        if (!query) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}video <nome ou link>`);
            return true;
        }
        await this._reply(m, '🎬 Baixando vídeo... (Arquivos grandes podem demorar)');
        try {
            const res = await this.mediaProcessor.downloadYouTubeVideo(query);

            if (!res.sucesso || (!res.buffer && !res.videoPath)) {
                await this._reply(m, `❌ ${res.error || 'Erro ao baixar vídeo.'}`);
                return true;
            }

            let thumbBuf = null;
            if (res.thumbnail) {
                thumbBuf = await this.mediaProcessor.fetchBuffer(res.thumbnail).catch((): any => null);
            }

            const fileSizeMB = res.size ? (res.size / (1024 * 1024)).toFixed(1) : '??';
            const caption = `🎬 *${res.titulo}*\n👤 *Canal:* ${res.autor || 'Desconhecido'}\n📦 *Tamanho:* ${fileSizeMB}MB`;

            const isLargeFile = res.size > 64 * 1024 * 1024;

            if (isLargeFile) {
                this.logger?.info(`📄 Arquivo grande (${fileSizeMB}MB), enviando como documento para evitar erro de limite.`);
                await this.sock.sendMessage(m.key.remoteJid, {
                    document: { url: res.videoPath },
                    fileName: `${res.titulo}.mp4`,
                    mimetype: 'video/mp4',
                    caption: caption + '\n\n💡 _Enviado como documento para manter a qualidade e evitar limites do WhatsApp._'
                }, { quoted: m });
            } else {
                await this.sock.sendMessage(m.key.remoteJid, {
                    video: res.buffer || { url: res.videoPath },
                    caption: caption,
                    mimetype: 'video/mp4',
                    jpegThumbnail: thumbBuf || undefined
                }, { quoted: m });
            }

            if (res.videoPath) {
                const cleanupDelay = isLargeFile ? 60000 : 15000;
                setTimeout(() => {
                    this.mediaProcessor.cleanupFile(res.videoPath).catch((e: any) => console.error('Erro no cleanup tardio:', e.message));
                }, cleanupDelay);
            }

        } catch (e: any) {
            console.error('Erro no video:', e);
            await this._reply(m, `❌ Erro ao processar vídeo: ${e.message}`);
        }
        return true;
    }

    public async _handleImageEffect(m: any, command: string, args: string[]): Promise<boolean> {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const targetMessage = quoted || m.message;

        if (!targetMessage) {
            await this._reply(m, '❌ Responda a uma imagem para aplicar o efeito.');
            return true;
        }

        await this._reply(m, `🎨 Aplicando efeito *${command}*...`);
        try {
            const buf = await this.mediaProcessor.downloadMedia(targetMessage, 'image');
            if (!buf) throw new Error('Falha ao baixar imagem.');

            // Tratamento de argumentos para addbg/gradient
            let options: any = {};
            if (['addbg', 'adicionarfundo'].includes(command)) {
                options.color = args[0];
            }
            if (['gradient', 'fundogradiente'].includes(command)) {
                options.color1 = args[0];
                options.color2 = args[1];
            }

            const res = await this.imageEffects.processImage(buf, command, options);

            if (res.success && res.buffer) {
                // Envia como imagem (usuário pode converter pra sticker com *sticker se quiser)
                await this.sock.sendMessage(m.key.remoteJid, { image: res.buffer, caption: `✅ Efeito ${command} aplicado` }, { quoted: m });
            } else {
                await this._reply(m, `❌ Erro: ${res.error || 'Falha desconhecida'}`);
            }
        } catch (e: any) {
            await this._reply(m, '❌ Erro ao processar imagem.');
            console.error(e);
        }
        return true;
    }

    public async _handlePaymentCommand(m: any, args: string[]): Promise<boolean> {
        // Se usuario quer ver info
        if (args.length === 0) {
            const plans = this.bot.paymentManager.getPlans();
            let msg = `💎 *SEJA PREMIUM NO AKIRA BOT*\n\n`;
            msg += `Desbloqueie recursos exclusivos, remova limites e suporte o projeto!\n\n`;

            for (const [key, plan] of Object.entries(plans) as [string, any][]) {
                msg += `🏷️ *${plan.name}*\n`;
                msg += `💰 Valor: R$ ${plan.price.toFixed(2)}\n`;
                msg += `📅 Duração: ${plan.days} dias\n`;
                msg += `👉 Use: *${this.config.PREFIXO}buy ${key}*\n\n`;
            }

            msg += `💡 *Vantagens:*\n`;
            msg += `✅ Acesso a ferramentas de Cybersecurity\n`;
            msg += `✅ Comandos de OSINT avançados\n`;
            msg += `✅ Prioridade no processamento\n`;
            msg += `✅ Suporte VIP\n\n`;

            if (this.bot.paymentManager.payConfig.kofiPage) {
                msg += `☕ *Apoie no Ko-fi:*\nhttps://ko-fi.com/${this.bot.paymentManager.payConfig.kofiPage}\n`;
                msg += `⚠️ *IMPORTANTE:* Ao doar, escreva seu número de WhatsApp na mensagem para ativar o VIP automaticamente!`;
            }

            await this._reply(m, msg);
            return true;
        }

        const planKey = args[0].toLowerCase().trim();
        const userId = m.key.participant || m.key.remoteJid;

        // Gera link
        const res = this.bot.paymentManager.generatePaymentLink(userId, planKey);

        if (res.success) {
            await this._reply(m, `⏳ *Gerando Pagamento...*`);

            // Envia QR Code se disponível
            await this._reply(m, `✅ *Pedido Criado!*\n\n${res.message}\n\n_Assim que o pagamento for confirmado, seu plano será ativado automaticamente._`);
        } else {
            await this._reply(m, `❌ ${res.message}`);
        }
        return true;
    }

    public async _handleVideoToAudio(m: any): Promise<boolean> {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const targetMessage = quoted || m.message;

        if (!targetMessage) {
            await this._reply(m, '❌ Responda a um vídeo para converter para MP3.');
            return true;
        }

        await this._reply(m, '🎵 Convertendo para MP3...');
        try {
            const buf = await this.mediaProcessor.downloadMedia(targetMessage, 'video');
            if (!buf) throw new Error('Falha ao baixar vídeo.');

            const res = await this.mediaProcessor.convertVideoToAudio(buf);

            if (res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, { audio: res.buffer, mimetype: 'audio/mp4', ptt: false }, { quoted: m });
            } else {
                await this._reply(m, `❌ Erro: ${res.error}`);
            }
        } catch (e: any) {
            await this._reply(m, '❌ Erro ao converter para MP3.');
            console.error(e);
        }
        return true;
    }

    public async _handleSetBotPhoto(m: any): Promise<boolean> {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const targetMessage = quoted || m.message;
        const chatJid = m.key.remoteJid;
        const ehGrupo = chatJid.endsWith('@g.us');

        if (!targetMessage) {
            await this._reply(m, `❌ Responda a uma imagem para definir como foto do ${ehGrupo ? 'grupo' : 'bot'}.`);
            return true;
        }

        await this._reply(m, `📸 Atualizando foto do ${ehGrupo ? 'grupo' : 'bot'}...`);
        try {
            const buf = await this.mediaProcessor.downloadMedia(targetMessage, 'image');
            if (!buf) throw new Error('Falha ao baixar imagem.');

            let res;
            if (ehGrupo) {
                res = await this.groupManagement.setGroupPhoto(chatJid, buf);
            } else {
                res = await this.botProfile.setBotPhoto(buf);
            }

            if (res.success) {
                await this._reply(m, `✅ Foto do ${ehGrupo ? 'grupo' : 'bot'} atualizada com sucesso!`);
            } else {
                await this._reply(m, `❌ Erro ao atualizar foto: ${res.error}`);
            }
        } catch (e: any) {
            await this._reply(m, '❌ Erro ao processar foto.');
            console.error(e);
        }
        return true;
    }

    public async _handleSetBotName(m: any, name: string): Promise<boolean> {
        const chatJid = m.key.remoteJid;
        const ehGrupo = chatJid.endsWith('@g.us');

        if (!name) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}${ehGrupo ? 'setname' : 'setbotname'} <nome>`);
            return true;
        }

        await this._reply(m, `📛 Alterando nome do ${ehGrupo ? 'grupo' : 'sistema'} para: ${name}`);

        let res;
        if (ehGrupo) {
            res = await this.groupManagement.setGroupName(chatJid, name);
        } else {
            res = await this.botProfile.setBotName(name);
        }

        if (res.success) {
            await this._reply(m, `✅ Nome do ${ehGrupo ? 'grupo' : 'bot'} atualizado!`);
        } else {
            await this._reply(m, `❌ Erro: ${res.error}`);
        }
        return true;
    }

    public async _handleSetBotStatus(m: any, status: string): Promise<boolean> {
        const chatJid = m.key.remoteJid;
        const ehGrupo = chatJid.endsWith('@g.us');

        if (!status) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}${ehGrupo ? 'setdesc' : 'setbotstatus'} <texto>`);
            return true;
        }

        await this._reply(m, `📝 Alterando ${ehGrupo ? 'descrição' : 'bio'} para: ${status}`);

        let res;
        if (ehGrupo) {
            res = await this.groupManagement.setGroupDescription(chatJid, status);
        } else {
            res = await this.botProfile.setBotStatus(status);
        }

        if (res.success) {
            await this._reply(m, `✅ ${ehGrupo ? 'Descrição' : 'Bio'} atualizada!`);
        } else {
            await this._reply(m, `❌ Erro: ${res.error}`);
        }
        return true;
    }


    // ═══════════════════════════════════════════════════════════════════════
    // NOVOS COMANDOS (DIVERSÃO & GESTÃO)
    // ═══════════════════════════════════════════════════════════════════════

    public async _handlePinterest(m: any, query: string, args: string[]): Promise<boolean> {
        if (!query) {
            await this._reply(m, `🔎 Uso: ${this.config.PREFIXO}pinterest <busca> | <quantidade 1-5>`);
            return true;
        }

        const parts = query.split('|');
        const searchTerm = parts[0].trim();
        const count = Math.min(Math.max(parseInt(parts[1] || '1', 10) || 1, 1), 5);

        await this._reply(m, `🔎 Buscando "${searchTerm}" no Pinterest...`);

        try {
            const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(searchTerm)}`;
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const jsonMatch = response.data.match(/\"id\":\"[0-9]+\",\"images\":\{\"orig\":\{\"url\":\"(https:\/\/i\.pinimg\.com\/originals\/[a-f0-9]+\.(jpg|png|gif))\"/g);

            let images: (string | null)[] = [];
            if (jsonMatch) {
                images = jsonMatch.map((match: string) => {
                    const urlMatch = match.match(/url\":\"(https:\/\/i\.pinimg\.com\/originals\/[a-f0-9]+\.(jpg|png|gif))/);
                    return urlMatch ? urlMatch[1] : null;
                }).filter((url: string | null) => url !== null);
            }

            if (images.length === 0) {
                const genericMatch = (response.data as string).match(/https:\/\/i\.pinimg\.com\/[^\/]+\/[a-f0-9]+\.(jpg|png|gif)/g);
                if (genericMatch) images = [...new Set(genericMatch)];
            }

            if (images.length === 0) {
                await this._reply(m, '❌ Não consegui encontrar imagens no Pinterest no momento. Tente novamente mais tarde.');
                return true;
            }

            const uniqueImages = Array.from(new Set(images)).slice(0, count) as string[];

            for (const imageUrl of uniqueImages) {
                try {
                    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
                    await this.sock.sendMessage(m.key.remoteJid, {
                        image: Buffer.from(imgRes.data),
                        caption: `🔎 *Busca:* ${searchTerm}\n📌 *Pinterest*`
                    }, { quoted: m });
                } catch (e: any) {
                    this.logger?.error(`Erro ao baixar imagem: ${imageUrl}`, e.message);
                }
            }
        } catch (e: any) {
            await this._reply(m, '❌ Erro ao acessar o serviço de busca.');
            console.error(e);
        }
        return true;
    }

    public async _handleShip(m: any): Promise<boolean> {
        try {
            const ctx = m.message?.extendedTextMessage?.contextInfo;
            const mentioned = ctx?.mentionedJid || [];

            if (mentioned.length < 2) {
                await this._reply(m, '💞 Uso: *ship @pessoa1 @pessoa2');
                return true;
            }

            const percent = Math.floor(Math.random() * 101);
            let comment = '';
            if (percent > 80) comment = '💖 Casal perfeito! Casem logo.';
            else if (percent > 50) comment = '😊 Tem chance, hein?';
            else comment = '😬 Vish, melhor ficarem só na amizade.';

            const msg = `💞 *COMPATIBILIDADE* 💞\n\n@${mentioned[0].split('@')[0]} + @${mentioned[1].split('@')[0]}\n🔥 *Chance:* ${percent}%\n\n${comment}`;

            await this.sock.sendMessage(m.key.remoteJid, {
                text: msg,
                contextInfo: { mentionedJid: mentioned }
            }, { quoted: m });
        } catch (e: any) {
            await this._reply(m, '❌ Erro no cálculo de compatibilidade.');
        }
        return true;
    }

    public async _handleGames(m: any, command: string, args: string[]): Promise<boolean> {
        try {
            switch (command) {
                case 'dado': {
                    const dado = Math.floor(Math.random() * 6) + 1;
                    await this._reply(m, `🎲 Você tirou: *${dado}*`);
                    break;
                }
                case 'moeda':
                case 'caracoroa': {
                    const moeda = Math.random() < 0.5 ? 'CARA' : 'COROA';
                    await this._reply(m, `🪙 Resultado: *${moeda}*`);
                    break;
                }
                case 'slot': {
                    const items = ['🍒', '🍋', '🍇', '🍉', '🍎', '🍍', '🥝', '🍑'];
                    const a = items[Math.floor(Math.random() * items.length)];
                    const b = items[Math.floor(Math.random() * items.length)];
                    const c = items[Math.floor(Math.random() * items.length)];
                    const win = (a === b && b === c);
                    const slotMsg = `🎰 *SLOT MACHINE* 🎰\n\n[ ${a} | ${b} | ${c} ]\n\n${win ? '🎉 *PARABÉNS! VOCÊ GANHOU!*' : '😔 Não foi dessa vez...'}`;
                    await this._reply(m, slotMsg);
                    break;
                }
                case 'chance': {
                    if (args.length === 0) {
                        await this._reply(m, `📊 Uso: ${this.config.PREFIXO}chance <pergunta>`);
                        break;
                    }
                    const percent = Math.floor(Math.random() * 101);
                    await this._reply(m, `📊 A chance de *${args.join(' ')}* é de *${percent}%*`);
                    break;
                }
                case 'gay': {
                    const gayPercent = Math.floor(Math.random() * 101);
                    await this._reply(m, `🏳️🌈 Você é *${gayPercent}%* gay`);
                    break;
                }
            }
        } catch (e: any) {
            await this._reply(m, '❌ Erro ao processar o jogo.');
        }
        return true;
    }

    // _handleTagAll: ver implementação completa abaixo (linha ~1969)

    // _handleWelcome: ver implementação completa abaixo (linha ~1933)

    public async _handleBroadcast(m: any, text: string): Promise<boolean> {
        if (!text) {
            await this._reply(m, `📢 Uso: ${this.config.PREFIXO}broadcast <mensagem>`);
            return true;
        }

        await this._reply(m, '🚀 Enviando transmissão global...');
        try {
            const groups: any = await this.sock.groupFetchAllParticipating();
            const jids = Object.keys(groups);

            let success = 0;
            for (const jid of jids) {
                try {
                    await this.sock.sendMessage(jid, { text: `📢 *AVISO GLOBAL:* \n\n${text}` });
                    success++;
                    await new Promise(r => setTimeout(r, 1000)); // Delay p/ evitar ban
                } catch (err: any) { }
            }
            await this._reply(m, `✅ Transmissão concluída! Enviado para ${success} grupos.`);
        } catch (e: any) {
            await this._reply(m, '❌ Erro na transmissão.');
        }
        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // SISTEMA DE REGISTRO
    // ═════════════════════════════════════════════════════════════════

    /**
     * Processa comando #registrar Nome|Idade
     */
    public async _handleRegister(m: any, fullArgs: string, userId: string): Promise<boolean> {
        try {
            // Verifica se já está registrado
            if (this.registrationSystem.isRegistered(userId)) {
                const profile = this.registrationSystem.getProfile(userId);

                await this.bot.reply(m,
                    `✅ **Você já está registrado!**\n\n` +
                    `📝 **Nome:** ${profile.nome}\n` +
                    `🎂 **Idade:** ${profile.idade} anos\n` +
                    `🔑 **Serial:** \`${profile.serial}\`\n` +
                    `🔗 **Link:** ${profile.link}\n` +
                    `📅 **Registrado em:** ${new Date(profile.registeredAt).toLocaleDateString('pt-BR')}`
                );
                return true;
            }

            // Valida formato
            if (!fullArgs || !fullArgs.includes('|')) {
                await this.bot.reply(m,
                    `❌ **Formato Incorreto**\n\n` +
                    `Use: \`#registrar Nome|Idade\`\n\n` +
                    `**Exemplos:**\n` +
                    `• \`#registrar João Silva|25\`\n` +
                    `• \`#registrar Maria Santos|30\`\n\n` +
                    `⚠️ A idade deve estar entre 13 e 99 anos.`
                );
                return true;
            }

            // Extrai nome e idade
            const parts = fullArgs.split('|');
            const nomeRegistro = parts[0].trim();
            const idadeStr = parts[1].trim();
            const idade = parseInt(idadeStr);

            // Valida nome
            if (!nomeRegistro || nomeRegistro.length < 3) {
                await this.bot.reply(m, '❌ O nome deve ter pelo menos 3 caracteres.');
                return true;
            }

            if (nomeRegistro.length > 50) {
                await this.bot.reply(m, '❌ O nome não pode ter mais de 50 caracteres.');
                return true;
            }

            // Valida idade
            if (isNaN(idade) || idade < 13 || idade > 99) {
                await this.bot.reply(m, '❌ A idade deve ser um número entre 13 e 99.');
                return true;
            }

            // Registra usuário
            const result = this.registrationSystem.register(userId, nomeRegistro, idade);

            if (result.success) {
                await this.bot.reply(m,
                    `🎉 **Registro Concluído com Sucesso!**\n\n` +
                    `📝 **Nome:** ${result.user.nome}\n` +
                    `🎂 **Idade:** ${result.user.idade} anos\n` +
                    `🔑 **Serial Único:** \`${result.user.serial}\`\n` +
                    `🔗 **Seu Link:** ${result.user.link}\n\n` +
                    `✅ Agora você tem acesso a todos os comandos do bot!\n` +
                    `Use \`#menu\` para ver os comandos disponíveis.`
                );
            } else {
                await this.bot.reply(m, `❌ Erro ao registrar: ${result.error}`);
            }

            return true;

        } catch (error: any) {
            console.error('Erro no registro:', error);
            await this.bot.reply(m, `❌ Erro ao processar registro: ${error.message}`);
            return true;
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // SISTEMA DE LEVEL (V21)
    // ═════════════════════════════════════════════════════════════════

    /**
     * Comando #level - Ver nível do usuário
     */



    // ═════════════════════════════════════════════════════════════════
    // SISTEMA DE LEVEL (V21)
    // ═════════════════════════════════════════════════════════════════

    /**
     * Comando #level - Ver nível do usuário
     */
    public async _handleLevel(m: any, userId: string, chatJid: string, ehGrupo: boolean): Promise<boolean> {
        try {
            const groupId = ehGrupo ? chatJid : 'global';

            const rec = this.levelSystem.getGroupRecord(groupId, userId, true);
            const patente = this.levelSystem.getPatente(rec.level || 0);
            const xpNeeded = this.levelSystem.requiredXp(rec.level || 0);
            const xpAtual = rec.xp || 0;
            const progress = (xpNeeded > 0 && isFinite(xpNeeded))
                ? ((xpAtual / xpNeeded) * 100).toFixed(1)
                : '100.0';
            const faltam = (isFinite(xpNeeded) && xpNeeded > xpAtual)
                ? xpNeeded - xpAtual
                : 0;

            await this.bot.reply(m,
                `📊 *Seu Nível*\n\n` +
                `🏅 *Patente:* ${patente}\n` +
                `🏆 *Level:* ${rec.level || 0}\n` +
                `⭐ *XP:* ${xpAtual}/${isFinite(xpNeeded) ? xpNeeded : '∞'}\n` +
                `📈 *Progresso:* ${progress}%\n\n` +
                `🎯 Faltam *${faltam} XP* para o próximo nível!`
            );

            return true;
        } catch (error: any) {
            console.error('Erro no comando level:', error);
            await this.bot.reply(m, '❌ Erro ao obter informações de level.');
            return true;
        }
    }

    /**
     * Comando #rank - Top 10 do grupo
     */
    public async _handleRank(m: any, chatJid: string, ehGrupo: boolean): Promise<boolean> {
        try {
            if (!ehGrupo) {
                await this.bot.reply(m, '📵 Este comando só funciona em grupos.');
                return true;
            }

            const allData = this.levelSystem.data || [];
            const groupData = allData
                .filter((r: any) => r.gid === chatJid)
                .sort((a: any, b: any) => (b.level - a.level) || (b.xp - a.xp))
                .slice(0, 10);

            if (groupData.length === 0) {
                await this.bot.reply(m, '📊 Nenhum usuário com XP registrado ainda neste grupo.');
                return true;
            }

            let texto = '🏆 *TOP 10 — RANKING DE NÍVEIS* 🏆\n\n';
            const mentions: string[] = [];

            groupData.forEach((user: any, index: number) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
                const numero = user.uid.split('@')[0];
                const patente = this.levelSystem.getPatente(user.level || 0);
                texto += `${medal} @${numero}\n`;
                texto += `   📊 ${patente} • Level ${user.level} • ${user.xp} XP\n\n`;
                mentions.push(user.uid);
            });

            await this.sock.sendMessage(chatJid, { text: texto, mentions }, { quoted: m });

            return true;
        } catch (error: any) {
            console.error('Erro no comando rank:', error);
            await this.bot.reply(m, '❌ Erro ao gerar ranking.');
            return true;
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // SISTEMA DE ECONOMIA (V21)
    // ═════════════════════════════════════════════════════════════════

    /**
     * Comando #daily - Recompensa diária
     */
    public async _handleDaily(m: any, userId: string): Promise<boolean> {
        try {
            const result = this.economySystem.daily(userId);

            if (result.success) {
                await this.bot.reply(m,
                    `🎁 **Recompensa Diária Coletada!**\n\n` +
                    `💰 **Recebido:** ${result.amount} moedas\n` +
                    `💼 **Saldo Total:** ${result.newBalance} moedas\n\n` +
                    `⏰ Volte amanhã para coletar novamente!`
                );
            } else {
                const timeLeft = this.economySystem.getDailyTimeLeft(userId);
                const hours = Math.floor(timeLeft / 3600000);
                const minutes = Math.floor((timeLeft % 3600000) / 60000);

                await this.bot.reply(m,
                    `⏰ **Daily Já Coletado**\n\n` +
                    `Você já coletou sua recompensa diária.\n` +
                    `Volte em: **${hours}h ${minutes}m**`
                );
            }

            return true;
        } catch (error: any) {
            console.error('Erro no comando daily:', error);
            await this.bot.reply(m, '❌ Erro ao processar daily.');
            return true;
        }
    }

    /**
     * Comando #atm - Ver saldo
     */
    public async _handleATM(m: any, userId: string): Promise<boolean> {
        try {
            const balance = this.economySystem.getBalance(userId);

            await this.bot.reply(m,
                `🏦 **Seu Saldo Bancário**\n\n` +
                `💵 **Carteira:** ${balance.wallet} moedas\n` +
                `🏛️ **Banco:** ${balance.bank} moedas\n` +
                `💰 **Total:** ${balance.total} moedas\n\n` +
                `Use \`#daily\` para ganhar moedas diárias!`
            );

            return true;
        } catch (error: any) {
            console.error('Erro no comando atm:', error);
            await this.bot.reply(m, '❌ Erro ao obter saldo.');
            return true;
        }
    }

    /**
     * Comando #transfer - Transferir dinheiro
     */
    public async _handleTransfer(m: any, userId: string, args: string[], fullArgs: string): Promise<boolean> {
        try {
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) {
                await this.bot.reply(m,
                    `❌ **Formato Incorreto**\n\n` +
                    `Use: \`#transfer @usuario valor\`\n` +
                    `Exemplo: \`#transfer @amigo 100\``
                );
                return true;
            }

            const amount = parseInt(args[args.length - 1]);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.reply(m, '❌ Valor inválido. Use apenas números positivos.');
                return true;
            }

            if (target === userId) {
                await this.bot.reply(m, '❌ Você não pode transferir para si mesmo.');
                return true;
            }

            const result = this.economySystem.transfer(userId, target, amount);

            if (result.success) {
                const targetNum = target.split('@')[0];
                await this.bot.reply(m,
                    `✅ **Transferência Realizada!**\n\n` +
                    `💸 **Enviado:** ${amount} moedas\n` +
                    `👤 **Para:** @${targetNum}\n` +
                    `💰 **Seu Saldo:** ${result.senderBalance} moedas`,
                    { mentions: [target] }
                );
            } else {
                await this.bot.reply(m, `❌ ${result.error}`);
            }

            return true;
        } catch (error: any) {
            console.error('Erro no comando transfer:', error);
            await this.bot.reply(m, '❌ Erro ao transferir.');
            return true;
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // EFEITOS DE ÁUDIO
    // ═════════════════════════════════════════════════════════════════

    /**
     * Processa comandos de efeitos de áudio
     */
    public async _handleAudioEffect(m: any, effect: string): Promise<boolean> {
        try {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const targetMessage = quoted || m.message;

            const hasAudio = !!(targetMessage?.audioMessage ||
                targetMessage?.videoMessage ||
                targetMessage?.viewOnceMessage?.message?.audioMessage ||
                targetMessage?.viewOnceMessageV2?.message?.audioMessage);

            if (!quoted && !hasAudio) {
                await this._showAudioEffectUsage(m, effect);
                return true;
            }

            await this._reply(m, `⏳ Aplicando efeito *${effect}*... Aguarde.`);

            const audioBuffer = await this.mediaProcessor.downloadMedia(targetMessage, 'audio');

            if (!audioBuffer || audioBuffer.length === 0) {
                await this._reply(m, '❌ Não consegui baixar o áudio. Certifique-se de responder a um áudio ou enviar um com o comando na legenda.');
                return true;
            }

            const audioProcessor = this.bot?.audioProcessor;
            if (!audioProcessor) {
                await this._reply(m, '❌ Processador de áudio não disponível.');
                return true;
            }

            const result = await audioProcessor.applyAudioEffect(audioBuffer, effect);

            if (!result.sucesso) {
                await this._reply(m, `❌ Erro ao aplicar efeito: ${result.error || 'falha desconhecida'}`);
                return true;
            }

            await this.sock.sendMessage(m.key.remoteJid, {
                audio: result.buffer,
                mimetype: result.mimetype || 'audio/mpeg',
                ptt: true,
                fileName: `${effect}_${Date.now()}.ogg`
            }, { quoted: m });

            return true;

        } catch (error: any) {
            console.error(`Erro no efeito ${effect}:`, error);
            await this._reply(m,
                `❌ *Erro ao aplicar efeito*\n\nDetalhes: ${error.message}\n\nTente novamente com um áudio diferente.`
            );
            return true;
        }
    }

    public async _showAudioEffectUsage(m: any, effect: string): Promise<void> {
        await this.bot.reply(m,
            `🎵 **Como Usar Efeitos de Áudio**\n\n` +
            `1️⃣ Envie um áudio com a legenda \`#${effect}\`\n` +
            `2️⃣ Ou responda a um áudio com \`#${effect}\`\n\n` +
            `**Efeitos disponíveis:**\n` +
            `🎶 #nightcore - Rápido + agudo\n` +
            `🐌 #slow - Lento + grave\n` +
            `🔊 #bass - Graves intensos\n` +
            `🗣️ #deep - Voz profunda\n` +
            `🤖 #robot - Efeito robótico\n` +
            `⏮️ #reverse - Áudio reverso\n` +
            `🐿️ #squirrel - Voz de esquilo\n` +
            `📢 #echo - Eco\n` +
            `🎧 #8d - Áudio 8D`
        );
    }


    public async _handleGetProfileAdmin(m: any, args: string[]): Promise<boolean> {
        const target = this.userProfile.extractUserJidFromMessage(m.message, m) || m.key.participant || m.key.remoteJid;
        const userInfo = await this.userProfile.getUserInfo(target);

        if (!userInfo.success) {
            await this._reply(m, `❌ Erro ao obter perfil: ${userInfo.error}`);
            return true;
        }

        const msg = this.userProfile.formatUserDataMessage(userInfo);

        if (userInfo.hasPhoto && userInfo.photoUrl) {
            await this.sock.sendMessage(m.key.remoteJid, {
                image: { url: userInfo.photoUrl },
                caption: msg
            }, { quoted: m });
        } else {
            await this._reply(m, msg);
        }
        return true;
    }

    public async _handleToggleModeration(m: any, command: string, args: string[]): Promise<boolean> {
        const jid = m.key.remoteJid;
        const enable = args[0] === 'on' || args[0] === '1';
        const actionStr = enable ? 'ATIVADO' : 'DESATIVADO';

        if (!this.bot.moderationSystem) return true;

        switch (command) {
            case 'antilink':
                this.bot.moderationSystem.toggleAntiLink(jid, enable);
                await this._reply(m, `✅ Anti-Link ${actionStr} para este grupo.`);
                break;
            case 'antifake':
                this.bot.moderationSystem.toggleAntiFake(jid, enable);
                await this._reply(m, `✅ Anti-Fake (+244) ${actionStr} para este grupo.`);
                break;
            case 'antiimage':
                this.bot.moderationSystem.toggleAntiImage(jid, enable);
                await this._reply(m, `✅ Anti-Imagem ${actionStr} para este grupo.`);
                break;
            case 'antisticker':
                this.bot.moderationSystem.toggleAntiSticker(jid, enable);
                await this._reply(m, `✅ Anti-Sticker ${actionStr} para este grupo.`);
                break;
        }
        return true;
    }

    public async _handleManualWarn(m: any, args: string[]): Promise<boolean> {
        const target = this.userProfile.extractUserJidFromMessage(m.message, m);
        if (!target) {
            await this._reply(m, `⚠️ Marque ou responda a alguém para dar um aviso.`);
            return true;
        }

        const reason = args.join(' ') || 'Sem motivo especificado';

        if (this.bot.handleWarning) {
            await this.bot.handleWarning(m, reason);
        } else if (this.bot.moderationSystem) {
            const res = this.bot.moderationSystem.addWarning(m.key.remoteJid, target, reason, 'Manual');
            if (res.sucesso) {
                await this._reply(m, `⚠️ *AVISO APLICADO* ⚠️\n\n👤 Usuário: @${target.split('@')[0]}\n📝 Motivo: ${reason}\n📊 Avisos: ${res.warnings}/3\n\n${res.action === 'kick' ? '❌ Usuário banido por atingir o limite.' : '⚠️ Evite violar as regras para não ser banido.'}`, { mentions: [target] });
            }
        }
        return true;
    }

    public async _handleResetWarns(m: any, args: string[]): Promise<boolean> {
        const target = this.userProfile.extractUserJidFromMessage(m.message, m);
        if (!target) {
            await this._reply(m, `⚠️ Marque ou responda a alguém para resetar os avisos.`);
            return true;
        }

        if (this.bot.moderationSystem) {
            this.bot.moderationSystem.resetWarnings(m.key.remoteJid, target);
            await this._reply(m, `✅ Avisos resetados para o usuário.`);
        }
        return true;
    }

    public async _handleDelete(m: any, hasPermission: boolean): Promise<boolean> {
        const quotedMsg = m.message?.extendedTextMessage?.contextInfo;
        if (!quotedMsg) {
            await this._reply(m, '❌ Responda a uma mensagem para apagá-la.');
            return true;
        }

        const isMe = quotedMsg.participant === this.sock.user?.id || (this.bot?.userJid && quotedMsg.participant === this.bot.userJid);

        if (isMe || hasPermission) {
            try {
                await this.sock.sendMessage(m.key.remoteJid, {
                    delete: {
                        remoteJid: m.key.remoteJid,
                        fromMe: isMe,
                        id: quotedMsg.stanzaId,
                        participant: quotedMsg.participant
                    }
                });
            } catch (e: any) {
                await this._reply(m, `❌ Erro ao apagar mensagem: ${e.message}`);
            }
        } else {
            await this._reply(m, '🚫 Você não tem permissão para apagar mensagens de outros usuários.');
        }
        return true;
    }

    public async _handleWelcome(m: any, command: string, args: string[], fullArgs: string): Promise<boolean> {
        if (!this.groupManagement) return true;

        const groupJid = m.key.remoteJid;
        const subCommand = command.toLowerCase();

        switch (subCommand) {
            case 'welcome':
            case 'bemvindo':
                if (args[0] === 'on' || args[0] === 'off') {
                    await this.groupManagement.toggleSetting(m, 'welcome', args[0]);
                } else {
                    await this._reply(m, `💡 Use *#welcome on/off* para ligar/desligar ou *#setwelcome Texto* para configurar.`);
                }
                break;
            case 'setwelcome':
                if (!fullArgs) return await this._reply(m, '❌ Informe o texto de boas-vindas.');
                await this.groupManagement.setCustomMessage(groupJid, 'welcome', fullArgs);
                await this._reply(m, '✅ Mensagem de boas-vindas personalizada salva!');
                break;
            case 'setgoodbye':
                if (!fullArgs) return await this._reply(m, '❌ Informe o texto de saída.');
                await this.groupManagement.setCustomMessage(groupJid, 'goodbye', fullArgs);
                await this._reply(m, '✅ Mensagem de saída personalizada salva!');
                break;
            case 'goodbye':
                if (args[0] === 'on' || args[0] === 'off') {
                    await this.groupManagement.toggleSetting(m, 'goodbye', args[0]);
                } else {
                    await this._reply(m, `💡 Use *#goodbye on/off* para ligar/desligar ou *#setgoodbye Texto* para configurar.`);
                }
                break;
        }
        return true;
    }

    public async _handleTagAll(m: any, text: string, hide: boolean = false): Promise<boolean> {
        if (!this.sock) return true;
        try {
            const groupMetadata = await this.sock.groupMetadata(m.key.remoteJid);
            const participants = groupMetadata.participants.map((p: any) => p.id);

            if (hide) {
                const msgText = text || '📢 Chamando todos...';
                await this.sock.sendMessage(m.key.remoteJid, {
                    text: msgText,
                    mentions: participants
                }, { quoted: m });
            } else {
                let msg = `📢 *Tagueando Todos* 📢\n\n`;
                if (text) msg += `📝 *Mensagem:* ${text}\n\n`;

                for (const part of groupMetadata.participants) {
                    msg += `• @${part.id.split('@')[0]}\n`;
                }

                await this.sock.sendMessage(m.key.remoteJid, {
                    text: msg,
                    mentions: participants
                }, { quoted: m });
            }
        } catch (e: any) {
            await this._reply(m, `❌ Erro ao taguear: ${e.message}`);
        }
        return true;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // NOVO: ENQUETE NATIVA DO WHATSAPP
    // ═══════════════════════════════════════════════════════════════════════

    public async _handlePoll(m: any, fullArgs: string): Promise<boolean> {
        try {
            if (!fullArgs || !fullArgs.includes('|')) {
                await this._reply(m,
                    `📊 *Como usar o comando enquete:*\n\n` +
                    `*#enquete Pergunta | Opção1 | Opção2*\n\n` +
                    `📝 _Exemplo:_\n#enquete Qual sua cor favorita? | Azul | Vermelho | Verde`
                );
                return true;
            }

            const partes = fullArgs.split('|').map((p: any) => p.trim()).filter(Boolean);
            if (partes.length < 3) {
                await this._reply(m, '❌ Preciso de pelo menos *1 pergunta* e *2 opções*.\n\nExemplo: #enquete Qual? | A | B');
                return true;
            }

            const pergunta = partes[0];
            const opcoes = partes.slice(1, 13); // Máximo 12 opções no WhatsApp

            await this.sock.sendMessage(m.key.remoteJid, {
                poll: {
                    name: pergunta,
                    values: opcoes,
                    selectableCount: 1
                }
            }, { quoted: m });

            return true;
        } catch (e: any) {
            console.error('Erro em _handlePoll:', e);
            await this._reply(m, `❌ Erro ao criar enquete: ${e.message}`);
            return true;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NOVO: SORTEIO DE MEMBRO
    // ═══════════════════════════════════════════════════════════════════════

    public async _handleRaffle(m: any, chatJid: string, args: string[]): Promise<boolean> {
        try {
            const meta = await this.sock.groupMetadata(chatJid);
            let pool = meta.participants;

            const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentioned && mentioned.length > 1) {
                pool = pool.filter((p: any) => mentioned.includes(p.id));
            } else {
                const botId = this.sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
                pool = pool.filter((p: any) => p.id !== botId);
            }

            if (!pool.length) {
                await this._reply(m, '❌ Sem participantes para sortear.');
                return true;
            }

            const vencedor = pool[Math.floor(Math.random() * pool.length)];
            const num = vencedor.id.split('@')[0];
            const tag = vencedor.admin ? '👑' : '🎉';

            await this.sock.sendMessage(chatJid, {
                text:
                    `🎰 *SORTEIO AKIRA!*\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `${tag} O vencedor é:\n\n` +
                    `🎊 *@${num}* 🎊\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `_Participantes: ${pool.length} | Sorteado por Akira Bot_`,
                mentions: [vencedor.id]
            }, { quoted: m });

            return true;
        } catch (e: any) {
            console.error('Erro em _handleRaffle:', e);
            await this._reply(m, `❌ Erro no sorteio: ${e.message}`);
            return true;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NOVO: DIVERSÃO (PIADAS, FRASES, FATOS)
    // ═══════════════════════════════════════════════════════════════════════

    public async _handleFun(m: any, tipo: string): Promise<boolean> {
        const piadas = [
            '😂 Por que o computador foi ao médico?\nPorque estava com vírus!',
            '😄 O que o zero disse pro oito?\nQue cinto bonito!',
            '🤣 Por que os programadores preferem o lado escuro?\nPorque no lado claro há bugs demais!',
            '😆 Por que o café foi preso?\nEle estava sendo *espresso* demais!',
            '😁 Qual é o animal mais antigo do mundo?\nA zebra — ainda está em preto e branco!',
            '🤭 Por que o livro de matemática ficou triste?\nTinha muitos problemas!',
            '😂 O que o oceano disse para a praia?\nNada, só deu uma onda!',
            '😄 Por que o smartphone foi ao psicólogo?\nTinha muitas notificações de ansiedade!',
            '🤣 Qual é o prato favorito do programador?\nBytes com ketchup!',
            '😆 Por que o Node.js foi para a escola?\nPara aprender a fazer async/await!',
        ];

        const frases = [
            '💡 *"O sucesso é a soma de pequenos esforços repetidos dia após dia."*\n— Robert Collier',
            '🌟 *"Não espere por uma crise para descobrir o que é importante em sua vida."*\n— Platão',
            '🚀 *"O único lugar onde sucesso vem antes de trabalho é no dicionário."*\n— Vidal Sassoon',
            '🎯 *"Acredite que você pode e você já está no meio do caminho."*\n— Theodore Roosevelt',
            '🔥 *"Não tenha medo de desistir do bom para ir atrás do ótimo."*\n— John D. Rockefeller',
            '💪 *"A diferença entre o possível e o impossível está na determinação."*\n— Tommy Lasorda',
            '🌈 *"Seja a mudança que você quer ver no mundo."*\n— Mahatma Gandhi',
            '⭐ *"O futuro pertence àqueles que acreditam na beleza dos seus sonhos."*\n— Eleanor Roosevelt',
            '🏆 *"Não meça seu sucesso pelas riquezas que você acumula, mas pelo bem que você faz."*\n— Anónimo',
            '🎓 *"Educação não é aprender fatos, mas treinar a mente para pensar."*\n— Albert Einstein',
        ];

        const fatos = [
            '🧠 *FATO CURIOSO:*\nOs polvos têm três corações e sangue azul!',
            '🌍 *FATO CURIOSO:*\nA Groenlândia é tecnicamente uma ilha, não um continente — mas é a maior ilha do mundo!',
            '🐘 *FATO CURIOSO:*\nOs elefantes são os únicos animais que não conseguem pular!',
            '⚡ *FATO CURIOSO:*\nOs relâmpagos são 5 vezes mais quentes que a superfície do Sol!',
            '🍌 *FATO CURIOSO:*\nBananas são tecnicamente berries, mas morangos não são!',
            '🧬 *FATO CURIOSO:*\nOs humanos compartilham 50% do DNA com as bananas!',
            '🌊 *FATO CURIOSO:*\nO oceano tem mais artefatos históricos do que todos os museus do mundo juntos!',
            '🦋 *FATO CURIOSO:*\nAs borboletas saboreiam com os pés!',
            '🌙 *FATO CURIOSO:*\nA lua se afasta da Terra cerca de 3,8 cm por ano!',
            '🐝 *FATO CURIOSO:*\nUma abelha rainha pode viver até 5 anos e produz 2.000 ovos por dia!',
        ];

        const banco = tipo === 'piada' ? piadas : tipo === 'frase' ? frases : fatos;
        const item = banco[Math.floor(Math.random() * banco.length)];

        await this._reply(m, item);
        return true;
    }

    public async _handleTTSCommand(m: any, args: string[], fullArgs: string): Promise<boolean> {
        try {
            if (!fullArgs) {
                await this._reply(m,
                    `🔊 *Como usar o TTS:*\n\n` +
                    `*#tts [idioma] texto*\n\n` +
                    `📝 _Exemplos:_\n` +
                    `• #tts olá, como você está?\n` +
                    `• #tts en hello world\n` +
                    `• #tts es hola mundo`
                );
                return true;
            }

            const idiomasValidos = ['pt', 'en', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'ar'];
            let lang = 'pt-BR';
            let texto = fullArgs;

            if (args.length > 1 && idiomasValidos.includes(args[0].toLowerCase())) {
                const codigo = args[0].toLowerCase();
                const mapa: any = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', ja: 'ja-JP', zh: 'zh-CN', ar: 'ar-SA' };
                lang = mapa[codigo] || 'pt-BR';
                texto = args.slice(1).join(' ');
            }

            if (!texto.trim()) {
                await this._reply(m, '❌ Escreva o texto que deseja converter.');
                return true;
            }

            if (texto.length > 500) {
                await this._reply(m, '❌ Texto muito longo. Máximo 500 caracteres.');
                return true;
            }

            const audioProcessor = this.bot?.audioProcessor;
            if (!audioProcessor || typeof audioProcessor.generateTTS !== 'function') {
                await this._reply(m, '❌ Serviço de TTS não disponível no momento.');
                return true;
            }

            await this.sock.sendPresenceUpdate('recording', m.key.remoteJid);
            const result = await audioProcessor.generateTTS(texto, lang);
            await this.sock.sendPresenceUpdate('paused', m.key.remoteJid);

            if (!result?.sucesso && !result?.buffer) {
                await this._reply(m, `❌ Erro ao gerar áudio: ${result?.error || 'falha no TTS'}`);
                return true;
            }

            await this.sock.sendMessage(m.key.remoteJid, {
                audio: result.buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
            }, { quoted: m });

            return true;
        } catch (e: any) {
            console.error('Erro em _handleTTSCommand:', e);
            await this._reply(m, `❌ Erro no TTS: ${e.message}`);
            return true;
        }
    }
}

export default CommandHandler;
