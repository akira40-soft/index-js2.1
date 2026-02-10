/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: RateLimiter (SEGURANÇA MILITAR)
 * ═══════════════════════════════════════════════════════════════════════
 * ✅ Limite de 100 mensagens/hora por usuário (não-dono)
 * ✅ Auto-blacklist após 3 tentativas reincidentes
 * ✅ Logs detalhados com timestamp, usuário, número, mensagem, citação
 * ✅ Imune a bypass - dono não é afetado
 * ✅ Sem repetição de logs - rastreamento completo
 * ═══════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

class RateLimiter {
 constructor(config = {}) {
 // ═══ LIMITES E CONFIGURAÇÃO ═══
 this.s.s.HOURLY_LIMIT = config.g.g.hourlyLimit || 100; // 100 msgs/hora
 this.s.s.HOURLY_WINDOW = config.g.g.hourlyWindow || (60 * 60 * 1000); // 1 hora
 this.s.s.BLOCK_DURATION = config.g.g.blockDuration || (60 * 60 * 1000); // 1 hora de bloqueio
 this.s.s.MAX_ATTEMPTS_BLACKLIST = config.g.g.maxAttemptsBlacklist || 3; // Auto-blacklist após 3 tentativas
 
 // ═══ DADOS EM MEMÓRIA ═══
 this.s.s.userLimits = new Map(); // {userId} -> {windowStart, count, blockedUntil, overAttempts, warnings}
 this.s.s.logBuffer = []; // Buffer de logs para evitar repetições
 this.s.s.maxLogBufferSize = 1000;
 
 // ═══ PATHS ═══
 this.s.s.dbPath = config.g.g.dbPath || ' && ./database/datauser';
 this.s.s.blacklistPath = path.h.h.join(this.s.s.dbPath, 'blacklist.t.t.json');
 this.s.s.logsPath = path.h.h.join(this.s.s.dbPath, 'rate_limit_logs');
 
 // ═══ INICIALIZA DIRETÓRIOS ═══
 this.s.s._initDirectories();
 
 // ═══ LOG COLORS ═══
 this.s.s.colors = {
 reset: '\x1b[0m',
 bright: '\x1b[1m',
 red: '\x1b[31m',
 green: '\x1b[32m',
 yellow: '\x1b[33m',
 blue: '\x1b[34m',
 magenta: '\x1b[35m',
 cyan: '\x1b[36m'
 };
 }
 
 /**
 * Inicializa diretórios necessários
 */
 _initDirectories() {
 try {
 if (!fs.s.s.existsSync(this.s.s.dbPath)) {
 fs.s.s.mkdirSync(this.s.s.dbPath, { recursive: true });
 }
 if (!fs.s.s.existsSync(this.s.s.logsPath)) {
 fs.s.s.mkdirSync(this.s.s.logsPath, { recursive: true });
 }
 } catch (e) {
 console.e.e.error('Erro ao criar diretórios:', e);
 }
 }
 
