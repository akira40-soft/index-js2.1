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

// Sistema de rate limiting para features premium (1x a cada 3 meses para users)
const premiumFeatureUsage = new Map();

// Log de ações administrativas
const adminLog = new Map();

// O PresenceSimulator é gerenciado via instância do BotCore ou localmente

class CommandHandler {
    constructor(sock, config, bot = null, messageProcessor = null) {
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
            // console.log('✅ Novos módulos inicializados');
        }

        // Inicializa PresenceSimulator se socket for fornecido
        if (sock) {
            this.presenceSimulator = new PresenceSimulator(sock);
            // console.log('✅ PresenceSimulator inicializado');
        }
    }

    /**
    * Define o socket e inicializa componentes dependentes
    */
    setSocket(sock) {
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

    /**
     * Processa a mensagem e despacha comandos (Método principal chamado pelo BotCore)
     */
    async handle(m, meta) {
        // meta: { nome, numeroReal, texto, replyInfo, ehGrupo }
        try {
            const { nome, numeroReal, texto, replyInfo, ehGrupo } = meta;
            // Extrai comando e argumentos
            const mp = this.messageProcessor || this.bot?.messageProcessor;

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

            // ══════════════════════════════════════════
            // VERIFICAÇÃO DE PERMISSÕES
            // ══════════════════════════════════════════
            const userId = m.key.participant || senderId;
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
                case 'ping':
                    await this.bot.reply(m, `🏓 Pong! Uptime: ${Math.floor(process.uptime())}s`);
                    return true;

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

                case 'tagall':
                case 'hidetag':
                case 'totag':
                    if (!isOwner) {
                        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
                        return true;
                    }
                    return await this._handleTagAll(m, fullArgs, command === 'hidetag');

                case 'welcome':
                case 'bemvindo':
                    if (!isOwner) {
                        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
                        return true;
                    }
                    return await this._handleWelcome(m, (args[0] || ''));

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
                    if (!isOwner) {
                        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
                        return true;
                    }
                    return await this.cybersecurityToolkit.handleCommand(m, command, args);

                case 'antilink':
                case 'mute':
                case 'desmute':
                case 'kick':
                case 'add':
                case 'promote':
                case 'demote':
                    if (!isOwner) {
                        await this.bot.reply(m, '🚫 Apenas o administrador do sistema pode gerenciar grupos.');
                        return true;
                    }
                    return await this.groupManagement.handleCommand(m, command, args);

                case 'setbotphoto':
                case 'setbotpic':
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

                case 'restart':
                case 'reiniciar':
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

    /**
     * Helper local para responder (Robustez: não depende do BotCore)
     */
    async _reply(m, text, options = {}) {
        try {
            if (this.sock) {
                return await this.sock.sendMessage(m.key.remoteJid, { text, ...options }, { quoted: m });
            }
            // Fallback para bot.reply se sock falhar (mas sock deveria estar lá)
            if (this.bot && typeof this.bot.reply === 'function') {
                return await this.bot.reply(m, text, options);
            }
            console.error('❌ CommandHandler: Sem meio de responder (sock/bot ausente)');
        } catch (e) {
            console.error('❌ Erro no _reply:', e.message);
        }
    }

    async _showMenu(m) {
        const menuText = `╔══════════════════════════════════════╗
║       🤖 *AKIRA BOT V21* 🤖          ║
║      *Enterprise Edition*            ║
╚══════════════════════════════════════╝

📱 *PREFIXO:* #

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *REGISTRO & PERFIL*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #registrar Nome|Idade - Cadastre-se no sistema
• #perfil - Ver seus dados e XP
• #level - Ver seu nível e progresso
• #rank - Top 10 do grupo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *ECONOMIA*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #daily - Recompensa diária (500 moedas)
• #atm - Ver seu saldo
• #transfer @user valor - Transferir moedas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 *MÍDIA & CRIAÇÃO*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #sticker | #s - Criar figurinha
• #take - Roubar figurinha
• #play [nome] - Baixar música
• #video [nome] - Baixar vídeo
• #toimg - Sticker para imagem
• #tomp3 - Vídeo para áudio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 *EFEITOS DE ÁUDIO*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #nightcore - Rápido + agudo
• #slow - Lento + grave
• #bass - Graves intensos
• #deep - Voz profunda
• #robot - Efeito robótico
• #reverse - Áudio reverso
• #squirrel - Voz de esquilo
• #echo - Eco
• #8d - Áudio 8D

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖼️ *EFEITOS DE IMAGEM*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #hd | #upscale - Melhorar qualidade
• #removebg - Remover fundo
• #wasted - Efeito GTA
• #communism - Efeito Comunista
• #jail | #triggered | #gay - Efeitos
• #sepia | #grey | #invert - Filtros

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕹️ *DIVERSÃO & JOGOS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #pinterest [busca] - Buscar imagens
• #ship @user @user - Compatibilidade
• #slot - Máquina de cassino
• #dado | #moeda - Sorteio
• #chance [pergunta] - Probabilidade
• #gay - Medidor de gayzice

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 *GRUPOS (ADMIN)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #mute @user [tempo] - Silenciar usuário
• #desmute @user - Desilenciar
• #fechar | #abrir - Fechar/abrir grupo
• #kick | #add - Gerenciar membros
• #promote | #demote - Gerenciar ADMs
• #tagall | #totag - Mencionar todos
• #antilink [on/off] - Proteção links
• #welcome [on/off] - Boas-vindas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 *AUTONOMIA WHATSAPP (ADMIN)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #fixar [tempo] - Fixar mensagem
• #desafixar - Desafixar mensagem
• #lido - Marcar como lido
• #reagir [emoji] - Reagir a mensagem

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 *CONFIGURAÇÕES (DONO)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #requireregister on/off - Exigir registro

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ *CYBERSECURITY (PREMIUM)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #nmap | #sqlmap | #dns | #whois
• #geo [ip] | #shodan | #cve

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *UTILITÁRIOS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• #ping - Status do sistema
• #broadcast [msg] - Transmissão

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *DICA:* Use #registrar para desbloquear
todos os comandos!

*Desenvolvido por Isaac Quarenta*
*AKIRA V21 ULTIMATE - Enterprise Edition*`;

        await this._reply(m, menuText);

        // Simula leitura após enviar menu
        if (this.presenceSimulator) {
            await this.presenceSimulator.markAsRead(m);
        }

        return true;
    }

    async _handleSticker(m, nome) {
        try {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMsg = m.message?.imageMessage || quoted?.imageMessage;
            const videoMsg = m.message?.videoMessage || quoted?.videoMessage;

            if (!imageMsg && !videoMsg) {
                await this._reply(m, '❌ Responda a uma imagem ou vídeo curto para criar o sticker.');
                return true;
            }

            const packName = 'akira-bot';
            const author = nome || 'Akira-Bot';

            let res;
            if (imageMsg) {
                const buf = await this.mediaProcessor.downloadMedia(imageMsg, 'image');
                res = await this.mediaProcessor.createStickerFromImage(buf, { packName, author });
            } else if (videoMsg) {
                const buf = await this.mediaProcessor.downloadMedia(videoMsg, 'video');
                res = await this.mediaProcessor.createAnimatedStickerFromVideo(buf, 10, { packName, author });
            }

            if (res && res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, { sticker: res.buffer }, { quoted: m });
            } else {
                await this._reply(m, `❌ Erro ao criar sticker: ${res?.error || 'falha interna'}`);
            }
        } catch (e) {
            console.error('Erro em _handleSticker:', e);
            await this._reply(m, '❌ Erro no processamento do sticker.');
        }
        return true;
    }



    async _handlePlay(m, query) {
        if (!query) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}play <nome da música ou link>`);
            return true;
        }
        await this._reply(m, '⏳ Buscando e processando música...');
        try {
            const res = await this.mediaProcessor.downloadYouTubeAudio(query);
            if (res.error) {
                await this._reply(m, `❌ ${res.error}`);
            } else {
                // Enviar thumbnail e metadados se disponíveis
                if (res.thumbnail) {
                    const thumbBuf = await this.mediaProcessor.fetchBuffer(res.thumbnail);
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

                await this.sock.sendMessage(m.key.remoteJid, {
                    audio: res.buffer,
                    mimetype: 'audio/mpeg',
                    ptt: false,
                    fileName: `${res.titulo || 'audio'}.mp3`
                }, { quoted: m });
            }
        } catch (e) {
            this.logger?.error('Erro no play:', e);
            await this._reply(m, '❌ Erro ao processar o comando play.');
        }
        return true;
    }

    async _handleProfile(m, meta) {
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
        } catch (e) {
            console.error('Erro no _handleProfile:', e);
            await this._reply(m, '❌ Erro ao carregar perfil.');
        }
        return true;
    }



    async _handleDono(m) {
        const donos = this.config.DONO_USERS;
        if (!donos || donos.length === 0) {
            await this._reply(m, '❌ Nenhum dono configurado.');
            return true;
        }

        // Prioriza o número solicitado pelo usuário: 244937035662
        const principal = donos.find(d => d.numero === '244937035662') || donos[0];

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

    async _handleReport(m, fullArgs, nome, senderId, ehGrupo) {
        if (!fullArgs) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}report <mensagem do bug/sugestão>`);
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
            await this._reply(m, `✅ *Report enviado com sucesso!*\nID: #${reportId}\n\nObrigado por colaborar com o desenvolvimento do Akira.`);
        } else {
            await this._reply(m, '⚠️ Erro ao enviar report: Nenhum administrador disponível, mas sua mensagem foi registrada no log.');
            console.warn(`[REPORT FALHO] ${reportMsg}`);
        }
        return true;
    }



    async _handlePremiumInfo(m, senderId) {
        const info = this.bot.subscriptionManager.getSubscriptionInfo(senderId);
        let msg = `💎 *STATUS PREMIUM*\n\n`;
        msg += `🏷️ Nível: ${info.tier}\n`;
        msg += `📊 Status: ${info.status}\n`;
        msg += `📅 Expira em: ${info.expiraEm || 'N/A'}\n\n`;
        msg += `✨ *Recursos:* \n${info.recursos.join('\n')}`;

        await this._reply(m, msg);
        return true;
    }

    async _handleAddPremium(m, args) {
        if (args.length < 2) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}addpremium <numero> <dias>`);
            return true;
        }

        // Extrai número (remove @s.whatsapp.net e caracteres não numéricos)
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

    async _handleDelPremium(m, args) {
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




    async _handleStickerToImage(m) {
        try {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted?.stickerMessage) {
                await this._reply(m, '❌ Responda a um sticker.');
                return true;
            }
            if (quoted.stickerMessage.isAnimated) {
                await this._reply(m, '❌ Apenas stickers estáticos por enquanto.');
                return true;
            }
            await this._reply(m, '🔄 Convertendo...');
            const buf = await this.mediaProcessor.downloadMedia(quoted.stickerMessage, 'sticker');
            const res = await this.mediaProcessor.convertStickerToImage(buf);
            if (res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, { image: res.buffer, caption: '✅ Aqui está sua imagem' }, { quoted: m });
            } else {
                await this._reply(m, `❌ Erro: ${res.error}`);
            }
        } catch (e) {
            await this._reply(m, '❌ Erro ao converter.');
        }
        return true;
    }

    async _handleVideo(m, query) {
        if (!query) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}video <nome ou link>`);
            return true;
        }
        await this._reply(m, '🎬 Baixando vídeo...');
        try {
            const res = await this.mediaProcessor.downloadYouTubeVideo(query);
            if (res.sucesso && res.buffer) {
                let thumbBuf = null;
                if (res.thumbnail) {
                    thumbBuf = await this.mediaProcessor.fetchBuffer(res.thumbnail);
                }

                await this.sock.sendMessage(m.key.remoteJid, {
                    video: res.buffer,
                    caption: `🎬 *${res.titulo}*\n👤 *Canal:* ${res.autor || 'Desconhecido'}`,
                    mimetype: 'video/mp4',
                    jpegThumbnail: thumbBuf || undefined
                }, { quoted: m });
            } else {
                await this._reply(m, `❌ Erro: ${res.error}`);
            }
        } catch (e) {
            this.logger?.error('Erro no video:', e);
            await this._reply(m, '❌ Erro ao baixar vídeo.');
        }
        return true;
    }

    async _handleImageEffect(m, command, args) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMsg = m.message?.imageMessage || quoted?.imageMessage;

        if (!imageMsg) {
            await this._reply(m, '❌ Responda a uma imagem para aplicar o efeito.');
            return true;
        }

        await this._reply(m, `🎨 Aplicando efeito *${command}*...`);
        try {
            const buf = await this.mediaProcessor.downloadMedia(imageMsg, 'image');

            // Tratamento de argumentos para addbg/gradient
            let options = {};
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
        } catch (e) {
            await this._reply(m, '❌ Erro ao processar imagem.');
            console.error(e);
        }
        return true;
    }

    async _handlePaymentCommand(m, args) {
        // Se usuario quer ver info
        if (args.length === 0) {
            const plans = this.bot.paymentManager.getPlans();
            let msg = `💎 *SEJA PREMIUM NO AKIRA BOT*\n\n`;
            msg += `Desbloqueie recursos exclusivos, remova limites e suporte o projeto!\n\n`;

            for (const [key, plan] of Object.entries(plans)) {
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

    async _handleVideoToAudio(m) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const videoMsg = m.message?.videoMessage || quoted?.videoMessage;

        if (!videoMsg) {
            await this._reply(m, '❌ Responda a um vídeo para converter para MP3.');
            return true;
        }

        await this._reply(m, '🎵 Convertendo vídeo para MP3...');
        try {
            const buf = await this.mediaProcessor.downloadMedia(videoMsg, 'video');
            const res = await this.mediaProcessor.convertVideoToAudio(buf);

            if (res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, { audio: res.buffer, mimetype: 'audio/mp4', ptt: false }, { quoted: m });
            } else {
                await this._reply(m, `❌ Erro: ${res.error}`);
            }
        } catch (e) {
            await this._reply(m, '❌ Erro ao converter para MP3.');
            console.error(e);
        }
        return true;
    }

    async _handleSetBotPhoto(m) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMsg = m.message?.imageMessage || quoted?.imageMessage;

        if (!imageMsg) {
            await this._reply(m, '❌ Responda a uma imagem para definir como foto do bot.');
            return true;
        }

        await this._reply(m, '📸 Atualizando foto do bot...');
        try {
            const buf = await this.mediaProcessor.downloadMedia(imageMsg, 'image');
            const res = await this.botProfile.setBotPhoto(buf);
            if (res.success) {
                await this._reply(m, '✅ Foto do bot atualizada com sucesso!');
            } else {
                await this._reply(m, `❌ Erro ao atualizar foto: ${res.error}`);
            }
        } catch (e) {
            await this._reply(m, '❌ Erro ao processar foto.');
            console.error(e);
        }
        return true;
    }

    async _handleSetBotName(m, name) {
        if (!name) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}setbotname <nome>`);
            return true;
        }
        await this._reply(m, `📛 Alterando nome para: ${name}`);
        const res = await this.botProfile.setBotName(name);
        if (res.success) {
            await this._reply(m, '✅ Nome do bot atualizado!');
        } else {
            await this._reply(m, `❌ Erro: ${res.error}`);
        }
        return true;
    }

    async _handleSetBotStatus(m, status) {
        if (!status) {
            await this._reply(m, `❌ Uso: ${this.config.PREFIXO}setbotstatus <texto>`);
            return true;
        }
        await this._reply(m, `📝 Alterando bio para: ${status}`);
        const res = await this.botProfile.setBotStatus(status);
        if (res.success) {
            await this._reply(m, '✅ Bio do bot atualizada!');
        } else {
            await this._reply(m, `❌ Erro: ${res.error}`);
        }
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NOVOS COMANDOS (DIVERSÃO & GESTÃO)
    // ═══════════════════════════════════════════════════════════════════════

    async _handlePinterest(m, query, args) {
        if (!query) {
            await this._reply(m, `🔎 Uso: ${this.config.PREFIXO}pinterest <busca> | <quantidade 1-5>`);
            return true;
        }

        const parts = query.split('|');
        const searchTerm = parts[0].trim();
        const count = Math.min(Math.max(parseInt(parts[1] || '1', 10) || 1, 1), 5);

        await this._reply(m, `🔎 Buscando "${searchTerm}" no Pinterest...`);

        try {
            const url = `https://api.fdci.se/sosmed/rep.php?gambar=${encodeURIComponent(searchTerm)}`;
            const response = await axios.get(url, { timeout: 15000 });
            const images = Array.isArray(response.data) ? response.data.slice(0, count) : [];

            if (images.length === 0) {
                await this._reply(m, '❌ Nada encontrado para essa busca.');
                return true;
            }

            for (const imageUrl of images) {
                try {
                    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
                    await this.sock.sendMessage(m.key.remoteJid, {
                        image: Buffer.from(imgRes.data),
                        caption: `🔎 *Resultado:* ${searchTerm}`
                    }, { quoted: m });
                } catch (e) {
                    this.logger?.error(`Erro ao baixar imagem: ${imageUrl}`, e.message);
                }
            }
        } catch (e) {
            await this._reply(m, '❌ Erro ao acessar o serviço de busca.');
            console.error(e);
        }
        return true;
    }

    async _handleShip(m) {
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
        } catch (e) {
            await this._reply(m, '❌ Erro no cálculo de compatibilidade.');
        }
        return true;
    }

    async _handleGames(m, command, args) {
        try {
            switch (command) {
                case 'dado':
                    const dado = Math.floor(Math.random() * 6) + 1;
                    await this._reply(m, `🎲 Você tirou: *${dado}*`);
                    break;
                case 'moeda':
                case 'caracoroa':
                    const moeda = Math.random() < 0.5 ? 'CARA' : 'COROA';
                    await this._reply(m, `🪙 Resultado: *${moeda}*`);
                    break;
                case 'slot':
                    const items = ['🍒', '🍋', '🍇', '🍉', '🍎', '🍍', '🥝', '🍑'];
                    const a = items[Math.floor(Math.random() * items.length)];
                    const b = items[Math.floor(Math.random() * items.length)];
                    const c = items[Math.floor(Math.random() * items.length)];
                    const win = (a === b && b === c);
                    const slotMsg = `🎰 *SLOT MACHINE* 🎰\n\n[ ${a} | ${b} | ${c} ]\n\n${win ? '🎉 *PARABÉNS! VOCÊ GANHOU!*' : '😔 Não foi dessa vez...'}`;
                    await this._reply(m, slotMsg);
                    break;
                case 'chance':
                    if (args.length === 0) {
                        await this._reply(m, `📊 Uso: ${this.config.PREFIXO}chance <pergunta>`);
                        break;
                    }
                    const percent = Math.floor(Math.random() * 101);
                    await this._reply(m, `📊 A chance de *${args.join(' ')}* é de *${percent}%*`);
                    break;
                case 'gay':
                    const gayPercent = Math.floor(Math.random() * 101);
                    await this._reply(m, `🏳️🌈 Você é *${gayPercent}%* gay`);
                    break;
            }
        } catch (e) {
            await this._reply(m, '❌ Erro ao processar o jogo.');
        }
        return true;
    }

    async _handleTagAll(m, text, isHide = false) {
        try {
            const chatJid = m.key.remoteJid;
            if (!chatJid.endsWith('@g.us')) {
                await this._reply(m, '❌ Comando apenas para grupos.');
                return true;
            }

            const groupMetadata = await this.sock.groupMetadata(chatJid);
            const participants = groupMetadata.participants.map(p => p.id);

            const msg = text || (isHide ? '📢' : '📢 *Atenção geral!*');

            await this.sock.sendMessage(chatJid, {
                text: msg,
                contextInfo: { mentionedJid: participants }
            }, { quoted: isHide ? null : m });
        } catch (e) {
            await this._reply(m, '❌ Erro ao mencionar membros.');
        }
        return true;
    }

    async _handleWelcome(m, arg) {
        try {
            const chatJid = m.key.remoteJid;
            if (!chatJid.endsWith('@g.us')) {
                await this._reply(m, '❌ Comando apenas para grupos.');
                return true;
            }

            const status = arg.toLowerCase();
            if (status === 'on') {
                // Implementação simplificada: salvar preferência no JSON se existir sistema de config de grupo
                await this._reply(m, '✅ Boas-vindas ativadas para este grupo.');
            } else if (status === 'off') {
                await this._reply(m, '🚫 Boas-vindas desativadas.');
            } else {
                await this._reply(m, `ℹ️ Uso: ${this.config.PREFIXO}welcome on/off`);
            }
        } catch (e) {
            await this._reply(m, '❌ Erro ao configurar boas-vindas.');
        }
        return true;
    }

    async _handleBroadcast(m, text) {
        if (!text) {
            await this._reply(m, `📢 Uso: ${this.config.PREFIXO}broadcast <mensagem>`);
            return true;
        }

        await this._reply(m, '🚀 Enviando transmissão global...');
        try {
            const groups = await this.sock.groupFetchAllParticipating();
            const jids = Object.keys(groups);

            let success = 0;
            for (const jid of jids) {
                try {
                    await this.sock.sendMessage(jid, { text: `📢 *AVISO GLOBAL:* \n\n${text}` });
                    success++;
                    await new Promise(r => setTimeout(r, 1000)); // Delay p/ evitar ban
                } catch (err) { }
            }
            await this._reply(m, `✅ Transmissão concluída! Enviado para ${success} grupos.`);
        } catch (e) {
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
    async _handleRegister(m, fullArgs, userId) {
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

        } catch (error) {
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
    async _handleLevel(m, userId, chatJid, ehGrupo) {
        try {
            const groupId = ehGrupo ? chatJid : 'global';
            const levelData = this.levelSystem.getLevel(userId, groupId);

            await this.bot.reply(m,
                `📊 **Seu Nível**\n\n` +
                `🏆 **Level:** ${levelData.level}\n` +
                `⭐ **XP:** ${levelData.xp}/${levelData.requiredXP}\n` +
                `📈 **Progresso:** ${levelData.progress.toFixed(1)}%\n` +
                `💬 **Mensagens:** ${levelData.messageCount}\n\n` +
                `🎯 Faltam ${levelData.xpToNextLevel} XP para o próximo nível!`
            );

            return true;
        } catch (error) {
            console.error('Erro no comando level:', error);
            await this.bot.reply(m, '❌ Erro ao obter informações de level.');
            return true;
        }
    }

    /**
     * Comando #rank - Top 10 do grupo
     */
    async _handleRank(m, chatJid, ehGrupo) {
        try {
            if (!ehGrupo) {
                await this.bot.reply(m, '📵 Este comando só funciona em grupos.');
                return true;
            }

            const ranking = this.levelSystem.getRanking(chatJid, 10);

            if (!ranking || ranking.length === 0) {
                await this.bot.reply(m, '📊 Nenhum usuário com XP registrado ainda.');
                return true;
            }

            let texto = '🏆 **TOP 10 - RANKING DE NÍVEIS**\n\n';

            ranking.forEach((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
                const numero = user.userId.split('@')[0];
                texto += `${medal} @${numero}\n`;
                texto += `   Level ${user.level} • ${user.xp} XP\n\n`;
            });

            const mentions = ranking.map(u => u.userId);
            await this.sock.sendMessage(chatJid, { text: texto, mentions });

            return true;
        } catch (error) {
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
    async _handleDaily(m, userId) {
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
        } catch (error) {
            console.error('Erro no comando daily:', error);
            await this.bot.reply(m, '❌ Erro ao processar daily.');
            return true;
        }
    }

    /**
     * Comando #atm - Ver saldo
     */
    async _handleATM(m, userId) {
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
        } catch (error) {
            console.error('Erro no comando atm:', error);
            await this.bot.reply(m, '❌ Erro ao obter saldo.');
            return true;
        }
    }

    /**
     * Comando #transfer - Transferir dinheiro
     */
    async _handleTransfer(m, userId, args, fullArgs) {
        try {
            // Valida menção
            const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) {
                await this.bot.reply(m,
                    `❌ **Formato Incorreto**\n\n` +
                    `Use: \`#transfer @usuario valor\`\n` +
                    `Exemplo: \`#transfer @amigo 100\``
                );
                return true;
            }

            // Valida valor
            const amount = parseInt(args[args.length - 1]);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.reply(m, '❌ Valor inválido. Use apenas números positivos.');
                return true;
            }

            // Não pode transferir para si mesmo
            if (target === userId) {
                await this.bot.reply(m, '❌ Você não pode transferir para si mesmo.');
                return true;
            }

            // Realiza transferência
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
        } catch (error) {
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
    async _handleAudioEffect(m, effect) {
        try {
            // Verificar se é uma resposta a um áudio ou vídeo
            const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const currentMsg = m.message;

            let audioMsg = null;

            // Prioridade: mensagem citada > mensagem atual
            if (quotedMsg?.audioMessage) {
                audioMsg = quotedMsg.audioMessage;
            } else if (quotedMsg?.videoMessage) {
                audioMsg = quotedMsg.videoMessage;
            } else if (currentMsg?.audioMessage) {
                audioMsg = currentMsg.audioMessage;
            } else if (currentMsg?.videoMessage) {
                audioMsg = currentMsg.videoMessage;
            }

            if (!audioMsg) {
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
                return true;
            }

            // Informar usuário que está processando
            await this.bot.reply(m, `⏳ Processando efeito **${effect}**...\n\nPor favor, aguarde.`);

            // Baixar áudio
            const mp = this.messageProcessor || this.bot?.messageProcessor;
            if (!mp) {
                await this.bot.reply(m, '❌ Erro: MediaProcessor não disponível.');
                return true;
            }

            // Criar mensagem fake para download
            const fakeMsg = quotedMsg ? { message: quotedMsg } : m;
            const audioBuffer = await mp.downloadMediaMessage(fakeMsg, 'buffer');

            if (!audioBuffer) {
                await this.bot.reply(m, '❌ Erro ao baixar o áudio.');
                return true;
            }

            // Aplicar efeito
            const processedAudio = await mp.applyAudioEffect(audioBuffer, effect);

            // Enviar áudio processado
            await this.sock.sendMessage(m.key.remoteJid, {
                audio: processedAudio,
                mimetype: 'audio/mpeg',
                fileName: `${effect}_${Date.now()}.mp3`,
                ptt: false // false = áudio normal, true = nota de voz
            }, { quoted: m });

            return true;

        } catch (error) {
            console.error(`Erro no efeito ${effect}:`, error);
            await this.bot.reply(m,
                `❌ **Erro ao aplicar efeito**\n\n` +
                `Detalhes: ${error.message}\n\n` +
                `Verifique se o áudio não está corrompido e tente novamente.`
            );
            return true;
        }
    }

    async _reply(m, text, options = {}) {
        return await this.bot.reply(m, text, options);
    }
}

export default CommandHandler;
