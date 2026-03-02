const ConfigManager = require('./ConfigManager');
const fs = require('fs');
const path = require('path');

/**
 * ═══════════════════════════════════════════════════════════════════════
 * COMMAND HANDLER - AKIRA BOT V21
 * ═══════════════════════════════════════════════════════════════════════
 * ✅ Sistema completo de comandos com permissões por tier
 * ✅ Rate limiting inteligente por usuário
 * ✅ Menus profissionais e formatados
 * ✅ Funcionalidades enterprise-grade
 * ═══════════════════════════════════════════════════════════════════════
 */

// Sistema de rate limiting por usuário (premium features)
const premiumFeatureUsage = new Map(); // { userId: { lastUse: timestamp, count: number, resetDate: Date } }

class CommandHandler {
  constructor(botCore) {
    this.bot = botCore;
    this.config = ConfigManager.getInstance();
  }

  /**
   * Verifica se usuário tem acesso a feature premium (1x a cada 3 meses)
   */
  canUsePremiumFeature(userId) {
    const now = new Date();
    const usage = premiumFeatureUsage.get(userId) || { lastUse: 0, count: 0, resetDate: now };

    // Reset a cada 3 meses (90 dias)
    const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

    if (usage.resetDate < threeMonthsAgo) {
      usage.count = 0;
      usage.resetDate = now;
    }

    const canUse = usage.count === 0;
    if (canUse) {
      usage.count = 1;
      usage.lastUse = now.getTime();
    }

    premiumFeatureUsage.set(userId, usage);
    return canUse;
  }

  /**
   * Formata linha divisória para menus
   */
  getDivider() {
    return '═'.repeat(54);
  }

  /**
   * Formata cabeçalho de menu
   */
  getMenuHeader(emoji, title) {
    return `╔${'═'.repeat(52)}╗
║ ${emoji}  ${title.padEnd(48)} ║
╚${'═'.repeat(52)}╝`;
  }

  /**
   * Formata seção de menu
   */
  getMenuSection(emoji, section) {
    return `\n${this.getDivider()}
${emoji} ${section}
${this.getDivider()}`;
  }

