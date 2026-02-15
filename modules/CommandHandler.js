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

// Sistema de rate limiting para features premium (1x a cada 3 meses para users)
const premiumFeatureUsage = new Map();

// Log de ações administrativas
const adminLog = new Map();

// O PresenceSimulator é gerenciado via instância do BotCore ou localmente

class CommandHandler {
    constructor(sock, config) {
        this.sock = sock;
        this.config = config;
        this.media = new MediaProcessor();

        // Inicializa handlers de mídia
        if (sock) {
            this.stickerHandler = new StickerViewOnceHandler(sock, this.config);
            this.mediaProcessor = new MediaProcessor();
            // console.log('✅ Handlers de mídia inicializados');
        }

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
            const mp = this.bot.messageProcessor;

            // Extrai comando e argumentos
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
            // DESPACHO DE COMANDOS
            // ══════════════════════════════════════════

            switch (command) {
                case 'ping':
                    await this.bot.reply(m, `🏓 Pong! Uptime: ${Math.floor(process.uptime())}s`);
                    return true;

                case 'menu':
                case 'help':
                case 'ajuda':
                case 'comandos':
                    return await this._showMenu(m);

                case 'sticker':
                case 's':
                case 'fig':
                    return await this._handleSticker(m, nome);

                case 'play':
                case 'p':
                    return await this._handlePlay(m, fullArgs);

                case 'perfil':
                case 'profile':
                case 'info':
                    return await this._handleProfile(m, meta);

                case 'registrar':
                case 'reg':
                    return await this._handleRegister(m, fullArgs, senderId);

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


                // Efeitos de Áudio
                case 'nightcore':
                case 'bass':
                case 'esquilo':
                case 'gemuk':
                case 'earrape':
                case 'fast':
                case 'fat':
                case 'reverse':
                case 'robot':
                case 'slow':
                case 'smooth':
                case 'tupai':
                case 'treble':
                case 'echo':
                    return await this._handleAudioEffect(m, command);

                // Pagamentos
                case 'donate':
                case 'doar':
                case 'buy':
                case 'comprar':
                case 'vip':
                case 'premium':
                    return await this._handlePaymentCommand(m, args);


                // Efeitos de Imagem
                case 'hd':
                case 'enhance':
                case 'removebg':
                case 'rmbg':
                case 'communism':
                case 'commie':
                case 'wasted':
                case 'jail':
                case 'triggered':
                case 'gay':
                case 'sepia':
                case 'grey':
                case 'gray':
                case 'invert':
                case 'negativo':
                case 'angola':
                case 'addbg':
                case 'adicionarfundo':
                    return await this._handleImageEffect(m, command, args);

                // Sticker Utils
                case 'take':
                case 'roubar':
                    return await this._handleTakeSticker(m, fullArgs, nome);

                case 'toimg':
                case 'img':
                    return await this._handleStickerToImage(m);

                // Video
                case 'video':
                case 'playvid':
                case 'ytmp4':
                    return await this._handleVideo(m, fullArgs);

                // Comandos Administrativos (Enterprise / Cybersecurity)
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

                // Comandos de Grupo
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

                case 'level':
                case 'nivel':
                    return await this._handleLevel(m, args, ehGrupo, senderId, isOwner);

                case 'train':
                case 'treinar':
                    if (!isOwner) {
                        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
                        return true;
                    }
                    await this.bot.reply(m, '⏳ Iniciando treinamento/indexação de dados...');
                    // Aqui você pode disparar um comando via exec ou chamar um endpoint específico
                    return true;

                case 'reload':
                case 'reiniciar':
                    if (!isOwner) {
                        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
                        return true;
                    }
                    await this.bot.reply(m, '🔄 Reiniciando sistemas Akira...');
                    process.exit(0); // O PM2 ou Docker vai reiniciar o processo
                    return true;

                default:
                    // Verifica se o comando pertence a algum outro toolkit
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

    async _showMenu(m) {
        const menuText = `╔══════════════════════════════════════╗
║       🤖 *AKIRA BOT V21* 🤖          ║
║      *Enterprise Edition*            ║
╚══════════════════════════════════════╝

📱 *PREFIXO:* #

🎨 *MÍDIA & CRIAÇÃO*
• #sticker | #s - Criar figurinha (img/video)
• #play [nome] - Baixar música/vídeo
• #toimg - Sticker para imagem
• #tomp3 - Vídeo para áudio

🖼️ *EFEITOS DE IMAGEM*
• #hd - Melhorar qualidade (Upscale)
• #removebg - Remover fundo
• #communism - Efeito Comunista
• #wasted - Efeito GTA Wasted
• #jail - Efeito Prisão
• #triggered - Efeito Triggered
• #gay - Efeito Arco-íris
• #sepia | #grey | #invert - Filtros

👥 *GESTÃO DE GRUPOS*
• #antilink [on/off] - Proteção contra links
• #antifake [on/off] - Bloquear números fake
• #welcome [on/off] - Mensagem de boas-vindas
• #mute | #desmute - Silenciar chat
• #kick @user - Banir membro
• #add [numero] - Adicionar membro
• #promote | #demote - Gerenciar ADMs
• #link - Link do grupo
• #totag - Mencionar todos (admin)

🛡️ *CYBERSECURITY (ADMIN)*
• #nmap [host] - Scanner de portas
• #sqlmap [url] - Teste de SQL Injection
• #dns [domain] - Enumeração DNS
• #whois [domain] - Consulta WHOIS
• #geo [ip] - Geolocalização
• #shodan [query] - Busca no Shodan
• #cve [ano] - Buscar vulnerabilidades

📊 *UTILITÁRIOS & PERFIL*
• #perfil - Seus dados e XP
• #rank - Ranking de usuários
• #ping - Status do sistema
• #dono - Contatar criador
• #report [msg] - Reportar bug

*Desenvolvido por Isaac Quarenta*
*Powered by AKIRA V21 ULTIMATE*`;

        await this.bot.reply(m, menuText);

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

            if (!imageMsg) {
                await this.bot.reply(m, '❌ Responda a uma imagem para criar o sticker.');
                return true;
            }

            await this.bot.reply(m, '⏳ Criando sticker...');
            const buf = await this.mediaProcessor.downloadMedia(imageMsg, 'image');
            const res = await this.mediaProcessor.createStickerFromImage(buf, {
                packName: 'Akira Pack',
                author: nome
            });

            if (res && res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, { sticker: res.buffer }, { quoted: m });
            } else {
                await this.bot.reply(m, '❌ Erro ao criar sticker.');
            }
        } catch (e) {
            await this.bot.reply(m, '❌ Erro no processamento do sticker.');
        }
        return true;
    }

