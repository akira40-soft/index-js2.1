const ConfigManager = require('./ConfigManager');
const PresenceSimulator = require('./PresenceSimulator');
const StickerViewOnceHandler = require('./StickerViewOnceHandler');
const MediaProcessor = require('./MediaProcessor');
const CybersecurityToolkit = require('./CybersecurityToolkit');
const OSINTFramework = require('./OSINTFramework');
const SubscriptionManager = require('./SubscriptionManager');
const SecurityLogger = require('./SecurityLogger');

// Novos módulos para comandos adicionais
const GroupManagement = require('./GroupManagement');
const UserProfile = require('./UserProfile');
const BotProfile = require('./BotProfile');
const ImageEffects = require('./ImageEffects');

const fs = require('fs');
const path = require('path');

/**
 * ═══════════════════════════════════════════════════════════════════════
 * COMMAND HANDLER - AKIRA BOT V21.02.2025
 * ═══════════════════════════════════════════════════════════════════════
 * ✅ Sistema completo de comandos com permissões por tier
 * ✅ Rate limiting inteligente e proteção contra abuso
 * ✅ Menus profissionais e formatados em ASCII art
 * ✅ Funcionalidades enterprise-grade
 * ✅ Logging de ações administrativas
 * ✅ Simulações realistas de presença (digitação, gravação, ticks)
 * ═══════════════════════════════════════════════════════════════════════
 */

// Sistema de rate limiting para features premium (1x a cada 3 meses para users)
const premiumFeatureUsage = new Map();

// Log de ações administrativas
const adminLog = new Map();

// PresenceSimulator será inicializado no construtor
let presenceSimulator = null;

class CommandHandler {
  constructor(botCore, sock = null) {
    this.bot = botCore;
    this.config = ConfigManager.getInstance();
    this.sock = sock;
    
    // Inicializa handlers de mídia
    if (sock) {
      this.stickerHandler = new StickerViewOnceHandler(sock, this.config);
      this.mediaProcessor = new MediaProcessor();
      console.log('✅ Handlers de mídia inicializados: StickerViewOnceHandler, MediaProcessor');
    }
    
    // Inicializa ferramentas de cybersecurity (ENTERPRISE)
    this.cybersecurityToolkit = new CybersecurityToolkit(sock, this.config);
    this.osintFramework = new OSINTFramework(this.config);
    this.subscriptionManager = new SubscriptionManager(this.config);
    this.securityLogger = new SecurityLogger(this.config);
    console.log('✅ Ferramentas ENTERPRISE inicializadas: CybersecurityToolkit, OSINTFramework, SubscriptionManager, SecurityLogger');
    
    // Inicializa novos módulos
    if (sock) {
      this.groupManagement = new GroupManagement(sock, this.config);
      this.userProfile = new UserProfile(sock, this.config);
      this.botProfile = new BotProfile(sock, this.config);
      this.imageEffects = new ImageEffects(this.config);
      console.log('✅ Novos módulos inicializados: GroupManagement, UserProfile, BotProfile, ImageEffects');
    }
    
    // Inicializa PresenceSimulator se socket for fornecido
    if (sock) {
      presenceSimulator = new PresenceSimulator(sock);
      console.log('✅ PresenceSimulator inicializado para CommandHandler');
    }
  }

  /**
   * Inicializa o socket do Baileys (usado se não foi passado no construtor)
   */
  setSocket(sock) {
    this.sock = sock;
    
    // Inicializa handlers de mídia se ainda não foram
    if (!this.stickerHandler) {
      this.stickerHandler = new StickerViewOnceHandler(sock, this.config);
      this.mediaProcessor = new MediaProcessor();
      console.log('✅ Handlers de mídia inicializados via setSocket()');
    }
    
    // Inicializa novos módulos se ainda não foram
    if (!this.groupManagement) {
      this.groupManagement = new GroupManagement(sock, this.config);
      this.userProfile = new UserProfile(sock, this.config);
      this.botProfile = new BotProfile(sock, this.config);
      this.imageEffects = new ImageEffects(this.config);
      console.log('✅ Novos módulos inicializados via setSocket()');
    }
    
    if (!presenceSimulator && sock) {
      presenceSimulator = new PresenceSimulator(sock);
      console.log('✅ PresenceSimulator inicializado via setSocket()');
    }
  }

  /**
   * Simula digitação realista antes de responder a um comando
   */
  async simulateTyping(jid, text) {
    if (!presenceSimulator) return;
    const duration = presenceSimulator.calculateTypingDuration(text);
    await presenceSimulator.simulateTyping(jid, duration);
  }

  /**
   * Simula gravação de áudio antes de enviar áudio
   */
  async simulateRecording(jid, text) {
    if (!presenceSimulator) return;
    const duration = presenceSimulator.calculateRecordingDuration(text);
    await presenceSimulator.simulateRecording(jid, duration);
  }

  /**
   * Marca mensagem com ticks apropriados
   */
  async markMessageStatus(m, wasActivated = true) {
    if (!presenceSimulator) return;
    await presenceSimulator.simulateTicks(m, wasActivated);
  }

  /**
   * Verifica se usuário tem acesso a feature premium
   * Users comuns: 1x a cada 90 dias
   * Owners/Admins: Ilimitado
   */
  canUsePremiumFeature(userId, isOwner = false) {
    if (isOwner) return true; // Owners têm acesso ilimitado

    const now = new Date();
    const usage = premiumFeatureUsage.get(userId) || { 
      lastUse: 0, 
      count: 0, 
      resetDate: new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000) // Garante reset
    };
    
    const threeMonthsInMs = 90 * 24 * 60 * 60 * 1000;
    const hasResetWindow = (now.getTime() - usage.resetDate.getTime()) >= threeMonthsInMs;
    
    if (hasResetWindow) {
      usage.count = 0;
      usage.resetDate = now;
    }
    
    const canUse = usage.count === 0;
    if (canUse) {
      usage.count = 1;
      usage.lastUse = now.getTime();
      premiumFeatureUsage.set(userId, usage);
    }
    
    return canUse;
  }

  /**
   * Log de ação administrativa
   */
  logAdminAction(userId, userName, action, target = null, details = '') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${action} | User: ${userName} (${userId}) | Target: ${target || 'N/A'} | Details: ${details}`;
    
    console.log(`📋 [ADMIN LOG] ${logEntry}`);
    
    const logsPath = path.join(this.config.LOGS_FOLDER, 'admin_actions.log');
    try {
      fs.appendFileSync(logsPath, logEntry + '\n');
    } catch (e) {
      console.error('Erro ao registrar ação:', e);
    }
  }

  /**
   * Formato para separadores de menu
   */
  createMenuBar(char = '═', length = 54) {
    return char.repeat(length);
  }

  /**
   * Cria cabeçalho profissional de menu
   */
  createMenuHeader(emoji, title) {
    const maxLen = 50;
    const titleFormatted = title.length > maxLen ? title.substring(0, maxLen - 3) + '...' : title;
    return `╔${this.createMenuBar('═', 52)}╗
║ ${emoji}  ${titleFormatted.padEnd(48)} ║
╚${this.createMenuBar('═', 52)}╝`;
  }

  /**
   * Cria seção de menu formatada
   */
  createMenuSection(emoji, title) {
    return `\n${this.createMenuBar()}
${emoji} ${title}
${this.createMenuBar()}`;
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

      // Helpers de permissão
      const isOwner = () => {
        try { return this.config.isDono(senderId, nome); } catch { return false; }
      };

      const ownerOnly = async (fn) => {
        if (!isOwner()) {
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🚫 *COMANDO RESTRITO*\n\nApenas o proprietário (Isaac Quarenta) pode usar este comando.\n\n💡 Se deseja acesso a features premium, use #donate para apoiar o projeto!' 
          }, { quoted: m });
          return true;
        }
        return await fn();
      };

      const cmd = parsed.comando.toLowerCase();
      const args = parsed.args;
      const full = parsed.textoCompleto;

      // Rate limiting
      if (!mp.checkRateLimit(senderId)) {
        await sock.sendMessage(m.key.remoteJid, { 
          text: '⏰ *AGUARDE UM MOMENTO*\n\nVocê está usando comandos muito rápido. Por favor, aguarde alguns segundos.' 
        }, { quoted: m });
        return true;
      }

      // ═══════════════════════════════════════════════════════════════
      // COMANDOS PÚBLICOS
      // ═══════════════════════════════════════════════════════════════

      // PING - Testar latência
      if (cmd === 'ping') {
        const startTime = Date.now();
        const sentMsg = await sock.sendMessage(m.key.remoteJid, { 
          text: '🏓 Pong!' 
        }, { quoted: m });
        const latency = Date.now() - startTime;
        
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        await sock.sendMessage(m.key.remoteJid, { 
          text: `📊 *LATÊNCIA E STATUS*

🏓 Latência: ${latency}ms
⏱️ Uptime: ${hours}h ${minutes}m
🤖 Bot: ${this.bot.sock.user ? '✅ Online' : '❌ Offline'}
📡 API: ${this.config.API_URL}` 
        });
        return true;
      }

      // INFO DO BOT
      if (cmd === 'info' || cmd === 'botinfo' || cmd === 'about') {
        const infoText = this.createMenuHeader('🤖', 'INFORMAÇÕES DO BOT') + `

*Nome:* Akira Bot V21.02.2025
*Desenvolvedor:* Isaac Quarenta
*País:* 🇦🇴 Luanda, Angola

${this.createMenuSection('⚙️', 'CONFIGURAÇÃO TÉCNICA')}
*Número:* ${this.config.BOT_NUMERO_REAL}
*Prefixo:* ${this.config.PREFIXO}
*Status:* ${this.bot.sock.user ? '✅ Online' : '❌ Offline'}
*Uptime:* ${Math.floor(process.uptime())}s
*API:* Hugging Face

${this.createMenuSection('✨', 'RECURSOS IMPLEMENTADOS')}
✅ IA Conversacional (GPT-like)
✅ Áudio Inteligente (STT + TTS)
✅ Criação de Stickers
✅ Download de Áudio YouTube
✅ Sistema de Níveis e XP
✅ Moderação Avançada
✅ Anti-link automático
✅ Sistema de Mute progressivo
✅ Logging de ações
✅ Rate limiting por usuário

${this.createMenuSection('🎤', 'SERVIÇOS DE ÁUDIO')}
*STT:* Deepgram (nova-2) - 200h/mês gratuito
*TTS:* Google Text-to-Speech - Ilimitado
*Idiomas Suportados:* Português, Inglês, Espanhol, Francês, +15 idiomas

${this.createMenuSection('🔐', 'SEGURANÇA')}
🛡️ Validação de usuários
🔒 Encriptação de dados
⏱️ Rate limiting inteligente
🚫 Bloqueio de spam
📋 Logging completo de ações

${this.createMenuSection('💡', 'COMANDOS RÁPIDOS')}
#menu - Ver todos os comandos
#help - Ajuda sobre comandos
#donate - Apoiar o projeto
#stats - Ver estatísticas

*Desenvolvido com ❤️ por Isaac Quarenta*
_Versão v21.02.2025 - Enterprise Grade_`;

        await sock.sendMessage(m.key.remoteJid, { text: infoText }, { quoted: m });
        return true;
      }

      // MENU / HELP
      if (cmd === 'help' || cmd === 'menu' || cmd === 'comandos' || cmd === 'ajuda') {
        const menuText = this.createMenuHeader('🤖', 'MENU COMPLETO - AKIRA BOT V21') + `

${this.createMenuSection('🎨', 'MÍDIA E CRIATIVIDADE')}
*#sticker* - Criar sticker de imagem
*#s* ou *#fig* - Aliases para sticker
*#gif* - Criar sticker animado (máx 30s)
*#toimg* - Converter sticker para imagem
*#play <nome/link>* - Baixar áudio do YouTube
*#tts <idioma> <texto>* - Converter texto em voz
*#ping* - Testar latência do bot

${this.createMenuSection('🎤', 'ÁUDIO INTELIGENTE')}
Envie mensagens de voz e eu respondo automaticamente!
• Em PV: Respondo qualquer áudio
• Em grupos: Mencione "Akira" ou responda ao meu áudio
• Transcrição interna (nunca mostrada)
• Resposta automática em áudio

${this.createMenuSection('👥', 'PERFIL E REGISTRO')}
*#perfil* - Ver seu perfil e estatísticas
*#info* - Informações pessoais
*#registrar Nome|Idade* - Registrar no bot
*#level* - Ver seu nível e progresso XP
*#stats* - Suas estatísticas completas

${this.createMenuSection('⚙️', 'COMANDOS DE GRUPO (Dono)')}
*#add <número>* - Adicionar membro
*#remove @membro* - Remover membro
*#ban @membro* - Banir membro
*#promote @membro* - Dar admin
*#demote @membro* - Remover admin
*#mute @usuário* - Mutar por 5 min (progressivo)
*#desmute @usuário* - Desmutar
*#warn @usuário* - Dar aviso
*#clearwarn @usuário* - Remover avisos

${this.createMenuSection('🛡️', 'MODERAÇÃO E PROTEÇÃO')}
*#antilink on* - Ativar anti-link automático
*#antilink off* - Desativar anti-link
*#antilink status* - Ver status
*#level on* - Ativar sistema de níveis
*#level off* - Desativar sistema de níveis
*#apagar* - Apagar mensagem (responda a ela)

