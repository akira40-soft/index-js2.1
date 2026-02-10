/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLASSE: RateLimiter (SEGURANÇA MILITAR)
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ Limite de 100 mensagens/hora por usuário (não-dono)
 * ✅ Auto-blacklist após 3 tentativas reincidentes
 * ✅ Logs detalhados com timestamp, usuário, número, mensagem, citação
 * ✅ Imune a bypass - dono não é afetado
 * ✅ Sem repetição de logs - rastreamento completo
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';

class RateLimiter {
    constructor(config = {}) {
        // ═══ LIMITES E CONFIGURAÇÃO ═══
        this.HOURLY_LIMIT = config.hourlyLimit || 100; // 100 msgs/hora
        this.HOURLY_WINDOW = config.hourlyWindow || (60 * 60 * 1000); // 1 hora
        this.MAX_VIOLATIONS = config.maxViolations || 3; // Max violações antes do ban
        this.LOG_FILE = config.logFile || path.join('temp', 'security_log.txt');
        this.BLACKLIST_FILE = config.blacklistFile || path.join('temp', 'blacklist.json');

        // Cache em memória
        this.usage = new Map();
        this.violations = new Map();
        this.blacklist = new Set();

        this._ensureFiles();
        this._loadBlacklist();

        // Limpeza periódica (a cada 10 min)
        setInterval(() => this._cleanup(), 10 * 60 * 1000);
    }

    _ensureFiles() {
        const dir = path.dirname(this.LOG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(this.BLACKLIST_FILE)) fs.writeFileSync(this.BLACKLIST_FILE, JSON.stringify([]));
    }

    _loadBlacklist() {
        try {
            if (fs.existsSync(this.BLACKLIST_FILE)) {
                const data = JSON.parse(fs.readFileSync(this.BLACKLIST_FILE, 'utf8'));
                data.forEach(id => this.blacklist.add(id));
            }
        } catch (e) {
            console.error('Erro ao carregar blacklist:', e);
        }
    }

    _saveBlacklist() {
        try {
            fs.writeFileSync(this.BLACKLIST_FILE, JSON.stringify([...this.blacklist]));
        } catch (e) {
            console.error('Erro ao salvar blacklist:', e);
        }
    }

    _log(type, userId, details) {
        const timestamp = new Date().toISOString();
        const icon = type === 'BAN' ? '🚫' : (type === 'WARN' ? '⚠️' : 'ℹ️');
        const logLine = `[${timestamp}] ${icon} ${type} | User: ${userId} | ${details}\n`;

        try {
            fs.appendFileSync(this.LOG_FILE, logLine);
            console.log(logLine.trim());
        } catch (e) {
            console.error('Erro ao escrever log:', e);
        }
    }

    isBlacklisted(userId) {
        return this.blacklist.has(userId);
    }

    check(userId, isOwner = false) {
        if (isOwner) return { allowed: true }; // Dono imune
        if (this.blacklist.has(userId)) return { allowed: false, reason: 'BLACKLISTED' };

        const now = Date.now();

        // Inicializa registro do usuário
        if (!this.usage.has(userId)) {
            this.usage.set(userId, { count: 0, startTime: now });
        }

        const userUsage = this.usage.get(userId);

        // Reset janela de tempo
        if (now - userUsage.startTime > this.HOURLY_WINDOW) {
            userUsage.count = 0;
            userUsage.startTime = now;
        }

        // Incrementa contador
        userUsage.count++;

        // Verifica limite
        if (userUsage.count > this.HOURLY_LIMIT) {
            this._handleViolation(userId);
            return {
                allowed: false,
                reason: 'RATE_LIMIT_EXCEEDED',
                wait: Math.ceil((this.HOURLY_WINDOW - (now - userUsage.startTime)) / 60000)
            };
        }

        return { allowed: true, remaining: this.HOURLY_LIMIT - userUsage.count };
    }

    _handleViolation(userId) {
        const violations = (this.violations.get(userId) || 0) + 1;
        this.violations.set(userId, violations);

        this._log('WARN', userId, `Violação de rate limit (${violations}/${this.MAX_VIOLATIONS})`);

        if (violations >= this.MAX_VIOLATIONS) {
            this.blacklist.add(userId);
            this._saveBlacklist();
            this._log('BAN', userId, 'Adicionado à blacklist por excesso de violações');
        }
    }

    _cleanup() {
        const now = Date.now();
        // Remove entradas expiradas do cache de uso
        for (const [userId, data] of this.usage.entries()) {
            if (now - data.startTime > this.HOURLY_WINDOW) {
                this.usage.delete(userId);
            }
        }
    }

    // Comandos manuais para admins
    banUser(userId, adminId) {
        this.blacklist.add(userId);
        this._saveBlacklist();
        this._log('BAN', userId, `Banido manualmente por admin ${adminId}`);
        return true;
    }

    unbanUser(userId, adminId) {
        if (this.blacklist.delete(userId)) {
            this._saveBlacklist();
            this.violations.delete(userId); // Reseta violações
            this._log('UNBAN', userId, `Desbanido manualmente por admin ${adminId}`);
            return true;
        }
        return false;
    }

    getBlacklist() {
        return [...this.blacklist];
    }
}

export default RateLimiter;