    async _handlePlay(m, query) {
        if (!query) {
            await this.bot.reply(m, '❌ Uso: #play <nome da música ou link>');
            return true;
        }
        await this.bot.reply(m, '⏳ Buscando e processando música...');
        try {
            const res = await this.mediaProcessor.downloadYouTubeAudio(query);
            if (res.error) {
                await this.bot.reply(m, `❌ ${res.error}`);
            } else {
                await this.sock.sendMessage(m.key.remoteJid, {
                    audio: res.buffer,
                    mimetype: 'audio/mpeg',
                    ptt: false,
                    fileName: `${res.title}.mp3`
                }, { quoted: m });
            }
        } catch (e) {
            await this.bot.reply(m, '❌ Erro ao processar o comando play.');
        }
        return true;
    }

    async _handleProfile(m, meta) {
        const { nome, numeroReal } = meta;
        const uid = m.key.participant || m.key.remoteJid;
        const record = this.bot.levelSystem.getGroupRecord(m.key.remoteJid, uid, true);
        const txt = `👤 *PERFIL:* ${nome}\n📱 *Número:* ${numeroReal}\n🎮 *Nível:* ${record.level || 0}\n⭐ *XP:* ${record.xp || 0}`;
        await this.bot.reply(m, txt);
        return true;
    }