${this.createMenuSection('📸', 'MODERAÇÃO DE GRUPO (Dono)')}
*#fotogrupo* - Ver/alterar foto do grupo
*#nomegrupo <nome>* - Alterar nome do grupo
*#descricaogrupo <desc>* - Alterar descrição
*#fechargrupo* - Fechar grupo (só admins enviam)
*#abrirgrupo* - Abrir grupo (todos enviam)
*#fecharprog HH:MM* - Fechamento programado
*#abrirprog HH:MM* - Abertura programada
*#verprog* - Ver programações ativas
*#cancelarprog* - Cancelar programações
*#statusgrupo* - Ver status do grupo

${this.createMenuSection('👤', 'DADOS DE USUÁRIO')}
*#dadosusuario @menção* - Ver dados do usuário
*#fotoperfil @menção* - Ver foto de perfil
*#biografia @menção* - Ver bio/status do usuário

${this.createMenuSection('🤖', 'CONFIGURAÇÕES DA AKIRA (Dono)')}
*#setbotpic* - Alterar foto da Akira
*#setbotname <nome>* - Alterar nome da Akira
*#setbotbio <bio>* - Alterar bio da Akira
*#verbotinfo* - Ver informações da Akira

${this.createMenuSection('💬', 'CONVERSA NORMAL')}
Apenas mencione "Akira" em grupos ou responda minhas mensagens
Em PV, converse naturalmente - sempre online!

${this.createMenuSection('⚠️', 'INFORMAÇÕES IMPORTANTES')}
🔐 Comandos de grupo: Apenas proprietário
📊 Sistema de XP: Ganha automaticamente ao conversar
🏆 Leveling: Suba de nível conversando
🎁 Rewards: Conquiste badges e prêmios
🛡️ Proteção: Anti-spam, anti-link, anti-abuse

${this.createMenuSection('❤️', 'APOIAR O PROJETO')}
*#donate* - Ver formas de apoio
Seu apoio ajuda a manter o bot online e com novas features!

*Desenvolvido com ❤️ por Isaac Quarenta*
_Versão v21.02.2025 - Enterprise Grade_`;

        await sock.sendMessage(m.key.remoteJid, { text: menuText }, { quoted: m });
        return true;
      }

      // DONATE
      if (cmd === 'donate' || cmd === 'doar' || cmd === 'apoia' || cmd === 'doacao' || cmd === 'apoiar') {
        const donateText = this.createMenuHeader('❤️', 'APOIE O PROJETO AKIRA BOT') + `

${this.createMenuSection('🙏', 'POR QUE APOIAR?')}
✅ Mantém o bot online 24/7
✅ Desenvolvimento de novas features
✅ Manutenção de servidores
✅ Melhorias de performance
✅ Suporte prioritário
✅ Acesso a recursos premium

${this.createMenuSection('💰', 'FORMAS DE APOIO')}

*🔑 PIX (INSTANTÂNEO)*
E-mail: akira.bot.dev@gmail.com
Chave: akira.bot.dev@gmail.com
CPF: Disponível em contato direto

*☕ COMPRE UM CAFÉ (Ko-fi)*
https://ko-fi.com/isaacquarenta
Pague quanto quiser, quanto puder

*💳 PAYPAL*
https://paypal.me/isaacquarenta
Internacional e seguro

*🎁 VALORES SUGERIDOS*
R$ 5 - Mantém 1 dia online + Agradecimento especial
R$ 20 - 1 semana online + Suporte prioritário
R$ 50 - 1 mês online + Acesso a features premium
R$ 100+ - 1 mês + Desenvolvimento customizado

${this.createMenuSection('🎉', 'BENEFÍCIOS DO APOIADOR')}
✨ Seu nome em parede de honra
✨ Badge especial "Apoiador" no bot
✨ Acesso a features beta primeiro
✨ Suporte técnico direto (WhatsApp)
✨ Customizações personalizadas
✨ Renovação automática de benefícios

${this.createMenuSection('📊', 'IMPACTO DA SUA DOAÇÃO')}
💵 R$ 5 = 1 dia online para todos os usuários
💵 R$ 20 = 1 semana de operação contínua
💵 R$ 50 = 1 mês de servidor + 1 feature nova
💵 R$ 100+ = 3 meses de operação + desenvolvimento customizado

${this.createMenuSection('📲', 'CONTATO')}
WhatsApp: +244 937 035 662
Email: isaac.quarenta@akira.bot
Discord: [Disponível em breve]

*Obrigado por apoiar um projeto feito com ❤️ paixão!*
_Cada real faz diferença no desenvolvimento do Akira Bot_

🚀 Desenvolvido com ❤️ por Isaac Quarenta`;

        await sock.sendMessage(m.key.remoteJid, { text: donateText }, { quoted: m });
        return true;
      }

      // ═══════════════════════════════════════════════════════════════
      // COMANDOS DE MANUTENÇÃO DE PERFIL
      // ═══════════════════════════════════════════════════════════════

      if (cmd === 'perfil' || cmd === 'profile' || cmd === 'myperfil') {
        try {
          const uid = m.key.participant || m.key.remoteJid;
          const dbFolder = path.join(this.config.DATABASE_FOLDER, 'datauser');
          const regPath = path.join(dbFolder, 'registered.json');
          
          let userData = { name: 'Não registrado', age: '?', registeredAt: 'N/A' };
          
          if (fs.existsSync(regPath)) {
            const registered = JSON.parse(fs.readFileSync(regPath, 'utf8') || '[]');
            const user = registered.find(u => u.id === uid);
            if (user) {
              userData = user;
            }
          }

          let levelRecord = null;
          if (this.bot.levelSystem && this.bot.levelSystem.getGroupRecord) {
            levelRecord = this.bot.levelSystem.getGroupRecord(m.key.remoteJid, uid, true);
          }
          const level = (levelRecord && levelRecord.level) ? levelRecord.level : 0;
          const xp = (levelRecord && levelRecord.xp) ? levelRecord.xp : 0;
          let nextLevelXp = 1000;
          if (this.bot.levelSystem && this.bot.levelSystem.requiredXp) {
            nextLevelXp = this.bot.levelSystem.requiredXp(level + 1) || 1000;
          }
          const progressPct = Math.min(100, Math.floor((xp / nextLevelXp) * 100));
          const patente = this.bot.levelSystem.getPatente(level);

          const profileText = this.createMenuHeader('👤', 'SEU PERFIL') + `

${this.createMenuSection('📝', 'INFORMAÇÕES PESSOAIS')}
*Nome:* ${userData.name || 'Desconhecido'}
*Idade:* ${userData.age || '?'} anos
*JID:* ${uid}
*Registrado em:* ${userData.registeredAt || 'Nunca'}

${this.createMenuSection('🎮', 'ESTATÍSTICAS DE JOGO')}
*Nível:* ${level}
*🏆 Patente:* ${patente}
*Experiência (XP):* ${xp}
*Próximo nível:* ${nextLevelXp}
*Progresso:* ${'█'.repeat(Math.floor(progressPct / 10))}${'░'.repeat(10 - Math.floor(progressPct / 10))} ${progressPct}%

${this.createMenuSection('🏆', 'CONQUISTAS')}
${level >= 5 ? '✅ Bronze - Nível 5' : '⬜ Bronze - Nível 5'}
${level >= 10 ? '✅ Prata - Nível 10' : '⬜ Prata - Nível 10'}
${level >= 25 ? '✅ Ouro - Nível 25' : '⬜ Ouro - Nível 25'}
${level >= 50 ? '✅ Platina - Nível 50' : '⬜ Platina - Nível 50'}
${level >= 100 ? '✅ Diamante - Nível 100' : '⬜ Diamante - Nível 100'}

${this.createMenuSection('💡', 'DICAS PARA SUBIR')}
💬 Converse naturalmente para ganhar XP
🎤 Responda áudios e converse
🏆 Participe de desafios
💰 Apoie o projeto e ganhe bônus

