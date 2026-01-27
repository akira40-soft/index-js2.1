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
    this.HOURLY_LIMIT = config.hourlyLimit || 100; // 100 msgs/hora
    this.HOURLY_WINDOW = config.hourlyWindow || (60 * 60 * 1000); // 1 hora
    this.BLOCK_DURATION = config.blockDuration || (60 * 60 * 1000); // 1 hora de bloqueio
    this.MAX_ATTEMPTS_BLACKLIST = config.maxAttemptsBlacklist || 3; // Auto-blacklist após 3 tentativas
    
    // ═══ DADOS EM MEMÓRIA ═══
    this.userLimits = new Map(); // {userId} -> {windowStart, count, blockedUntil, overAttempts, warnings}
    this.logBuffer = []; // Buffer de logs para evitar repetições
    this.maxLogBufferSize = 1000;
    
    // ═══ PATHS ═══
    this.dbPath = config.dbPath || './database/datauser';
    this.blacklistPath = path.join(this.dbPath, 'blacklist.json');
    this.logsPath = path.join(this.dbPath, 'rate_limit_logs');
    
    // ═══ INICIALIZA DIRETÓRIOS ═══
    this._initDirectories();
    
    // ═══ LOG COLORS ═══
    this.colors = {
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
      if (!fs.existsSync(this.dbPath)) {
        fs.mkdirSync(this.dbPath, { recursive: true });
      }
      if (!fs.existsSync(this.logsPath)) {
        fs.mkdirSync(this.logsPath, { recursive: true });
      }
    } catch (e) {
      console.error('Erro ao criar diretórios:', e);
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
      this._log('PERMITIDO', userId, userName, userNumber, messageText, quotedMessage, 'DONO_ISENTO', 'Nenhuma limitação');
      return { allowed: true, reason: 'OWNER_EXEMPT' };
    }
    
    // ═══ VERIFICA BLACKLIST ═══
    if (this.isBlacklisted(userId)) {
      this._log('BLOQUEADO', userId, userName, userNumber, messageText, quotedMessage, 'BLACKLIST', 'Usuário está em blacklist permanente');
      return { allowed: false, reason: 'BLACKLIST', severity: 'CRÍTICO' };
    }
    
    const now = Date.now();
    let userData = this.userLimits.get(userId);
    
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
      this.userLimits.set(userId, userData);
    }
    
    // ═══ VERIFICA SE BLOQUEIO AINDA ESTÁ ATIVO ═══
    if (userData.blockedUntil && now < userData.blockedUntil) {
      userData.overAttempts++;
      
      const timePassedMs = now - userData.blockedUntil + this.BLOCK_DURATION;
      const timePassedSec = Math.floor(timePassedMs / 1000);
      const timeRemainingSec = Math.ceil((userData.blockedUntil - now) / 1000);
      const blockExpireTime = new Date(userData.blockedUntil).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      this._log(
        '⚠️ BLOQUEADO REINCIDÊNCIA',
        userId,
        userName,
        userNumber,
        messageText,
        quotedMessage,
        `TENTATIVA ${userData.overAttempts}/${this.MAX_ATTEMPTS_BLACKLIST}`,
        `Passou: ${timePassedSec}s | Falta: ${timeRemainingSec}s | Desbloqueio: ${blockExpireTime}`
      );
      
      // ═══ AUTO-BLACKLIST APÓS MÚLTIPLAS TENTATIVAS ═══
      if (userData.overAttempts >= this.MAX_ATTEMPTS_BLACKLIST) {
        this.addToBlacklist(userId, userName, userNumber, 'SPAM_REINCIDÊNCIA');
        
        this._log(
          '🚨 AUTO-BLACKLIST ACIONADO',
          userId,
          userName,
          userNumber,
          messageText,
          quotedMessage,
          `MÚLTIPLAS REINCIDÊNCIAS (${userData.overAttempts})`,
          'ADICIONADO À BLACKLIST PERMANENTE'
        );
        
        return {
          allowed: false,
          reason: 'AUTO_BLACKLIST_TRIGGERED',
          overAttempts: userData.overAttempts,
          severity: 'CRÍTICO'
        };
      }
      
      this.userLimits.set(userId, userData);
      return {
        allowed: false,
        reason: 'BLOCKED_TEMPORARY',
        timePassedSec,
        timeRemainingSec,
        blockExpireTime,
        overAttempts: userData.overAttempts,
        severity: 'ALTO'
      };
    }
    
    // ═══ RESETA JANELA SE EXPIROU ═══
    if (now - userData.windowStart >= this.HOURLY_WINDOW) {
      userData.windowStart = now;
      userData.count = 0;
      userData.blockedUntil = 0;
      userData.overAttempts = 0;
      userData.warnings = 0;
    }
    
    // ═══ INCREMENTA CONTADOR ═══
    userData.count++;
    
    // ═══ VERIFICA SE PASSOU DO LIMITE ═══
    if (userData.count > this.HOURLY_LIMIT) {
      userData.blockedUntil = now + this.BLOCK_DURATION;
      userData.warnings++;
      
      const blockExpireTime = new Date(userData.blockedUntil).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      this._log(
        '🚫 LIMITE EXCEDIDO',
        userId,
        userName,
        userNumber,
        messageText,
        quotedMessage,
        `MENSAGENS: ${userData.count}/${this.HOURLY_LIMIT}`,
        `Bloqueado até ${blockExpireTime} (1 hora)`
      );
      
      this.userLimits.set(userId, userData);
      return {
        allowed: false,
        reason: 'LIMIT_EXCEEDED',
        messagesCount: userData.count,
        limit: this.HOURLY_LIMIT,
        blockExpireTime,
        severity: 'ALTO'
      };
    }
    
    // ═══ AVISO DE PROXIMIDADE DO LIMITE ═══
    const percentualUso = (userData.count / this.HOURLY_LIMIT) * 100;
    if (percentualUso >= 90 && userData.count > 0) {
      const remaining = this.HOURLY_LIMIT - userData.count;
      this._log(
        '⚡ AVISO: PROXIMIDADE CRÍTICA DO LIMITE',
        userId,
        userName,
        userNumber,
        messageText,
        quotedMessage,
        `${userData.count}/${this.HOURLY_LIMIT} (${percentualUso.toFixed(1)}%)`,
        `⚠️ Apenas ${remaining} mensagens restantes`
      );
    } else if (percentualUso >= 75) {
      this._log(
        '⚡ AVISO: PROXIMIDADE DO LIMITE',
        userId,
        userName,
        userNumber,
        messageText,
        quotedMessage,
        `${userData.count}/${this.HOURLY_LIMIT} (${percentualUso.toFixed(1)}%)`,
        `Faltam ${this.HOURLY_LIMIT - userData.count} mensagens`
      );
    }
    
    this.userLimits.set(userId, userData);
    
    return {
      allowed: true,
      reason: 'OK',
      messagesCount: userData.count,
      limit: this.HOURLY_LIMIT,
      percentualUso: percentualUso.toFixed(1)
    };
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * SISTEMA DE LOGGING DETALHADO
   * ═══════════════════════════════════════════════════════════════════════
   */
  _log(status, userId, userName, userNumber, messageText, quotedMessage, details, action) {
    const timestamp = new Date();
    const timestampFormatted = timestamp.toLocaleString('pt-BR', {
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
    const lastLogIndex = this.logBuffer.findIndex(l => l.hash === logHash && (timestamp - l.timestamp) < 5000);
    
    if (lastLogIndex !== -1) {
      // Log semelhante enviado nos últimos 5 segundos - incrementa contador
      this.logBuffer[lastLogIndex].count++;
      return;
    }
    
    // ═══ ADICIONA LOG AO BUFFER ═══
    this.logBuffer.push({
      hash: logHash,
      timestamp,
      count: 1
    });
    
    // Mantém buffer sob controle
    if (this.logBuffer.length > this.maxLogBufferSize) {
      this.logBuffer.shift();
    }
    
    // ═══ FORMATA LOG PARA TERMINAL ═══
    const separator = '═'.repeat(120);
    const border = '─'.repeat(120);
    
    let statusColor = this.colors.cyan;
    if (status.includes('BLOQUEADO')) statusColor = this.colors.red;
    else if (status.includes('AUTO-BLACKLIST')) statusColor = this.colors.red + this.colors.bright;
    else if (status.includes('LIMITE')) statusColor = this.colors.yellow;
    else if (status.includes('AVISO')) statusColor = this.colors.yellow;
    else if (status.includes('PERMITIDO')) statusColor = this.colors.green;
    
    // ═══ OUTPUT NO TERMINAL ═══
    console.log(`\n${this.colors.cyan}${separator}${this.colors.reset}`);
    console.log(`${statusColor}📊 [${timestampFormatted}] ${status}${this.colors.reset}`);
    console.log(`${this.colors.cyan}${border}${this.colors.reset}`);
    
    console.log(`${this.colors.bright}👤 USUÁRIO${this.colors.reset}`);
    console.log(`  ${this.colors.cyan}├─${this.colors.reset} Nome: ${this.colors.bright}${userName}${this.colors.reset}`);
    console.log(`  ${this.colors.cyan}├─${this.colors.reset} Número: ${this.colors.bright}${userNumber}${this.colors.reset}`);
    console.log(`  ${this.colors.cyan}└─${this.colors.reset} JID: ${this.colors.bright}${userId}${this.colors.reset}`);
    
    console.log(`${this.colors.bright}💬 MENSAGEM${this.colors.reset}`);
    const msgPreview = messageText.substring(0, 100) + (messageText.length > 100 ? '...' : '');
    console.log(`  ${this.colors.cyan}├─${this.colors.reset} Texto: "${this.colors.magenta}${msgPreview}${this.colors.reset}"`);
    console.log(`  ${this.colors.cyan}├─${this.colors.reset} Comprimento: ${this.colors.bright}${messageText.length}${this.colors.reset} caracteres`);
    
    if (quotedMessage && quotedMessage.trim()) {
      const quotedPreview = quotedMessage.substring(0, 80) + (quotedMessage.length > 80 ? '...' : '');
      console.log(`  ${this.colors.cyan}├─${this.colors.reset} Citada: "${this.colors.blue}${quotedPreview}${this.colors.reset}"`);
    }
    
    console.log(`  ${this.colors.cyan}└─${this.colors.reset} Tipo: ${this.colors.bright}${messageText.startsWith('#') ? 'COMANDO' : 'MENSAGEM'}${this.colors.reset}`);
    
    console.log(`${this.colors.bright}📈 DETALHES${this.colors.reset}`);
    console.log(`  ${this.colors.cyan}└─${this.colors.reset} ${this.colors.yellow}${details}${this.colors.reset}`);
    
    if (action) {
      console.log(`${this.colors.bright}⚡ AÇÃO${this.colors.reset}`);
      console.log(`  ${this.colors.cyan}└─${this.colors.reset} ${this.colors.bright}${action}${this.colors.reset}`);
    }
    
    console.log(`${this.colors.cyan}${separator}${this.colors.reset}`);
    
    // ═══ SALVA LOG EM ARQUIVO ═══
    this._saveLogToFile(timestampFormatted, status, userId, userName, userNumber, messageText, quotedMessage, details, action);
  }
  
  /**
   * Salva log em arquivo
   */
  _saveLogToFile(timestamp, status, userId, userName, userNumber, messageText, quotedMessage, details, action) {
    try {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const logFile = path.join(this.logsPath, `rate_limit_${dateStr}.log`);
      
      const logEntry = {
        timestamp,
        status,
        userId,
        userName,
        userNumber,
        messagePreview: messageText.substring(0, 150),
        quotedPreview: quotedMessage ? quotedMessage.substring(0, 100) : null,
        details,
        action
      };
      
      const logLine = JSON.stringify(logEntry) + '\n';
      
      fs.appendFileSync(logFile, logLine, 'utf8');
    } catch (e) {
      console.error('Erro ao salvar log:', e);
    }
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * GERENCIAMENTO DE BLACKLIST
   * ═══════════════════════════════════════════════════════════════════════
   */
  isBlacklisted(userId) {
    const list = this.loadBlacklist();
    if (!Array.isArray(list)) return false;
    
    const found = list.find(entry => entry && entry.id === userId);
    
    if (found) {
      // Verifica expiração
      if (found.expiresAt && found.expiresAt !== 'PERMANENT') {
        if (Date.now() > found.expiresAt) {
          this.removeFromBlacklist(userId);
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
    const list = this.loadBlacklist();
    const arr = Array.isArray(list) ? list : [];
    
    // Evita duplicatas
    if (arr.find(x => x && x.id === userId)) {
      return false;
    }
    
    let expiresAt = 'PERMANENT';
    if (expiryMs) {
      expiresAt = Date.now() + expiryMs;
    }
    
    const entry = {
      id: userId,
      name: userName,
      number: userNumber,
      reason,
      addedAt: Date.now(),
      expiresAt,
      severity: reason === 'SPAM_REINCIDÊNCIA' ? '🚨 CRÍTICO' : 'ALTO'
    };
    
    arr.push(entry);
    
    try {
      fs.writeFileSync(this.blacklistPath, JSON.stringify(arr, null, 2), 'utf8');
      
      const timestamp = new Date().toLocaleString('pt-BR');
      console.log(`\n${'═'.repeat(120)}`);
      console.log(`${this.colors.red}${this.colors.bright}🚫 [${timestamp}] BLACKLIST ADICIONADO - SEVERIDADE: ${entry.severity}${this.colors.reset}`);
      console.log(`${'─'.repeat(120)}`);
      console.log(`${this.colors.bright}👤 USUÁRIO${this.colors.reset}`);
      console.log(`  ├─ Nome: ${userName}`);
      console.log(`  ├─ Número: ${userNumber}`);
      console.log(`  └─ JID: ${userId}`);
      console.log(`📋 RAZÃO: ${reason}`);
      console.log(`⏰ EXPIRAÇÃO: ${expiresAt === 'PERMANENT' ? 'PERMANENTE' : new Date(expiresAt).toLocaleString('pt-BR')}`);
      console.log(`🔐 STATUS: Todas as mensagens e comandos serão ignorados`);
      console.log(`${'═'.repeat(120)}\n`);
      
      return true;
    } catch (e) {
      console.error('Erro ao adicionar à blacklist:', e);
      return false;
    }
  }
  
  /**
   * Remove da blacklist
   */
  removeFromBlacklist(userId) {
    const list = this.loadBlacklist();
    const arr = Array.isArray(list) ? list : [];
    const index = arr.findIndex(x => x && x.id === userId);
    
    if (index !== -1) {
      const removed = arr[index];
      arr.splice(index, 1);
      
      try {
        fs.writeFileSync(this.blacklistPath, JSON.stringify(arr, null, 2), 'utf8');
        console.log(`✅ [BLACKLIST] ${removed.name} (${removed.number}) removido da blacklist`);
        return true;
      } catch (e) {
        console.error('Erro ao remover da blacklist:', e);
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
      if (!fs.existsSync(this.blacklistPath)) {
        return [];
      }
      
      const data = fs.readFileSync(this.blacklistPath, 'utf8');
      if (!data || !data.trim()) {
        return [];
      }
      
      return JSON.parse(data);
    } catch (e) {
      console.error('Erro ao carregar blacklist:', e);
      return [];
    }
  }
  
  /**
   * Retorna relatório da blacklist
   */
  getBlacklistReport() {
    const list = this.loadBlacklist();
    if (!Array.isArray(list) || list.length === 0) {
      return { total: 0, entries: [] };
    }
    
    return {
      total: list.length,
      entries: list.map(entry => ({
        name: entry.name || 'Desconhecido',
        number: entry.number || 'N/A',
        reason: entry.reason || 'indefinida',
        severity: entry.severity || 'NORMAL',
        addedAt: new Date(entry.addedAt).toLocaleString('pt-BR'),
        expiresAt: entry.expiresAt === 'PERMANENT' ? 'PERMANENTE' : new Date(entry.expiresAt).toLocaleString('pt-BR')
      }))
    };
  }
  
  /**
   * Retorna status de um usuário
   */
  getStatusUser(userId) {
    const userData = this.userLimits.get(userId);
    const isBlacklisted = this.isBlacklisted(userId);
    
    if (isBlacklisted) {
      return { blocked: true, reason: 'BLACKLIST' };
    }
    
    if (!userData) {
      return { blocked: false, messagesCount: 0, limit: this.HOURLY_LIMIT };
    }
    
    const now = Date.now();
    const blocked = userData.blockedUntil && now < userData.blockedUntil;
    const timeRemaining = blocked ? Math.ceil((userData.blockedUntil - now) / 1000) : 0;
    
    return {
      blocked,
      messagesCount: userData.count,
      limit: this.HOURLY_LIMIT,
      overAttempts: userData.overAttempts,
      timeRemainingSec: timeRemaining
    };
  }
  
  /**
   * Retorna estatísticas gerais
   */
  getStats() {
    const activeUsers = Array.from(this.userLimits.entries()).filter(([_, data]) => data.blockedUntil > Date.now());
    
    return {
      totalBlockedUsers: activeUsers.length,
      totalBlacklistedUsers: this.loadBlacklist().length,
      logBufferSize: this.logBuffer.length
    };
  }
  
  /**
   * Reset completo
   */
  reset() {
    this.userLimits.clear();
    this.logBuffer = [];
  }
}

module.exports = RateLimiter;
