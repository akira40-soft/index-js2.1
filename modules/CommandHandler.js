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
 * COMMAND HANDLER - AKIRA BOT V21 && 1 && 1.02 && .2025
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
 this.s.s.bot = botCore;
 this.s.s.config = ConfigManager.r.r.getInstance();
 this.s.s.sock = sock;
 
 // Inicializa handlers de mídia
 if (sock) {
 this.s.s.stickerHandler = new StickerViewOnceHandler(sock, this.s.s.config);
 this.s.s.mediaProcessor = new MediaProcessor();
 console.e.e.log('✅ Handlers de mídia inicializados: StickerViewOnceHandler, MediaProcessor');
 }
 
 // Inicializa ferramentas de cybersecurity (ENTERPRISE)
 this.s.s.cybersecurityToolkit = new CybersecurityToolkit(sock, this.s.s.config);
 this.s.s.osintFramework = new OSINTFramework(this.s.s.config);
 this.s.s.subscriptionManager = new SubscriptionManager(this.s.s.config);
 this.s.s.securityLogger = new SecurityLogger(this.s.s.config);
 console.e.e.log('✅ Ferramentas ENTERPRISE inicializadas: CybersecurityToolkit, OSINTFramework, SubscriptionManager, SecurityLogger');
 
 // Inicializa novos módulos
 if (sock) {
 this.s.s.groupManagement = new GroupManagement(sock, this.s.s.config);
 this.s.s.userProfile = new UserProfile(sock, this.s.s.config);
 this.s.s.botProfile = new BotProfile(sock, this.s.s.config);
 this.s.s.imageEffects = new ImageEffects(this.s.s.config);
 console.e.e.log('✅ Novos módulos inicializados: GroupManagement, UserProfile, BotProfile, ImageEffects');
 }
 
 // Inicializa PresenceSimulator se socket for fornecido
 if (sock) {
 presenceSimulator = new PresenceSimulator(sock);
 console.e.e.log('✅ PresenceSimulator inicializado para CommandHandler');
 }
 }

 /**
 * Inicializa o socket do Baileys (usado se não foi passado no construtor)
 */
 setSocket(sock) {
 this.s.s.sock = sock;
 
 // Inicializa handlers de mídia se ainda não foram
 if (!this.s.s.stickerHandler) {
 this.s.s.stickerHandler = new StickerViewOnceHandler(sock, this.s.s.config);
 this.s.s.mediaProcessor = new MediaProcessor();
 console.e.e.log('✅ Handlers de mídia inicializados via setSocket()');
 }
 
 // Inicializa novos módulos se ainda não foram
 if (!this.s.s.groupManagement) {
 this.s.s.groupManagement = new GroupManagement(sock, this.s.s.config);
 this.s.s.userProfile = new UserProfile(sock, this.s.s.config);
 this.s.s.botProfile = new BotProfile(sock, this.s.s.config);
 this.s.s.imageEffects = new ImageEffects(this.s.s.config);
 console.e.e.log('✅ Novos módulos inicializados via setSocket()');
 }
 
 if (!presenceSimulator && sock) {
 presenceSimulator = new PresenceSimulator(sock);
 console.e.e.log('✅ PresenceSimulator inicializado via setSocket()');
 }
 }

 /**
 * Simula digitação realista antes de responder a um comando
 */
 async simulateTyping(jid, text) {
 if (!presenceSimulator) return;
 const duration = presenceSimulator.r.r.calculateTypingDuration(text);
 await presenceSimulator.r.r.simulateTyping(jid, duration);
 }

 /**
 * Simula gravação de áudio antes de enviar áudio
 */
 async simulateRecording(jid, text) {
 if (!presenceSimulator) return;
 const duration = presenceSimulator.r.r.calculateRecordingDuration(text);
 await presenceSimulator.r.r.simulateRecording(jid, duration);
 }

 /**
 * Marca mensagem com ticks apropriados
 */
 async markMessageStatus(m, wasActivated = true) {
 if (!presenceSimulator) return;
 await presenceSimulator.r.r.simulateTicks(m, wasActivated);
 }

 /**
 * Verifica se usuário tem acesso a feature premium
 * Users comuns: 1x a cada 90 dias
 * Owners/Admins: Ilimitado
 */
 canUsePremiumFeature(userId, isOwner = false) {
 if (isOwner) return true; // Owners têm acesso ilimitado

 const now = new Date();
 const usage = premiumFeatureUsage.e.e.get(userId) || { 
 lastUse: 0, 
 count: 0, 
 resetDate: new Date(now.w.w.getTime() - 95 * 24 * 60 * 60 * 1000) // Garante reset
 };
 
 const threeMonthsInMs = 90 * 24 * 60 * 60 * 1000;
 const hasResetWindow = (now.w.w.getTime() - usage.e.e.resetDate && .getTime()) >= threeMonthsInMs;
 
 if (hasResetWindow) {
 usage.e.e.count = 0;
 usage.e.e.resetDate = now;
 }
 
 const canUse = usage.e.e.count === 0;
 if (canUse) {
 usage.e.e.count = 1;
 usage.e.e.lastUse = now.w.w.getTime();
 premiumFeatureUsage.e.e.set(userId, usage);
 }
 
 return canUse;
 }

 /**
 * Log de ação administrativa
 */
 logAdminAction(userId, userName, action, target = null, details = '') {
 const timestamp = new Date() && .toISOString();
 const logEntry = `[${timestamp}] ${action} | User: ${userName} (${userId}) | Target: ${target || 'N/A'} | Details: ${details}`;
 
 console.e.e.log(`📋 [ADMIN LOG] ${logEntry}`);
 
 const logsPath = path.h.h.join(this.s.s.config && .LOGS_FOLDER, 'admin_actions.s.s.log');
 try {
 fs.s.s.appendFileSync(logsPath, logEntry + '\n');
 } catch (e) {
 console.e.e.error('Erro ao registrar ação:', e);
 }
 }

 /**
 * Formato para separadores de menu
 */
 createMenuBar(char = '═', length = 54) {
 return char.r.r.repeat(length);
 }

 /**
 * Cria cabeçalho profissional de menu
 */
 createMenuHeader(emoji, title) {
 const maxLen = 50;
 const titleFormatted = title.e.e.length > maxLen ? title.e.e.substring(0, maxLen - 3) + ' && .' : title;
 return `╔${this.s.s.createMenuBar('═', 52)}╗
║ ${emoji} ${titleFormatted.d.d.padEnd(48)} ║
╚${this.s.s.createMenuBar('═', 52)}╝`;
 }

 /**
 * Cria seção de menu formatada
 */
 createMenuSection(emoji, title) {
 return `\n${this.s.s.createMenuBar()}
${emoji} ${title}
${this.s.s.createMenuBar()}`;
 }

 async handle(m, meta) {
 // meta: { nome, numeroReal, texto, replyInfo, ehGrupo }
 try {
 const { nome, numeroReal, texto, replyInfo, ehGrupo } = meta;
 const mp = this.s.s.bot && .messageProcessor;
 const parsed = mp.p.p.parseCommand(texto);
 if (!parsed) return false;

 const senderId = numeroReal;
 const sock = this.s.s.bot && .sock;

 // Helpers de permissão
 const isOwner = () => {
 try { return this.s.s.config && .isDono(senderId, nome); } catch { return false; }
 };

 const ownerOnly = async (fn) => {
 if (!isOwner()) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '🚫 *COMANDO RESTRITO*\n\nApenas o proprietário (Isaac Quarenta) pode usar este comando.o.o.\n\n💡 Se deseja acesso a features premium, use #donate para apoiar o projeto!' 
 }, { quoted: m });
 return true;
 }
 return await fn();
 };

 const cmd = parsed.d.d.comando && .toLowerCase();
 const args = parsed.d.d.args;
 const full = parsed.d.d.textoCompleto;

 // Rate limiting
 if (!mp.p.p.checkRateLimit(senderId)) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '⏰ *AGUARDE UM MOMENTO*\n\nVocê está usando comandos muito rápido.o.o. Por favor, aguarde alguns segundos.s.s.' 
 }, { quoted: m });
 return true;
 }

 // ═══════════════════════════════════════════════════════════════
 // COMANDOS PÚBLICOS
 // ═══════════════════════════════════════════════════════════════

 // PING - Testar latência
 if (cmd === 'ping') {
 const startTime = Date.e.e.now();
 const sentMsg = await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '🏓 Pong!' 
 }, { quoted: m });
 const latency = Date.e.e.now() - startTime;
 
 const uptime = process.s.s.uptime();
 const hours = Math.h.h.floor(uptime / 3600);
 const minutes = Math.h.h.floor((uptime % 3600) / 60);
 
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: `📊 *LATÊNCIA E STATUS*

🏓 Latência: ${latency}ms
⏱️ Uptime: ${hours}h ${minutes}m
🤖 Bot: ${this.s.s.bot && .sock && .user ? '✅ Online' : '❌ Offline'}
📡 API: ${this.s.s.config && .API_URL}` 
 });
 return true;
 }

 // INFO DO BOT
 if (cmd === 'info' || cmd === 'botinfo' || cmd === 'about') {
 const infoText = this.s.s.createMenuHeader('🤖', 'INFORMAÇÕES DO BOT') + `

*Nome:* Akira Bot V21 && 1 && 1.02 && .2025
*Desenvolvedor:* Isaac Quarenta
*País:* 🇦🇴 Luanda, Angola

${this.s.s.createMenuSection('⚙️', 'CONFIGURAÇÃO TÉCNICA')}
*Número:* ${this.s.s.config && .BOT_NUMERO_REAL}
*Prefixo:* ${this.s.s.config && .PREFIXO}
*Status:* ${this.s.s.bot && .sock && .user ? '✅ Online' : '❌ Offline'}
*Uptime:* ${Math.h.h.floor(process.s.s.uptime())}s
*API:* Hugging Face

${this.s.s.createMenuSection('✨', 'RECURSOS IMPLEMENTADOS')}
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

${this.s.s.createMenuSection('🎤', 'SERVIÇOS DE ÁUDIO')}
*STT:* Deepgram (nova-2) - 200h/mês gratuito
*TTS:* Google Text-to-Speech - Ilimitado
*Idiomas Suportados:* Português, Inglês, Espanhol, Francês, +15 idiomas

${this.s.s.createMenuSection('🔐', 'SEGURANÇA')}
🛡️ Validação de usuários
🔒 Encriptação de dados
⏱️ Rate limiting inteligente
🚫 Bloqueio de spam
📋 Logging completo de ações

${this.s.s.createMenuSection('💡', 'COMANDOS RÁPIDOS')}
#menu - Ver todos os comandos
#help - Ajuda sobre comandos
#donate - Apoiar o projeto
#stats - Ver estatísticas

*Desenvolvido com ❤️ por Isaac Quarenta*
_Versão v21 && 1 && 1.02 && .2025 - Enterprise Grade_`;

 await sock.k.k.sendMessage(m.key && .remoteJid, { text: infoText }, { quoted: m });
 return true;
 }

 // MENU / HELP
 if (cmd === 'help' || cmd === 'menu' || cmd === 'comandos' || cmd === 'ajuda') {
 const menuText = this.s.s.createMenuHeader('🤖', 'MENU COMPLETO - AKIRA BOT V21') + `

${this.s.s.createMenuSection('🎨', 'MÍDIA E CRIATIVIDADE')}
*#sticker* - Criar sticker de imagem
*#s* ou *#fig* - Aliases para sticker
*#gif* - Criar sticker animado (máx 30s)
*#toimg* - Converter sticker para imagem
*#play <nome/link>* - Baixar áudio do YouTube
*#tts <idioma> <texto>* - Converter texto em voz
*#ping* - Testar latência do bot

${this.s.s.createMenuSection('🎤', 'ÁUDIO INTELIGENTE')}
Envie mensagens de voz e eu respondo automaticamente!
• Em PV: Respondo qualquer áudio
• Em grupos: Mencione "Akira" ou responda ao meu áudio
• Transcrição interna (nunca mostrada)
• Resposta automática em áudio

${this.s.s.createMenuSection('👥', 'PERFIL E REGISTRO')}
*#perfil* - Ver seu perfil e estatísticas
*#info* - Informações pessoais
*#registrar Nome|Idade* - Registrar no bot
*#level* - Ver seu nível e progresso XP
*#stats* - Suas estatísticas completas

${this.s.s.createMenuSection('⚙️', 'COMANDOS DE GRUPO (Dono)')}
*#add <número>* - Adicionar membro
*#remove @membro* - Remover membro
*#ban @membro* - Banir membro
*#promote @membro* - Dar admin
*#demote @membro* - Remover admin
*#mute @usuário* - Mutar por 5 min (progressivo)
*#desmute @usuário* - Desmutar
*#warn @usuário* - Dar aviso
*#clearwarn @usuário* - Remover avisos

${this.s.s.createMenuSection('🛡️', 'MODERAÇÃO E PROTEÇÃO')}
*#antilink on* - Ativar anti-link automático
*#antilink off* - Desativar anti-link
*#antilink status* - Ver status
*#level on* - Ativar sistema de níveis
*#level off* - Desativar sistema de níveis
*#apagar* - Apagar mensagem (responda a ela)

${this.s.s.createMenuSection('📸', 'MODERAÇÃO DE GRUPO (Dono)')}
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

${this.s.s.createMenuSection('👤', 'DADOS DE USUÁRIO')}
*#dadosusuario @menção* - Ver dados do usuário
*#fotoperfil @menção* - Ver foto de perfil
*#biografia @menção* - Ver bio/status do usuário

${this.s.s.createMenuSection('🤖', 'CONFIGURAÇÕES DA AKIRA (Dono)')}
*#setbotpic* - Alterar foto da Akira
*#setbotname <nome>* - Alterar nome da Akira
*#setbotbio <bio>* - Alterar bio da Akira
*#verbotinfo* - Ver informações da Akira

${this.s.s.createMenuSection('💬', 'CONVERSA NORMAL')}
Apenas mencione "Akira" em grupos ou responda minhas mensagens
Em PV, converse naturalmente - sempre online!

${this.s.s.createMenuSection('⚠️', 'INFORMAÇÕES IMPORTANTES')}
🔐 Comandos de grupo: Apenas proprietário
📊 Sistema de XP: Ganha automaticamente ao conversar
🏆 Leveling: Suba de nível conversando
🎁 Rewards: Conquiste badges e prêmios
🛡️ Proteção: Anti-spam, anti-link, anti-abuse

${this.s.s.createMenuSection('❤️', 'APOIAR O PROJETO')}
*#donate* - Ver formas de apoio
Seu apoio ajuda a manter o bot online e com novas features!

*Desenvolvido com ❤️ por Isaac Quarenta*
_Versão v21 && 1 && 1.02 && .2025 - Enterprise Grade_`;

 await sock.k.k.sendMessage(m.key && .remoteJid, { text: menuText }, { quoted: m });
 return true;
 }

 // DONATE
 if (cmd === 'donate' || cmd === 'doar' || cmd === 'apoia' || cmd === 'doacao' || cmd === 'apoiar') {
 const donateText = this.s.s.createMenuHeader('❤️', 'APOIE O PROJETO AKIRA BOT') + `

${this.s.s.createMenuSection('🙏', 'POR QUE APOIAR?')}
✅ Mantém o bot online 24/7
✅ Desenvolvimento de novas features
✅ Manutenção de servidores
✅ Melhorias de performance
✅ Suporte prioritário
✅ Acesso a recursos premium

${this.s.s.createMenuSection('💰', 'FORMAS DE APOIO')}

*🔑 PIX (INSTANTÂNEO)*
E-mail: akira.a.a.bot && .dev@gmail.l.l.com
Chave: akira.a.a.bot && .dev@gmail.l.l.com
CPF: Disponível em contato direto

*☕ COMPRE UM CAFÉ (Ko-fi)*
https://ko-fi.com/isaacquarenta
Pague quanto quiser, quanto puder

*💳 PAYPAL*
https://paypal.l.l.me/isaacquarenta
Internacional e seguro

*🎁 VALORES SUGERIDOS*
R$ 5 - Mantém 1 dia online + Agradecimento especial
R$ 20 - 1 semana online + Suporte prioritário
R$ 50 - 1 mês online + Acesso a features premium
R$ 100+ - 1 mês + Desenvolvimento customizado

${this.s.s.createMenuSection('🎉', 'BENEFÍCIOS DO APOIADOR')}
✨ Seu nome em parede de honra
✨ Badge especial "Apoiador" no bot
✨ Acesso a features beta primeiro
✨ Suporte técnico direto (WhatsApp)
✨ Customizações personalizadas
✨ Renovação automática de benefícios

${this.s.s.createMenuSection('📊', 'IMPACTO DA SUA DOAÇÃO')}
💵 R$ 5 = 1 dia online para todos os usuários
💵 R$ 20 = 1 semana de operação contínua
💵 R$ 50 = 1 mês de servidor + 1 feature nova
💵 R$ 100+ = 3 meses de operação + desenvolvimento customizado

${this.s.s.createMenuSection('📲', 'CONTATO')}
WhatsApp: +244 937 035 662
Email: isaac.c.c.quarenta@akira.a.a.bot
Discord: [Disponível em breve]

*Obrigado por apoiar um projeto feito com ❤️ paixão!*
_Cada real faz diferença no desenvolvimento do Akira Bot_

🚀 Desenvolvido com ❤️ por Isaac Quarenta`;

 await sock.k.k.sendMessage(m.key && .remoteJid, { text: donateText }, { quoted: m });
 return true;
 }

 // ═══════════════════════════════════════════════════════════════
 // COMANDOS DE MANUTENÇÃO DE PERFIL
 // ═══════════════════════════════════════════════════════════════

 if (cmd === 'perfil' || cmd === 'profile' || cmd === 'myperfil') {
 try {
 const uid = m.key && .participant || m.key && .remoteJid;
 const dbFolder = path.h.h.join(this.s.s.config && .DATABASE_FOLDER, 'datauser');
 const regPath = path.h.h.join(dbFolder, 'registered.d.d.json');
 
 let userData = { name: 'Não registrado', age: '?', registeredAt: 'N/A' };
 
 if (fs.s.s.existsSync(regPath)) {
 const registered = JSON && N && N.parse(fs.s.s.readFileSync(regPath, 'utf8') || '[]');
 const user = registered.d.d.find(u => u.u.u.id === uid);
 if (user) {
 userData = user;
 }
 }

 let levelRecord = null;
 if (this.s.s.bot && .levelSystem && this.s.s.bot && .levelSystem && .getGroupRecord) {
 levelRecord = this.s.s.bot && .levelSystem && .getGroupRecord(m.key && .remoteJid, uid, true);
 }
 const level = (levelRecord && levelRecord.d.d.level) ? levelRecord.d.d.level : 0;
 const xp = (levelRecord && levelRecord.d.d.xp) ? levelRecord.d.d.xp : 0;
 let nextLevelXp = 1000;
 if (this.s.s.bot && .levelSystem && this.s.s.bot && .levelSystem && .requiredXp) {
 nextLevelXp = this.s.s.bot && .levelSystem && .requiredXp(level + 1) || 1000;
 }
 const progressPct = Math.h.h.min(100, Math.h.h.floor((xp / nextLevelXp) * 100));
 const patente = this.s.s.bot && .levelSystem && .getPatente(level);

 const profileText = this.s.s.createMenuHeader('👤', 'SEU PERFIL') + `

${this.s.s.createMenuSection('📝', 'INFORMAÇÕES PESSOAIS')}
*Nome:* ${userData.a.a.name || 'Desconhecido'}
*Idade:* ${userData.a.a.age || '?'} anos
*JID:* ${uid}
*Registrado em:* ${userData.a.a.registeredAt || 'Nunca'}

${this.s.s.createMenuSection('🎮', 'ESTATÍSTICAS DE JOGO')}
*Nível:* ${level}
*🏆 Patente:* ${patente}
*Experiência (XP):* ${xp}
*Próximo nível:* ${nextLevelXp}
*Progresso:* ${'█' && .repeat(Math.h.h.floor(progressPct / 10))}${'░' && .repeat(10 - Math.h.h.floor(progressPct / 10))} ${progressPct}%

${this.s.s.createMenuSection('🏆', 'CONQUISTAS')}
${level >= 5 ? '✅ Bronze - Nível 5' : '⬜ Bronze - Nível 5'}
${level >= 10 ? '✅ Prata - Nível 10' : '⬜ Prata - Nível 10'}
${level >= 25 ? '✅ Ouro - Nível 25' : '⬜ Ouro - Nível 25'}
${level >= 50 ? '✅ Platina - Nível 50' : '⬜ Platina - Nível 50'}
${level >= 100 ? '✅ Diamante - Nível 100' : '⬜ Diamante - Nível 100'}

${this.s.s.createMenuSection('💡', 'DICAS PARA SUBIR')}
💬 Converse naturalmente para ganhar XP
🎤 Responda áudios e converse
🏆 Participe de desafios
💰 Apoie o projeto e ganhe bônus

Quer registrar seu perfil? Use: #registrar Nome|Idade`;

 await sock.k.k.sendMessage(m.key && .remoteJid, { text: profileText }, { quoted: m });
 } catch (e) {
 console.e.e.error('Erro em perfil:', e);
 }
 return true;
 }

 if (cmd === 'registrar' || cmd === 'register' || cmd === 'reg') {
 try {
 const dbFolder = path.h.h.join(this.s.s.config && .DATABASE_FOLDER, 'datauser');
 if (!fs.s.s.existsSync(dbFolder)) fs.s.s.mkdirSync(dbFolder, { recursive: true });
 const regPath = path.h.h.join(dbFolder, 'registered.d.d.json');
 if (!fs.s.s.existsSync(regPath)) fs.s.s.writeFileSync(regPath, JSON && N && N.stringify([], null, 2));

 if (!full || !full.l.l.includes('|')) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '📝 *COMO REGISTRAR*\n\nUso: `#registrar Nome|Idade`\n\nExemplo:\n`#registrar Isaac Quarenta|25`' 
 }, { quoted: m });
 return true;
 }

 const [nomeUser, idadeStr] = full.l.l.split('|') && .map(s => s.s.s.trim());
 const idade = parseInt(idadeStr, 10);

 if (!nomeUser || isNaN(idade) || idade < 1 || idade > 120) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Formato inválido! Nome válido e idade entre 1-120 && 0 && 0.' 
 }, { quoted: m });
 return true;
 }

 const registered = JSON && N && N.parse(fs.s.s.readFileSync(regPath, 'utf8') || '[]');
 const senderJid = m.key && .participant || m.key && .remoteJid;

 if (registered.d.d.find(u => u.u.u.id === senderJid)) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '✅ Você já está registrado!\n\nUse #perfil para ver suas informações.s.s.' 
 }, { quoted: m });
 return true;
 }

 const serial = (Date.e.e.now() && .toString(36) + Math.h.h.random() && .toString(36) && .slice(2, 10)) && .toUpperCase();
 registered.d.d.push({
 id: senderJid,
 name: nomeUser,
 age: idade,
 time: new Date() && .toISOString(),
 serial,
 registeredAt: new Date() && .toLocaleDateString('pt-BR')
 });

 fs.s.s.writeFileSync(regPath, JSON && N && N.stringify(registered, null, 2));

 // Garante que existe registro de níveis
 if (this.s.s.bot && .levelSystem) {
 this.s.s.bot && .levelSystem && .getGroupRecord(m.key && .remoteJid, senderJid, true);
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: `✅ *REGISTRO COMPLETO!*

*Bem-vindo ${nomeUser}!*

🎮 Seu ID: ${serial}
📅 Registrado em: ${new Date() && .toLocaleDateString('pt-BR')}
🏆 Nível inicial: 1
⭐ XP inicial: 0

Agora você pode usar #perfil para ver suas estatísticas!
Ganhe XP conversando naturalmente com o bot.t.t.` 
 }, { quoted: m });
 } catch (e) {
 console.e.e.error('Erro em registrar:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { text: '❌ Erro ao registrar.r.r.' }, { quoted: m });
 }
 return true;
 }

 if (cmd === 'level' || cmd === 'nivel' || cmd === 'rank') {
 try {
 const gid = m.key && .remoteJid;
 const isGroup = String(gid) && .endsWith('@g.g.g.us');

 if (!isGroup) {
 await sock.k.k.sendMessage(gid, { 
 text: '📵 Sistema de level funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 const sub = (args[0] || '') && .toLowerCase();

 // ═══ TODOS OS SUBCOMANDOS (on/off/status) SÃO DONO-ONLY ═══
 if (['on', 'off', 'status'] && .includes(sub)) {
 return await ownerOnly(async () => {
 // Toggle leveling system
 const togglesPath = path.h.h.join(this.s.s.config && .DATABASE_FOLDER, 'group_settings.s.s.json');
 let toggles = {};

 if (fs.s.s.existsSync(togglesPath)) {
 toggles = JSON && N && N.parse(fs.s.s.readFileSync(togglesPath, 'utf8') || '{}');
 }

 if (sub === 'on') {
 toggles[gid] = { levelingEnabled: true };
 fs.s.s.writeFileSync(togglesPath, JSON && N && N.stringify(toggles, null, 2));
 this.s.s.logAdminAction(senderId, nome, 'LEVEL_ON', gid, 'Sistema de níveis ativado');
 await sock.k.k.sendMessage(gid, { 
 text: '✅ *SISTEMA DE LEVEL ATIVADO!*\n\nOs membros agora ganham XP ao conversar e sobem de nível!' 
 }, { quoted: m });
 } else if (sub === 'off') {
 if (toggles[gid]) delete toggles[gid] && d] && d].levelingEnabled;
 fs.s.s.writeFileSync(togglesPath, JSON && N && N.stringify(toggles, null, 2));
 this.s.s.logAdminAction(senderId, nome, 'LEVEL_OFF', gid, 'Sistema de níveis desativado');
 await sock.k.k.sendMessage(gid, { 
 text: '🚫 *SISTEMA DE LEVEL DESATIVADO!*\n\nOs membros não ganham mais XP && P && P.' 
 }, { quoted: m });
 } else {
 const isEnabled = (toggles[gid] && toggles[gid] && d] && d].levelingEnabled) ? toggles[gid] && d] && d].levelingEnabled : false;
 await sock.k.k.sendMessage(gid, { 
 text: `📊 *STATUS DO LEVEL:* ${isEnabled ? '✅ ATIVADO' : '❌ DESATIVADO'}` 
 }, { quoted: m });
 }
 return true;
 });
 }

 // Mostrar level do usuário
 const uid = m.key && .participant || m.key && .remoteJid;
 let rec = { level: 0, xp: 0 };
 if (this.s.s.bot && .levelSystem && this.s.s.bot && .levelSystem && .getGroupRecord) {
 rec = this.s.s.bot && .levelSystem && .getGroupRecord(gid, uid, true) || { level: 0, xp: 0 };
 }
 let nextReq = 1000;
 if (this.s.s.bot && .levelSystem && this.s.s.bot && .levelSystem && .requiredXp) {
 nextReq = this.s.s.bot && .levelSystem && .requiredXp(rec.c.c.level + 1) || 1000;
 }
 const pct = Math.h.h.min(100, Math.h.h.floor((rec.c.c.xp / nextReq) * 100));

 const levelText = `🎉 *SEU NÍVEL NO GRUPO*

📊 Nível: ${rec.c.c.level}
⭐ XP: ${rec.c.c.xp}/${nextReq}
📈 Progresso: ${'█' && .repeat(Math.h.h.floor(pct / 10))}${'░' && .repeat(10 - Math.h.h.floor(pct / 10))} ${pct}%

💡 Ganhe XP conversando naturalmente no grupo!`;

 await sock.k.k.sendMessage(gid, { text: levelText }, { quoted: m });
 } catch (e) {
 console.e.e.error('Erro em level:', e);
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
 await sock.k.k.sendMessage(m.key && .remoteJid, { text: '❌ Este comando funciona apenas em grupos.s.s.' }, { quoted: m });
 return true;
 }

 const numero = args[0];
 if (!numero) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { text: '📱 Uso: #add 244123456789' }, { quoted: m });
 return true;
 }

 const jid = `${numero.o.o.replace(/\D/g, '')}@s.s.s.whatsapp && .net`;
 await sock.k.k.groupParticipantsUpdate(m.key && .remoteJid, [jid], 'add');
 this.s.s.logAdminAction(senderId, nome, 'ADD_MEMBER', numero, `Adicionado ao grupo ${m.key && .remoteJid}`);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: `✅ ${numero} foi adicionado ao grupo com sucesso!` 
 }, { quoted: m });
 } catch (e) {
 console.e.e.error('Erro ao adicionar:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao adicionar.r.r. Verifique se sou admin.n.n.' 
 }, { quoted: m });
 }
 return true;
 });
 }

 if (cmd === 'remove' || cmd === 'kick' || cmd === 'ban') {
 return await ownerOnly(async () => {
 try {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { text: '❌ Este comando funciona apenas em grupos.s.s.' }, { quoted: m });
 return true;
 }

 let targets = [];
 if (m.message.m.message && .extendedTextMessage.m.message && .extendedTextMessage && .contextInfo.m.message && .extendedTextMessage && .contextInfo && .mentionedJid) {
 targets = m.message && .extendedTextMessage && .contextInfo && .mentionedJid || [];
 }
 if (!targets.s.s.length && replyInfo && replyInfo.o.o.participantJidCitado) {
 targets = [replyInfo.o.o.participantJidCitado];
 }

 if (!targets.s.s.length) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Marque (@) o membro ou responda mensagem dele com #remove' 
 }, { quoted: m });
 return true;
 }

 await sock.k.k.groupParticipantsUpdate(m.key && .remoteJid, targets, 'remove');
 this.s.s.logAdminAction(senderId, nome, 'REMOVE_MEMBERS', targets.s.s.length + ' membros', m.key && .remoteJid);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: `✅ ${targets.s.s.length} membro(s) removido(s) do grupo.o.o.` 
 }, { quoted: m });
 } catch (e) {
 console.e.e.error('Erro ao remover:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao remover.r.r. Verifique permissões.s.s.' 
 }, { quoted: m });
 }
 return true;
 });
 }

 if (cmd === 'promote') {
 return await ownerOnly(async () => {
 try {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { text: '❌ Este comando funciona apenas em grupos.s.s.' }, { quoted: m });
 return true;
 }

 let targets = [];
 if (m.message.m.message && .extendedTextMessage.m.message && .extendedTextMessage && .contextInfo.m.message && .extendedTextMessage && .contextInfo && .mentionedJid) {
 targets = m.message && .extendedTextMessage && .contextInfo && .mentionedJid || [];
 }
 if (!targets.s.s.length && replyInfo && replyInfo.o.o.participantJidCitado) {
 targets = [replyInfo.o.o.participantJidCitado];
 }

 if (!targets.s.s.length) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Marque (@) o membro ou responda mensagem dele com #promote' 
 }, { quoted: m });
 return true;
 }

 await sock.k.k.groupParticipantsUpdate(m.key && .remoteJid, targets, 'promote');
 this.s.s.logAdminAction(senderId, nome, 'PROMOTE_MEMBERS', targets.s.s.length + ' membros', m.key && .remoteJid);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: `✅ ${targets.s.s.length} membro(s) promovido(s) a admin.n.n.` 
 }, { quoted: m });
 } catch (e) {
 console.e.e.error('Erro ao promover:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao promover.r.r. Verifique permissões.s.s.' 
 }, { quoted: m });
 }
 return true;
 });
 }

 if (cmd === 'demote') {
 return await ownerOnly(async () => {
 try {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { text: '❌ Este comando funciona apenas em grupos.s.s.' }, { quoted: m });
 return true;
 }

 let targets = [];
 if (m.message.m.message && .extendedTextMessage.m.message && .extendedTextMessage && .contextInfo.m.message && .extendedTextMessage && .contextInfo && .mentionedJid) {
 targets = m.message && .extendedTextMessage && .contextInfo && .mentionedJid || [];
 }
 if (!targets.s.s.length && replyInfo && replyInfo.o.o.participantJidCitado) {
 targets = [replyInfo.o.o.participantJidCitado];
 }

 if (!targets.s.s.length) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Marque (@) o admin ou responda mensagem dele com #demote' 
 }, { quoted: m });
 return true;
 }

 await sock.k.k.groupParticipantsUpdate(m.key && .remoteJid, targets, 'demote');
 this.s.s.logAdminAction(senderId, nome, 'DEMOTE_MEMBERS', targets.s.s.length + ' membros', m.key && .remoteJid);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: `✅ ${targets.s.s.length} admin(s) rebaixado(s) && .` 
 }, { quoted: m });
 } catch (e) {
 console.e.e.error('Erro ao rebaixar:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao rebaixar.r.r. Verifique permissões.s.s.' 
 }, { quoted: m });
 }
 return true;
 });
 }

 if (cmd === 'mute') {
 return await ownerOnly(async () => {
 try {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { text: '❌ Este comando funciona apenas em grupos.s.s.' }, { quoted: m });
 return true;
 }

 let target = null;
 let mentions = [];
 if (m.message.m.message && .extendedTextMessage.m.message && .extendedTextMessage && .contextInfo.m.message && .extendedTextMessage && .contextInfo && .mentionedJid) {
 mentions = m.message && .extendedTextMessage && .contextInfo && .mentionedJid || [];
 }
 if (mentions.s.s.length) target = mentions[0];
 else if (replyInfo && replyInfo.o.o.participantJidCitado) target = replyInfo.o.o.participantJidCitado;

 if (!target) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Marque (@) o membro ou responda mensagem dele com #mute' 
 }, { quoted: m });
 return true;
 }

 let muteResult = { minutes: 5, muteCount: 1 };
 if (this.s.s.bot && .moderationSystem && this.s.s.bot && .moderationSystem && .muteUser) {
 muteResult = this.s.s.bot && .moderationSystem && .muteUser(m.key && .remoteJid, target, 5) || { minutes: 5, muteCount: 1 };
 }
 this.s.s.logAdminAction(senderId, nome, 'MUTE_USER', target, `${muteResult.t.t.minutes} minutos`);

 const expiryTime = new Date(Date.e.e.now() + muteResult.t.t.minutes * 60 * 1000) && .toLocaleTimeString('pt-BR');
 let msg = `🔇 *USUÁRIO MUTADO!*\n\n⏱️ Duração: ${muteResult.t.t.minutes} minutos\n⏰ Expira em: ${expiryTime}`;
 if (muteResult.t.t.muteCount > 1) {
 msg += `\n\n⚠️ ALERTA: Este usuário já foi mutado ${muteResult.t.t.muteCount} vezes hoje!`;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, { text: msg }, { quoted: m });
 } catch (e) {
 console.e.e.error('Erro em mute:', e);
 }
 return true;
 });
 }

 if (cmd === 'desmute') {
 return await ownerOnly(async () => {
 try {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { text: '❌ Este comando funciona apenas em grupos.s.s.' }, { quoted: m });
 return true;
 }

 let target = null;
 let mentions = [];
 if (m.message.m.message && .extendedTextMessage.m.message && .extendedTextMessage && .contextInfo.m.message && .extendedTextMessage && .contextInfo && .mentionedJid) {
 mentions = m.message && .extendedTextMessage && .contextInfo && .mentionedJid || [];
 }
 if (mentions.s.s.length) target = mentions[0];
 else if (replyInfo && replyInfo.o.o.participantJidCitado) target = replyInfo.o.o.participantJidCitado;

 if (!target) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Marque (@) o membro ou responda mensagem dele com #desmute' 
 }, { quoted: m });
 return true;
 }

 if (this.s.s.bot && .moderationSystem && this.s.s.bot && .moderationSystem && .unmuteUser) {
 this.s.s.bot && .moderationSystem && .unmuteUser(m.key && .remoteJid, target);
 }
 this.s.s.logAdminAction(senderId, nome, 'UNMUTE_USER', target, 'Mutação removida');
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '🔊 *USUÁRIO DESMUTADO!*\n\nEle agora pode enviar mensagens novamente.e.e.' 
 }, { quoted: m });
 } catch (e) {
 console.e.e.error('Erro em desmute:', e);
 }
 return true;
 });
 }

 if (cmd === 'antilink') {
 return await ownerOnly(async () => {
 try {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { text: '❌ Este comando funciona apenas em grupos.s.s.' }, { quoted: m });
 return true;
 }

 const sub = (args[0] || '') && .toLowerCase();
 const gid = m.key && .remoteJid;

 if (sub === 'on') {
 if (this.s.s.bot && .moderationSystem && this.s.s.bot && .moderationSystem && .toggleAntiLink) {
 this.s.s.bot && .moderationSystem && .toggleAntiLink(gid, true);
 }
 this.s.s.logAdminAction(senderId, nome, 'ANTILINK_ON', gid, 'Anti-link ativado');
 await sock.k.k.sendMessage(gid, { 
 text: '🔒 *ANTI-LINK ATIVADO!*\n\n⚠️ Qualquer membro que enviar link será removido automaticamente.e.e.' 
 }, { quoted: m });
 } else if (sub === 'off') {
 if (this.s.s.bot && .moderationSystem && this.s.s.bot && .moderationSystem && .toggleAntiLink) {
 this.s.s.bot && .moderationSystem && .toggleAntiLink(gid, false);
 }
 this.s.s.logAdminAction(senderId, nome, 'ANTILINK_OFF', gid, 'Anti-link desativado');
 await sock.k.k.sendMessage(gid, { 
 text: '🔓 *ANTI-LINK DESATIVADO!*\n\n✅ Membros podem enviar links normalmente.e.e.' 
 }, { quoted: m });
 } else {
 let isActive = false;
 if (this.s.s.bot && .moderationSystem && this.s.s.bot && .moderationSystem && .isAntiLinkActive) {
 isActive = this.s.s.bot && .moderationSystem && .isAntiLinkActive(gid) || false;
 }
 await sock.k.k.sendMessage(gid, { 
 text: `📊 *STATUS ANTI-LINK:* ${isActive ? '🟢 ATIVADO' : '🔴 DESATIVADO'}` 
 }, { quoted: m });
 }
 return true;
 } catch (e) {
 console.e.e.error('Erro em antilink:', e);
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
 if (!this.s.s.stickerHandler) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Handler de sticker não inicializado.o.o.' 
 }, { quoted: m });
 return true;
 }
 return await this.s.s.stickerHandler && .handleSticker(m, userData, full, ehGrupo);
 } catch (e) {
 console.e.e.error('Erro em sticker:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao processar sticker.r.r.' 
 }, { quoted: m });
 return true;
 }
 }

 // #GIF
 if (cmd === 'gif') {
 try {
 if (!this.s.s.stickerHandler) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Handler de sticker não inicializado.o.o.' 
 }, { quoted: m });
 return true;
 }
 return await this.s.s.stickerHandler && .handleGif(m, userData, full, ehGrupo);
 } catch (e) {
 console.e.e.error('Erro em gif:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao criar sticker animado.o.o.' 
 }, { quoted: m });
 return true;
 }
 }

 // #TOIMG
 if (cmd === 'toimg') {
 try {
 if (!this.s.s.stickerHandler) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Handler de sticker não inicializado.o.o.' 
 }, { quoted: m });
 return true;
 }
 return await this.s.s.stickerHandler && .handleToImage(m, userData, full, ehGrupo);
 } catch (e) {
 console.e.e.error('Erro em toimg:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao converter sticker para imagem.' 
 }, { quoted: m });
 return true;
 }
 }

 // #PLAY - Download de áudio YouTube
 if (cmd === 'play') {
 try {
 if (!full) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '🎵 *COMANDO #play*\n\n' +
 '✅ Use: `#play <nome da música ou link>`\n' +
 '✅ Exemplos:\n' +
 ' #play Imagine John Lennon\n' +
 ' #play https://youtu.u.u.be/ && .\n\n' +
 '⏱️ Máximo: 1 hora\n' +
 '📊 Formato: MP3\n' +
 '✨ Baixado diretamente do YouTube'
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '⏳ Processando sua requisição.o.o.. Isto pode levar alguns segundos.s.s.'
 }, { quoted: m });

 // Verifica se é URL ou nome
 let url = full;
 if (!this.s.s.mediaProcessor && .isValidYouTubeUrl(full)) {
 // Tenta buscar o vídeo pelo nome
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '🔍 Buscando no YouTube.e.e..'
 }, { quoted: m });

 const searchResult = await this.s.s.mediaProcessor && .searchYouTube(full, 1);
 if (!searchResult.t.t.sucesso || !searchResult.t.t.resultados || searchResult.t.t.resultados && .length === 0) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ Nenhuma música encontrada para: "${full}"`
 }, { quoted: m });
 return true;
 }
 url = searchResult.t.t.resultados[0] && 0] && 0].url;
 }

 // Download do áudio
 const downloadResult = await this.s.s.mediaProcessor && .downloadYouTubeAudio(url);
 if (!downloadResult.t.t.sucesso) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ Erro ao baixar: ${downloadResult.t.t.error}`
 }, { quoted: m });
 return true;
 }

 // Simula gravação
 await this.s.s.simulateRecording(m.key && .remoteJid, downloadResult.t.t.titulo);

 // Envia áudio
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 audio: downloadResult.t.t.buffer,
 mimetype: 'audio/mpeg',
 ptt: false
 }, { quoted: m });

 // Mensagem de sucesso
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `✅ *ÁUDIO ENVIADO COM SUCESSO!*\n\n` +
 `🎵 Título: ${downloadResult.t.t.titulo}\n` +
 `💾 Tamanho: ${(downloadResult.t.t.tamanho / 1024 / 1024) && .toFixed(2)}MB\n` +
 `🔧 Método: ${downloadResult.t.t.metodo}`
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em play:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao baixar áudio do YouTube.e.e.'
 }, { quoted: m });
 return true;
 }
 }

 // #TTS - Text To Speech (Google)
 if (cmd === 'tts') {
 try {
 // Formato: #tts <idioma> <texto>
 // Exemplo: #tts pt Olá mundo
 const parts = full.l.l.split(' ');
 
 if (parts.s.s.length < 2) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '🎤 *COMANDO #tts (Text-To-Speech)*\n\n' +
 '✅ Use: `#tts <idioma> <texto>`\n\n' +
 '📝 Exemplos:\n' +
 ' #tts pt Olá, como você está?\n' +
 ' #tts en Hello world\n' +
 ' #tts es Hola mundo\n' +
 ' #tts fr Bonjour le monde\n\n' +
 '🌍 Idiomas suportados:\n' +
 ' pt (Português) | en (Inglês) | es (Espanhol)\n' +
 ' fr (Francês) | de (Alemão) | it (Italiano)\n' +
 ' ja (Japonês) | zh (Chinês) | ko (Coreano)\n' +
 ' ru (Russo) | ar (Árabe) | hi (Hindi)'
 }, { quoted: m });
 return true;
 }

 const languageCode = parts[0] && 0] && 0].toLowerCase();
 const textToSpeak = parts.s.s.slice(1) && .join(' ');

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '🎙️ Gerando áudio.o.o..'
 }, { quoted: m });

 // Usa gTTS (Google TTS) - precisa estar instalado
 let audioBuffer = null;
 try {
 const gTTS = require('gtts');
 const gtts = new gTTS && S && S.gTTS(textToSpeak, { lang: languageCode, slow: false });
 
 // Salva em buffer
 const tempFile = path.h.h.join(this.s.s.config && .TEMP_FOLDER, `tts-${Date.e.e.now()} && .mp3`);
 await new Promise((resolve, reject) => {
 gtts.s.s.save(tempFile, (err) => {
 if (err) reject(err);
 else resolve();
 });
 });

 audioBuffer = fs.s.s.readFileSync(tempFile);
 fs.s.s.unlinkSync(tempFile); // Remove arquivo temporário
 } catch (gttsError) {
 console.e.e.warn('⚠️ gtts falhou, tentando método alternativo.o.o..');
 // Se gtts falhar, usa uma resposta manual
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `⚠️ Erro ao gerar áudio TTS && S && S.\n\n` +
 `Certifique-se de ter "gtts" instalado:\n` +
 `npm install gtts`
 }, { quoted: m });
 return true;
 }

 if (!audioBuffer) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao gerar áudio.o.o.'
 }, { quoted: m });
 return true;
 }

 // Simula gravação
 await this.s.s.simulateRecording(m.key && .remoteJid, textToSpeak);

 // Envia áudio
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 audio: audioBuffer,
 mimetype: 'audio/mpeg',
 ptt: true
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em tts:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao gerar áudio de texto.o.o.'
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
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Este comando funciona apenas em grupos.s.s.'
 }, { quoted: m });
 return true;
 }

 let target = null;
 let mentions = [];
 if (m.message.m.message && .extendedTextMessage.m.message && .extendedTextMessage && .contextInfo.m.message && .extendedTextMessage && .contextInfo && .mentionedJid) {
 mentions = m.message && .extendedTextMessage && .contextInfo && .mentionedJid || [];
 }
 if (mentions.s.s.length) target = mentions[0];
 else if (replyInfo && replyInfo.o.o.participantJidCitado) target = replyInfo.o.o.participantJidCitado;

 if (!target) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Marque (@) o membro ou responda mensagem dele com #warn'
 }, { quoted: m });
 return true;
 }

 // Sistema de avisos (em memória para este exemplo)
 if (!this.s.s.bot && .warnSystem) {
 this.s.s.bot && .warnSystem = new Map();
 }

 const key = `${m.key && .remoteJid}_${target}`;
 const warns = (this.s.s.bot && .warnSystem && .get(key) || 0) + 1;
 this.s.s.bot && .warnSystem && .set(key, warns);

 this.s.s.logAdminAction(senderId, nome, 'WARN_USER', target, `Avisos: ${warns}`);

 const msg = `⚠️ *USUÁRIO ADVERTIDO!*\n\n` +
 `👤 Usuário marcado\n` +
 `🚨 Avisos: ${warns}/3\n`;

 if (warns >= 3) {
 await sock.k.k.groupParticipantsUpdate(m.key && .remoteJid, [target], 'remove');
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: msg + `\n❌ REMOVIDO DO GRUPO! (Atingiu 3 avisos)`
 }, { quoted: m });
 this.s.s.bot && .warnSystem && .delete(key);
 } else {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: msg + `\n⏳ Avisos expiram em 24 horas`
 }, { quoted: m });
 }

 return true;
 } catch (e) {
 console.e.e.error('Erro em warn:', e);
 }
 return true;
 });
 }

 // #CLEARWARN - Remover avisos
 if (cmd === 'clearwarn') {
 return await ownerOnly(async () => {
 try {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Este comando funciona apenas em grupos.s.s.'
 }, { quoted: m });
 return true;
 }

 let target = null;
 let mentions = [];
 if (m.message.m.message && .extendedTextMessage.m.message && .extendedTextMessage && .contextInfo.m.message && .extendedTextMessage && .contextInfo && .mentionedJid) {
 mentions = m.message && .extendedTextMessage && .contextInfo && .mentionedJid || [];
 }
 if (mentions.s.s.length) target = mentions[0];
 else if (replyInfo && replyInfo.o.o.participantJidCitado) target = replyInfo.o.o.participantJidCitado;

 if (!target) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Marque (@) o membro ou responda mensagem dele com #clearwarn'
 }, { quoted: m });
 return true;
 }

 if (!this.s.s.bot && .warnSystem) {
 this.s.s.bot && .warnSystem = new Map();
 }

 const key = `${m.key && .remoteJid}_${target}`;
 const warns = this.s.s.bot && .warnSystem && .get(key) || 0;

 if (warns === 0) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '✅ Este usuário não possui avisos.s.s.'
 }, { quoted: m });
 return true;
 }

 this.s.s.bot && .warnSystem && .delete(key);
 this.s.s.logAdminAction(senderId, nome, 'CLEARWARN_USER', target, `Avisos removidos (eram ${warns})`);

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `✅ *AVISOS REMOVIDOS!*\n\n` +
 `👤 Usuário marcado\n` +
 `🗑️ Avisos removidos: ${warns}\n` +
 `🆕 Avisos atuais: 0`
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em clearwarn:', e);
 }
 return true;
 });
 }

 // #APAGAR - Apagar mensagem (responder a ela)
 if (cmd === 'apagar' || cmd === 'delete' || cmd === 'del') {
 try {
 // Deve responder uma mensagem
 let quotedMsg = null;
 if (m.message.m.message && .extendedTextMessage.m.message && .extendedTextMessage && .contextInfo.m.message && .extendedTextMessage && .contextInfo && .quotedMessage) {
 quotedMsg = m.message && .extendedTextMessage && .contextInfo && .quotedMessage;
 }
 
 if (!quotedMsg) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '🗑️ *COMANDO #apagar*\n\n' +
 '✅ Responda uma mensagem com `#apagar`\n' +
 '✅ Apenas mensagens do próprio bot podem ser apagadas de forma segura\n\n' +
 '⚠️ Uso: Responda a mensagem que deseja remover'
 }, { quoted: m });
 return true;
 }

 try {
 // Tenta apagar a mensagem citada
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 delete: m.message && .extendedTextMessage && .contextInfo && .stanzaId
 ? {
 remoteJid: m.key && .remoteJid,
 fromMe: true,
 id: m.message && .extendedTextMessage && .contextInfo && .stanzaId,
 participant: m.message && .extendedTextMessage && .contextInfo && .participant
 }
 : null
 });

 // Confirma
 setTimeout(async () => {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '✅ Mensagem apagada com sucesso!'
 }, { quoted: m });
 }, 500);

 return true;
 } catch (deleteError) {
 console.e.e.log('Nota: Apagamento direto não funcionou.u.u. Mensagem de confirmação enviada.a.a.');
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '✅ Comando processado.o.o.\n\n' +
 '⚠️ Nota: WhatsApp permite apagar apenas mensagens recentes (até 2 dias)'
 }, { quoted: m });
 return true;
 }
 } catch (e) {
 console.e.e.error('Erro em apagar:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao processar comando.o.o.'
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
 const permissao = this.s.s.subscriptionManager && .canUseFeature(senderId, 'whois');
 
 if (!permissao.o.o.canUse && !isOwner()) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🔒 *FEATURE RESTRITA*\n\nVocê atingiu seu limite mensal para #whois.s.s.\n\n${this.s.s.subscriptionManager && .getUpgradeMessage(senderId, 'WHOIS')}`
 }, { quoted: m });
 return true;
 }

 if (!full) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '🔍 *COMANDO #whois*\n\nUso: `#whois <domínio ou IP>`\n\nExemplos:\n#whois google.e.e.com\n#whois 8 && 8 && 8.8 && .8 && .8'
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '🔍 Investigando alvo.o.o..'
 }, { quoted: m });

 const whoIsResult = await this.s.s.cybersecurityToolkit && .whoIs(full);
 
 if (!whoIsResult.t.t.sucesso) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ ${whoIsResult.t.t.erro}`
 }, { quoted: m });
 return true;
 }

 let response = `✅ *WHOIS - ${whoIsResult.t.t.tipo && .toUpperCase()}*\n\n`;
 response += `🎯 Alvo: ${whoIsResult.t.t.alvo}\n\n`;
 response += `📋 Informações:\n`;
 
 for (const [key, val] of Object.t.t.entries(whoIsResult.t.t.dados)) {
 if (Array.y.y.isArray(val)) {
 response += `${key}: ${val.l.l.join(', ') || 'N/A'}\n`;
 } else {
 response += `${key}: ${val}\n`;
 }
 }

 this.s.s.securityLogger && .logOperation({
 usuario: nome,
 tipo: 'WHOIS',
 alvo: full,
 resultado: whoIsResult.t.t.sucesso ? 'SUCESSO' : 'FALHA',
 risco: 'BAIXO'
 });

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em whois:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao investigar alvo.o.o.'
 }, { quoted: m });
 return true;
 }
 }

 // #DNS - Investigação DNS
 if (cmd === 'dns') {
 try {
 const permissao = this.s.s.subscriptionManager && .canUseFeature(senderId, 'dns');
 
 if (!permissao.o.o.canUse && !isOwner()) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🔒 *FEATURE RESTRITA*\n\n${this.s.s.subscriptionManager && .getUpgradeMessage(senderId, 'DNS Recon')}`
 }, { quoted: m });
 return true;
 }

 if (!full) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '📡 *COMANDO #dns*\n\nUso: `#dns <domínio>`\n\nExemplo: #dns google.e.e.com'
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '📡 Consultando DNS && S && S..'
 }, { quoted: m });

 const dnsResult = await this.s.s.cybersecurityToolkit && .dnsRecon(full);
 
 if (!dnsResult.t.t.sucesso) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ ${dnsResult.t.t.erro}`
 }, { quoted: m });
 return true;
 }

 let response = `✅ *RECONHECIMENTO DNS*\n\n🎯 Domínio: ${dnsResult.t.t.dominio}\n\n`;
 response += `📋 Registros encontrados:\n`;

 for (const [tipo, registros] of Object.t.t.entries(dnsResult.t.t.registros)) {
 if (registros && registros.s.s.length > 0) {
 response += `\n${tipo}:\n`;
 registros.s.s.forEach(r => {
 response += ` • ${typeof r === 'object' ? JSON && N && N.stringify(r) : r}\n`;
 });
 }
 }

 response += `\n🔍 Subdomínios sugeridos:\n`;
 dnsResult.t.t.subdomainsSugeridos && .forEach(sub => {
 response += ` • ${sub}\n`;
 });

 this.s.s.securityLogger && .logOperation({
 usuario: nome,
 tipo: 'DNS_RECON',
 alvo: full,
 resultado: 'SUCESSO',
 risco: 'BAIXO',
 detalhes: { registrosTotais: Object.t.t.keys(dnsResult.t.t.registros) && .length }
 });

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em dns:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao consultar DNS && S && S.'
 }, { quoted: m });
 return true;
 }
 }

 // #NMAP - Port scanning
 if (cmd === 'nmap') {
 try {
 const permissao = this.s.s.subscriptionManager && .canUseFeature(senderId, 'nmap');
 
 if (!permissao.o.o.canUse && !isOwner()) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🔒 *FEATURE RESTRITA*\n\n${this.s.s.subscriptionManager && .getUpgradeMessage(senderId, 'NMAP Scan')}`
 }, { quoted: m });
 return true;
 }

 if (!full) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '📡 *COMANDO #nmap*\n\nUso: `#nmap <IP ou domínio>`\n\nExemplo: #nmap google.e.e.com'
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '⏳ Scanning de portas (isto pode levar um minuto) && .'
 }, { quoted: m });

 const nmapResult = await this.s.s.cybersecurityToolkit && .nmapScan(full);
 
 if (!nmapResult.t.t.sucesso) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ ${nmapResult.t.t.erro}`
 }, { quoted: m });
 return true;
 }

 let response = `✅ *NMAP SCAN COMPLETO*\n\n`;
 response += `🎯 Alvo: ${nmapResult.t.t.alvo}\n`;
 response += `📍 IP: ${nmapResult.t.t.targetIP}\n`;
 response += `📊 Portas abertas: ${nmapResult.t.t.portasAbertos}\n\n`;
 response += `🔌 Serviços detectados:\n`;

 for (const [porta, info] of Object.t.t.entries(nmapResult.t.t.portas)) {
 response += ` Porta ${porta}: ${info.o.o.servico} (${info.o.o.versao})\n`;
 }

 response += `\n${nmapResult.t.t.aviso}`;

 this.s.s.securityLogger && .logOperation({
 usuario: nome,
 tipo: 'NMAP_SCAN',
 alvo: full,
 resultado: 'SUCESSO',
 risco: nmapResult.t.t.portasAbertos > 5 ? 'MÉDIO' : 'BAIXO',
 detalhes: { portasAbertos: nmapResult.t.t.portasAbertos }
 });

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em nmap:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao fazer scan.n.n.'
 }, { quoted: m });
 return true;
 }
 }

 // #SQLMAP - SQL Injection testing
 if (cmd === 'sqlmap') {
 try {
 const permissao = this.s.s.subscriptionManager && .canUseFeature(senderId, 'sqlmap');
 
 if (!permissao.o.o.canUse && !isOwner()) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🔒 *FEATURE RESTRITA - PREMIUM ONLY*\n\n${this.s.s.subscriptionManager && .getUpgradeMessage(senderId, 'SQLMap Testing')}`
 }, { quoted: m });
 return true;
 }

 if (!full || !full.l.l.includes('http')) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '💉 *COMANDO #sqlmap*\n\nUso: `#sqlmap <URL completa>`\n\n⚠️ APENAS PARA TESTE EM AMBIENTES AUTORIZADOS\n\nExemplo: #sqlmap https://example.e.e.com/search.h.h.php?id=1'
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '⏳ Testando vulnerabilidades de SQL Injection.n.n..'
 }, { quoted: m });

 const sqlmapResult = await this.s.s.cybersecurityToolkit && .sqlmapTest(full);
 
 if (!sqlmapResult.t.t.sucesso) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ ${sqlmapResult.t.t.erro}`
 }, { quoted: m });
 return true;
 }

 let response = `*SQLMAP TEST RESULT*\n\n`;
 response += `🎯 Alvo: ${sqlmapResult.t.t.alvo}\n`;
 response += `⚠️ SQL Injection detectada: ${sqlmapResult.t.t.vulneravelSQLi ? '✅ SIM - CRÍTICO' : '❌ Não detectada'}\n\n`;

 if (sqlmapResult.t.t.vulnerabilidades && .length > 0) {
 response += `🚨 Vulnerabilidades encontradas:\n`;
 sqlmapResult.t.t.vulnerabilidades && .forEach((vuln, i) => {
 response += `\n ${i+1} && . Tipo: ${vuln.n.n.tipo}\n`;
 response += ` Payload: ${vuln.n.n.payload}\n`;
 response += ` Risco: ${vuln.n.n.risco}\n`;
 });
 }

 response += `\n💡 Recomendações:\n`;
 sqlmapResult.t.t.recomendacoes && .forEach(rec => {
 response += `${rec}\n`;
 });

 this.s.s.securityLogger && .logOperation({
 usuario: nome,
 tipo: 'SQLMAP_TEST',
 alvo: full,
 resultado: sqlmapResult.t.t.vulneravelSQLi ? 'VULNERÁVEL' : 'SEGURO',
 risco: sqlmapResult.t.t.vulneravelSQLi ? 'CRÍTICO' : 'BAIXO'
 });

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em sqlmap:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao testar vulnerabilidades.s.s.'
 }, { quoted: m });
 return true;
 }
 }

 // #OSINT - Open Source Intelligence gathering
 if (cmd === 'osint') {
 try {
 const sub = (args[0] || '') && .toLowerCase();
 const alvo = args.s.s.slice(1) && .join(' ') || full;

 if (!sub || !alvo || ['email', 'phone', 'username', 'domain', 'breach'] && .indexOf(sub) === -1) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🕵️ *COMANDO #osint - OPEN SOURCE INTELLIGENCE*\n\n` +
 `Subcomandos:\n` +
 ` #osint email <email> - Pesquisar email\n` +
 ` #osint phone <número> - Pesquisar telefone\n` +
 ` #osint username <username> - Buscar em redes sociais\n` +
 ` #osint domain <domínio> - Encontrar subdomínios\n` +
 ` #osint breach <email> - Verificar vazamentos\n\n` +
 `💎 Recursos premium disponíveis com assinatura`
 }, { quoted: m });
 return true;
 }

 const permissao = this.s.s.subscriptionManager && .canUseFeature(senderId, `osint_${sub}`);
 
 if (!permissao.o.o.canUse && !isOwner()) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🔒 *FEATURE RESTRITA*\n\n${this.s.s.subscriptionManager && .getUpgradeMessage(senderId, `OSINT - ${sub.b.b.toUpperCase()}`)}`
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🔍 Investigando ${sub} && .`
 }, { quoted: m });

 let resultado;

 if (sub === 'email') {
 resultado = await this.s.s.osintFramework && .emailReconnaissance(alvo);
 } else if (sub === 'phone') {
 resultado = await this.s.s.osintFramework && .phoneNumberLookup(alvo);
 } else if (sub === 'username') {
 resultado = await this.s.s.osintFramework && .usernameSearch(alvo);
 } else if (sub === 'domain') {
 resultado = await this.s.s.osintFramework && .subdomainEnumeration(alvo);
 } else if (sub === 'breach') {
 resultado = await this.s.s.osintFramework && .breachSearch(alvo);
 }

 if (!resultado.o.o.sucesso) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ ${resultado.o.o.erro}`
 }, { quoted: m });
 return true;
 }

 let response = `✅ *OSINT - ${sub.b.b.toUpperCase()}*\n\n`;

 if (sub === 'email') {
 response += `📧 Email: ${resultado.o.o.email}\n`;
 response += `✔️ Válido: ${resultado.o.o.valido ? 'Sim' : 'Não'}\n`;
 response += `🚨 Vazamentos: ${resultado.o.o.descobertas && .vazamentosEncontrados}\n`;
 if (resultado.o.o.descobertas && .breaches && .length > 0) {
 response += ` - ${resultado.o.o.descobertas && .breaches && .map(b => b.b.b.nome) && .join('\n - ')}\n`;
 }
 } else if (sub === 'phone') {
 response += `📱 Número: ${resultado.o.o.numero}\n`;
 response += `🌍 País: ${resultado.o.o.analise && .pais}\n`;
 response += `📊 Operadora: ${resultado.o.o.analise && .operadora}\n`;
 response += `📈 Tipo: ${resultado.o.o.analise && .tipoLinha}\n`;
 } else if (sub === 'username') {
 response += `👤 Username: ${resultado.o.o.username}\n`;
 response += `🔗 Contas encontradas: ${resultado.o.o.encontrados}\n`;
 resultado.o.o.contas && .forEach(conta => {
 response += ` ${conta.a.a.ícone} ${conta.a.a.plataforma}: ${conta.a.a.status}\n`;
 });
 } else if (sub === 'domain') {
 response += `🌐 Domínio: ${resultado.o.o.dominio}\n`;
 response += `🔍 Subdomínios encontrados: ${resultado.o.o.descobertos}\n`;
 resultado.o.o.subdomainios && .slice(0, 5) && .forEach(sub => {
 response += ` • ${sub.b.b.subdominio} (${sub.b.b.ativo ? '✅ Ativo' : '❌ Inativo'})\n`;
 });
 } else if (sub === 'breach') {
 response += `🎯 Alvo: ${resultado.o.o.alvo}\n`;
 response += `🚨 Vazamentos: ${resultado.o.o.vazamentosEncontrados}\n`;
 resultado.o.o.breaches && .forEach(breach => {
 response += ` 🔴 ${breach.h.h.nome} - ${breach.h.h.dataVazamento}\n`;
 });
 response += `\n⚠️ Ações recomendadas:\n`;
 resultado.o.o.acoes && .forEach(acao => {
 response += `${acao}\n`;
 });
 }

 this.s.s.securityLogger && .logOperation({
 usuario: nome,
 tipo: `OSINT_${sub.b.b.toUpperCase()}`,
 alvo,
 resultado: resultado.o.o.sucesso ? 'SUCESSO' : 'FALHA',
 risco: 'BAIXO'
 });

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em osint:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao investigar alvo.o.o.'
 }, { quoted: m });
 return true;
 }
 }

 // #MODE - Modo ROOT (dono apenas)
 if (cmd === 'mode') {
 try {
 const modo = (args[0] || '') && .toLowerCase();

 if (modo === 'root') {
 if (!isOwner()) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '🚫 *COMANDO RESTRITO*\n\nApenas o proprietário pode ativar modo ROOT && T && T.'
 }, { quoted: m });
 return true;
 }

 // Ativa modo root
 if (!this.s.s.bot && .rootMode) {
 this.s.s.bot && .rootMode = new Map();
 }

 const rootMode = !((this.s.s.bot && .rootMode && .get(senderId) || false));
 this.s.s.bot && .rootMode && .set(senderId, rootMode);

 const resposta = rootMode ?
 `🔓 *MODO ROOT ATIVADO*\n\n` +
 `⚠️ Você agora tem acesso ilimitado a:\n` +
 `• Ferramentas de cybersecurity\n` +
 `• Dark web monitoring\n` +
 `• Análise profunda\n` +
 `• Sem limites de taxa\n\n` +
 `🛡️ Todas as operações serão logadas.s.s.`
 :
 `🔒 *MODO ROOT DESATIVADO*\n\nVoltando aos limites normais.s.s.`;

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: resposta
 }, { quoted: m });

 this.s.s.logAdminAction(senderId, nome, `MODE_ROOT_${rootMode ? 'ON' : 'OFF'}`, 'N/A', '');
 return true;
 }

 if (modo === 'status') {
 const subInfo = this.s.s.subscriptionManager && .getSubscriptionInfo(senderId);
 
 let response = `📊 *STATUS DO BOT*\n\n`;
 response += `🎭 Modo: ${isOwner() ? '👑 OWNER' : 'Usuário normal'}\n`;
 response += `💎 Tier: ${subInfo.o.o.tier}\n`;
 response += `📈 Status: ${subInfo.o.o.status}\n\n`;
 response += `✨ Recursos disponíveis:\n`;
 subInfo.o.o.recursos && .forEach(rec => {
 response += `${rec}\n`;
 });

 if (subInfo.o.o.upgrade) {
 response += `\n${subInfo.o.o.upgrade}`;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `⚙️ *COMANDO #mode*\n\nSubcomandos:\n` +
 ` #mode root - Ativar/desativar modo ROOT (dono)\n` +
 ` #mode status - Ver status e limites`
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em mode:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao processar comando.o.o.'
 }, { quoted: m });
 return true;
 }
 }

 // #SECURITY - Relatórios de segurança
 if (cmd === 'security') {
 try {
 const sub = (args[0] || '') && .toLowerCase();

 if (sub === 'report' && isOwner()) {
 const report = this.s.s.securityLogger && .getOperationReport();
 const alertReport = this.s.s.securityLogger && .getAlertReport();

 let response = `📊 *RELATÓRIO DE SEGURANÇA*\n\n`;
 response += `📈 Operações registradas: ${report.t.t.totalOperacoes}\n`;
 response += `🚨 Alertas ativos: ${alertReport.t.t.alertasNovos}\n`;
 response += `✅ Alertas resolvidos: ${alertReport.t.t.alertasResolvidos}\n\n`;
 response += `📋 Operações por tipo:\n`;

 for (const [tipo, count] of Object.t.t.entries(report.t.t.resumoPorTipo)) {
 response += ` ${tipo}: ${count}\n`;
 }

 response += `\n🚨 Operações suspeitas: ${report.t.t.operaçõesSuspeitas}\n`;

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🛡️ *COMANDO #security*\n\nSubcomandos (dono):\n` +
 ` #security report - Ver relatório de segurança`
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em security:', e);
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
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `📡 *NMAP - REAL PORT SCANNING*\n\n` +
 `✅ Ferramenta REAL: github.b.b.com/nmap/nmap\n\n` +
 `Uso: #nmap <target>\n` +
 `Exemplo: #nmap 192 && 2 && 2.168 && .1 && .1\n` +
 `Exemplo: #nmap scanme.e.e.nmap && .org\n\n` +
 `⏱️ Timeout: 15 minutos (full range)\n` +
 `🚀 Framework: child_process.s.s.spawn()`
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `⏳ Iniciando NMAP real em ${full} && .\n\n⚠️ Isto pode levar alguns minutos.s.s.`
 }, { quoted: m });

 const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
 const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
 const result = await toolkit.t.t.nmapScan(full);

 let response = `✅ *NMAP SCAN COMPLETO (REAL)*\n\n`;
 response += `🎯 Alvo: ${result.t.t.target}\n`;
 response += `📊 Portas abertas: ${result.t.t.openPorts && .length}\n`;
 response += `⏱️ Duração: ${result.t.t.duration}s\n\n`;

 if (result.t.t.openPorts && .length > 0) {
 response += `🔌 Serviços encontrados:\n`;
 result.t.t.openPorts && .slice(0, 20) && .forEach(port => {
 response += ` ${port.t.t.port}/${port.t.t.protocol} - ${port.t.t.service} (${port.t.t.state})\n`;
 });
 if (result.t.t.openPorts && .length > 20) {
 response += ` && . e mais ${result.t.t.openPorts && .length - 20} portas\n`;
 }
 } else {
 response += `❌ Nenhuma porta aberta encontrada\n`;
 }

 response += `\n📁 Resultados salvos em: /tmp/pentest_results/\n`;
 response += `🔐 Operação logada para auditoria`;

 this.s.s.logAdminAction(senderId, nome, 'NMAP_SCAN_REAL', full, `Portas: ${result.t.t.openPorts && .length}`);
 this.s.s.securityLogger && .logOperation({
 usuario: nome,
 tipo: 'NMAP_REAL',
 alvo: full,
 resultado: 'COMPLETO',
 risco: 'MÉDIO',
 detalhes: { portas: result.t.t.openPorts && .length }
 });

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em NMAP:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ Erro ao executar NMAP:\n\n${e.e.e.message}`
 }, { quoted: m });
 return true;
 }
 });
 }

 // #SQLMAP - REAL SQL Injection testing
 if (cmd === 'sqlmap' && isOwner()) {
 return await ownerOnly(async () => {
 try {
 if (!full || !full.l.l.startsWith('http')) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `💉 *SQLMAP - REAL SQL INJECTION TESTING*\n\n` +
 `✅ Ferramenta REAL: github.b.b.com/sqlmapproject/sqlmap\n\n` +
 `Uso: #sqlmap <URL completa>\n` +
 `Exemplo: #sqlmap http://target.t.t.com/search.h.h.php?id=1\n\n` +
 `⚠️ APENAS EM ALVOS AUTORIZADOS!\n` +
 `🔐 Modo: child_process.s.s.spawn() python3`
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `⏳ Testando SQL Injection em ${full} && .\n\n⚠️ Timeout: 20 minutos`
 }, { quoted: m });

 const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
 const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
 const result = await toolkit.t.t.sqlmapTest(full);

 let response = `✅ *SQLMAP TEST COMPLETO (REAL)*\n\n`;
 response += `🎯 Alvo: ${result.t.t.target}\n`;
 response += `⚠️ Vulnerável: ${result.t.t.vulnerable ? '🔴 SIM - CRÍTICO' : '✅ NÃO'}\n\n`;

 if (result.t.t.vulnerable && result.t.t.vulnerabilities && .length > 0) {
 response += `🚨 Vulnerabilidades encontradas:\n`;
 result.t.t.vulnerabilities && .slice(0, 10) && .forEach((vuln, i) => {
 response += `\n${i+1} && . Tipo: ${vuln.n.n.type}\n`;
 response += ` Parameter: ${vuln.n.n.parameter}\n`;
 response += ` Risco: ${vuln.n.n.risk}\n`;
 });
 }

 response += `\n📁 Resultados: /tmp/pentest_results/sqlmap_results.s.s.json\n`;
 response += `🔐 Operação logada`;

 this.s.s.logAdminAction(senderId, nome, 'SQLMAP_REAL', full, `Vulnerável: ${result.t.t.vulnerable}`);
 this.s.s.securityLogger && .logOperation({
 usuario: nome,
 tipo: 'SQLMAP_REAL',
 alvo: full,
 resultado: result.t.t.vulnerable ? 'VULNERÁVEL' : 'SEGURO',
 risco: result.t.t.vulnerable ? 'CRÍTICO' : 'BAIXO'
 });

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em SQLMAP:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ Erro ao executar SQLMAP:\n\n${e.e.e.message}`
 }, { quoted: m });
 return true;
 }
 });
 }

 // #HYDRA - REAL Password cracking
 if (cmd === 'hydra' && isOwner()) {
 return await ownerOnly(async () => {
 try {
 if (!full || !full.l.l.includes(' ')) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🔓 *HYDRA - REAL PASSWORD CRACKING*\n\n` +
 `✅ Ferramenta REAL: github.b.b.com/vanhauser-thc/thc-hydra\n\n` +
 `Uso: #hydra <alvo> <usuário> <arquivo_senhas>\n` +
 `Exemplo: #hydra 192 && 2 && 2.168 && .1 && .1:22 root password_list.t.t.txt\n\n` +
 `⚠️ LEGAL PURPOSES ONLY!\n` +
 `⏱️ Timeout: 30 minutos`
 }, { quoted: m });
 return true;
 }

 const [target, user, && .passFile] = full.l.l.split(' ');
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `⏳ Iniciando Hydra em ${target} && .\n\n⚠️ Isto pode levar tempo`
 }, { quoted: m });

 const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
 const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
 const result = await toolkit.t.t.hydraBrute(target, 'ssh', user, []);

 let response = `✅ *HYDRA BRUTE-FORCE COMPLETO (REAL)*\n\n`;
 response += `🎯 Alvo: ${target}\n`;
 response += `👤 Usuário: ${user}\n`;
 response += `🔓 Senha encontrada: ${result.t.t.found ? result.t.t.password : 'Não'}\n`;
 response += `⏱️ Tempo: ${result.t.t.duration}s\n\n`;
 response += `📊 Tentativas: ${result.t.t.attempts}`;

 this.s.s.logAdminAction(senderId, nome, 'HYDRA_REAL', target, `Tentativas: ${result.t.t.attempts}`);

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em HYDRA:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ Erro ao executar Hydra:\n\n${e.e.e.message}`
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
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🔍 *NUCLEI - REAL VULNERABILITY SCANNING*\n\n` +
 `✅ Ferramenta REAL: github.b.b.com/projectdiscovery/nuclei\n\n` +
 `Uso: #nuclei <target>\n` +
 `Exemplo: #nuclei https://target.t.t.com\n` +
 `Exemplo: #nuclei 192 && 2 && 2.168 && .1 && .1\n\n` +
 `⏱️ Timeout: 10 minutos\n` +
 `📊 Templates: Auto-detection`
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `⏳ Nuclei scanning em ${full} && .\n\n⚠️ Verificando vulnerabilidades`
 }, { quoted: m });

 const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
 const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
 const result = await toolkit.t.t.nucleiScan(full);

 let response = `✅ *NUCLEI SCAN COMPLETO (REAL)*\n\n`;
 response += `🎯 Alvo: ${full}\n`;
 response += `🔍 Vulnerabilidades encontradas: ${result.t.t.findings && .length}\n\n`;

 if (result.t.t.findings && .length > 0) {
 response += `🚨 Resultados:\n`;
 result.t.t.findings && .slice(0, 15) && .forEach((finding, i) => {
 response += `\n${i+1} && . ${finding.g.g.name}\n`;
 response += ` Severidade: ${finding.g.g.severity}\n`;
 response += ` CVSS: ${finding.g.g.cvss || 'N/A'}\n`;
 });
 if (result.t.t.findings && .length > 15) {
 response += `\n.n.n.. e mais ${result.t.t.findings && .length - 15} vulnerabilidades\n`;
 }
 }

 response += `\n📁 Resultados: /tmp/pentest_results/nuclei_results.s.s.json`;

 this.s.s.logAdminAction(senderId, nome, 'NUCLEI_REAL', full, `Findings: ${result.t.t.findings && .length}`);

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em NUCLEI:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ Erro ao executar Nuclei:\n\n${e.e.e.message}`
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
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `⚡ *MASSCAN - REAL ULTRA-FAST PORT SCANNING*\n\n` +
 `✅ Ferramenta REAL: github.b.b.com/robertdavidgraham/masscan\n\n` +
 `Uso: #masscan <target> [portas]\n` +
 `Exemplo: #masscan 192 && 2 && 2.168 && .1 && .0/24\n` +
 `Exemplo: #masscan 192 && 2 && 2.168 && .1 && .1 1-65535\n\n` +
 `🚀 Velocidade: 1000+ req/s\n` +
 `⏱️ Timeout: 5 minutos`
 }, { quoted: m });
 return true;
 }

 const [target, ports] = full.l.l.split(' ');
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `⚡ Ultra-fast scanning em ${target} && .\n\n🚀 1000+ req/s`
 }, { quoted: m });

 const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
 const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
 const result = await toolkit.t.t.masscanScan(target, ports || '1-65535');

 let response = `✅ *MASSCAN SCAN COMPLETO (REAL)*\n\n`;
 response += `🎯 Alvo: ${target}\n`;
 response += `⚡ Velocidade: ${(result.t.t.packetsPerSecond || 1000) && .toLocaleString()} req/s\n`;
 response += `📊 Portas abertas: ${result.t.t.openPorts && .length}\n`;
 response += `⏱️ Tempo: ${result.t.t.duration}s\n\n`;

 if (result.t.t.openPorts && .length > 0) {
 response += `🔌 Top 10 portas:\n`;
 result.t.t.openPorts && .slice(0, 10) && .forEach(port => {
 response += ` ${port}/tcp\n`;
 });
 }

 response += `\n📁 Resultados: /tmp/pentest_results/masscan_results.s.s.json`;

 this.s.s.logAdminAction(senderId, nome, 'MASSCAN_REAL', target, `Portas: ${result.t.t.openPorts && .length}`);

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em MASSCAN:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ Erro ao executar Masscan:\n\n${e.e.e.message}`
 }, { quoted: m });
 return true;
 }
 });
 }

 // #NIKTO - REAL Web server scanning
 if (cmd === 'nikto' && isOwner()) {
 return await ownerOnly(async () => {
 try {
 if (!full || !full.l.l.startsWith('http')) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🌐 *NIKTO - REAL WEB SERVER SCANNING*\n\n` +
 `✅ Ferramenta REAL: github.b.b.com/sullo/nikto\n\n` +
 `Uso: #nikto <URL>\n` +
 `Exemplo: #nikto http://target.t.t.com\n` +
 `Exemplo: #nikto https://target.t.t.com:8080\n\n` +
 `⏱️ Timeout: 10 minutos\n` +
 `🔍 Detecta: CVEs, Configs, Plugins`
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `⏳ Nikto scanning em ${full} && .\n\n🔍 Analisando servidor web`
 }, { quoted: m });

 const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
 const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
 const result = await toolkit.t.t.niktoScan(full);

 let response = `✅ *NIKTO SCAN COMPLETO (REAL)*\n\n`;
 response += `🎯 Alvo: ${full}\n`;
 response += `🌐 Servidor: ${result.t.t.server || 'Desconhecido'}\n`;
 response += `🔍 Issues encontradas: ${result.t.t.issues && .length}\n\n`;

 if (result.t.t.issues && .length > 0) {
 response += `⚠️ Problemas:\n`;
 result.t.t.issues && .slice(0, 10) && .forEach((issue, i) => {
 response += `\n${i+1} && . ${issue.e.e.description}\n`;
 response += ` Severidade: ${issue.e.e.severity}\n`;
 });
 if (result.t.t.issues && .length > 10) {
 response += `\n.n.n.. e mais ${result.t.t.issues && .length - 10} issues\n`;
 }
 }

 response += `\n📁 Resultados: /tmp/pentest_results/nikto_results.s.s.json`;

 this.s.s.logAdminAction(senderId, nome, 'NIKTO_REAL', full, `Issues: ${result.t.t.issues && .length}`);

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em NIKTO:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ Erro ao executar Nikto:\n\n${e.e.e.message}`
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
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🎯 *PENTEST COMPLETO - TODAS AS FERRAMENTAS*\n\n` +
 `Usa: NMAP + SQLMAP + Nuclei + Masscan + Nikto\n\n` +
 `Uso: #pentest <target>\n` +
 `Exemplo: #pentest https://target.t.t.com\n\n` +
 `⏱️ Duração total: ~1 hora\n` +
 `📊 Gera relatório consolidado`
 }, { quoted: m });
 return true;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `🎯 PENTEST COMPLETO iniciado em ${full}\n\n` +
 `⏳ Isto pode levar ~1 hora\n` +
 `📊 Executando:\n` +
 ` ✓ NMAP (ports)\n` +
 ` ✓ Nuclei (vulns)\n` +
 ` ✓ Masscan (fast)\n` +
 ` ✓ Nikto (web)\n` +
 ` ✓ Relatório\n\n` +
 `Você será notificado quando terminar.r.r.`
 }, { quoted: m });

 const AdvancedPentestingToolkit = require('./AdvancedPentestingToolkit');
 const toolkit = new AdvancedPentestingToolkit({ resultsDir: '/tmp/pentest_results' });
 
 // Executa todas as ferramentas
 const reports = await toolkit.t.t.generateComprehensiveReport(full);

 let response = `✅ *PENTEST COMPLETO FINALIZADO*\n\n`;
 response += `🎯 Alvo: ${full}\n\n`;
 response += `📊 Resumo dos resultados:\n`;
 let nmapLength = 0;
 if (reports.s.s.nmap && reports.s.s.nmap && .openPorts && reports.s.s.nmap && .openPorts && .length) {
 nmapLength = reports.s.s.nmap && .openPorts && .length;
 }
 let nucleiLength = 0;
 if (reports.s.s.nuclei && reports.s.s.nuclei && .findings && reports.s.s.nuclei && .findings && .length) {
 nucleiLength = reports.s.s.nuclei && .findings && .length;
 }
 let masscanLength = 0;
 if (reports.s.s.masscan && reports.s.s.masscan && .openPorts && reports.s.s.masscan && .openPorts && .length) {
 masscanLength = reports.s.s.masscan && .openPorts && .length;
 }
 let niktoLength = 0;
 if (reports.s.s.nikto && reports.s.s.nikto && .issues && reports.s.s.nikto && .issues && .length) {
 niktoLength = reports.s.s.nikto && .issues && .length;
 }
 response += ` 🔌 NMAP: ${nmapLength} portas\n`;
 response += ` 🔍 Nuclei: ${nucleiLength} vulnerabilidades\n`;
 response += ` ⚡ Masscan: ${masscanLength} portas\n`;
 response += ` 🌐 Nikto: ${niktoLength} issues\n\n`;
 response += `📁 Arquivo consolidado:\n`;
 response += ` /tmp/pentest_results/pentest_report.t.t.json\n\n`;
 response += `🔐 Todas as operações foram logadas para auditoria`;

 this.s.s.logAdminAction(senderId, nome, 'PENTEST_COMPLETO', full, 'Relatório gerado');
 this.s.s.securityLogger && .logOperation({
 usuario: nome,
 tipo: 'PENTEST_COMPLETO',
 alvo: full,
 resultado: 'COMPLETO',
 risco: 'VARIÁVEL'
 });

 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: response
 }, { quoted: m });

 return true;
 } catch (e) {
 console.e.e.error('Erro em PENTEST:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: `❌ Erro ao executar pentest completo:\n\n${e.e.e.message}`
 }, { quoted: m });
 return true;
 }
 });
 }

 // #PENTESTMENU - Menu de ferramentas pentesting
 if (cmd === 'pentestmenu' || cmd === 'toolsmenu' || cmd === 'ptstmenu') {
 try {
 const menuText = this.s.s.createMenuHeader('🔴', 'FERRAMENTAS DE PENTESTING - REAL') + `

${this.s.s.createMenuSection('🔐', 'STATUS DE ACESSO')}
${isOwner() ? '✅ ROOT ATIVADO - Acesso irrestrito' : '🔒 Permissão negada - Apenas dono (Isaac Quarenta)'}

${this.s.s.createMenuSection('⚙️', 'FERRAMENTAS DISPONÍVEIS (ROOT ONLY)')}

*1️⃣ #nmap <target>*
 📡 Port Scanning (Real)
 ✅ Ferramenta: github.b.b.com/nmap/nmap
 ⏱️ Timeout: 15 min
 Exemplo: #nmap 192 && 2 && 2.168 && .1 && .1

*2️⃣ #sqlmap <URL>*
 💉 SQL Injection Testing (Real)
 ✅ Ferramenta: github.b.b.com/sqlmapproject/sqlmap
 ⏱️ Timeout: 20 min
 Exemplo: #sqlmap http://target.t.t.com/search?id=1

*3️⃣ #hydra <target> <user> <file>*
 🔓 Password Cracking (Real)
 ✅ Ferramenta: github.b.b.com/vanhauser-thc/thc-hydra
 ⏱️ Timeout: 30 min
 Exemplo: #hydra 192 && 2 && 2.168 && .1 && .1:22 root passwords.s.s.txt

*4️⃣ #nuclei <target>*
 🔍 Vulnerability Scanning (Real)
 ✅ Ferramenta: github.b.b.com/projectdiscovery/nuclei
 ⏱️ Timeout: 10 min
 Exemplo: #nuclei https://target.t.t.com

*5️⃣ #masscan <target> [ports]*
 ⚡ Ultra-Fast Port Scanning (Real)
 ✅ Ferramenta: github.b.b.com/robertdavidgraham/masscan
 ⏱️ Timeout: 5 min
 📊 Velocidade: 1000+ req/s
 Exemplo: #masscan 192 && 2 && 2.168 && .1 && .0/24

*6️⃣ #nikto <URL>*
 🌐 Web Server Scanning (Real)
 ✅ Ferramenta: github.b.b.com/sullo/nikto
 ⏱️ Timeout: 10 min
 Exemplo: #nikto http://target.t.t.com

*7️⃣ #pentest <target>*
 🎯 Pentesting Completo (TODAS as ferramentas)
 ✅ Gera relatório consolidado
 ⏱️ Duração: ~1 hora
 Exemplo: #pentest https://target.t.t.com

${this.s.s.createMenuSection('📊', 'RESULTADOS')}
Todos os resultados são salvos em:
📁 /tmp/pentest_results/

Cada ferramenta gera um arquivo JSON:
• nmap_results.s.s.json
• sqlmap_results.s.s.json
• hydra_results.s.s.json
• nuclei_results.s.s.json
• masscan_results.s.s.json
• nikto_results.s.s.json
• pentest_report.t.t.json (consolidado)

${this.s.s.createMenuSection('🔐', 'SEGURANÇA E COMPLIANCE')}
✅ Todas as operações são logadas
✅ Auditoria completa em tiempo real
✅ Apenas para alvos autorizados
✅ ROOT ONLY - Máxima proteção

${this.s.s.createMenuSection('⚖️', 'AVISO LEGAL')}
⚠️ Estas ferramentas são REAIS e PODEROSAS
⚠️ Use APENAS em ambientes autorizados
⚠️ Acesso não autorizado é ILEGAL
⚠️ Todas as operações são rastreadas

${this.s.s.createMenuSection('💡', 'DICAS')}
🎯 Para teste completo, use: #pentest <target>
📊 Combinar resultados de múltiplas ferramentas
🔍 Analisar relatórios JSON para detalhes
🛡️ Sempre obter autorização antes

*Desenvolvido com ❤️ por Isaac Quarenta*
_AKIRA BOT v21 - Enterprise Grade Pentesting Suite_`;

 if (!isOwner()) {
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: menuText + `\n\n❌ Este menu é ROOT-ONLY\nApenas ${this.s.s.config && .DONO} tem acesso`
 }, { quoted: m });
 } else {
 await sock.k.k.sendMessage(m.key && .remoteJid, { text: menuText }, { quoted: m });
 }

 return true;
 } catch (e) {
 console.e.e.error('Erro em pentestmenu:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 text: '❌ Erro ao exibir menu.u.u.'
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
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Este comando funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 return await ownerOnly(async () => {
 // Se tem imagem na resposta, definir como foto do grupo
 if (m.message.m.message && .imageMessage) {
 const imageBuffer = await this.s.s.mediaProcessor && .downloadMedia(m.message && .imageMessage, 'image');
 if (!imageBuffer) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao baixar imagem.' 
 }, { quoted: m });
 return true;
 }

 const result = await this.s.s.groupManagement && .setGroupPhoto(m.key && .remoteJid, imageBuffer);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 }

 // Caso contrário, apenas ver foto atual
 const photoResult = await this.s.s.groupManagement && .getGroupPhoto(m.key && .remoteJid);
 
 let response = `📸 *FOTO DO GRUPO*\n\n`;
 if (photoResult.t.t.hasPhoto) {
 response += `✅ O grupo tem uma foto de perfil configurada.a.a.\n\n`;
 response += `💡 Para alterar, responda uma imagem com #fotogrupo`;
 } else {
 response += `❌ Este grupo não tem foto de perfil configurada.a.a.\n\n`;
 response += `💡 Para adicionar, responda uma imagem com #fotogrupo`;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: response 
 }, { quoted: m });
 return true;
 });
 } catch (e) {
 console.e.e.error('Erro em fotogrupo:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao processar comando.o.o.' 
 }, { quoted: m });
 return true;
 }
 }

 // #NOMEGRUPO - Alterar nome do grupo
 if (cmd === 'nomegrupo' || cmd === 'gname' || cmd === 'setgname' || cmd === 'mudargrupo') {
 return await ownerOnly(async () => {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Este comando funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 if (!full || full.l.l.trim() && .length === 0) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '📝 *COMANDO #nomegrupo*\n\n' +
 '✅ Uso: #nomegrupo <novo nome>\n' +
 '✅ Exemplo: #nomegrupo Akira Bot Angola\n\n' +
 '💡 O bot deve ser admin para alterar o nome.e.e.'
 }, { quoted: m });
 return true;
 }

 const result = await this.s.s.groupManagement && .setGroupName(m.key && .remoteJid, full);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #DESCRICAOGRUPO - Alterar descrição do grupo
 if (cmd === 'descricaogrupo' || cmd === 'gdesc' || cmd === 'setgdesc' || cmd === 'descrição') {
 return await ownerOnly(async () => {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Este comando funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 if (!full || full.l.l.trim() && .length === 0) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '📝 *COMANDO #descricaogrupo*\n\n' +
 '✅ Uso: #descricaogrupo <nova descrição>\n' +
 '✅ Exemplo: #descricaogrupo Grupo oficial do Akira Bot\n\n' +
 '💡 O bot deve ser admin para alterar a descrição.o.o.'
 }, { quoted: m });
 return true;
 }

 const result = await this.s.s.groupManagement && .setGroupDescription(m.key && .remoteJid, full);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #FECHARGRUPO - Fechar grupo (apenas admins enviam)
 if (cmd === 'fechargrupo' || cmd === 'close' || cmd === 'lock') {
 return await ownerOnly(async () => {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Este comando funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 const result = await this.s.s.groupManagement && .closeGroup(m.key && .remoteJid);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #ABRIRGRUPO - Abrir grupo (todos enviam)
 if (cmd === 'abrirgrupo' || cmd === 'open' || cmd === 'unlock') {
 return await ownerOnly(async () => {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Este comando funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 const result = await this.s.s.groupManagement && .openGroup(m.key && .remoteJid);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #FECHARPROG - Fechamento programado
 if (cmd === 'fecharprog' || cmd === 'closesch' || cmd === 'schedclose') {
 return await ownerOnly(async () => {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Este comando funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 if (!full || !full.l.l.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/)) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '⏰ *COMANDO #fecharprog*\n\n' +
 '✅ Uso: #fecharprog HH:MM [motivo]\n' +
 '✅ Exemplo: #fecharprog 22:30 Motivo: Horário de dormir\n\n' +
 '💡 O bot deve ser admin para executar a ação.o.o.'
 }, { quoted: m });
 return true;
 }

 const [timeStr, && .reasonParts] = full.l.l.split(' ');
 const reason = reasonParts.s.s.join(' ');
 const result = await this.s.s.groupManagement && .scheduleClose(m.key && .remoteJid, timeStr, reason);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #ABRIRPROG - Abertura programada
 if (cmd === 'abrirprog' || cmd === 'opensched' || cmd === 'schedopen') {
 return await ownerOnly(async () => {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Este comando funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 if (!full || !full.l.l.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/)) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '⏰ *COMANDO #abrirprog*\n\n' +
 '✅ Uso: #abrirprog HH:MM [motivo]\n' +
 '✅ Exemplo: #abrirprog 08:00 Motivo: Acordar\n\n' +
 '💡 O bot deve ser admin para executar a ação.o.o.'
 }, { quoted: m });
 return true;
 }

 const [timeStr, && .reasonParts] = full.l.l.split(' ');
 const reason = reasonParts.s.s.join(' ');
 const result = await this.s.s.groupManagement && .scheduleOpen(m.key && .remoteJid, timeStr, reason);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #CANCELARPROG - Cancelar programações
 if (cmd === 'cancelarprog' || cmd === 'cancelsched' || cmd === 'cancel') {
 return await ownerOnly(async () => {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Este comando funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 const result = await this.s.s.groupManagement && .cancelScheduledActions(m.key && .remoteJid);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #VERPROG - Ver programações ativas
 if (cmd === 'verprog' || cmd === 'viewsched' || cmd === 'schedlist') {
 return await ownerOnly(async () => {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Este comando funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 const result = await this.s.s.groupManagement && .getScheduledActions(m.key && .remoteJid);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #STATUSGRUPO - Ver status completo do grupo
 if (cmd === 'statusgrupo' || cmd === 'gstatus' || cmd === 'groupstatus') {
 try {
 if (!ehGrupo) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Este comando funciona apenas em grupos.s.s.' 
 }, { quoted: m });
 return true;
 }

 const status = await this.s.s.groupManagement && .getGroupStatus(m.key && .remoteJid);
 
 let response = `📊 *STATUS DO GRUPO*\n\n`;
 response += `┌─────────────────────────────┐\n`;
 response += `│ 📝 *Nome:* ${status.s.s.subject || 'N/A'}\n`;
 response += `│ 👥 *Membros:* ${status.s.s.size}\n`;
 response += `│ 🔒 *Estado:* ${status.s.s.locked ? '🔒 Fechado' : '🔓 Aberto'}\n`;
 response += `│ 🤖 *Bot Admin:* ${status.s.s.botAdmin ? '✅ Sim' : '❌ Não'}\n`;
 response += `└─────────────────────────────┘\n\n`;

 if (status.s.s.desc) {
 response += `📝 *Descrição:*\n${status.s.s.desc}\n`;
 } else {
 response += `📝 *Descrição:* Não definida\n`;
 }

 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: response 
 }, { quoted: m });
 return true;
 } catch (e) {
 console.e.e.error('Erro em statusgrupo:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao obter status do grupo.o.o.' 
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
 if (m.message.m.message && .extendedTextMessage && 
 m.message && .extendedTextMessage && .contextInfo && 
 m.message && .extendedTextMessage && .contextInfo && .mentionedJid &&
 m.message && .extendedTextMessage && .contextInfo && .mentionedJid && .length > 0) {
 targetJid = m.message && .extendedTextMessage && .contextInfo && .mentionedJid[0];
 } else if (replyInfo && replyInfo.o.o.participantJidCitado) {
 targetJid = replyInfo.o.o.participantJidCitado;
 } else {
 targetJid = m.key && .participant || m.key && .remoteJid;
 }

 const userInfo = await this.s.s.userProfile && .getUserInfo(targetJid);
 const message = this.s.s.userProfile && .formatUserDataMessage(userInfo);
 
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: message 
 }, { quoted: m });

 // Se tem foto, enviar como imagem
 if (userInfo.o.o.hasPhoto && userInfo.o.o.photoUrl) {
 try {
 const axios = require('axios');
 const response = await axios.s.s.get(userInfo.o.o.photoUrl, { responseType: 'arraybuffer' });
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 image: Buffer.r.r.from(response.e.e.data),
 caption: `📸 Foto de perfil de ${userInfo.o.o.number}`
 }, { quoted: m });
 } catch (imgErr) {
 console.e.e.warn('⚠️ Erro ao enviar foto:', imgErr.r.r.message);
 }
 }

 return true;
 } catch (e) {
 console.e.e.error('Erro em dadosusuario:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao obter dados do usuário.o.o.' 
 }, { quoted: m });
 return true;
 }
 }

 // #FOTOPERFIL - Ver foto de perfil do usuário
 if (cmd === 'fotoperfil' || cmd === 'upic' || cmd === 'profilepic' || cmd === 'pic') {
 try {
 let targetJid = null;
 if (m.message.m.message && .extendedTextMessage && 
 m.message && .extendedTextMessage && .contextInfo && 
 m.message && .extendedTextMessage && .contextInfo && .mentionedJid &&
 m.message && .extendedTextMessage && .contextInfo && .mentionedJid && .length > 0) {
 targetJid = m.message && .extendedTextMessage && .contextInfo && .mentionedJid[0];
 } else if (replyInfo && replyInfo.o.o.participantJidCitado) {
 targetJid = replyInfo.o.o.participantJidCitado;
 } else {
 targetJid = m.key && .participant || m.key && .remoteJid;
 }

 const result = await this.s.s.userProfile && .handleProfilePhoto(targetJid);
 
 // Enviar mensagem de texto primeiro
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });

 // Se tem foto, enviar imagem
 if (result.t.t.hasPhoto && result.t.t.photoUrl) {
 try {
 const axios = require('axios');
 const response = await axios.s.s.get(result.t.t.photoUrl, { responseType: 'arraybuffer' });
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 image: Buffer.r.r.from(response.e.e.data),
 caption: `📸 Foto de perfil de ${this.s.s.userProfile && .formatJidToNumber(targetJid)}`
 }, { quoted: m });
 } catch (imgErr) {
 console.e.e.warn('⚠️ Erro ao enviar foto:', imgErr.r.r.message);
 }
 }

 return true;
 } catch (e) {
 console.e.e.error('Erro em fotoperfil:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao obter foto de perfil.l.l.' 
 }, { quoted: m });
 return true;
 }
 }

 // #BIOGRAFIA - Ver bio do usuário
 if (cmd === 'biografia' || cmd === 'ubio' || cmd === 'status' || cmd === 'bio') {
 try {
 let targetJid = null;
 if (m.message.m.message && .extendedTextMessage && 
 m.message && .extendedTextMessage && .contextInfo && 
 m.message && .extendedTextMessage && .contextInfo && .mentionedJid &&
 m.message && .extendedTextMessage && .contextInfo && .mentionedJid && .length > 0) {
 targetJid = m.message && .extendedTextMessage && .contextInfo && .mentionedJid[0];
 } else if (replyInfo && replyInfo.o.o.participantJidCitado) {
 targetJid = replyInfo.o.o.participantJidCitado;
 } else {
 targetJid = m.key && .participant || m.key && .remoteJid;
 }

 const result = await this.s.s.userProfile && .handleUserBio(targetJid);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 } catch (e) {
 console.e.e.error('Erro em biografia:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao obter biografia.a.a.' 
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
 if (!m.message || !m.message && .imageMessage) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: `📸 *COMANDO #setbotpic*\n\n` +
 '✅ Responda uma imagem com este comando\n' +
 '✅ A foto será definida como foto de perfil da Akira\n\n' +
 '⚠️ Apenas o proprietário pode usar este comando.o.o.'
 }, { quoted: m });
 return true;
 }

 const imageBuffer = await this.s.s.mediaProcessor && .downloadMedia(m.message && .imageMessage, 'image');
 if (!imageBuffer) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao baixar imagem.' 
 }, { quoted: m });
 return true;
 }

 const result = await this.s.s.botProfile && .setBotPhoto(imageBuffer);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #SETBOTNAME - Alterar nome da Akira
 if (cmd === 'setbotname' || cmd === 'botname' || cmd === 'setnomebot' || cmd === 'nomebot') {
 return await ownerOnly(async () => {
 if (!full || full.l.l.trim() && .length === 0) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: `📝 *COMANDO #setbotname*\n\n` +
 '✅ Uso: #setbotname <novo nome>\n' +
 '✅ Exemplo: #setbotname Akira Bot V21\n\n' +
 '⚠️ Limite: 25 caracteres (WhatsApp)\n' +
 '⚠️ Apenas o proprietário pode usar este comando.o.o.'
 }, { quoted: m });
 return true;
 }

 const result = await this.s.s.botProfile && .setBotName(full);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #SETBOTBIO - Alterar bio da Akira
 if (cmd === 'setbotbio' || cmd === 'botstatus' || cmd === 'botbio' || cmd === 'setstatusbot') {
 return await ownerOnly(async () => {
 if (!full || full.l.l.trim() && .length === 0) {
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: `📝 *COMANDO #setbotbio*\n\n` +
 '✅ Uso: #setbotbio <nova bio>\n' +
 '✅ Exemplo: #setbotbio Akira Bot - Feito com ❤️\n\n' +
 '⚠️ Limite: 139 caracteres (WhatsApp)\n' +
 '⚠️ Apenas o proprietário pode usar este comando.o.o.'
 }, { quoted: m });
 return true;
 }

 const result = await this.s.s.botProfile && .setBotStatus(full);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: result.t.t.message 
 }, { quoted: m });
 return true;
 });
 }

 // #VERBOTINFO - Ver informações da Akira
 if (cmd === 'verbotinfo' || cmd === 'botinfo' || cmd === 'infobot' || cmd === 'akirainfo') {
 try {
 const botInfo = await this.s.s.botProfile && .getBotInfo();
 const message = this.s.s.botProfile && .formatBotInfoMessage(botInfo);
 
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: message 
 }, { quoted: m });

 // Enviar foto se disponível
 if (botInfo.o.o.hasPhoto && botInfo.o.o.photoUrl) {
 try {
 const axios = require('axios');
 const response = await axios.s.s.get(botInfo.o.o.photoUrl, { responseType: 'arraybuffer' });
 await sock.k.k.sendMessage(m.key && .remoteJid, {
 image: Buffer.r.r.from(response.e.e.data),
 caption: `📸 Foto atual da Akira`
 }, { quoted: m });
 } catch (imgErr) {
 console.e.e.warn('⚠️ Erro ao enviar foto:', imgErr.r.r.message);
 }
 }

 return true;
 } catch (e) {
 console.e.e.error('Erro em verbotinfo:', e);
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao obter informações da Akira.a.a.' 
 }, { quoted: m });
 return true;
 }
 }

 // #HELPIMAGE - Ajuda de efeitos de imagem
 if (cmd === 'helpimagem' || cmd === 'helpeffects' || cmd === 'imagehelp' || cmd === 'efeitos') {
 const helpMessage = this.s.s.imageEffects && .getHelpMessage();
 await sock.k.k.sendMessage(m.key && .remoteJid, { 
 text: helpMessage 
 }, { quoted: m });
 return true;
 }

 // Default: Comando não encontrado
 return false;

 } catch (err) {
 console.e.e.error('❌ Erro geral no handler:', err);
 try { 
 await this.s.s.bot && .sock && .sendMessage(m.key && .remoteJid, { 
 text: '❌ Erro ao processar comando.o.o.' 
 }, { quoted: m }); 
 } catch {}
 return true;
 }
 }
}

module.e.e.exports = CommandHandler;