Quer registrar seu perfil? Use: #registrar Nome|Idade`;

          await sock.sendMessage(m.key.remoteJid, { text: profileText }, { quoted: m });
        } catch (e) {
          console.error('Erro em perfil:', e);
        }
        return true;
      }

      if (cmd === 'registrar' || cmd === 'register' || cmd === 'reg') {
        try {
          const dbFolder = path.join(this.config.DATABASE_FOLDER, 'datauser');
          if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });
          const regPath = path.join(dbFolder, 'registered.json');
          if (!fs.existsSync(regPath)) fs.writeFileSync(regPath, JSON.stringify([], null, 2));

          if (!full || !full.includes('|')) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '📝 *COMO REGISTRAR*\n\nUso: `#registrar Nome|Idade`\n\nExemplo:\n`#registrar Isaac Quarenta|25`' 
            }, { quoted: m });
            return true;
          }

          const [nomeUser, idadeStr] = full.split('|').map(s => s.trim());
          const idade = parseInt(idadeStr, 10);

          if (!nomeUser || isNaN(idade) || idade < 1 || idade > 120) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Formato inválido! Nome válido e idade entre 1-120.' 
            }, { quoted: m });
            return true;
          }

          const registered = JSON.parse(fs.readFileSync(regPath, 'utf8') || '[]');
          const senderJid = m.key.participant || m.key.remoteJid;

          if (registered.find(u => u.id === senderJid)) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '✅ Você já está registrado!\n\nUse #perfil para ver suas informações.' 
            }, { quoted: m });
            return true;
          }

          const serial = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toUpperCase();
          registered.push({
            id: senderJid,
            name: nomeUser,
            age: idade,
            time: new Date().toISOString(),
            serial,
            registeredAt: new Date().toLocaleDateString('pt-BR')
          });

          fs.writeFileSync(regPath, JSON.stringify(registered, null, 2));

          // Garante que existe registro de níveis
          if (this.bot.levelSystem) {
            this.bot.levelSystem.getGroupRecord(m.key.remoteJid, senderJid, true);
          }

          await sock.sendMessage(m.key.remoteJid, { 
            text: `✅ *REGISTRO COMPLETO!*

*Bem-vindo ${nomeUser}!*

🎮 Seu ID: ${serial}
📅 Registrado em: ${new Date().toLocaleDateString('pt-BR')}
🏆 Nível inicial: 1
⭐ XP inicial: 0

Agora você pode usar #perfil para ver suas estatísticas!
Ganhe XP conversando naturalmente com o bot.` 
          }, { quoted: m });
        } catch (e) {
          console.error('Erro em registrar:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao registrar.' }, { quoted: m });
        }
        return true;
      }

      if (cmd === 'level' || cmd === 'nivel' || cmd === 'rank') {
        try {
          const gid = m.key.remoteJid;
          const isGroup = String(gid).endsWith('@g.us');

          if (!isGroup) {
            await sock.sendMessage(gid, { 
              text: '📵 Sistema de level funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          const sub = (args[0] || '').toLowerCase();

          // ═══ TODOS OS SUBCOMANDOS (on/off/status) SÃO DONO-ONLY ═══
          if (['on', 'off', 'status'].includes(sub)) {
            return await ownerOnly(async () => {
              // Toggle leveling system
              const togglesPath = path.join(this.config.DATABASE_FOLDER, 'group_settings.json');
              let toggles = {};

              if (fs.existsSync(togglesPath)) {
                toggles = JSON.parse(fs.readFileSync(togglesPath, 'utf8') || '{}');
              }

              if (sub === 'on') {
                toggles[gid] = { levelingEnabled: true };
                fs.writeFileSync(togglesPath, JSON.stringify(toggles, null, 2));
                this.logAdminAction(senderId, nome, 'LEVEL_ON', gid, 'Sistema de níveis ativado');
                await sock.sendMessage(gid, { 
                  text: '✅ *SISTEMA DE LEVEL ATIVADO!*\n\nOs membros agora ganham XP ao conversar e sobem de nível!' 
                }, { quoted: m });
              } else if (sub === 'off') {
                if (toggles[gid]) delete toggles[gid].levelingEnabled;
                fs.writeFileSync(togglesPath, JSON.stringify(toggles, null, 2));
                this.logAdminAction(senderId, nome, 'LEVEL_OFF', gid, 'Sistema de níveis desativado');
                await sock.sendMessage(gid, { 
                  text: '🚫 *SISTEMA DE LEVEL DESATIVADO!*\n\nOs membros não ganham mais XP.' 
                }, { quoted: m });
              } else {
                const isEnabled = (toggles[gid] && toggles[gid].levelingEnabled) ? toggles[gid].levelingEnabled : false;
                await sock.sendMessage(gid, { 
                  text: `📊 *STATUS DO LEVEL:* ${isEnabled ? '✅ ATIVADO' : '❌ DESATIVADO'}` 
                }, { quoted: m });
              }
              return true;
            });
          }

          // Mostrar level do usuário
          const uid = m.key.participant || m.key.remoteJid;
          let rec = { level: 0, xp: 0 };
          if (this.bot.levelSystem && this.bot.levelSystem.getGroupRecord) {
            rec = this.bot.levelSystem.getGroupRecord(gid, uid, true) || { level: 0, xp: 0 };
          }
          let nextReq = 1000;
          if (this.bot.levelSystem && this.bot.levelSystem.requiredXp) {
            nextReq = this.bot.levelSystem.requiredXp(rec.level + 1) || 1000;
          }
          const pct = Math.min(100, Math.floor((rec.xp / nextReq) * 100));

          const levelText = `🎉 *SEU NÍVEL NO GRUPO*

📊 Nível: ${rec.level}
⭐ XP: ${rec.xp}/${nextReq}
📈 Progresso: ${'█'.repeat(Math.floor(pct / 10))}${'░'.repeat(10 - Math.floor(pct / 10))} ${pct}%

💡 Ganhe XP conversando naturalmente no grupo!`;

          await sock.sendMessage(gid, { text: levelText }, { quoted: m });
        } catch (e) {
          console.error('Erro em level:', e);
        }
        return true;
      }

      // ═══════════════════════════════════════════════════════════════
      // COMANDOS DE MODERAÇÃO (DONO APENAS)
      // ═══════════════════════════════════════════════════════════════

      if (cmd === 'add') {
        return await ownerOnly(async () => {
          try {
            if (!ehGrupo) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando funciona apenas em grupos.' }, { quoted: m });
              return true;
            }

            const numero = args[0];
            if (!numero) {
              await sock.sendMessage(m.key.remoteJid, { text: '📱 Uso: #add 244123456789' }, { quoted: m });
              return true;
            }

            const jid = `${numero.replace(/\D/g, '')}@s.whatsapp.net`;
            await sock.groupParticipantsUpdate(m.key.remoteJid, [jid], 'add');
            this.logAdminAction(senderId, nome, 'ADD_MEMBER', numero, `Adicionado ao grupo ${m.key.remoteJid}`);
            await sock.sendMessage(m.key.remoteJid, { 
              text: `✅ ${numero} foi adicionado ao grupo com sucesso!` 
            }, { quoted: m });
          } catch (e) {
            console.error('Erro ao adicionar:', e);
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Erro ao adicionar. Verifique se sou admin.' 
            }, { quoted: m });
          }
          return true;
        });
      }

      if (cmd === 'remove' || cmd === 'kick' || cmd === 'ban') {
        return await ownerOnly(async () => {
          try {
            if (!ehGrupo) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando funciona apenas em grupos.' }, { quoted: m });
              return true;
            }

            let targets = [];
            if (m.message && m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo && m.message.extendedTextMessage.contextInfo.mentionedJid) {
              targets = m.message.extendedTextMessage.contextInfo.mentionedJid || [];
            }
            if (!targets.length && replyInfo && replyInfo.participantJidCitado) {
              targets = [replyInfo.participantJidCitado];
            }

            if (!targets.length) {
              await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Marque (@) o membro ou responda mensagem dele com #remove' 
              }, { quoted: m });
              return true;
            }

            await sock.groupParticipantsUpdate(m.key.remoteJid, targets, 'remove');
            this.logAdminAction(senderId, nome, 'REMOVE_MEMBERS', targets.length + ' membros', m.key.remoteJid);
            await sock.sendMessage(m.key.remoteJid, { 
              text: `✅ ${targets.length} membro(s) removido(s) do grupo.` 
            }, { quoted: m });
          } catch (e) {
            console.error('Erro ao remover:', e);
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Erro ao remover. Verifique permissões.' 
            }, { quoted: m });
          }
          return true;
        });
      }

      if (cmd === 'promote') {
        return await ownerOnly(async () => {
          try {
            if (!ehGrupo) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando funciona apenas em grupos.' }, { quoted: m });
              return true;
            }

            let targets = [];
            if (m.message && m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo && m.message.extendedTextMessage.contextInfo.mentionedJid) {
              targets = m.message.extendedTextMessage.contextInfo.mentionedJid || [];
            }
            if (!targets.length && replyInfo && replyInfo.participantJidCitado) {
              targets = [replyInfo.participantJidCitado];
            }

            if (!targets.length) {
              await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Marque (@) o membro ou responda mensagem dele com #promote' 
              }, { quoted: m });
              return true;
            }

            await sock.groupParticipantsUpdate(m.key.remoteJid, targets, 'promote');
            this.logAdminAction(senderId, nome, 'PROMOTE_MEMBERS', targets.length + ' membros', m.key.remoteJid);
            await sock.sendMessage(m.key.remoteJid, { 
              text: `✅ ${targets.length} membro(s) promovido(s) a admin.` 
            }, { quoted: m });
          } catch (e) {
            console.error('Erro ao promover:', e);
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Erro ao promover. Verifique permissões.' 
            }, { quoted: m });
          }
          return true;
        });
      }

      if (cmd === 'demote') {
        return await ownerOnly(async () => {
          try {
            if (!ehGrupo) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando funciona apenas em grupos.' }, { quoted: m });
              return true;
            }

            let targets = [];
            if (m.message && m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo && m.message.extendedTextMessage.contextInfo.mentionedJid) {
              targets = m.message.extendedTextMessage.contextInfo.mentionedJid || [];
            }
            if (!targets.length && replyInfo && replyInfo.participantJidCitado) {
              targets = [replyInfo.participantJidCitado];
            }

            if (!targets.length) {
              await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Marque (@) o admin ou responda mensagem dele com #demote' 
              }, { quoted: m });
              return true;
            }

            await sock.groupParticipantsUpdate(m.key.remoteJid, targets, 'demote');
            this.logAdminAction(senderId, nome, 'DEMOTE_MEMBERS', targets.length + ' membros', m.key.remoteJid);
            await sock.sendMessage(m.key.remoteJid, { 
              text: `✅ ${targets.length} admin(s) rebaixado(s).` 
            }, { quoted: m });
          } catch (e) {
            console.error('Erro ao rebaixar:', e);
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Erro ao rebaixar. Verifique permissões.' 
            }, { quoted: m });
          }
          return true;
        });
      }

      if (cmd === 'mute') {
        return await ownerOnly(async () => {
          try {
            if (!ehGrupo) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando funciona apenas em grupos.' }, { quoted: m });
              return true;
            }

            let target = null;
            let mentions = [];
            if (m.message && m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo && m.message.extendedTextMessage.contextInfo.mentionedJid) {
              mentions = m.message.extendedTextMessage.contextInfo.mentionedJid || [];
            }
            if (mentions.length) target = mentions[0];
            else if (replyInfo && replyInfo.participantJidCitado) target = replyInfo.participantJidCitado;

            if (!target) {
              await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Marque (@) o membro ou responda mensagem dele com #mute' 
              }, { quoted: m });
              return true;
            }

            let muteResult = { minutes: 5, muteCount: 1 };
            if (this.bot.moderationSystem && this.bot.moderationSystem.muteUser) {
              muteResult = this.bot.moderationSystem.muteUser(m.key.remoteJid, target, 5) || { minutes: 5, muteCount: 1 };
            }
            this.logAdminAction(senderId, nome, 'MUTE_USER', target, `${muteResult.minutes} minutos`);

            const expiryTime = new Date(Date.now() + muteResult.minutes * 60 * 1000).toLocaleTimeString('pt-BR');
            let msg = `🔇 *USUÁRIO MUTADO!*\n\n⏱️ Duração: ${muteResult.minutes} minutos\n⏰ Expira em: ${expiryTime}`;
            if (muteResult.muteCount > 1) {
              msg += `\n\n⚠️ ALERTA: Este usuário já foi mutado ${muteResult.muteCount} vezes hoje!`;
            }

            await sock.sendMessage(m.key.remoteJid, { text: msg }, { quoted: m });
          } catch (e) {
            console.error('Erro em mute:', e);
          }
          return true;
        });
      }

      if (cmd === 'desmute') {
        return await ownerOnly(async () => {
          try {
            if (!ehGrupo) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando funciona apenas em grupos.' }, { quoted: m });
              return true;
            }

            let target = null;
            let mentions = [];
            if (m.message && m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo && m.message.extendedTextMessage.contextInfo.mentionedJid) {
              mentions = m.message.extendedTextMessage.contextInfo.mentionedJid || [];
            }
            if (mentions.length) target = mentions[0];
            else if (replyInfo && replyInfo.participantJidCitado) target = replyInfo.participantJidCitado;

            if (!target) {
              await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Marque (@) o membro ou responda mensagem dele com #desmute' 
              }, { quoted: m });
              return true;
            }

            if (this.bot.moderationSystem && this.bot.moderationSystem.unmuteUser) {
              this.bot.moderationSystem.unmuteUser(m.key.remoteJid, target);
            }
            this.logAdminAction(senderId, nome, 'UNMUTE_USER', target, 'Mutação removida');
            await sock.sendMessage(m.key.remoteJid, { 
              text: '🔊 *USUÁRIO DESMUTADO!*\n\nEle agora pode enviar mensagens novamente.' 
            }, { quoted: m });
          } catch (e) {
            console.error('Erro em desmute:', e);
          }
          return true;
        });
      }

      if (cmd === 'antilink') {
        return await ownerOnly(async () => {
          try {
            if (!ehGrupo) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando funciona apenas em grupos.' }, { quoted: m });
              return true;
            }

            const sub = (args[0] || '').toLowerCase();
            const gid = m.key.remoteJid;

            if (sub === 'on') {
              if (this.bot.moderationSystem && this.bot.moderationSystem.toggleAntiLink) {
                this.bot.moderationSystem.toggleAntiLink(gid, true);
              }
              this.logAdminAction(senderId, nome, 'ANTILINK_ON', gid, 'Anti-link ativado');
              await sock.sendMessage(gid, { 
                text: '🔒 *ANTI-LINK ATIVADO!*\n\n⚠️ Qualquer membro que enviar link será removido automaticamente.' 
              }, { quoted: m });
            } else if (sub === 'off') {
              if (this.bot.moderationSystem && this.bot.moderationSystem.toggleAntiLink) {
                this.bot.moderationSystem.toggleAntiLink(gid, false);
              }
              this.logAdminAction(senderId, nome, 'ANTILINK_OFF', gid, 'Anti-link desativado');
              await sock.sendMessage(gid, { 
                text: '🔓 *ANTI-LINK DESATIVADO!*\n\n✅ Membros podem enviar links normalmente.' 
              }, { quoted: m });
            } else {
              let isActive = false;
              if (this.bot.moderationSystem && this.bot.moderationSystem.isAntiLinkActive) {
                isActive = this.bot.moderationSystem.isAntiLinkActive(gid) || false;
              }
              await sock.sendMessage(gid, { 
                text: `📊 *STATUS ANTI-LINK:* ${isActive ? '🟢 ATIVADO' : '🔴 DESATIVADO'}` 
              }, { quoted: m });
            }
            return true;
          } catch (e) {
            console.error('Erro em antilink:', e);
          }
          return true;
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // COMANDOS DE MÍDIA - STICKER, GIF, TOIMG, PLAY, TTS
      // ═══════════════════════════════════════════════════════════════

      // #STICKER / #S / #FIG
      if (cmd === 'sticker' || cmd === 's' || cmd === 'fig') {
        try {
          if (!this.stickerHandler) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Handler de sticker não inicializado.' 
            }, { quoted: m });
            return true;
          }
          return await this.stickerHandler.handleSticker(m, userData, full, ehGrupo);
        } catch (e) {
          console.error('Erro em sticker:', e);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Erro ao processar sticker.' 
          }, { quoted: m });
          return true;
        }
      }

      // #GIF
      if (cmd === 'gif') {
        try {
          if (!this.stickerHandler) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Handler de sticker não inicializado.' 
            }, { quoted: m });
            return true;
          }
          return await this.stickerHandler.handleGif(m, userData, full, ehGrupo);
        } catch (e) {
          console.error('Erro em gif:', e);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Erro ao criar sticker animado.' 
          }, { quoted: m });
          return true;
        }
      }

      // #TOIMG
      if (cmd === 'toimg') {
        try {
          if (!this.stickerHandler) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Handler de sticker não inicializado.' 
            }, { quoted: m });
            return true;
          }
          return await this.stickerHandler.handleToImage(m, userData, full, ehGrupo);
        } catch (e) {
          console.error('Erro em toimg:', e);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Erro ao converter sticker para imagem.' 
          }, { quoted: m });
          return true;
        }
      }

      // #PLAY - Download de áudio YouTube
      if (cmd === 'play') {
        try {
          if (!full) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '🎵 *COMANDO #play*\n\n' +
                    '✅ Use: `#play <nome da música ou link>`\n' +
                    '✅ Exemplos:\n' +
                    '   #play Imagine John Lennon\n' +
                    '   #play https://youtu.be/...\n\n' +
                    '⏱️ Máximo: 1 hora\n' +
                    '📊 Formato: MP3\n' +
                    '✨ Baixado diretamente do YouTube'
            }, { quoted: m });
            return true;
          }

          await sock.sendMessage(m.key.remoteJid, {
            text: '⏳ Processando sua requisição... Isto pode levar alguns segundos.'
          }, { quoted: m });

          // Verifica se é URL ou nome
          let url = full;
          if (!this.mediaProcessor.isValidYouTubeUrl(full)) {
            // Tenta buscar o vídeo pelo nome
            await sock.sendMessage(m.key.remoteJid, {
              text: '🔍 Buscando no YouTube...'
            }, { quoted: m });

            const searchResult = await this.mediaProcessor.searchYouTube(full, 1);
            if (!searchResult.sucesso || !searchResult.resultados || searchResult.resultados.length === 0) {
              await sock.sendMessage(m.key.remoteJid, {
                text: `❌ Nenhuma música encontrada para: "${full}"`
              }, { quoted: m });
              return true;
            }
            url = searchResult.resultados[0].url;
          }

          // Download do áudio
          const downloadResult = await this.mediaProcessor.downloadYouTubeAudio(url);
          if (!downloadResult.sucesso) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ Erro ao baixar: ${downloadResult.error}`
            }, { quoted: m });
            return true;
          }

          // Simula gravação
          await this.simulateRecording(m.key.remoteJid, downloadResult.titulo);

          // Envia áudio
          await sock.sendMessage(m.key.remoteJid, {
            audio: downloadResult.buffer,
            mimetype: 'audio/mpeg',
            ptt: false
          }, { quoted: m });

          // Mensagem de sucesso
          await sock.sendMessage(m.key.remoteJid, {
            text: `✅ *ÁUDIO ENVIADO COM SUCESSO!*\n\n` +
                  `🎵 Título: ${downloadResult.titulo}\n` +
                  `💾 Tamanho: ${(downloadResult.tamanho / 1024 / 1024).toFixed(2)}MB\n` +
                  `🔧 Método: ${downloadResult.metodo}`
          }, { quoted: m });

          return true;
        } catch (e) {
          console.error('Erro em play:', e);
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao baixar áudio do YouTube.'
          }, { quoted: m });
          return true;
        }
      }

      // #TTS - Text To Speech (Google)
      if (cmd === 'tts') {
        try {
          // Formato: #tts <idioma> <texto>
          // Exemplo: #tts pt Olá mundo
          const parts = full.split(' ');
          
          if (parts.length < 2) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '🎤 *COMANDO #tts (Text-To-Speech)*\n\n' +
                    '✅ Use: `#tts <idioma> <texto>`\n\n' +
                    '📝 Exemplos:\n' +
                    '   #tts pt Olá, como você está?\n' +
                    '   #tts en Hello world\n' +
                    '   #tts es Hola mundo\n' +
                    '   #tts fr Bonjour le monde\n\n' +
                    '🌍 Idiomas suportados:\n' +
                    '   pt (Português) | en (Inglês) | es (Espanhol)\n' +
                    '   fr (Francês) | de (Alemão) | it (Italiano)\n' +
                    '   ja (Japonês) | zh (Chinês) | ko (Coreano)\n' +
                    '   ru (Russo) | ar (Árabe) | hi (Hindi)'
            }, { quoted: m });
            return true;
          }

          const languageCode = parts[0].toLowerCase();
          const textToSpeak = parts.slice(1).join(' ');

          await sock.sendMessage(m.key.remoteJid, {
            text: '🎙️ Gerando áudio...'
          }, { quoted: m });

          // Usa gTTS (Google TTS) - precisa estar instalado
          let audioBuffer = null;
          try {
            const gTTS = require('gtts');
            const gtts = new gTTS.gTTS(textToSpeak, { lang: languageCode, slow: false });
            
            // Salva em buffer
            const tempFile = path.join(this.config.TEMP_FOLDER, `tts-${Date.now()}.mp3`);
            await new Promise((resolve, reject) => {
              gtts.save(tempFile, (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            audioBuffer = fs.readFileSync(tempFile);
            fs.unlinkSync(tempFile); // Remove arquivo temporário
          } catch (gttsError) {
            console.warn('⚠️ gtts falhou, tentando método alternativo...');
            // Se gtts falhar, usa uma resposta manual
            await sock.sendMessage(m.key.remoteJid, {
              text: `⚠️ Erro ao gerar áudio TTS.\n\n` +
                    `Certifique-se de ter "gtts" instalado:\n` +
                    `npm install gtts`
            }, { quoted: m });
            return true;
          }

          if (!audioBuffer) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '❌ Erro ao gerar áudio.'
            }, { quoted: m });
            return true;
          }

          // Simula gravação
          await this.simulateRecording(m.key.remoteJid, textToSpeak);

          // Envia áudio
          await sock.sendMessage(m.key.remoteJid, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: true
          }, { quoted: m });

          return true;
        } catch (e) {
          console.error('Erro em tts:', e);
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao gerar áudio de texto.'
          }, { quoted: m });
          return true;
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // COMANDOS DE PROTEÇÃO - WARN, CLEARWARN, APAGAR
      // ═══════════════════════════════════════════════════════════════

      // #WARN - Dar aviso a usuário
      if (cmd === 'warn') {
        return await ownerOnly(async () => {
          try {
            if (!ehGrupo) {
              await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Este comando funciona apenas em grupos.'
              }, { quoted: m });
              return true;
            }

            let target = null;
            let mentions = [];
            if (m.message && m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo && m.message.extendedTextMessage.contextInfo.mentionedJid) {
              mentions = m.message.extendedTextMessage.contextInfo.mentionedJid || [];
            }
            if (mentions.length) target = mentions[0];
            else if (replyInfo && replyInfo.participantJidCitado) target = replyInfo.participantJidCitado;

            if (!target) {
              await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Marque (@) o membro ou responda mensagem dele com #warn'
              }, { quoted: m });
              return true;
            }

            // Sistema de avisos (em memória para este exemplo)
            if (!this.bot.warnSystem) {
              this.bot.warnSystem = new Map();
            }

            const key = `${m.key.remoteJid}_${target}`;
            const warns = (this.bot.warnSystem.get(key) || 0) + 1;
            this.bot.warnSystem.set(key, warns);

            this.logAdminAction(senderId, nome, 'WARN_USER', target, `Avisos: ${warns}`);

            const msg = `⚠️ *USUÁRIO ADVERTIDO!*\n\n` +
                       `👤 Usuário marcado\n` +
                       `🚨 Avisos: ${warns}/3\n`;

            if (warns >= 3) {
              await sock.groupParticipantsUpdate(m.key.remoteJid, [target], 'remove');
              await sock.sendMessage(m.key.remoteJid, {
                text: msg + `\n❌ REMOVIDO DO GRUPO! (Atingiu 3 avisos)`
              }, { quoted: m });
              this.bot.warnSystem.delete(key);
            } else {
              await sock.sendMessage(m.key.remoteJid, {
                text: msg + `\n⏳ Avisos expiram em 24 horas`
              }, { quoted: m });
            }

            return true;
          } catch (e) {
            console.error('Erro em warn:', e);
          }
          return true;
        });
      }

      // #CLEARWARN - Remover avisos
      if (cmd === 'clearwarn') {
        return await ownerOnly(async () => {
          try {
            if (!ehGrupo) {
              await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Este comando funciona apenas em grupos.'
              }, { quoted: m });
              return true;
            }

            let target = null;
            let mentions = [];
            if (m.message && m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo && m.message.extendedTextMessage.contextInfo.mentionedJid) {
              mentions = m.message.extendedTextMessage.contextInfo.mentionedJid || [];
            }
            if (mentions.length) target = mentions[0];
            else if (replyInfo && replyInfo.participantJidCitado) target = replyInfo.participantJidCitado;

            if (!target) {
              await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Marque (@) o membro ou responda mensagem dele com #clearwarn'
              }, { quoted: m });
              return true;
            }

            if (!this.bot.warnSystem) {
              this.bot.warnSystem = new Map();
            }

            const key = `${m.key.remoteJid}_${target}`;
            const warns = this.bot.warnSystem.get(key) || 0;

            if (warns === 0) {
              await sock.sendMessage(m.key.remoteJid, {
                text: '✅ Este usuário não possui avisos.'
              }, { quoted: m });
              return true;
            }

            this.bot.warnSystem.delete(key);
            this.logAdminAction(senderId, nome, 'CLEARWARN_USER', target, `Avisos removidos (eram ${warns})`);

            await sock.sendMessage(m.key.remoteJid, {
              text: `✅ *AVISOS REMOVIDOS!*\n\n` +
                    `👤 Usuário marcado\n` +
                    `🗑️ Avisos removidos: ${warns}\n` +
                    `🆕 Avisos atuais: 0`
            }, { quoted: m });

            return true;
          } catch (e) {
            console.error('Erro em clearwarn:', e);
          }
          return true;
        });
      }

      // #APAGAR - Apagar mensagem (responder a ela)
      if (cmd === 'apagar' || cmd === 'delete' || cmd === 'del') {
        try {
          // Deve responder uma mensagem
          let quotedMsg = null;
          if (m.message && m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo && m.message.extendedTextMessage.contextInfo.quotedMessage) {
            quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
          }
          
          if (!quotedMsg) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '🗑️ *COMANDO #apagar*\n\n' +
                    '✅ Responda uma mensagem com `#apagar`\n' +
                    '✅ Apenas mensagens do próprio bot podem ser apagadas de forma segura\n\n' +
                    '⚠️ Uso: Responda a mensagem que deseja remover'
            }, { quoted: m });
            return true;
          }

          try {
            // Tenta apagar a mensagem citada
            await sock.sendMessage(m.key.remoteJid, {
              delete: m.message.extendedTextMessage.contextInfo.stanzaId
                ? {
                    remoteJid: m.key.remoteJid,
                    fromMe: true,
                    id: m.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: m.message.extendedTextMessage.contextInfo.participant
                  }
                : null
            });

            // Confirma
            setTimeout(async () => {
              await sock.sendMessage(m.key.remoteJid, {
                text: '✅ Mensagem apagada com sucesso!'
              }, { quoted: m });
            }, 500);

            return true;
          } catch (deleteError) {
            console.log('Nota: Apagamento direto não funcionou. Mensagem de confirmação enviada.');
            await sock.sendMessage(m.key.remoteJid, {
              text: '✅ Comando processado.\n\n' +
                    '⚠️ Nota: WhatsApp permite apagar apenas mensagens recentes (até 2 dias)'
            }, { quoted: m });
            return true;
          }
        } catch (e) {
          console.error('Erro em apagar:', e);
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao processar comando.'
          }, { quoted: m });
          return true;
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // 🔐 COMANDOS DE CYBERSECURITY - ENTERPRISE TOOLS
      // ═══════════════════════════════════════════════════════════════

      // #WHOIS - Investigação de domínios e IPs
      if (cmd === 'whois') {
        try {
          const permissao = this.subscriptionManager.canUseFeature(senderId, 'whois');
          
          if (!permissao.canUse && !isOwner()) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `🔒 *FEATURE RESTRITA*\n\nVocê atingiu seu limite mensal para #whois.\n\n${this.subscriptionManager.getUpgradeMessage(senderId, 'WHOIS')}`
            }, { quoted: m });
            return true;
          }

          if (!full) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '🔍 *COMANDO #whois*\n\nUso: `#whois <domínio ou IP>`\n\nExemplos:\n#whois google.com\n#whois 8.8.8.8'
            }, { quoted: m });
            return true;
          }

          await sock.sendMessage(m.key.remoteJid, {
            text: '🔍 Investigando alvo...'
          }, { quoted: m });

          const whoIsResult = await this.cybersecurityToolkit.whoIs(full);
          
          if (!whoIsResult.sucesso) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ ${whoIsResult.erro}`
            }, { quoted: m });
            return true;
          }

          let response = `✅ *WHOIS - ${whoIsResult.tipo.toUpperCase()}*\n\n`;
          response += `🎯 Alvo: ${whoIsResult.alvo}\n\n`;
          response += `📋 Informações:\n`;
          
          for (const [key, val] of Object.entries(whoIsResult.dados)) {
            if (Array.isArray(val)) {
              response += `${key}: ${val.join(', ') || 'N/A'}\n`;
            } else {
              response += `${key}: ${val}\n`;
            }
          }

          this.securityLogger.logOperation({
            usuario: nome,
            tipo: 'WHOIS',
            alvo: full,
            resultado: whoIsResult.sucesso ? 'SUCESSO' : 'FALHA',
            risco: 'BAIXO'
          });

          await sock.sendMessage(m.key.remoteJid, {
            text: response
          }, { quoted: m });

          return true;
        } catch (e) {
          console.error('Erro em whois:', e);
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao investigar alvo.'
          }, { quoted: m });
          return true;
        }
      }

      // #DNS - Investigação DNS
      if (cmd === 'dns') {
        try {
          const permissao = this.subscriptionManager.canUseFeature(senderId, 'dns');
          
          if (!permissao.canUse && !isOwner()) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `🔒 *FEATURE RESTRITA*\n\n${this.subscriptionManager.getUpgradeMessage(senderId, 'DNS Recon')}`
            }, { quoted: m });
            return true;
          }

          if (!full) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '📡 *COMANDO #dns*\n\nUso: `#dns <domínio>`\n\nExemplo: #dns google.com'
            }, { quoted: m });
            return true;
          }

          await sock.sendMessage(m.key.remoteJid, {
            text: '📡 Consultando DNS...'
          }, { quoted: m });

          const dnsResult = await this.cybersecurityToolkit.dnsRecon(full);
          
          if (!dnsResult.sucesso) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ ${dnsResult.erro}`
            }, { quoted: m });
            return true;
          }

          let response = `✅ *RECONHECIMENTO DNS*\n\n🎯 Domínio: ${dnsResult.dominio}\n\n`;
          response += `📋 Registros encontrados:\n`;

          for (const [tipo, registros] of Object.entries(dnsResult.registros)) {
            if (registros && registros.length > 0) {
              response += `\n${tipo}:\n`;
              registros.forEach(r => {
                response += `  • ${typeof r === 'object' ? JSON.stringify(r) : r}\n`;
              });
            }
          }

          response += `\n🔍 Subdomínios sugeridos:\n`;
          dnsResult.subdomainsSugeridos.forEach(sub => {
            response += `  • ${sub}\n`;
          });

          this.securityLogger.logOperation({
            usuario: nome,
            tipo: 'DNS_RECON',
            alvo: full,
            resultado: 'SUCESSO',
            risco: 'BAIXO',
            detalhes: { registrosTotais: Object.keys(dnsResult.registros).length }
          });

          await sock.sendMessage(m.key.remoteJid, {
            text: response
          }, { quoted: m });

          return true;
        } catch (e) {
          console.error('Erro em dns:', e);
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao consultar DNS.'
          }, { quoted: m });
          return true;
        }
      }

      // #NMAP - Port scanning
      if (cmd === 'nmap') {
        try {
          const permissao = this.subscriptionManager.canUseFeature(senderId, 'nmap');
          
          if (!permissao.canUse && !isOwner()) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `🔒 *FEATURE RESTRITA*\n\n${this.subscriptionManager.getUpgradeMessage(senderId, 'NMAP Scan')}`
            }, { quoted: m });
            return true;
          }

          if (!full) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '📡 *COMANDO #nmap*\n\nUso: `#nmap <IP ou domínio>`\n\nExemplo: #nmap google.com'
            }, { quoted: m });
            return true;
          }

          await sock.sendMessage(m.key.remoteJid, {
            text: '⏳ Scanning de portas (isto pode levar um minuto)...'
          }, { quoted: m });

          const nmapResult = await this.cybersecurityToolkit.nmapScan(full);
          
          if (!nmapResult.sucesso) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ ${nmapResult.erro}`
            }, { quoted: m });
            return true;
          }

          let response = `✅ *NMAP SCAN COMPLETO*\n\n`;
          response += `🎯 Alvo: ${nmapResult.alvo}\n`;
          response += `📍 IP: ${nmapResult.targetIP}\n`;
          response += `📊 Portas abertas: ${nmapResult.portasAbertos}\n\n`;
          response += `🔌 Serviços detectados:\n`;

          for (const [porta, info] of Object.entries(nmapResult.portas)) {
            response += `  Porta ${porta}: ${info.servico} (${info.versao})\n`;
          }

          response += `\n${nmapResult.aviso}`;

          this.securityLogger.logOperation({
            usuario: nome,
            tipo: 'NMAP_SCAN',
            alvo: full,
            resultado: 'SUCESSO',
            risco: nmapResult.portasAbertos > 5 ? 'MÉDIO' : 'BAIXO',
            detalhes: { portasAbertos: nmapResult.portasAbertos }
          });

          await sock.sendMessage(m.key.remoteJid, {
            text: response
          }, { quoted: m });

          return true;
        } catch (e) {
          console.error('Erro em nmap:', e);
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao fazer scan.'
          }, { quoted: m });
          return true;
        }
      }

      // #SQLMAP - SQL Injection testing
      if (cmd === 'sqlmap') {
        try {
          const permissao = this.subscriptionManager.canUseFeature(senderId, 'sqlmap');
          
          if (!permissao.canUse && !isOwner()) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `🔒 *FEATURE RESTRITA - PREMIUM ONLY*\n\n${this.subscriptionManager.getUpgradeMessage(senderId, 'SQLMap Testing')}`
            }, { quoted: m });
            return true;
          }

          if (!full || !full.includes('http')) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '💉 *COMANDO #sqlmap*\n\nUso: `#sqlmap <URL completa>`\n\n⚠️ APENAS PARA TESTE EM AMBIENTES AUTORIZADOS\n\nExemplo: #sqlmap https://example.com/search.php?id=1'
            }, { quoted: m });
            return true;
          }

          await sock.sendMessage(m.key.remoteJid, {
            text: '⏳ Testando vulnerabilidades de SQL Injection...'
          }, { quoted: m });

          const sqlmapResult = await this.cybersecurityToolkit.sqlmapTest(full);
          
          if (!sqlmapResult.sucesso) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ ${sqlmapResult.erro}`
            }, { quoted: m });
            return true;
          }

          let response = `*SQLMAP TEST RESULT*\n\n`;
          response += `🎯 Alvo: ${sqlmapResult.alvo}\n`;
          response += `⚠️ SQL Injection detectada: ${sqlmapResult.vulneravelSQLi ? '✅ SIM - CRÍTICO' : '❌ Não detectada'}\n\n`;

          if (sqlmapResult.vulnerabilidades.length > 0) {
            response += `🚨 Vulnerabilidades encontradas:\n`;
            sqlmapResult.vulnerabilidades.forEach((vuln, i) => {
              response += `\n  ${i+1}. Tipo: ${vuln.tipo}\n`;
              response += `     Payload: ${vuln.payload}\n`;
              response += `     Risco: ${vuln.risco}\n`;
            });
          }

          response += `\n💡 Recomendações:\n`;
          sqlmapResult.recomendacoes.forEach(rec => {
            response += `${rec}\n`;
          });

          this.securityLogger.logOperation({
            usuario: nome,
            tipo: 'SQLMAP_TEST',
            alvo: full,
            resultado: sqlmapResult.vulneravelSQLi ? 'VULNERÁVEL' : 'SEGURO',
            risco: sqlmapResult.vulneravelSQLi ? 'CRÍTICO' : 'BAIXO'
          });

          await sock.sendMessage(m.key.remoteJid, {
            text: response
          }, { quoted: m });

          return true;
        } catch (e) {
          console.error('Erro em sqlmap:', e);
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao testar vulnerabilidades.'
          }, { quoted: m });
          return true;
        }
      }

      // #OSINT - Open Source Intelligence gathering
      if (cmd === 'osint') {
        try {
          const sub = (args[0] || '').toLowerCase();
          const alvo = args.slice(1).join(' ') || full;

          if (!sub || !alvo || ['email', 'phone', 'username', 'domain', 'breach'].indexOf(sub) === -1) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `🕵️ *COMANDO #osint - OPEN SOURCE INTELLIGENCE*\n\n` +
                    `Subcomandos:\n` +
                    `  #osint email <email> - Pesquisar email\n` +
                    `  #osint phone <número> - Pesquisar telefone\n` +
                    `  #osint username <username> - Buscar em redes sociais\n` +
                    `  #osint domain <domínio> - Encontrar subdomínios\n` +
                    `  #osint breach <email> - Verificar vazamentos\n\n` +
                    `💎 Recursos premium disponíveis com assinatura`
            }, { quoted: m });
            return true;
          }

          const permissao = this.subscriptionManager.canUseFeature(senderId, `osint_${sub}`);
          
          if (!permissao.canUse && !isOwner()) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `🔒 *FEATURE RESTRITA*\n\n${this.subscriptionManager.getUpgradeMessage(senderId, `OSINT - ${sub.toUpperCase()}`)}`
            }, { quoted: m });
            return true;
          }

          await sock.sendMessage(m.key.remoteJid, {
            text: `🔍 Investigando ${sub}...`
          }, { quoted: m });

          let resultado;

          if (sub === 'email') {
            resultado = await this.osintFramework.emailReconnaissance(alvo);
          } else if (sub === 'phone') {
            resultado = await this.osintFramework.phoneNumberLookup(alvo);
          } else if (sub === 'username') {
            resultado = await this.osintFramework.usernameSearch(alvo);
          } else if (sub === 'domain') {
            resultado = await this.osintFramework.subdomainEnumeration(alvo);
          } else if (sub === 'breach') {
            resultado = await this.osintFramework.breachSearch(alvo);
          }

          if (!resultado.sucesso) {
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ ${resultado.erro}`
            }, { quoted: m });
            return true;
          }

          let response = `✅ *OSINT - ${sub.toUpperCase()}*\n\n`;

          if (sub === 'email') {
            response += `📧 Email: ${resultado.email}\n`;
            response += `✔️ Válido: ${resultado.valido ? 'Sim' : 'Não'}\n`;
            response += `🚨 Vazamentos: ${resultado.descobertas.vazamentosEncontrados}\n`;
            if (resultado.descobertas.breaches.length > 0) {
              response += `   - ${resultado.descobertas.breaches.map(b => b.nome).join('\n   - ')}\n`;
            }
          } else if (sub === 'phone') {
            response += `📱 Número: ${resultado.numero}\n`;
            response += `🌍 País: ${resultado.analise.pais}\n`;
            response += `📊 Operadora: ${resultado.analise.operadora}\n`;
            response += `📈 Tipo: ${resultado.analise.tipoLinha}\n`;
          } else if (sub === 'username') {
            response += `👤 Username: ${resultado.username}\n`;
            response += `🔗 Contas encontradas: ${resultado.encontrados}\n`;
            resultado.contas.forEach(conta => {
              response += `   ${conta.ícone} ${conta.plataforma}: ${conta.status}\n`;
            });
          } else if (sub === 'domain') {
            response += `🌐 Domínio: ${resultado.dominio}\n`;
            response += `🔍 Subdomínios encontrados: ${resultado.descobertos}\n`;
            resultado.subdomainios.slice(0, 5).forEach(sub => {
              response += `   • ${sub.subdominio} (${sub.ativo ? '✅ Ativo' : '❌ Inativo'})\n`;
            });
          } else if (sub === 'breach') {
            response += `🎯 Alvo: ${resultado.alvo}\n`;
            response += `🚨 Vazamentos: ${resultado.vazamentosEncontrados}\n`;
            resultado.breaches.forEach(breach => {
              response += `   🔴 ${breach.nome} - ${breach.dataVazamento}\n`;
            });
            response += `\n⚠️ Ações recomendadas:\n`;
            resultado.acoes.forEach(acao => {
              response += `${acao}\n`;
            });
          }

          this.securityLogger.logOperation({
            usuario: nome,
            tipo: `OSINT_${sub.toUpperCase()}`,
            alvo,
            resultado: resultado.sucesso ? 'SUCESSO' : 'FALHA',
            risco: 'BAIXO'
          });

          await sock.sendMessage(m.key.remoteJid, {
            text: response
          }, { quoted: m });

          return true;
        } catch (e) {
          console.error('Erro em osint:', e);
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao investigar alvo.'
          }, { quoted: m });
          return true;
        }
      }

      // #MODE - Modo ROOT (dono apenas)
      if (cmd === 'mode') {
        try {
          const modo = (args[0] || '').toLowerCase();

          if (modo === 'root') {
            if (!isOwner()) {
              await sock.sendMessage(m.key.remoteJid, {
                text: '🚫 *COMANDO RESTRITO*\n\nApenas o proprietário pode ativar modo ROOT.'
              }, { quoted: m });
              return true;
            }

            // Ativa modo root
            if (!this.bot.rootMode) {
              this.bot.rootMode = new Map();
            }

            const rootMode = !((this.bot.rootMode.get(senderId) || false));
            this.bot.rootMode.set(senderId, rootMode);

            const resposta = rootMode ?
              `🔓 *MODO ROOT ATIVADO*\n\n` +
              `⚠️ Você agora tem acesso ilimitado a:\n` +
              `• Ferramentas de cybersecurity\n` +
              `• Dark web monitoring\n` +
              `• Análise profunda\n` +
              `• Sem limites de taxa\n\n` +
              `🛡️ Todas as operações serão logadas.`
              :
              `🔒 *MODO ROOT DESATIVADO*\n\nVoltando aos limites normais.`;

            await sock.sendMessage(m.key.remoteJid, {
              text: resposta
            }, { quoted: m });

            this.logAdminAction(senderId, nome, `MODE_ROOT_${rootMode ? 'ON' : 'OFF'}`, 'N/A', '');
            return true;
          }

          if (modo === 'status') {
            const subInfo = this.subscriptionManager.getSubscriptionInfo(senderId);
            
            let response = `📊 *STATUS DO BOT*\n\n`;
            response += `🎭 Modo: ${isOwner() ? '👑 OWNER' : 'Usuário normal'}\n`;
            response += `💎 Tier: ${subInfo.tier}\n`;
            response += `📈 Status: ${subInfo.status}\n\n`;
            response += `✨ Recursos disponíveis:\n`;
            subInfo.recursos.forEach(rec => {
              response += `${rec}\n`;
            });

            if (subInfo.upgrade) {
              response += `\n${subInfo.upgrade}`;
            }

            await sock.sendMessage(m.key.remoteJid, {
              text: response
            }, { quoted: m });
            return true;
          }

          await sock.sendMessage(m.key.remoteJid, {
            text: `⚙️ *COMANDO #mode*\n\nSubcomandos:\n` +
                  `  #mode root - Ativar/desativar modo ROOT (dono)\n` +
                  `  #mode status - Ver status e limites`
          }, { quoted: m });

          return true;
        } catch (e) {
          console.error('Erro em mode:', e);
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao processar comando.'
          }, { quoted: m });
          return true;
        }
      }

      // #SECURITY - Relatórios de segurança
      if (cmd === 'security') {
        try {
          const sub = (args[0] || '').toLowerCase();

          if (sub === 'report' && isOwner()) {
            const report = this.securityLogger.getOperationReport();
            const alertReport = this.securityLogger.getAlertReport();

            let response = `📊 *RELATÓRIO DE SEGURANÇA*\n\n`;
            response += `📈 Operações registradas: ${report.totalOperacoes}\n`;
            response += `🚨 Alertas ativos: ${alertReport.alertasNovos}\n`;
            response += `✅ Alertas resolvidos: ${alertReport.alertasResolvidos}\n\n`;
            response += `📋 Operações por tipo:\n`;

            for (const [tipo, count] of Object.entries(report.resumoPorTipo)) {
              response += `   ${tipo}: ${count}\n`;
            }

            response += `\n🚨 Operações suspeitas: ${report.operaçõesSuspeitas}\n`;

            await sock.sendMessage(m.key.remoteJid, {
              text: response
            }, { quoted: m });

            return true;
          }

          await sock.sendMessage(m.key.remoteJid, {
            text: `🛡️ *COMANDO #security*\n\nSubcomandos (dono):\n` +
                  `  #security report - Ver relatório de segurança`
          }, { quoted: m });

          return true;
        } catch (e) {
          console.error('Erro em security:', e);
          return true;
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 🔴 FERRAMENTAS PENTESTING REAIS (ROOT ONLY - DONO)
      // ═══════════════════════════════════════════════════════════════════════
      
      // #NMAP - REAL Port scanning com ferramenta verdadeira
      if (cmd === 'nmap' && isOwner()) {
        return await ownerOnly(async () => {
          try {
            if (!full) {
              await sock.sendMessage(m.key.remoteJid, {
                text: `📡 *NMAP - REAL PORT SCANNING*\n\n` +
                      `✅ Ferramenta REAL: github.com/nmap/nmap\n\n` +
                      `Uso: #nmap <target>\n` +
                      `Exemplo: #nmap 192.168.1.1\n` +
                      `Exemplo: #nmap scanme.nmap.org\n\n` +
                      `⏱️ Timeout: 15 minutos (full range)\n` +
                      `🚀 Framework: child_process.spawn()`
              }, { quoted: m });
              return true;
            }

            await sock.sendMessage(m.key.remoteJid, {
              text: `⏳ Iniciando NMAP real em ${full}...\n\n⚠️ Isto pode levar alguns minutos.`
            }, { quoted: m });

            const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
            const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
            const result = await toolkit.nmapScan(full);

            let response = `✅ *NMAP SCAN COMPLETO (REAL)*\n\n`;
            response += `🎯 Alvo: ${result.target}\n`;
            response += `📊 Portas abertas: ${result.openPorts.length}\n`;
            response += `⏱️ Duração: ${result.duration}s\n\n`;

            if (result.openPorts.length > 0) {
              response += `🔌 Serviços encontrados:\n`;
              result.openPorts.slice(0, 20).forEach(port => {
                response += `   ${port.port}/${port.protocol} - ${port.service} (${port.state})\n`;
              });
              if (result.openPorts.length > 20) {
                response += `   ... e mais ${result.openPorts.length - 20} portas\n`;
              }
            } else {
              response += `❌ Nenhuma porta aberta encontrada\n`;
            }

            response += `\n📁 Resultados salvos em: /tmp/pentest_results/\n`;
            response += `🔐 Operação logada para auditoria`;

            this.logAdminAction(senderId, nome, 'NMAP_SCAN_REAL', full, `Portas: ${result.openPorts.length}`);
            this.securityLogger.logOperation({
              usuario: nome,
              tipo: 'NMAP_REAL',
              alvo: full,
              resultado: 'COMPLETO',
              risco: 'MÉDIO',
              detalhes: { portas: result.openPorts.length }
            });

            await sock.sendMessage(m.key.remoteJid, {
              text: response
            }, { quoted: m });

            return true;
          } catch (e) {
            console.error('Erro em NMAP:', e);
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ Erro ao executar NMAP:\n\n${e.message}`
            }, { quoted: m });
            return true;
          }
        });
      }

      // #SQLMAP - REAL SQL Injection testing
      if (cmd === 'sqlmap' && isOwner()) {
        return await ownerOnly(async () => {
          try {
            if (!full || !full.startsWith('http')) {
              await sock.sendMessage(m.key.remoteJid, {
                text: `💉 *SQLMAP - REAL SQL INJECTION TESTING*\n\n` +
                      `✅ Ferramenta REAL: github.com/sqlmapproject/sqlmap\n\n` +
                      `Uso: #sqlmap <URL completa>\n` +
                      `Exemplo: #sqlmap http://target.com/search.php?id=1\n\n` +
                      `⚠️ APENAS EM ALVOS AUTORIZADOS!\n` +
                      `🔐 Modo: child_process.spawn() python3`
              }, { quoted: m });
              return true;
            }

            await sock.sendMessage(m.key.remoteJid, {
              text: `⏳ Testando SQL Injection em ${full}...\n\n⚠️ Timeout: 20 minutos`
            }, { quoted: m });

            const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
            const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
            const result = await toolkit.sqlmapTest(full);

            let response = `✅ *SQLMAP TEST COMPLETO (REAL)*\n\n`;
            response += `🎯 Alvo: ${result.target}\n`;
            response += `⚠️ Vulnerável: ${result.vulnerable ? '🔴 SIM - CRÍTICO' : '✅ NÃO'}\n\n`;

            if (result.vulnerable && result.vulnerabilities.length > 0) {
              response += `🚨 Vulnerabilidades encontradas:\n`;
              result.vulnerabilities.slice(0, 10).forEach((vuln, i) => {
                response += `\n${i+1}. Tipo: ${vuln.type}\n`;
                response += `   Parameter: ${vuln.parameter}\n`;
                response += `   Risco: ${vuln.risk}\n`;
              });
            }

            response += `\n📁 Resultados: /tmp/pentest_results/sqlmap_results.json\n`;
            response += `🔐 Operação logada`;

            this.logAdminAction(senderId, nome, 'SQLMAP_REAL', full, `Vulnerável: ${result.vulnerable}`);
            this.securityLogger.logOperation({
              usuario: nome,
              tipo: 'SQLMAP_REAL',
              alvo: full,
              resultado: result.vulnerable ? 'VULNERÁVEL' : 'SEGURO',
              risco: result.vulnerable ? 'CRÍTICO' : 'BAIXO'
            });

            await sock.sendMessage(m.key.remoteJid, {
              text: response
            }, { quoted: m });

            return true;
          } catch (e) {
            console.error('Erro em SQLMAP:', e);
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ Erro ao executar SQLMAP:\n\n${e.message}`
            }, { quoted: m });
            return true;
          }
        });
      }

      // #HYDRA - REAL Password cracking
      if (cmd === 'hydra' && isOwner()) {
        return await ownerOnly(async () => {
          try {
            if (!full || !full.includes(' ')) {
              await sock.sendMessage(m.key.remoteJid, {
                text: `🔓 *HYDRA - REAL PASSWORD CRACKING*\n\n` +
                      `✅ Ferramenta REAL: github.com/vanhauser-thc/thc-hydra\n\n` +
                      `Uso: #hydra <alvo> <usuário> <arquivo_senhas>\n` +
                      `Exemplo: #hydra 192.168.1.1:22 root password_list.txt\n\n` +
                      `⚠️ LEGAL PURPOSES ONLY!\n` +
                      `⏱️ Timeout: 30 minutos`
              }, { quoted: m });
              return true;
            }

            const [target, user, ...passFile] = full.split(' ');
            await sock.sendMessage(m.key.remoteJid, {
              text: `⏳ Iniciando Hydra em ${target}...\n\n⚠️ Isto pode levar tempo`
            }, { quoted: m });

            const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
            const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
            const result = await toolkit.hydraBrute(target, 'ssh', user, []);

            let response = `✅ *HYDRA BRUTE-FORCE COMPLETO (REAL)*\n\n`;
            response += `🎯 Alvo: ${target}\n`;
            response += `👤 Usuário: ${user}\n`;
            response += `🔓 Senha encontrada: ${result.found ? result.password : 'Não'}\n`;
            response += `⏱️ Tempo: ${result.duration}s\n\n`;
            response += `📊 Tentativas: ${result.attempts}`;

            this.logAdminAction(senderId, nome, 'HYDRA_REAL', target, `Tentativas: ${result.attempts}`);

            await sock.sendMessage(m.key.remoteJid, {
              text: response
            }, { quoted: m });

            return true;
          } catch (e) {
            console.error('Erro em HYDRA:', e);
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ Erro ao executar Hydra:\n\n${e.message}`
            }, { quoted: m });
            return true;
          }
        });
      }

      // #NUCLEI - REAL Vulnerability scanning
      if (cmd === 'nuclei' && isOwner()) {
        return await ownerOnly(async () => {
          try {
            if (!full) {
              await sock.sendMessage(m.key.remoteJid, {
                text: `🔍 *NUCLEI - REAL VULNERABILITY SCANNING*\n\n` +
                      `✅ Ferramenta REAL: github.com/projectdiscovery/nuclei\n\n` +
                      `Uso: #nuclei <target>\n` +
                      `Exemplo: #nuclei https://target.com\n` +
                      `Exemplo: #nuclei 192.168.1.1\n\n` +
                      `⏱️ Timeout: 10 minutos\n` +
                      `📊 Templates: Auto-detection`
              }, { quoted: m });
              return true;
            }

            await sock.sendMessage(m.key.remoteJid, {
              text: `⏳ Nuclei scanning em ${full}...\n\n⚠️ Verificando vulnerabilidades`
            }, { quoted: m });

            const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
            const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
            const result = await toolkit.nucleiScan(full);

            let response = `✅ *NUCLEI SCAN COMPLETO (REAL)*\n\n`;
            response += `🎯 Alvo: ${full}\n`;
            response += `🔍 Vulnerabilidades encontradas: ${result.findings.length}\n\n`;

            if (result.findings.length > 0) {
              response += `🚨 Resultados:\n`;
              result.findings.slice(0, 15).forEach((finding, i) => {
                response += `\n${i+1}. ${finding.name}\n`;
                response += `   Severidade: ${finding.severity}\n`;
                response += `   CVSS: ${finding.cvss || 'N/A'}\n`;
              });
              if (result.findings.length > 15) {
                response += `\n... e mais ${result.findings.length - 15} vulnerabilidades\n`;
              }
            }

            response += `\n📁 Resultados: /tmp/pentest_results/nuclei_results.json`;

            this.logAdminAction(senderId, nome, 'NUCLEI_REAL', full, `Findings: ${result.findings.length}`);

            await sock.sendMessage(m.key.remoteJid, {
              text: response
            }, { quoted: m });

            return true;
          } catch (e) {
            console.error('Erro em NUCLEI:', e);
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ Erro ao executar Nuclei:\n\n${e.message}`
            }, { quoted: m });
            return true;
          }
        });
      }

      // #MASSCAN - REAL Ultra-fast port scanning
      if (cmd === 'masscan' && isOwner()) {
        return await ownerOnly(async () => {
          try {
            if (!full) {
              await sock.sendMessage(m.key.remoteJid, {
                text: `⚡ *MASSCAN - REAL ULTRA-FAST PORT SCANNING*\n\n` +
                      `✅ Ferramenta REAL: github.com/robertdavidgraham/masscan\n\n` +
                      `Uso: #masscan <target> [portas]\n` +
                      `Exemplo: #masscan 192.168.1.0/24\n` +
                      `Exemplo: #masscan 192.168.1.1 1-65535\n\n` +
                      `🚀 Velocidade: 1000+ req/s\n` +
                      `⏱️ Timeout: 5 minutos`
              }, { quoted: m });
              return true;
            }

            const [target, ports] = full.split(' ');
            await sock.sendMessage(m.key.remoteJid, {
              text: `⚡ Ultra-fast scanning em ${target}...\n\n🚀 1000+ req/s`
            }, { quoted: m });

            const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
            const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
            const result = await toolkit.masscanScan(target, ports || '1-65535');

            let response = `✅ *MASSCAN SCAN COMPLETO (REAL)*\n\n`;
            response += `🎯 Alvo: ${target}\n`;
            response += `⚡ Velocidade: ${(result.packetsPerSecond || 1000).toLocaleString()} req/s\n`;
            response += `📊 Portas abertas: ${result.openPorts.length}\n`;
            response += `⏱️ Tempo: ${result.duration}s\n\n`;

            if (result.openPorts.length > 0) {
              response += `🔌 Top 10 portas:\n`;
              result.openPorts.slice(0, 10).forEach(port => {
                response += `   ${port}/tcp\n`;
              });
            }

            response += `\n📁 Resultados: /tmp/pentest_results/masscan_results.json`;

            this.logAdminAction(senderId, nome, 'MASSCAN_REAL', target, `Portas: ${result.openPorts.length}`);

            await sock.sendMessage(m.key.remoteJid, {
              text: response
            }, { quoted: m });

            return true;
          } catch (e) {
            console.error('Erro em MASSCAN:', e);
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ Erro ao executar Masscan:\n\n${e.message}`
            }, { quoted: m });
            return true;
          }
        });
      }

      // #NIKTO - REAL Web server scanning
      if (cmd === 'nikto' && isOwner()) {
        return await ownerOnly(async () => {
          try {
            if (!full || !full.startsWith('http')) {
              await sock.sendMessage(m.key.remoteJid, {
                text: `🌐 *NIKTO - REAL WEB SERVER SCANNING*\n\n` +
                      `✅ Ferramenta REAL: github.com/sullo/nikto\n\n` +
                      `Uso: #nikto <URL>\n` +
                      `Exemplo: #nikto http://target.com\n` +
                      `Exemplo: #nikto https://target.com:8080\n\n` +
                      `⏱️ Timeout: 10 minutos\n` +
                      `🔍 Detecta: CVEs, Configs, Plugins`
              }, { quoted: m });
              return true;
            }

            await sock.sendMessage(m.key.remoteJid, {
              text: `⏳ Nikto scanning em ${full}...\n\n🔍 Analisando servidor web`
            }, { quoted: m });

            const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
            const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
            const result = await toolkit.niktoScan(full);

            let response = `✅ *NIKTO SCAN COMPLETO (REAL)*\n\n`;
            response += `🎯 Alvo: ${full}\n`;
            response += `🌐 Servidor: ${result.server || 'Desconhecido'}\n`;
            response += `🔍 Issues encontradas: ${result.issues.length}\n\n`;

            if (result.issues.length > 0) {
              response += `⚠️ Problemas:\n`;
              result.issues.slice(0, 10).forEach((issue, i) => {
                response += `\n${i+1}. ${issue.description}\n`;
                response += `   Severidade: ${issue.severity}\n`;
              });
              if (result.issues.length > 10) {
                response += `\n... e mais ${result.issues.length - 10} issues\n`;
              }
            }

            response += `\n📁 Resultados: /tmp/pentest_results/nikto_results.json`;

            this.logAdminAction(senderId, nome, 'NIKTO_REAL', full, `Issues: ${result.issues.length}`);

            await sock.sendMessage(m.key.remoteJid, {
              text: response
            }, { quoted: m });

            return true;
          } catch (e) {
            console.error('Erro em NIKTO:', e);
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ Erro ao executar Nikto:\n\n${e.message}`
            }, { quoted: m });
            return true;
          }
        });
      }

      // #PENTEST - Gerar relatório completo com todas as ferramentas
      if (cmd === 'pentest' && isOwner()) {
        return await ownerOnly(async () => {
          try {
            if (!full) {
              await sock.sendMessage(m.key.remoteJid, {
                text: `🎯 *PENTEST COMPLETO - TODAS AS FERRAMENTAS*\n\n` +
                      `Usa: NMAP + SQLMAP + Nuclei + Masscan + Nikto\n\n` +
                      `Uso: #pentest <target>\n` +
                      `Exemplo: #pentest https://target.com\n\n` +
                      `⏱️ Duração total: ~1 hora\n` +
                      `📊 Gera relatório consolidado`
              }, { quoted: m });
              return true;
            }

            await sock.sendMessage(m.key.remoteJid, {
              text: `🎯 PENTEST COMPLETO iniciado em ${full}\n\n` +
                    `⏳ Isto pode levar ~1 hora\n` +
                    `📊 Executando:\n` +
                    `   ✓ NMAP (ports)\n` +
                    `   ✓ Nuclei (vulns)\n` +
                    `   ✓ Masscan (fast)\n` +
                    `   ✓ Nikto (web)\n` +
                    `   ✓ Relatório\n\n` +
                    `Você será notificado quando terminar.`
            }, { quoted: m });

            const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
            const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
            
            // Executa todas as ferramentas
            const reports = await toolkit.generateComprehensiveReport(full);

            let response = `✅ *PENTEST COMPLETO FINALIZADO*\n\n`;
            response += `🎯 Alvo: ${full}\n\n`;
            response += `📊 Resumo dos resultados:\n`;
            let nmapLength = 0;
            if (reports.nmap && reports.nmap.openPorts && reports.nmap.openPorts.length) {
              nmapLength = reports.nmap.openPorts.length;
            }
            let nucleiLength = 0;
            if (reports.nuclei && reports.nuclei.findings && reports.nuclei.findings.length) {
              nucleiLength = reports.nuclei.findings.length;
            }
            let masscanLength = 0;
            if (reports.masscan && reports.masscan.openPorts && reports.masscan.openPorts.length) {
              masscanLength = reports.masscan.openPorts.length;
            }
            let niktoLength = 0;
            if (reports.nikto && reports.nikto.issues && reports.nikto.issues.length) {
              niktoLength = reports.nikto.issues.length;
            }
            response += `   🔌 NMAP: ${nmapLength} portas\n`;
            response += `   🔍 Nuclei: ${nucleiLength} vulnerabilidades\n`;
            response += `   ⚡ Masscan: ${masscanLength} portas\n`;
            response += `   🌐 Nikto: ${niktoLength} issues\n\n`;
            response += `📁 Arquivo consolidado:\n`;
            response += `   /tmp/pentest_results/pentest_report.json\n\n`;
            response += `🔐 Todas as operações foram logadas para auditoria`;

            this.logAdminAction(senderId, nome, 'PENTEST_COMPLETO', full, 'Relatório gerado');
            this.securityLogger.logOperation({
              usuario: nome,
              tipo: 'PENTEST_COMPLETO',
              alvo: full,
              resultado: 'COMPLETO',
              risco: 'VARIÁVEL'
            });

            await sock.sendMessage(m.key.remoteJid, {
              text: response
            }, { quoted: m });

            return true;
          } catch (e) {
            console.error('Erro em PENTEST:', e);
            await sock.sendMessage(m.key.remoteJid, {
              text: `❌ Erro ao executar pentest completo:\n\n${e.message}`
            }, { quoted: m });
            return true;
          }
        });
      }

      // #PENTESTMENU - Menu de ferramentas pentesting
      if (cmd === 'pentestmenu' || cmd === 'toolsmenu' || cmd === 'ptstmenu') {
        try {
          const menuText = this.createMenuHeader('🔴', 'FERRAMENTAS DE PENTESTING - REAL') + `

${this.createMenuSection('🔐', 'STATUS DE ACESSO')}
${isOwner() ? '✅ ROOT ATIVADO - Acesso irrestrito' : '🔒 Permissão negada - Apenas dono (Isaac Quarenta)'}

${this.createMenuSection('⚙️', 'FERRAMENTAS DISPONÍVEIS (ROOT ONLY)')}

*1️⃣ #nmap <target>*
   📡 Port Scanning (Real)
   ✅ Ferramenta: github.com/nmap/nmap
   ⏱️ Timeout: 15 min
   Exemplo: #nmap 192.168.1.1

*2️⃣ #sqlmap <URL>*
   💉 SQL Injection Testing (Real)
   ✅ Ferramenta: github.com/sqlmapproject/sqlmap
   ⏱️ Timeout: 20 min
   Exemplo: #sqlmap http://target.com/search?id=1

*3️⃣ #hydra <target> <user> <file>*
   🔓 Password Cracking (Real)
   ✅ Ferramenta: github.com/vanhauser-thc/thc-hydra
   ⏱️ Timeout: 30 min
   Exemplo: #hydra 192.168.1.1:22 root passwords.txt

*4️⃣ #nuclei <target>*
   🔍 Vulnerability Scanning (Real)
   ✅ Ferramenta: github.com/projectdiscovery/nuclei
   ⏱️ Timeout: 10 min
   Exemplo: #nuclei https://target.com

*5️⃣ #masscan <target> [ports]*
   ⚡ Ultra-Fast Port Scanning (Real)
   ✅ Ferramenta: github.com/robertdavidgraham/masscan
   ⏱️ Timeout: 5 min
   📊 Velocidade: 1000+ req/s
   Exemplo: #masscan 192.168.1.0/24

*6️⃣ #nikto <URL>*
   🌐 Web Server Scanning (Real)
   ✅ Ferramenta: github.com/sullo/nikto
   ⏱️ Timeout: 10 min
   Exemplo: #nikto http://target.com

*7️⃣ #pentest <target>*
   🎯 Pentesting Completo (TODAS as ferramentas)
   ✅ Gera relatório consolidado
   ⏱️ Duração: ~1 hora
   Exemplo: #pentest https://target.com

${this.createMenuSection('📊', 'RESULTADOS')}
Todos os resultados são salvos em:
📁 /tmp/pentest_results/

Cada ferramenta gera um arquivo JSON:
• nmap_results.json
• sqlmap_results.json
• hydra_results.json
• nuclei_results.json
• masscan_results.json
• nikto_results.json
• pentest_report.json (consolidado)

${this.createMenuSection('🔐', 'SEGURANÇA E COMPLIANCE')}
✅ Todas as operações são logadas
✅ Auditoria completa em tiempo real
✅ Apenas para alvos autorizados
✅ ROOT ONLY - Máxima proteção

${this.createMenuSection('⚖️', 'AVISO LEGAL')}
⚠️ Estas ferramentas são REAIS e PODEROSAS
⚠️ Use APENAS em ambientes autorizados
⚠️ Acesso não autorizado é ILEGAL
⚠️ Todas as operações são rastreadas

${this.createMenuSection('💡', 'DICAS')}
🎯 Para teste completo, use: #pentest <target>
📊 Combinar resultados de múltiplas ferramentas
🔍 Analisar relatórios JSON para detalhes
🛡️ Sempre obter autorização antes

*Desenvolvido com ❤️ por Isaac Quarenta*
_AKIRA BOT v21 - Enterprise Grade Pentesting Suite_`;

          if (!isOwner()) {
            await sock.sendMessage(m.key.remoteJid, {
              text: menuText + `\n\n❌ Este menu é ROOT-ONLY\nApenas ${this.config.DONO} tem acesso`
            }, { quoted: m });
          } else {
            await sock.sendMessage(m.key.remoteJid, { text: menuText }, { quoted: m });
          }

          return true;
        } catch (e) {
          console.error('Erro em pentestmenu:', e);
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao exibir menu.'
          }, { quoted: m });
          return true;
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // 🔧 NOVOS COMANDOS DE MODERAÇÃO DE GRUPO
      // ═══════════════════════════════════════════════════════════════

      // #FOTOGRUPO - Ver/alterar foto do grupo
      if (cmd === 'fotogrupo' || cmd === 'grouppic' || cmd === 'gpic') {
        try {
          if (!ehGrupo) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          return await ownerOnly(async () => {
            // Se tem imagem na resposta, definir como foto do grupo
            if (m.message && m.message.imageMessage) {
              const imageBuffer = await this.mediaProcessor.downloadMedia(m.message.imageMessage, 'image');
              if (!imageBuffer) {
                await sock.sendMessage(m.key.remoteJid, { 
                  text: '❌ Erro ao baixar imagem.' 
                }, { quoted: m });
                return true;
              }

              const result = await this.groupManagement.setGroupPhoto(m.key.remoteJid, imageBuffer);
              await sock.sendMessage(m.key.remoteJid, { 
                text: result.message 
              }, { quoted: m });
              return true;
            }

            // Caso contrário, apenas ver foto atual
            const photoResult = await this.groupManagement.getGroupPhoto(m.key.remoteJid);
            
            let response = `📸 *FOTO DO GRUPO*\n\n`;
            if (photoResult.hasPhoto) {
              response += `✅ O grupo tem uma foto de perfil configurada.\n\n`;
              response += `💡 Para alterar, responda uma imagem com #fotogrupo`;
            } else {
              response += `❌ Este grupo não tem foto de perfil configurada.\n\n`;
              response += `💡 Para adicionar, responda uma imagem com #fotogrupo`;
            }

            await sock.sendMessage(m.key.remoteJid, { 
              text: response 
            }, { quoted: m });
            return true;
          });
        } catch (e) {
          console.error('Erro em fotogrupo:', e);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Erro ao processar comando.' 
          }, { quoted: m });
          return true;
        }
      }

      // #NOMEGRUPO - Alterar nome do grupo
      if (cmd === 'nomegrupo' || cmd === 'gname' || cmd === 'setgname' || cmd === 'mudargrupo') {
        return await ownerOnly(async () => {
          if (!ehGrupo) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          if (!full || full.trim().length === 0) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '📝 *COMANDO #nomegrupo*\n\n' +
                    '✅ Uso: #nomegrupo <novo nome>\n' +
                    '✅ Exemplo: #nomegrupo Akira Bot Angola\n\n' +
                    '💡 O bot deve ser admin para alterar o nome.'
            }, { quoted: m });
            return true;
          }

          const result = await this.groupManagement.setGroupName(m.key.remoteJid, full);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #DESCRICAOGRUPO - Alterar descrição do grupo
      if (cmd === 'descricaogrupo' || cmd === 'gdesc' || cmd === 'setgdesc' || cmd === 'descrição') {
        return await ownerOnly(async () => {
          if (!ehGrupo) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          if (!full || full.trim().length === 0) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '📝 *COMANDO #descricaogrupo*\n\n' +
                    '✅ Uso: #descricaogrupo <nova descrição>\n' +
                    '✅ Exemplo: #descricaogrupo Grupo oficial do Akira Bot\n\n' +
                    '💡 O bot deve ser admin para alterar a descrição.'
            }, { quoted: m });
            return true;
          }

          const result = await this.groupManagement.setGroupDescription(m.key.remoteJid, full);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #FECHARGRUPO - Fechar grupo (apenas admins enviam)
      if (cmd === 'fechargrupo' || cmd === 'close' || cmd === 'lock') {
        return await ownerOnly(async () => {
          if (!ehGrupo) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          const result = await this.groupManagement.closeGroup(m.key.remoteJid);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #ABRIRGRUPO - Abrir grupo (todos enviam)
      if (cmd === 'abrirgrupo' || cmd === 'open' || cmd === 'unlock') {
        return await ownerOnly(async () => {
          if (!ehGrupo) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          const result = await this.groupManagement.openGroup(m.key.remoteJid);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #FECHARPROG - Fechamento programado
      if (cmd === 'fecharprog' || cmd === 'closesch' || cmd === 'schedclose') {
        return await ownerOnly(async () => {
          if (!ehGrupo) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          if (!full || !full.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/)) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '⏰ *COMANDO #fecharprog*\n\n' +
                    '✅ Uso: #fecharprog HH:MM [motivo]\n' +
                    '✅ Exemplo: #fecharprog 22:30 Motivo: Horário de dormir\n\n' +
                    '💡 O bot deve ser admin para executar a ação.'
            }, { quoted: m });
            return true;
          }

          const [timeStr, ...reasonParts] = full.split(' ');
          const reason = reasonParts.join(' ');
          const result = await this.groupManagement.scheduleClose(m.key.remoteJid, timeStr, reason);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #ABRIRPROG - Abertura programada
      if (cmd === 'abrirprog' || cmd === 'opensched' || cmd === 'schedopen') {
        return await ownerOnly(async () => {
          if (!ehGrupo) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          if (!full || !full.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/)) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '⏰ *COMANDO #abrirprog*\n\n' +
                    '✅ Uso: #abrirprog HH:MM [motivo]\n' +
                    '✅ Exemplo: #abrirprog 08:00 Motivo: Acordar\n\n' +
                    '💡 O bot deve ser admin para executar a ação.'
            }, { quoted: m });
            return true;
          }

          const [timeStr, ...reasonParts] = full.split(' ');
          const reason = reasonParts.join(' ');
          const result = await this.groupManagement.scheduleOpen(m.key.remoteJid, timeStr, reason);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #CANCELARPROG - Cancelar programações
      if (cmd === 'cancelarprog' || cmd === 'cancelsched' || cmd === 'cancel') {
        return await ownerOnly(async () => {
          if (!ehGrupo) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          const result = await this.groupManagement.cancelScheduledActions(m.key.remoteJid);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #VERPROG - Ver programações ativas
      if (cmd === 'verprog' || cmd === 'viewsched' || cmd === 'schedlist') {
        return await ownerOnly(async () => {
          if (!ehGrupo) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          const result = await this.groupManagement.getScheduledActions(m.key.remoteJid);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #STATUSGRUPO - Ver status completo do grupo
      if (cmd === 'statusgrupo' || cmd === 'gstatus' || cmd === 'groupstatus') {
        try {
          if (!ehGrupo) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando funciona apenas em grupos.' 
            }, { quoted: m });
            return true;
          }

          const status = await this.groupManagement.getGroupStatus(m.key.remoteJid);
          
          let response = `📊 *STATUS DO GRUPO*\n\n`;
          response += `┌─────────────────────────────┐\n`;
          response += `│ 📝 *Nome:* ${status.subject || 'N/A'}\n`;
          response += `│ 👥 *Membros:* ${status.size}\n`;
          response += `│ 🔒 *Estado:* ${status.locked ? '🔒 Fechado' : '🔓 Aberto'}\n`;
          response += `│ 🤖 *Bot Admin:* ${status.botAdmin ? '✅ Sim' : '❌ Não'}\n`;
          response += `└─────────────────────────────┘\n\n`;

          if (status.desc) {
            response += `📝 *Descrição:*\n${status.desc}\n`;
          } else {
            response += `📝 *Descrição:* Não definida\n`;
          }

          await sock.sendMessage(m.key.remoteJid, { 
            text: response 
          }, { quoted: m });
          return true;
        } catch (e) {
          console.error('Erro em statusgrupo:', e);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Erro ao obter status do grupo.' 
          }, { quoted: m });
          return true;
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // 👤 NOVOS COMANDOS DE DADOS DE USUÁRIO
      // ═══════════════════════════════════════════════════════════════

      // #DADOSUSUARIO - Ver dados do usuário mencionado
      if (cmd === 'dadosusuario' || cmd === 'userdata' || cmd === 'udata' || cmd === 'infousuario') {
        try {
          // Extrair usuário mencionado ou usar sender
          let targetJid = null;
          if (m.message && m.message.extendedTextMessage && 
              m.message.extendedTextMessage.contextInfo && 
              m.message.extendedTextMessage.contextInfo.mentionedJid &&
              m.message.extendedTextMessage.contextInfo.mentionedJid.length > 0) {
            targetJid = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
          } else if (replyInfo && replyInfo.participantJidCitado) {
            targetJid = replyInfo.participantJidCitado;
          } else {
            targetJid = m.key.participant || m.key.remoteJid;
          }

          const userInfo = await this.userProfile.getUserInfo(targetJid);
          const message = this.userProfile.formatUserDataMessage(userInfo);
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: message 
          }, { quoted: m });

          // Se tem foto, enviar como imagem
          if (userInfo.hasPhoto && userInfo.photoUrl) {
            try {
              const axios = require('axios');
              const response = await axios.get(userInfo.photoUrl, { responseType: 'arraybuffer' });
              await sock.sendMessage(m.key.remoteJid, {
                image: Buffer.from(response.data),
                caption: `📸 Foto de perfil de ${userInfo.number}`
              }, { quoted: m });
            } catch (imgErr) {
              console.warn('⚠️ Erro ao enviar foto:', imgErr.message);
            }
          }

          return true;
        } catch (e) {
          console.error('Erro em dadosusuario:', e);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Erro ao obter dados do usuário.' 
          }, { quoted: m });
          return true;
        }
      }

      // #FOTOPERFIL - Ver foto de perfil do usuário
      if (cmd === 'fotoperfil' || cmd === 'upic' || cmd === 'profilepic' || cmd === 'pic') {
        try {
          let targetJid = null;
          if (m.message && m.message.extendedTextMessage && 
              m.message.extendedTextMessage.contextInfo && 
              m.message.extendedTextMessage.contextInfo.mentionedJid &&
              m.message.extendedTextMessage.contextInfo.mentionedJid.length > 0) {
            targetJid = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
          } else if (replyInfo && replyInfo.participantJidCitado) {
            targetJid = replyInfo.participantJidCitado;
          } else {
            targetJid = m.key.participant || m.key.remoteJid;
          }

          const result = await this.userProfile.handleProfilePhoto(targetJid);
          
          // Enviar mensagem de texto primeiro
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });

          // Se tem foto, enviar imagem
          if (result.hasPhoto && result.photoUrl) {
            try {
              const axios = require('axios');
              const response = await axios.get(result.photoUrl, { responseType: 'arraybuffer' });
              await sock.sendMessage(m.key.remoteJid, {
                image: Buffer.from(response.data),
                caption: `📸 Foto de perfil de ${this.userProfile.formatJidToNumber(targetJid)}`
              }, { quoted: m });
            } catch (imgErr) {
              console.warn('⚠️ Erro ao enviar foto:', imgErr.message);
            }
          }

          return true;
        } catch (e) {
          console.error('Erro em fotoperfil:', e);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Erro ao obter foto de perfil.' 
          }, { quoted: m });
          return true;
        }
      }

      // #BIOGRAFIA - Ver bio do usuário
      if (cmd === 'biografia' || cmd === 'ubio' || cmd === 'status' || cmd === 'bio') {
        try {
          let targetJid = null;
          if (m.message && m.message.extendedTextMessage && 
              m.message.extendedTextMessage.contextInfo && 
              m.message.extendedTextMessage.contextInfo.mentionedJid &&
              m.message.extendedTextMessage.contextInfo.mentionedJid.length > 0) {
            targetJid = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
          } else if (replyInfo && replyInfo.participantJidCitado) {
            targetJid = replyInfo.participantJidCitado;
          } else {
            targetJid = m.key.participant || m.key.remoteJid;
          }

          const result = await this.userProfile.handleUserBio(targetJid);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        } catch (e) {
          console.error('Erro em biografia:', e);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Erro ao obter biografia.' 
          }, { quoted: m });
          return true;
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // 🤖 NOVOS COMANDOS DE CONFIGURAÇÃO DA AKIRA (DONO APENAS)
      // ═══════════════════════════════════════════════════════════════

      // #SETBOTPIC - Alterar foto da Akira
      if (cmd === 'setbotpic' || cmd === 'botpic' || cmd === 'botfoto' || cmd === 'setbotfoto') {
        return await ownerOnly(async () => {
          if (!m.message || !m.message.imageMessage) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: `📸 *COMANDO #setbotpic*\n\n` +
                    '✅ Responda uma imagem com este comando\n' +
                    '✅ A foto será definida como foto de perfil da Akira\n\n' +
                    '⚠️ Apenas o proprietário pode usar este comando.'
            }, { quoted: m });
            return true;
          }

          const imageBuffer = await this.mediaProcessor.downloadMedia(m.message.imageMessage, 'image');
          if (!imageBuffer) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Erro ao baixar imagem.' 
            }, { quoted: m });
            return true;
          }

          const result = await this.botProfile.setBotPhoto(imageBuffer);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #SETBOTNAME - Alterar nome da Akira
      if (cmd === 'setbotname' || cmd === 'botname' || cmd === 'setnomebot' || cmd === 'nomebot') {
        return await ownerOnly(async () => {
          if (!full || full.trim().length === 0) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: `📝 *COMANDO #setbotname*\n\n` +
                    '✅ Uso: #setbotname <novo nome>\n' +
                    '✅ Exemplo: #setbotname Akira Bot V21\n\n' +
                    '⚠️ Limite: 25 caracteres (WhatsApp)\n' +
                    '⚠️ Apenas o proprietário pode usar este comando.'
            }, { quoted: m });
            return true;
          }

          const result = await this.botProfile.setBotName(full);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #SETBOTBIO - Alterar bio da Akira
      if (cmd === 'setbotbio' || cmd === 'botstatus' || cmd === 'botbio' || cmd === 'setstatusbot') {
        return await ownerOnly(async () => {
          if (!full || full.trim().length === 0) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: `📝 *COMANDO #setbotbio*\n\n` +
                    '✅ Uso: #setbotbio <nova bio>\n' +
                    '✅ Exemplo: #setbotbio Akira Bot - Feito com ❤️\n\n' +
                    '⚠️ Limite: 139 caracteres (WhatsApp)\n' +
                    '⚠️ Apenas o proprietário pode usar este comando.'
            }, { quoted: m });
            return true;
          }

          const result = await this.botProfile.setBotStatus(full);
          await sock.sendMessage(m.key.remoteJid, { 
            text: result.message 
          }, { quoted: m });
          return true;
        });
      }

      // #VERBOTINFO - Ver informações da Akira
      if (cmd === 'verbotinfo' || cmd === 'botinfo' || cmd === 'infobot' || cmd === 'akirainfo') {
        try {
          const botInfo = await this.botProfile.getBotInfo();
          const message = this.botProfile.formatBotInfoMessage(botInfo);
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: message 
          }, { quoted: m });

          // Enviar foto se disponível
          if (botInfo.hasPhoto && botInfo.photoUrl) {
            try {
              const axios = require('axios');
              const response = await axios.get(botInfo.photoUrl, { responseType: 'arraybuffer' });
              await sock.sendMessage(m.key.remoteJid, {
                image: Buffer.from(response.data),
                caption: `📸 Foto atual da Akira`
              }, { quoted: m });
            } catch (imgErr) {
              console.warn('⚠️ Erro ao enviar foto:', imgErr.message);
            }
          }

          return true;
        } catch (e) {
          console.error('Erro em verbotinfo:', e);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Erro ao obter informações da Akira.' 
          }, { quoted: m });
          return true;
        }
      }

      // #HELPIMAGE - Ajuda de efeitos de imagem
      if (cmd === 'helpimagem' || cmd === 'helpeffects' || cmd === 'imagehelp' || cmd === 'efeitos') {
        const helpMessage = this.imageEffects.getHelpMessage();
        await sock.sendMessage(m.key.remoteJid, { 
          text: helpMessage 
        }, { quoted: m });
        return true;
      }

      // Default: Comando não encontrado
      return false;

    } catch (err) {
      console.error('❌ Erro geral no handler:', err);
      try { 
        await this.bot.sock.sendMessage(m.key.remoteJid, { 
          text: '❌ Erro ao processar comando.' 
        }, { quoted: m }); 
      } catch {}
      return true;
    }
  }
}

module.exports = CommandHandler;