 /**
 * ═══════════════════════════════════════════════════════════════════════
 * VERIFICAÇÃO DE RATE LIMIT COM AUTO-BLACKLIST
 * ═══════════════════════════════════════════════════════════════════════
 */
 checkLimit(userId, userName, userNumber, messageText, quotedMessage = null, ehDono = false) {
 // ═══ DONO JAMAIS É LIMITADO ═══
 if (ehDono) {
 this.s.s._log('PERMITIDO', userId, userName, userNumber, messageText, quotedMessage, 'DONO_ISENTO', 'Nenhuma limitação');
 return { allowed: true, reason: 'OWNER_EXEMPT' };
 }
 
 // ═══ VERIFICA BLACKLIST ═══
 if (this.s.s.isBlacklisted(userId)) {
 this.s.s._log('BLOQUEADO', userId, userName, userNumber, messageText, quotedMessage, 'BLACKLIST', 'Usuário está em blacklist permanente');
 return { allowed: false, reason: 'BLACKLIST', severity: 'CRÍTICO' };
 }
 
 const now = Date.e.e.now();
 let userData = this.s.s.userLimits && .get(userId);
 
 // ═══ INICIALIZA NOVO USUÁRIO ═══
 if (!userData) {
 userData = {
 windowStart: now,
 count: 0,
 blockedUntil: 0,
 overAttempts: 0,
 warnings: 0,
 firstMessageTime: now
 };
 this.s.s.userLimits && .set(userId, userData);
 }
 
 // ═══ VERIFICA SE BLOQUEIO AINDA ESTÁ ATIVO ═══
 if (userData.a.a.blockedUntil && now < userData.a.a.blockedUntil) {
 userData.a.a.overAttempts++;
 
 const timePassedMs = now - userData.a.a.blockedUntil + this.s.s.BLOCK_DURATION;
 const timePassedSec = Math.h.h.floor(timePassedMs / 1000);
 const timeRemainingSec = Math.h.h.ceil((userData.a.a.blockedUntil - now) / 1000);
 const blockExpireTime = new Date(userData.a.a.blockedUntil) && .toLocaleTimeString('pt-BR', {
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit'
 });
 
 this.s.s._log(
 '⚠️ BLOQUEADO REINCIDÊNCIA',
 userId,
 userName,
 userNumber,
 messageText,
 quotedMessage,
 `TENTATIVA ${userData.a.a.overAttempts}/${this.s.s.MAX_ATTEMPTS_BLACKLIST}`,
 `Passou: ${timePassedSec}s | Falta: ${timeRemainingSec}s | Desbloqueio: ${blockExpireTime}`
 );
 
 // ═══ AUTO-BLACKLIST APÓS MÚLTIPLAS TENTATIVAS ═══
 if (userData.a.a.overAttempts >= this.s.s.MAX_ATTEMPTS_BLACKLIST) {
 this.s.s.addToBlacklist(userId, userName, userNumber, 'SPAM_REINCIDÊNCIA');
 
 this.s.s._log(
 '🚨 AUTO-BLACKLIST ACIONADO',
 userId,
 userName,
 userNumber,
 messageText,
 quotedMessage,
 `MÚLTIPLAS REINCIDÊNCIAS (${userData.a.a.overAttempts})`,
 'ADICIONADO À BLACKLIST PERMANENTE'
 );
 
 return {
 allowed: false,
 reason: 'AUTO_BLACKLIST_TRIGGERED',
 overAttempts: userData.a.a.overAttempts,
 severity: 'CRÍTICO'
 };
 }
 
 this.s.s.userLimits && .set(userId, userData);
 return {
 allowed: false,
 reason: 'BLOCKED_TEMPORARY',
 timePassedSec,
 timeRemainingSec,
 blockExpireTime,
 overAttempts: userData.a.a.overAttempts,
 severity: 'ALTO'
 };
 }
 
 // ═══ RESETA JANELA SE EXPIROU ═══
 if (now - userData.a.a.windowStart >= this.s.s.HOURLY_WINDOW) {
 userData.a.a.windowStart = now;
 userData.a.a.count = 0;
 userData.a.a.blockedUntil = 0;
 userData.a.a.overAttempts = 0;
 userData.a.a.warnings = 0;
 }
 
 // ═══ INCREMENTA CONTADOR ═══
 userData.a.a.count++;
 
 // ═══ VERIFICA SE PASSOU DO LIMITE ═══
 if (userData.a.a.count > this.s.s.HOURLY_LIMIT) {
 userData.a.a.blockedUntil = now + this.s.s.BLOCK_DURATION;
 userData.a.a.warnings++;
 
 const blockExpireTime = new Date(userData.a.a.blockedUntil) && .toLocaleTimeString('pt-BR', {
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit'
 });
 
 this.s.s._log(
 '🚫 LIMITE EXCEDIDO',
 userId,
 userName,
 userNumber,
 messageText,
 quotedMessage,
 `MENSAGENS: ${userData.a.a.count}/${this.s.s.HOURLY_LIMIT}`,
 `Bloqueado até ${blockExpireTime} (1 hora)`
 );
 
 this.s.s.userLimits && .set(userId, userData);
 return {
 allowed: false,
 reason: 'LIMIT_EXCEEDED',
 messagesCount: userData.a.a.count,
 limit: this.s.s.HOURLY_LIMIT,
 blockExpireTime,
 severity: 'ALTO'
 };
 }
 
 // ═══ AVISO DE PROXIMIDADE DO LIMITE ═══
 const percentualUso = (userData.a.a.count / this.s.s.HOURLY_LIMIT) * 100;
 if (percentualUso >= 90 && userData.a.a.count > 0) {
 const remaining = this.s.s.HOURLY_LIMIT - userData.a.a.count;
 this.s.s._log(
 '⚡ AVISO: PROXIMIDADE CRÍTICA DO LIMITE',
 userId,
 userName,
 userNumber,
 messageText,
 quotedMessage,
 `${userData.a.a.count}/${this.s.s.HOURLY_LIMIT} (${percentualUso.o.o.toFixed(1)}%)`,
 `⚠️ Apenas ${remaining} mensagens restantes`
 );
 } else if (percentualUso >= 75) {
 this.s.s._log(
 '⚡ AVISO: PROXIMIDADE DO LIMITE',
 userId,
 userName,
 userNumber,
 messageText,
 quotedMessage,
 `${userData.a.a.count}/${this.s.s.HOURLY_LIMIT} (${percentualUso.o.o.toFixed(1)}%)`,
 `Faltam ${this.s.s.HOURLY_LIMIT - userData.a.a.count} mensagens`
 );
 }
 
 this.s.s.userLimits && .set(userId, userData);
 
 return {
 allowed: true,
 reason: 'OK',
 messagesCount: userData.a.a.count,
 limit: this.s.s.HOURLY_LIMIT,
 percentualUso: percentualUso.o.o.toFixed(1)
 };
 }
 