  async handle(m, meta) {
    // meta: { nome, numeroReal, texto, replyInfo, ehGrupo }
    try {
      const { nome, numeroReal, texto, replyInfo, ehGrupo } = meta;
      const mp = this.bot.messageProcessor;
      const parsed = mp.parseCommand(texto);
      if (!parsed) return false;

      const senderId = numeroReal;
      const sock = this.bot.sock;

      // common helpers
      const isOwner = () => {
        try { return this.config.isDono(senderId, nome); } catch { return false; }
      };

      const cmd = parsed.comando;
      const args = parsed.args;
      const full = parsed.textoCompleto;

      // Rate-limit via messageProcessor
      if (!mp.checkRateLimit(senderId)) {
        await sock.sendMessage(m.key.remoteJid, { text: '⏰ Você está usando comandos muito rápido. Aguarde.' }, { quoted: m });
        return true;
      }

      // Permission check wrapper for owner-only actions
      const ownerOnly = async (fn) => {
        if (!isOwner()) {
          await sock.sendMessage(m.key.remoteJid, { text: '🚫 Comando restrito ao dono.' }, { quoted: m });
          return true;
        }
        return await fn();
      };

      switch (cmd) {
        case 'ping':
          await sock.sendMessage(m.key.remoteJid, { text: `🏓 Pong! Uptime: ${Math.floor(process.uptime())}s` }, { quoted: m });
          return true;

        case 'perfil':
        case 'profile':
        case 'info':
          try {
            const uid = m.key.participant || m.key.remoteJid;
            const nomeReg = this.bot.apiClient.getRegisterName ? this.bot.apiClient.getRegisterName(uid) : 'Não registrado';
            const level = this.bot.levelSystem.getGroupRecord(m.key.remoteJid, uid, true).level || 0;
            const xp = this.bot.levelSystem.getGroupRecord(m.key.remoteJid, uid, true).xp || 0;
            const txt = `👤 *Perfil:* ${nomeReg}\n🎮 Nível: ${level}\n⭐ XP: ${xp}`;
            await sock.sendMessage(m.key.remoteJid, { text: txt }, { quoted: m });
          } catch (e) { }
          return true;

        case 'registrar':
        case 'register':
        case 'reg':
          try {
            // local simple registry using database/datauser/registered.json
            const dbFolder = path.join(this.config.DATABASE_FOLDER, 'datauser');
            if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });
            const regPath = path.join(dbFolder, 'registered.json');
            if (!fs.existsSync(regPath)) fs.writeFileSync(regPath, JSON.stringify([], null, 2));

            if (!full.includes('|')) {
              await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #registrar Nome|Idade' }, { quoted: m });
              return true;
            }
            const [nomeUser, idadeStr] = full.split('|').map(s => s.trim());
            const idade = parseInt(idadeStr, 10);
            if (!nomeUser || isNaN(idade)) { await sock.sendMessage(m.key.remoteJid, { text: 'Formato inválido.' }, { quoted: m }); return true; }

            const registered = JSON.parse(fs.readFileSync(regPath, 'utf8') || '[]');
            const senderJid = m.key.participant || m.key.remoteJid;
            if (registered.find(u => u.id === senderJid)) { await sock.sendMessage(m.key.remoteJid, { text: '✅ Você já está registrado!' }, { quoted: m }); return true; }

            const serial = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toUpperCase();
            const time = new Date().toISOString();
            registered.push({ id: senderJid, name: nomeUser, age: idade, time, serial, registeredAt: Date.now() });
            fs.writeFileSync(regPath, JSON.stringify(registered, null, 2));

            // ensure leveling record
            this.bot.levelSystem.getGroupRecord(m.key.remoteJid, senderJid, true);
            await sock.sendMessage(m.key.remoteJid, { text: '✅ Registrado com sucesso!' }, { quoted: m });
          } catch (e) { this.bot.logger && this.bot.logger.error('registrar error', e); }
          return true;

        case 'level':
        case 'nivel':
        case 'rank':
          try {
            const gid = m.key.remoteJid;
            if (!String(gid).endsWith('@g.us')) { await sock.sendMessage(gid, { text: '📵 Level funciona apenas em grupos.' }, { quoted: m }); return true; }
            const sub = (args[0] || '').toLowerCase();
            if (['on', 'off', 'status'].includes(sub)) {
              return await ownerOnly(async () => {
                const settingsPath = this.config.JSON_PATHS?.leveling || null;
                if (settingsPath) {
                  const toggles = this.bot.apiClient.loadJSON ? this.bot.apiClient.loadJSON(settingsPath) : {};
                  if (sub === 'on') { toggles[gid] = true; this.bot.apiClient.saveJSON && this.bot.apiClient.saveJSON(settingsPath, toggles); await sock.sendMessage(gid, { text: '✅ Level ativado' }, { quoted: m }); }
                  else if (sub === 'off') { delete toggles[gid]; this.bot.apiClient.saveJSON && this.bot.apiClient.saveJSON(settingsPath, toggles); await sock.sendMessage(gid, { text: '🚫 Level desativado' }, { quoted: m }); }
                  else { await sock.sendMessage(gid, { text: `ℹ️ Status: ${toggles[gid] ? 'Ativo' : 'Inativo'}` }, { quoted: m }); }
                } else {
                  await sock.sendMessage(gid, { text: '⚠️ Configuração de leveling não encontrada' }, { quoted: m });
                }
                return true;
              });
            }

            // Mostrar level do usuário
            const uid = m.key.participant || m.key.remoteJid;
            const rec = this.bot.levelSystem.getGroupRecord(gid, uid, true);
            const req = this.bot.levelSystem.requiredXp(rec.level);
            const pct = req === Infinity ? 100 : Math.min(100, Math.floor((rec.xp / req) * 100));
            const msg = `🎉 LEVEL\n👤 @${uid.split('@')[0]}\n📊 Nível: ${rec.level}\n⭐ XP: ${rec.xp}/${req}\nProgresso: ${pct}%`;
            await sock.sendMessage(gid, { text: msg, contextInfo: { mentionedJid: [uid] } }, { quoted: m });
          } catch (e) { }
          return true;

        case 'antilink':
          try {
            return await ownerOnly(async () => {
              const sub2 = (args[0] || '').toLowerCase();
              const gid = m.key.remoteJid;
              if (sub2 === 'on') { this.bot.moderationSystem.toggleAntiLink(gid, true); await sock.sendMessage(gid, { text: '🔒 ANTI-LINK ATIVADO' }, { quoted: m }); }
              else if (sub2 === 'off') { this.bot.moderationSystem.toggleAntiLink(gid, false); await sock.sendMessage(gid, { text: '🔓 ANTI-LINK DESATIVADO' }, { quoted: m }); }
              else { await sock.sendMessage(gid, { text: `Status: ${this.bot.moderationSystem.isAntiLinkActive(gid) ? 'Ativo' : 'Inativo'}` }, { quoted: m }); }
              return true;
            });
          } catch (e) { }
          return true;

        case 'mute':
          try {
            return await ownerOnly(async () => {
              const target = (m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])[0] || replyInfo?.participantJidCitado;
              if (!target) { await sock.sendMessage(m.key.remoteJid, { text: 'Marque ou responda o usuário' }, { quoted: m }); return true; }
              const res = this.bot.moderationSystem.muteUser(m.key.remoteJid, target, 5);
              await sock.sendMessage(m.key.remoteJid, { text: `🔇 Mutado por ${res.minutes} minutos` }, { quoted: m });
              return true;
            });
          } catch (e) { }
          return true;