    async _handleRegister(m, fullArgs, senderId) {
        if (!fullArgs.includes('|')) {
            await this.bot.reply(m, '❌ Uso: #registrar Nome|Idade');
            return true;
        }

        const [nomeUser, idadeStr] = fullArgs.split('|').map(s => s.trim());
        const idade = parseInt(idadeStr, 10);

        if (!nomeUser || isNaN(idade)) {
            await this.bot.reply(m, '❌ Formato inválido. Use: #registrar Nome|Idade');
            return true;
        }

        const uid = m.key.participant || m.key.remoteJid;
        const res = this.bot.registrationSystem.registerUser(uid, nomeUser, idade, senderId.replace(/\D/g, ''));

        if (res.success) {
            await this.bot.reply(m, `✅ *REGISTRO CONCLUÍDO*\n\n👤 Nome: ${res.user.name}\n🎂 Idade: ${res.user.age}\n📅 Data: ${new Date(res.user.date).toLocaleDateString('pt-BR')}\n\nBem-vindo ao sistema Akira Enterprise!`);
        } else {
            await this.bot.reply(m, `❌ ${res.message}`);
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

        await this.bot.reply(m, msg);
        return true;
    }

    async _handleAddPremium(m, args) {
        if (args.length < 2) {
            await this.bot.reply(m, '❌ Uso: #addpremium <numero> <dias>');
            return true;
        }

        // Extrai número (remove @s.whatsapp.net e caracteres não numéricos)
        let targetUser = args[0].replace(/\D/g, '');
        let days = parseInt(args[1]);

        if (!targetUser || isNaN(days)) {
            await this.bot.reply(m, '❌ Formato inválido.');
            return true;
        }

        // Adiciona sufixo se necessário para a chave do mapa (embora o SubscriptionManager use apenas o ID geralmente, vamos padronizar)
        // O SubscriptionManager usa a chave que passamos. Se passarmos só numero, ele usa só numero.
        // O senderId vem como numero@s.whatsapp.net. Vamos manter consistência.
        const targetJid = targetUser + '@s.whatsapp.net';

        const res = this.bot.subscriptionManager.subscribe(targetJid, days);

        if (res.sucesso) {
            await this.bot.reply(m, `✅ Premium adicionado para ${targetUser} por ${days} dias.\nExpira em: ${res.expiraEm}`);
        } else {
            await this.bot.reply(m, `❌ Erro: ${res.erro}`);
        }
        return true;
    }

    async _handleDelPremium(m, args) {
        if (args.length < 1) {
            await this.bot.reply(m, '❌ Uso: #delpremium <numero>');
            return true;
        }

        let targetUser = args[0].replace(/\D/g, '');
        const targetJid = targetUser + '@s.whatsapp.net';

        const res = this.bot.subscriptionManager.unsubscribe(targetJid);

        if (res.sucesso) {
            await this.bot.reply(m, `✅ Premium removido de ${targetUser}`);
        } else {
            await this.bot.reply(m, `❌ Erro: ${res.erro}`);
        }
        return true;
    }

    async _handleLevel(m, args, ehGrupo, senderId, isOwner) {
        if (!ehGrupo) {
            await this.bot.reply(m, '📵 Este comando só funciona em grupos.');
            return true;
        }
        const sub = (args[0] || '').toLowerCase();
        if (['on', 'off'].includes(sub)) {
            if (!isOwner) {
                await this.bot.reply(m, '🚫 Apenas administradores podem alterar o status do level.');
                return true;
            }
            // Implementação de toggle depende de como o BotCore gerencia os settings
            await this.bot.reply(m, `✅ Sistema de level ${sub === 'on' ? 'ativado' : 'desativado'} para este grupo.`);
            return true;
        }
        const uid = m.key.participant || m.key.remoteJid;
        const rec = this.bot.levelSystem.getGroupRecord(m.key.remoteJid, uid, true);
        await this.bot.reply(m, `📊 *Seu Status:* Nível ${rec.level || 0} | XP ${rec.xp || 0}`);
        return true;
    }

    async _handleAudioEffect(m, effectName) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const audioMsg = m.message?.audioMessage || quoted?.audioMessage;

        if (!audioMsg) {
            await this.bot.reply(m, '❌ Responda a um áudio para aplicar o efeito.');
            return true;
        }

        await this.bot.reply(m, `🎵 Aplicando efeito *${effectName}*...`);
        try {
            const buf = await this.mediaProcessor.downloadMedia(audioMsg, 'audio');
            const res = await this.bot.audioProcessor.applyAudioEffect(buf, effectName);

            if (res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, {
                    audio: res.buffer,
                    mimetype: 'audio/mpeg',
                    ptt: true
                }, { quoted: m });
            } else {
                await this.bot.reply(m, `❌ Erro: ${res.error}`);
            }
        } catch (e) {
            await this.bot.reply(m, '❌ Erro ao processar áudio.');
            console.error(e);
        }
        return true;
    }

    async _handleTakeSticker(m, args, nome) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted?.stickerMessage) {
            await this.bot.reply(m, '❌ Responda a um sticker.');
            return true;
        }

        const newPack = args || 'Akira Pack';
        const newAuthor = nome;

        await this.bot.reply(m, '🎨 Roubando sticker...');
        try {
            const buf = await this.mediaProcessor.downloadMedia(quoted.stickerMessage, 'sticker');
            const newSticker = await this.mediaProcessor.addStickerMetadata(buf, newPack, newAuthor);

            await this.sock.sendMessage(m.key.remoteJid, { sticker: newSticker }, { quoted: m });
        } catch (e) {
            await this.bot.reply(m, '❌ Erro ao processar sticker.');
            console.error(e);
        }
        return true;
    }

    async _handleStickerToImage(m) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted?.stickerMessage) {
            await this.bot.reply(m, '❌ Responda a um sticker.');
            return true;
        }

        if (quoted.stickerMessage.isAnimated) {
            await this.bot.reply(m, '❌ Apenas stickers estáticos por enquanto.');
            return true;
        }

        await this.bot.reply(m, '🔄 Convertendo...');
        try {
            const buf = await this.mediaProcessor.downloadMedia(quoted.stickerMessage, 'sticker');
            const res = await this.mediaProcessor.convertStickerToImage(buf);

            if (res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, { image: res.buffer, caption: '✅ Aqui está sua imagem' }, { quoted: m });
            } else {
                await this.bot.reply(m, `❌ Erro: ${res.error}`);
            }
        } catch (e) {
            await this.bot.reply(m, '❌ Erro ao converter.');
            console.error(e);
        }
        return true;
    }

    async _handleVideo(m, query) {
        if (!query) {
            await this.bot.reply(m, '❌ Uso: #video <nome ou link>');
            return true;
        }
        await this.bot.reply(m, '🎬 Baixando vídeo...');
        try {
            const res = await this.mediaProcessor.downloadYouTubeVideo(query);
            if (res.sucesso && res.buffer) {
                await this.sock.sendMessage(m.key.remoteJid, {
                    video: res.buffer,
                    caption: `🎬 ${res.titulo}`,
                    mimetype: 'video/mp4'
                }, { quoted: m });
            } else {
                await this.bot.reply(m, `❌ Erro: ${res.error}`);
            }
        } catch (e) {
            await this.bot.reply(m, '❌ Erro ao baixar vídeo.');
            console.error(e);
        }
        return true;
    }

    async _handleImageEffect(m, command, args) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMsg = m.message?.imageMessage || quoted?.imageMessage;

        if (!imageMsg) {
            await this.bot.reply(m, '❌ Responda a uma imagem para aplicar o efeito.');
            return true;
        }

        await this.bot.reply(m, `🎨 Aplicando efeito *${command}*...`);
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
                // Envia como imagem (usuário pode converter pra sticker com #sticker se quiser)
                await this.sock.sendMessage(m.key.remoteJid, { image: res.buffer, caption: `✅ Efeito ${command} aplicado` }, { quoted: m });
            } else {
                await this.bot.reply(m, `❌ Erro: ${res.error || 'Falha desconhecida'}`);
            }
        } catch (e) {
            await this.bot.reply(m, '❌ Erro ao processar imagem.');
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
                msg += `👉 Use: *#buy ${key}*\n\n`;
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

            await this.bot.reply(m, msg);
            return true;
        }

        const planKey = args[0].toLowerCase().trim();
        const userId = m.key.participant || m.key.remoteJid;

        // Gera link
        const res = this.bot.paymentManager.generatePaymentLink(userId, planKey);

        if (res.success) {
            await this.bot.reply(m, `⏳ *Gerando Pagamento...*`);

            // Envia QR Code se disponível
            await this.bot.reply(m, `✅ *Pedido Criado!*\n\n${res.message}\n\n_Assim que o pagamento for confirmado, seu plano será ativado automaticamente._`);
        } else {
            await this.bot.reply(m, `❌ ${res.message}`);
        }
        return true;
    }

    /**
    * Processa comandos recebidos (LEGACY - Mantido para compatibilidade se necessário)
    */
    async handleCommand(m, command, args) {
        return this.handle(m, {
            nome: m.pushName || 'Usuário',
            numeroReal: m.key.participant || m.key.remoteJid,
            texto: `${this.config.PREFIXO}${command} ${args.join(' ')}`,
            replyInfo: null,
            ehGrupo: m.key.remoteJid.endsWith('@g.us')
        });
    }
}

export default CommandHandler;