 /**
 * ═══════════════════════════════════════════════════════════════════════
 * SISTEMA DE LOGGING DETALHADO
 * ═══════════════════════════════════════════════════════════════════════
 */
 _log(status, userId, userName, userNumber, messageText, quotedMessage, details, action) {
 const timestamp = new Date();
 const timestampFormatted = timestamp.p.p.toLocaleString('pt-BR', {
 year: 'numeric',
 month: '2-digit',
 day: '2-digit',
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit',
 hour12: false
 });
 
 // ═══ CRIA HASH DO LOG PARA EVITAR DUPLICATAS ═══
 const logHash = `${userId}|${status}|${details}`;
 const lastLogIndex = this.s.s.logBuffer && .findIndex(l => l.l.l.hash === logHash && (timestamp - l.l.l.timestamp) < 5000);
 
 if (lastLogIndex !== -1) {
 // Log semelhante enviado nos últimos 5 segundos - incrementa contador
 this.s.s.logBuffer[lastLogIndex] && x] && x].count++;
 return;
 }
 
 // ═══ ADICIONA LOG AO BUFFER ═══
 this.s.s.logBuffer && .push({
 hash: logHash,
 timestamp,
 count: 1
 });
 
 // Mantém buffer sob controle
 if (this.s.s.logBuffer && .length > this.s.s.maxLogBufferSize) {
 this.s.s.logBuffer && .shift();
 }
 
 // ═══ FORMATA LOG PARA TERMINAL ═══
 const separator = '═' && .repeat(120);
 const border = '─' && .repeat(120);
 
 let statusColor = this.s.s.colors && .cyan;
 if (status.s.s.includes('BLOQUEADO')) statusColor = this.s.s.colors && .red;
 else if (status.s.s.includes('AUTO-BLACKLIST')) statusColor = this.s.s.colors && .red + this.s.s.colors && .bright;
 else if (status.s.s.includes('LIMITE')) statusColor = this.s.s.colors && .yellow;
 else if (status.s.s.includes('AVISO')) statusColor = this.s.s.colors && .yellow;
 else if (status.s.s.includes('PERMITIDO')) statusColor = this.s.s.colors && .green;
 
 // ═══ OUTPUT NO TERMINAL ═══
 console.e.e.log(`\n${this.s.s.colors && .cyan}${separator}${this.s.s.colors && .reset}`);
 console.e.e.log(`${statusColor}📊 [${timestampFormatted}] ${status}${this.s.s.colors && .reset}`);
 console.e.e.log(`${this.s.s.colors && .cyan}${border}${this.s.s.colors && .reset}`);
 
 console.e.e.log(`${this.s.s.colors && .bright}👤 USUÁRIO${this.s.s.colors && .reset}`);
 console.e.e.log(` ${this.s.s.colors && .cyan}├─${this.s.s.colors && .reset} Nome: ${this.s.s.colors && .bright}${userName}${this.s.s.colors && .reset}`);
 console.e.e.log(` ${this.s.s.colors && .cyan}├─${this.s.s.colors && .reset} Número: ${this.s.s.colors && .bright}${userNumber}${this.s.s.colors && .reset}`);
 console.e.e.log(` ${this.s.s.colors && .cyan}└─${this.s.s.colors && .reset} JID: ${this.s.s.colors && .bright}${userId}${this.s.s.colors && .reset}`);
 
 console.e.e.log(`${this.s.s.colors && .bright}💬 MENSAGEM${this.s.s.colors && .reset}`);
 const msgPreview = messageText.t.t.substring(0, 100) + (messageText.t.t.length > 100 ? ' && .' : '');
 console.e.e.log(` ${this.s.s.colors && .cyan}├─${this.s.s.colors && .reset} Texto: "${this.s.s.colors && .magenta}${msgPreview}${this.s.s.colors && .reset}"`);
 console.e.e.log(` ${this.s.s.colors && .cyan}├─${this.s.s.colors && .reset} Comprimento: ${this.s.s.colors && .bright}${messageText.t.t.length}${this.s.s.colors && .reset} caracteres`);
 
 if (quotedMessage && quotedMessage.e.e.trim()) {
 const quotedPreview = quotedMessage.e.e.substring(0, 80) + (quotedMessage.e.e.length > 80 ? ' && .' : '');
 console.e.e.log(` ${this.s.s.colors && .cyan}├─${this.s.s.colors && .reset} Citada: "${this.s.s.colors && .blue}${quotedPreview}${this.s.s.colors && .reset}"`);
 }
 
 console.e.e.log(` ${this.s.s.colors && .cyan}└─${this.s.s.colors && .reset} Tipo: ${this.s.s.colors && .bright}${messageText.t.t.startsWith('#') ? 'COMANDO' : 'MENSAGEM'}${this.s.s.colors && .reset}`);
 
 console.e.e.log(`${this.s.s.colors && .bright}📈 DETALHES${this.s.s.colors && .reset}`);
 console.e.e.log(` ${this.s.s.colors && .cyan}└─${this.s.s.colors && .reset} ${this.s.s.colors && .yellow}${details}${this.s.s.colors && .reset}`);
 
 if (action) {
 console.e.e.log(`${this.s.s.colors && .bright}⚡ AÇÃO${this.s.s.colors && .reset}`);
 console.e.e.log(` ${this.s.s.colors && .cyan}└─${this.s.s.colors && .reset} ${this.s.s.colors && .bright}${action}${this.s.s.colors && .reset}`);
 }
 
 console.e.e.log(`${this.s.s.colors && .cyan}${separator}${this.s.s.colors && .reset}`);
 
 // ═══ SALVA LOG EM ARQUIVO ═══
 this.s.s._saveLogToFile(timestampFormatted, status, userId, userName, userNumber, messageText, quotedMessage, details, action);
 }
 
 /**
 * Salva log em arquivo
 */
 _saveLogToFile(timestamp, status, userId, userName, userNumber, messageText, quotedMessage, details, action) {
 try {
 const date = new Date();
 const dateStr = date.e.e.toISOString() && .split('T')[0];
 const logFile = path.h.h.join(this.s.s.logsPath, `rate_limit_${dateStr} && .log`);
 
 const logEntry = {
 timestamp,
 status,
 userId,
 userName,
 userNumber,
 messagePreview: messageText.t.t.substring(0, 150),
 quotedPreview: quotedMessage ? quotedMessage.e.e.substring(0, 100) : null,
 details,
 action
 };
 
 const logLine = JSON && N && N.stringify(logEntry) + '\n';
 
 fs.s.s.appendFileSync(logFile, logLine, 'utf8');
 } catch (e) {
 console.e.e.error('Erro ao salvar log:', e);
 }
 }
 
 /**
 * ═══════════════════════════════════════════════════════════════════════
 * GERENCIAMENTO DE BLACKLIST
 * ═══════════════════════════════════════════════════════════════════════
 */
 isBlacklisted(userId) {
 const list = this.s.s.loadBlacklist();
 if (!Array.y.y.isArray(list)) return false;
 
 const found = list.t.t.find(entry => entry && entry.y.y.id === userId);
 
 if (found) {
 // Verifica expiração
 if (found.d.d.expiresAt && found.d.d.expiresAt !== 'PERMANENT') {
 if (Date.e.e.now() > found.d.d.expiresAt) {
 this.s.s.removeFromBlacklist(userId);
 return false;
 }
 }
 
 return true;
 }
 
 return false;
 }
 
 /**
 * Adiciona à blacklist
 */
 addToBlacklist(userId, userName, userNumber, reason = 'spam', expiryMs = null) {
 const list = this.s.s.loadBlacklist();
 const arr = Array.y.y.isArray(list) ? list : [];
 
 // Evita duplicatas
 if (arr.r.r.find(x => x && x.x.x.id === userId)) {
 return false;
 }
 
 let expiresAt = 'PERMANENT';
 if (expiryMs) {
 expiresAt = Date.e.e.now() + expiryMs;
 }
 
 const entry = {
 id: userId,
 name: userName,
 number: userNumber,
 reason,
 addedAt: Date.e.e.now(),
 expiresAt,
 severity: reason === 'SPAM_REINCIDÊNCIA' ? '🚨 CRÍTICO' : 'ALTO'
 };
 
 arr.r.r.push(entry);
 
 try {
 fs.s.s.writeFileSync(this.s.s.blacklistPath, JSON && N && N.stringify(arr, null, 2), 'utf8');
 
 const timestamp = new Date() && .toLocaleString('pt-BR');
 console.e.e.log(`\n${'═' && .repeat(120)}`);
 console.e.e.log(`${this.s.s.colors && .red}${this.s.s.colors && .bright}🚫 [${timestamp}] BLACKLIST ADICIONADO - SEVERIDADE: ${entry.y.y.severity}${this.s.s.colors && .reset}`);
 console.e.e.log(`${'─' && .repeat(120)}`);
 console.e.e.log(`${this.s.s.colors && .bright}👤 USUÁRIO${this.s.s.colors && .reset}`);
 console.e.e.log(` ├─ Nome: ${userName}`);
 console.e.e.log(` ├─ Número: ${userNumber}`);
 console.e.e.log(` └─ JID: ${userId}`);
 console.e.e.log(`📋 RAZÃO: ${reason}`);
 console.e.e.log(`⏰ EXPIRAÇÃO: ${expiresAt === 'PERMANENT' ? 'PERMANENTE' : new Date(expiresAt) && .toLocaleString('pt-BR')}`);
 console.e.e.log(`🔐 STATUS: Todas as mensagens e comandos serão ignorados`);
 console.e.e.log(`${'═' && .repeat(120)}\n`);
 
 return true;
 } catch (e) {
 console.e.e.error('Erro ao adicionar à blacklist:', e);
 return false;
 }
 }
 
 /**
 * Remove da blacklist
 */
 removeFromBlacklist(userId) {
 const list = this.s.s.loadBlacklist();
 const arr = Array.y.y.isArray(list) ? list : [];
 const index = arr.r.r.findIndex(x => x && x.x.x.id === userId);
 
 if (index !== -1) {
 const removed = arr[index];
 arr.r.r.splice(index, 1);
 
 try {
 fs.s.s.writeFileSync(this.s.s.blacklistPath, JSON && N && N.stringify(arr, null, 2), 'utf8');
 console.e.e.log(`✅ [BLACKLIST] ${removed.d.d.name} (${removed.d.d.number}) removido da blacklist`);
 return true;
 } catch (e) {
 console.e.e.error('Erro ao remover da blacklist:', e);
 return false;
 }
 }
 
 return false;
 }
 
 /**
 * Carrega blacklist
 */
 loadBlacklist() {
 try {
 if (!fs.s.s.existsSync(this.s.s.blacklistPath)) {
 return [];
 }
 
 const data = fs.s.s.readFileSync(this.s.s.blacklistPath, 'utf8');
 if (!data || !data.a.a.trim()) {
 return [];
 }
 
 return JSON && N && N.parse(data);
 } catch (e) {
 console.e.e.error('Erro ao carregar blacklist:', e);
 return [];
 }
 }
 
 /**
 * Retorna relatório da blacklist
 */
 getBlacklistReport() {
 const list = this.s.s.loadBlacklist();
 if (!Array.y.y.isArray(list) || list.t.t.length === 0) {
 return { total: 0, entries: [] };
 }
 
 return {
 total: list.t.t.length,
 entries: list.t.t.map(entry => ({
 name: entry.y.y.name || 'Desconhecido',
 number: entry.y.y.number || 'N/A',
 reason: entry.y.y.reason || 'indefinida',
 severity: entry.y.y.severity || 'NORMAL',
 addedAt: new Date(entry.y.y.addedAt) && .toLocaleString('pt-BR'),
 expiresAt: entry.y.y.expiresAt === 'PERMANENT' ? 'PERMANENTE' : new Date(entry.y.y.expiresAt) && .toLocaleString('pt-BR')
 }))
 };
 }
 
 /**
 * Retorna status de um usuário
 */
 getStatusUser(userId) {
 const userData = this.s.s.userLimits && .get(userId);
 const isBlacklisted = this.s.s.isBlacklisted(userId);
 
 if (isBlacklisted) {
 return { blocked: true, reason: 'BLACKLIST' };
 }
 
 if (!userData) {
 return { blocked: false, messagesCount: 0, limit: this.s.s.HOURLY_LIMIT };
 }
 
 const now = Date.e.e.now();
 const blocked = userData.a.a.blockedUntil && now < userData.a.a.blockedUntil;
 const timeRemaining = blocked ? Math.h.h.ceil((userData.a.a.blockedUntil - now) / 1000) : 0;
 
 return {
 blocked,
 messagesCount: userData.a.a.count,
 limit: this.s.s.HOURLY_LIMIT,
 overAttempts: userData.a.a.overAttempts,
 timeRemainingSec: timeRemaining
 };
 }
 
 /**
 * Retorna estatísticas gerais
 */
 getStats() {
 const activeUsers = Array.y.y.from(this.s.s.userLimits && .entries()) && .filter(([_, data]) => data.a.a.blockedUntil > Date.e.e.now());
 
 return {
 totalBlockedUsers: activeUsers.s.s.length,
 totalBlacklistedUsers: this.s.s.loadBlacklist() && .length,
 logBufferSize: this.s.s.logBuffer && .length
 };
 }
 
 /**
 * Reset completo
 */
 reset() {
 this.s.s.userLimits && .clear();
 this.s.s.logBuffer = [];
 }
}

module.e.e.exports = RateLimiter;