        case 'desmute':
          try { return await ownerOnly(async () => { const target = (m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])[0] || replyInfo?.participantJidCitado; if (!target) { await sock.sendMessage(m.key.remoteJid, { text: 'Marque ou responda o usuário' }, { quoted: m }); return true; } this.bot.moderationSystem.unmuteUser(m.key.remoteJid, target); await sock.sendMessage(m.key.remoteJid, { text: '🔊 Usuário desmutado' }, { quoted: m }); return true; }); } catch (e) { }
          return true;

        case 'sticker':
        case 's':
        case 'fig':
          try {
            // delegate to mediaProcessor
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMsg = m.message?.imageMessage || quoted?.imageMessage;
            const stickerMsg = quoted?.stickerMessage;
            if (stickerMsg) {
              const stickerBuf = await this.bot.mediaProcessor.downloadMedia(stickerMsg, 'sticker');
              if (stickerBuf) {
                await sock.sendMessage(m.key.remoteJid, { sticker: stickerBuf }, { quoted: m });
              } else {
                await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao baixar sticker.' }, { quoted: m });
              }
              return true;
            }
            if (imageMsg) {
              const buf = await this.bot.mediaProcessor.downloadMedia(imageMsg, 'image');
              const res = await this.bot.mediaProcessor.createStickerFromImage(buf, { packName: this.config.STICKER_PACK || 'Akira Pack', author: nome });
              if (res && res.sucesso && res.buffer) {
                await sock.sendMessage(m.key.remoteJid, { sticker: res.buffer }, { quoted: m });
              } else {
                await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao criar sticker' }, { quoted: m });
              }
              return true;
            }
            await sock.sendMessage(m.key.remoteJid, { text: 'Envie/Responda uma imagem ou sticker' }, { quoted: m });
          } catch (e) { }
          return true;

        case 'play':
          try {
            if (!full) { await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #play <link ou termo>' }, { quoted: m }); return true; }
            await sock.sendMessage(m.key.remoteJid, { text: '⏳ Processando música...' }, { quoted: m });
            const res = await this.bot.mediaProcessor.downloadYouTubeAudio(full);
            if (res.error) { await sock.sendMessage(m.key.remoteJid, { text: `❌ ${res.error}` }, { quoted: m }); return true; }
            await sock.sendMessage(m.key.remoteJid, { audio: res.buffer, mimetype: 'audio/mpeg', ptt: false, fileName: `${res.title || 'music'}.mp3` }, { quoted: m });
          } catch (e) { }
          return true;

        // ═══════════════════════════════════════════════════════════════
        // COMANDO: MENU / HELP / COMANDOS
        // ═══════════════════════════════════════════════════════════════
        case 'help':
        case 'menu':
        case 'comandos':
        case 'ajuda':
          try {
            const menuText = `╔════════════════════════════════════════════════════╗
║  🤖 AKIRA BOT V21 - MENU COMPLETO 🤖              ║
╚════════════════════════════════════════════════════╝

📱 *PREFIXO:* \`${this.config.PREFIXO}\`

═══════════════════════════════════════════════════════
🎨 MÍDIA & CRIATIVIDADE (Todos)
═══════════════════════════════════════════════════════
\`#sticker\` - Criar sticker de imagem
\`#s\` ou \`#fig\` - Aliases para #sticker
\`#play <nome/link>\` - Baixar música do YouTube
\`#ping\` - Testar latência do bot

═══════════════════════════════════════════════════════
🎤 ÁUDIO INTELIGENTE (Novo)
═══════════════════════════════════════════════════════
• Respondo áudio automaticamente em PV
• Em grupos: mencione "Akira" ou responda ao áudio
• Transcrição interna (NUNCA mostra no chat)
• Resposto em áudio automático

═══════════════════════════════════════════════════════
👑 MODERAÇÃO (Apenas Isaac Quarenta)
═══════════════════════════════════════════════════════
\`#antilink on\` - Ativar anti-link
\`#antilink off\` - Desativar anti-link
\`#antilink status\` - Ver status
\`#mute @usuário\` - Mutar por 5 min (ou reply)
\`#desmute @usuário\` - Desmutar (ou reply)
\`#level on\` - Ativar sistema de níveis
\`#level off\` - Desativar sistema de níveis
\`#level status\` - Ver status do level

═══════════════════════════════════════════════════════
🎮 UTILIDADES (Todos)
═══════════════════════════════════════════════════════
\`#perfil\` ou \`#info\` - Ver seu perfil
\`#registrar Nome|Idade\` - Registrar no bot
\`#level\` - Ver seu nível e XP

═══════════════════════════════════════════════════════
💬 CONVERSA NORMAL
═══════════════════════════════════════════════════════
✅ Mencione "Akira" em grupos
✅ Ou responda minhas mensagens para conversar
✅ IA sempre disponível em PV

═══════════════════════════════════════════════════════
⚠️ INFORMAÇÕES IMPORTANTES
═══════════════════════════════════════════════════════
🔐 Comandos de grupo: Apenas Isaac Quarenta
📊 Sistema de XP automático ao enviar mensagens
🏆 Suba de nível conversando (automaticamente)
🛡️ Anti-spam e proteção contra abuso
🎤 STT: Deepgram (200h/mês gratuito)
🔊 TTS: Google Text-to-Speech

═══════════════════════════════════════════════════════
💰 *Quer apoiar o projeto?*
Digite: \`#donate\` ou \`#doar\`
═══════════════════════════════════════════════════════

*Desenvolvido com ❤️ por Isaac Quarenta*`;

            await sock.sendMessage(m.key.remoteJid, { text: menuText }, { quoted: m });
          } catch (e) {
            this.bot.logger?.error('Erro no comando menu:', e);
          }
          return true;

        // ═══════════════════════════════════════════════════════════════
        // COMANDO: DONATE / APOIO
        // ═══════════════════════════════════════════════════════════════
        case 'donate':
        case 'doar':
        case 'apoia':
        case 'doacao':
          try {
            const donateText = `╔════════════════════════════════════════════════════╗
║  ❤️ APOIE O PROJETO AKIRA BOT ❤️                ║
╚════════════════════════════════════════════════════╝

🙏 *Você gosta do Akira?*

Seu apoio nos ajuda a manter:
✅ Bot online 24/7
✅ Novas funcionalidades
✅ Sem publicidades
✅ Gratuito para todos

═══════════════════════════════════════════════════════
💰 FORMAS DE APOIAR
═══════════════════════════════════════════════════════

🔑 *PIX (IMEDIATO):*
E-mail: akira.bot.dev@gmail.com
Chave: akira.bot.dev@gmail.com

☕ *COMPRE UM CAFÉ (Ko-fi):*
https://ko-fi.com/isaacquarenta

💳 *PAYPAL:*
https://paypal.me/isaacquarenta

🎁 *QUALQUER VALOR AJUDA!*
Desde R$ 5 até quanto você quiser contribuir

═══════════════════════════════════════════════════════
🙏 AGRADECIMENTOS ESPECIAIS
═══════════════════════════════════════════════════════

Todos que contribuem receberão:
✨ Meu sincero agradecimento
✨ Suporte prioritário
✨ Novas features primeiro
✨ Reconhecimento especial
✨ Status VIP no bot

═══════════════════════════════════════════════════════
📊 IMPACTO DA SUA DOAÇÃO
═══════════════════════════════════════════════════════

R$ 5 = Mantém o bot 1 dia online
R$ 20 = Semana completa
R$ 50 = Mês inteiro
R$ 100+ = Mês + desenvolvimento de features

═══════════════════════════════════════════════════════

*Desenvolvido com ❤️ por Isaac Quarenta*

_Obrigado por apoiar um projeto feito com paixão!_ 🚀`;

            await sock.sendMessage(m.key.remoteJid, { text: donateText }, { quoted: m });
          } catch (e) {
            this.bot.logger?.error('Erro no comando donate:', e);
          }
          return true;

        default:
          return false;
      }
    } catch (err) {
      try { await this.bot.sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no comando.' }, { quoted: m }); } catch { }
      return true;
    }
  }
}

module.exports = CommandHandler;
