/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: ModerationSystem (VERSÃO COM SEGURANÇA MILITAR)
 * ═══════════════════════════════════════════════════════════════════════
 * ✅ Sistema de moderação: mute, ban, antilink, antispam, leveling
 * ✅ Rate limiting com 100 msgs/hora por usuário (não-dono)
 * ✅ Auto-blacklist após 3 tentativas de spam
 * ✅ Logs detalhados em terminal (usuário, número, mensagem, citação, timestamps)
 * ✅ Sistema imune a bypass - dono não é afetado
 * ═══════════════════════════════════════════════════════════════════════
 */

import ConfigManager from './ConfigManager.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

class ModerationSystem {
    constructor(logger = null) {
        this.config = ConfigManager.getInstance();
        this.logger = logger || console;

        // ═══════════════════════════════════════════════════════════════════════
        // HF SPACES: Usar /tmp para garantir permissões de escrita
        // O HF Spaces tem sistema de arquivos somente-leitura em /
        // ═══════════════════════════════════════════════════════════════════════

        // Forçar uso de /tmp no HF Spaces (sistema read-only)
        this.blacklistPath = '/tmp/akira_data/datauser/blacklist.json';

        // ═══ ESTRUTURAS DE DADOS ═══
        this.mutedUsers = new Map(); // {groupId_userId} -> {expires, mutedAt, minutes}
        this.mutedUsers = new Map(); // {groupId_userId} -> {expires, mutedAt, minutes}
        this.antiLinkGroups = new Set(); // groupIds com anti-link ativo
        this.antiLinkPath = '/tmp/akira_data/data/antilink.json'; // Persistência do AntiLink
        this._loadAntiLinkSettings();

        this.muteCounts = new Map(); // {groupId_userId} -> {count, lastMuteDate}
        this.muteCounts = new Map(); // {groupId_userId} -> {count, lastMuteDate}
        this.bannedUsers = new Map(); // {userId} -> {reason, bannedAt, expiresAt}
        this.spamCache = new Map(); // {userId} -> [timestamps]

        // ═══ NOVO: SISTEMA DE RATE LIMITING COM SEGURANÇA MILITAR ═══
        this.userRateLimit = new Map(); // {userId} -> { windowStart, count, blockedUntil, overAttempts, warnings, blocked_at, blocked_by_warning }
        this.hourlyLimit = 100; // Limite de mensagens por hora (não-dono)
        this.hourlyWindow = 60 * 60 * 1000; // 1 hora em ms
        this.blockDuration = 60 * 60 * 1000; // 1 hora de bloqueio
        this.maxAttemptsBeforeBlacklist = 3; // Auto-blacklist após 3 tentativas

        // ═══ CONSTANTES ANTIGAS ═══
        this.HOURLY_LIMIT = 300;
        this.HOURLY_WINDOW_MS = 60 * 60 * 1000;
        this.SPAM_THRESHOLD = 3; // mensagens em 3 segundos
        this.SPAM_WINDOW_MS = 3000;

        // ═══ LOG DETALHADO ═══
        this.enableDetailedLogging = true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BLACKLIST (PERSISTENTE)
    // ═══════════════════════════════════════════════════════════════════════

    _loadBlacklist() {
        try {
            if (!fs.existsSync(this.blacklistPath)) {
                // Cria diretório se não existir
                const dir = path.dirname(this.blacklistPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(this.blacklistPath, JSON.stringify([]));
                return [];
            }
            const data = fs.readFileSync(this.blacklistPath, 'utf8');
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            this.logger.error(`❌ Erro ao ler blacklist: ${error.message}`);
            return [];
        }
    }

    _saveBlacklist(list) {
        try {
            const dir = path.dirname(this.blacklistPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.blacklistPath, JSON.stringify(list, null, 2));
        } catch (error) {
            this.logger.error(`❌ Erro ao salvar blacklist: ${error.message}`);
        }
    }

    isBlacklisted(jid) {
        try {
            const list = this._loadBlacklist();
            // Normaliza JID para remover sufixos se necessário, mas a comparação exata é preferível
            // O bot recebe o remoteJid ou participant
            const found = list.find(entry => entry && (entry.id === jid || entry.id === jid.split('@')[0]));
            return !!found;
        } catch (e) {
            return false;
        }
    }

    addToBlacklist(jid, reason = 'spam_auto') {
        const list = this._loadBlacklist();
        if (!list.find(x => x && x.id === jid)) {
            list.push({
                id: jid,
                reason,
                addedAt: Date.now(),
                date_str: new Date().toLocaleString('pt-BR')
            });
            this._saveBlacklist(list);
            this.logger.warn(`🚫 Usuário adicionado à Blacklist: ${jid} (${reason})`);
            return true;
        }
        return false;
    }

    removeFromBlacklist(jid) {
        const list = this._loadBlacklist();
        const initialLength = list.length;
        const newList = list.filter(x => x && x.id !== jid);

        if (newList.length < initialLength) {
            this._saveBlacklist(newList);
            this.logger.info(`✅ Usuário removido da Blacklist: ${jid}`);
            return true;
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SISTEMA DE MUTE (EM MEMÓRIA)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Verifica se um usuário está mutado em um grupo
     */
    isMuted(groupId, userId) {
        if (!groupId || !userId) return false;
        const key = `${groupId}_${userId}`;
        const muteData = this.mutedUsers.get(key);

        if (!muteData) return false;

        if (Date.now() > muteData.expires) {
            this.mutedUsers.delete(key);
            this.logger.info(`🔊 Mute expirado para ${userId} no grupo ${groupId}`);
            return false;
        }

        return true;
    }

    /**
     * Muta um usuário
     */
    muteUser(groupId, userId, minutes = 5) {
        const key = `${groupId}_${userId}`;

        // Lógica de incremento de mute (reincidência no mesmo dia)
        const today = new Date().toDateString();
        let countData = this.muteCounts.get(key) || { count: 0, lastMuteDate: today };

        if (countData.lastMuteDate !== today) {
            countData = { count: 0, lastMuteDate: today };
        }

        countData.count += 1;
        this.muteCounts.set(key, countData);

        // Calcula tempo com base na reincidência
        let muteMinutes = minutes;
        if (countData.count > 1) {
            muteMinutes = minutes * Math.pow(2, countData.count - 1); // Exponencial: 5, 10, 20...
            this.logger.warn(`⚠️ [MUTE INTENSIFICADO] ${userId} muteado ${countData.count}x hoje. Tempo: ${muteMinutes} min`);
        }

        const expires = Date.now() + (muteMinutes * 60 * 1000);
        this.mutedUsers.set(key, {
            expires,
            mutedAt: Date.now(),
            minutes: muteMinutes,
            muteCount: countData.count
        });

        return { expires, muteMinutes, muteCount: countData.count };
    }

    /**
     * Desmuta um usuário
     */
    unmuteUser(groupId, userId) {
        const key = `${groupId}_${userId}`;
        const wasMuted = this.mutedUsers.has(key);
        this.mutedUsers.delete(key);
        if (wasMuted) {
            this.logger.info(`🔊 Usuário ${userId} desmutado manualmente no grupo ${groupId}`);
        }
        return wasMuted;
    }

    /**
    * ═══════════════════════════════════════════════════════════════════════
    * NOVO: Sistema de Rate Limiting com Logs Detalhados
    * ═══════════════════════════════════════════════════════════════════════
    */
    checkAndLimitHourlyMessages(userId, userName, userNumber, messageText, quotedMessage = null, ehDono = false) {
        // DONO JAMAIS É LIMITADO
        if (ehDono) {
            return { allowed: true, reason: 'DONO_ISENTO' };
        }

        const now = Date.now();
        let userData = this.userRateLimit?.get(userId) || {
            windowStart: now,
            count: 0,
            blockedUntil: 0,
            overAttempts: 0,
            warnings: 0,
            blocked_at: null,
            blocked_by_warning: false
        };

        // ═══ VERIFICA SE BLOQUEIO AINDA ESTÁ ATIVO ═══
        if (userData.blockedUntil && now < userData.blockedUntil) {
            userData.overAttempts++;

            const timePassedMs = now - userData.blocked_at;
            const timePassedSec = Math.floor(timePassedMs / 1000);
            const timeRemainingMs = userData.blockedUntil - now;
            const timeRemainingSec = Math.ceil(timeRemainingMs / 1000);
            const blockExpireTime = new Date(userData.blockedUntil).toLocaleTimeString('pt-BR');

            this._logRateLimitAttempt(
                'BLOQUEADO_REINCIDÊNCIA',
                userId,
                userName,
                userNumber,
                messageText,
                quotedMessage,
                `Tentativa ${userData.overAttempts}/${this.maxAttemptsBeforeBlacklist}`,
                `Passou: ${timePassedSec}s | Falta: ${timeRemainingSec}s | Desbloqueio: ${blockExpireTime}`
            );

            // AUTO-BLACKLIST APÓS MÚLTIPLAS TENTATIVAS
            if (userData.overAttempts >= this.maxAttemptsBeforeBlacklist) {
                this._logRateLimitAttempt(
                    '🚨 AUTO-BLACKLIST ACIONADO',
                    userId,
                    userName,
                    userNumber,
                    messageText,
                    quotedMessage,
                    `MÚLTIPLAS REINCIDÊNCIAS (${userData.overAttempts})`,
                    'USUÁRIO ADICIONADO À BLACKLIST PERMANENTE'
                );

                this.userRateLimit?.set(userId, userData);
                return {
                    allowed: false,
                    reason: 'AUTO_BLACKLIST_TRIGGERED',
                    overAttempts: userData.overAttempts,
                    action: 'ADD_TO_BLACKLIST'
                };
            }

            this.userRateLimit?.set(userId, userData);
            return {
                allowed: false,
                reason: 'BLOQUEADO_REINCIDÊNCIA',
                timePassedSec,
                timeRemainingSec,
                blockExpireTime,
                overAttempts: userData.overAttempts
            };
        }

        // ═══ RESETA JANELA SE EXPIROU ═══
        if (now - userData.windowStart >= this.hourlyWindow) {
            userData.windowStart = now;
            userData.count = 0;
            userData.blockedUntil = 0;
            userData.overAttempts = 0;
            userData.warnings = 0;
            userData.blocked_at = null;
            userData.blocked_by_warning = false;
        }

        // ═══ INCREMENTA CONTADOR ═══
        userData.count++;

        // ═══ VERIFICA SE PASSOU DO LIMITE ═══
        if (userData.count > this.hourlyLimit) {
            userData.blockedUntil = now + this.blockDuration;
            userData.blocked_at = now;
            userData.blocked_by_warning = true;
            userData.warnings++;

            this._logRateLimitAttempt(
                '⚠️ LIMITE EXCEDIDO',
                userId,
                userName,
                userNumber,
                messageText,
                quotedMessage,
                `Mensagens: ${userData.count}/${this.hourlyLimit}`,
                `Bloqueado por 1 hora`
            );

            this.userRateLimit?.set(userId, userData);
            return {
                allowed: false,
                reason: 'LIMITE_HORARIO_EXCEDIDO',
                messagesCount: userData.count,
                limit: this.hourlyLimit,
                blockDurationMinutes: 60
            };
        }

        // ═══ AVISO DE PROXIMIDADE DO LIMITE ═══
        const percentualUso = (userData.count / this.hourlyLimit) * 100;
        if (percentualUso >= 80 && userData.count > 0) {
            this._logRateLimitAttempt(
                '⚡ AVISO: PROXIMIDADE DO LIMITE',
                userId,
                userName,
                userNumber,
                messageText,
                quotedMessage,
                `${userData.count}/${this.hourlyLimit} (${percentualUso.toFixed(1)}%)`,
                `Faltam ${this.hourlyLimit - userData.count} mensagens`
            );
        }

        this.userRateLimit?.set(userId, userData);

        return {
            allowed: true,
            reason: 'OK',
            messagesCount: userData.count,
            limit: this.hourlyLimit,
            percentualUso
        };
    }

    /**
    * ═══════════════════════════════════════════════════════════════════════
    * NOVO: Sistema de Logging Detalhado em Terminal
    * ═══════════════════════════════════════════════════════════════════════
    */
    _logRateLimitAttempt(status, userId, userName, userNumber, messageText, quotedMessage, details, action) {
        if (!this.enableDetailedLogging) return;

        const timestamp = new Date().toLocaleString('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const separator = '═'.repeat(100);
        const border = '─'.repeat(100);

        // ═══ LOG FORMATADO ═══
        console.log(`\n${separator}`);
        console.log(`📊 [${timestamp}] ${status}`);
        console.log(border);

        console.log(`👤 USUÁRIO`);
        console.log(` ├─ Nome: ${userName || 'Desconhecido'}`);
        console.log(` ├─ Número: ${userNumber || 'N/A'}`);
        console.log(` └─ JID: ${userId || 'N/A'}`);

        console.log(`💬 MENSAGEM`);
        console.log(` ├─ Texto: "${messageText?.substring(0, 150)}${messageText?.length > 150 ? '...' : ''}"`);
        console.log(` ├─ Comprimento: ${messageText?.length || 0} caracteres`);
        if (quotedMessage) {
            console.log(` ├─ Citada: "${quotedMessage?.substring(0, 100)}${quotedMessage?.length > 100 ? '...' : ''}"`);
        }
        console.log(` └─ Tipo: ${messageText?.startsWith('#') ? 'COMANDO' : 'MENSAGEM'}`);

        console.log(`📈 DETALHES`);
        console.log(` └─ ${details}`);

        if (action) {
            console.log(`⚡ AÇÃO`);
            console.log(` └─ ${action}`);
        }

        console.log(separator);
    }

    /**
    * Retorna relatório do usuário
    */
    getHourlyLimitStatus(userId) {
        const userData = this.userRateLimit?.get(userId);
        if (!userData) {
            return { allowed: true, reason: 'Novo usuário' };
        }

        const now = Date.now();
        const timePassedMs = now - userData.windowStart;
        const timePassedMin = Math.floor(timePassedMs / 60000);

        return {
            messagesCount: userData.count,
            limit: this.hourlyLimit,
            blocked: now < userData.blockedUntil,
            blockedUntil: userData.blockedUntil,
            overAttempts: userData.overAttempts,
            warnings: userData.warnings,
            timePassedMinutes: timePassedMin
        };
    }

    /**
    * Verifica se usuário está mutado
    */
    isUserMuted(groupId, userId) {
        const key = `${groupId}_${userId}`;
        const muteData = this.mutedUsers?.get(key);

        if (!muteData) return false;

        if (Date.now() > muteData.expires) {
            this.mutedUsers?.delete(key);
            return false;
        }

        return true;
    }

    /**
    * Muta usuário
    */
    muteUser(groupId, userId, minutes = null) {
        minutes = minutes || this.config?.MUTE_DEFAULT_MINUTES;
        const key = `${groupId}_${userId}`;

        const muteCount = this.incrementMuteCount(groupId, userId);

        // Multiplica tempo a cada mute
        if (muteCount > 1) {
            minutes = minutes * Math.pow(2, muteCount - 1);
        }

        const expires = Date.now() + (minutes * 60 * 1000);
        this.mutedUsers?.set(key, {
            expires,
            mutedAt: Date.now(),
            minutes,
            muteCount
        });

        return { expires, minutes, muteCount };
    }

    /**
    * Remove mute
    */
    unmuteUser(groupId, userId) {
        const key = `${groupId}_${userId}`;
        return this.mutedUsers?.delete(key);
    }

    /**
    * Incrementa contador de mutes diários
    */
    incrementMuteCount(groupId, userId) {
        const key = `${groupId}_${userId}`;
        const today = new Date().toDateString();
        const countData = this.muteCounts?.get(key) || { count: 0, lastMuteDate: today };

        if (countData.lastMuteDate !== today) {
            countData.count = 0;
            countData.lastMuteDate = today;
        }

        countData.count += 1;
        this.muteCounts?.set(key, countData);

        return countData.count;
    }

    /**
    * Obtém contador de mutes
    */
    getMuteCount(groupId, userId) {
        const key = `${groupId}_${userId}`;
        const today = new Date().toDateString();
        const countData = this.muteCounts?.get(key);

        if (!countData || countData.lastMuteDate !== today) {
            return 0;
        }

        return countData.count || 0;
    }

    /**
    * Carrega configurações de AntiLink
    */
    _loadAntiLinkSettings() {
        try {
            if (!fs.existsSync(this.antiLinkPath)) {
                const dir = path.dirname(this.antiLinkPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(this.antiLinkPath, JSON.stringify([]));
                return;
            }
            const data = fs.readFileSync(this.antiLinkPath, 'utf8');
            const groups = JSON.parse(data);
            if (Array.isArray(groups)) {
                groups.forEach(g => this.antiLinkGroups.add(g));
            }
        } catch (e) {
            this.logger.error(`❌ Erro ao carregar AntiLink: ${e.message}`);
        }
    }

    /**
    * Salva configurações de AntiLink
    */
    _saveAntiLinkSettings() {
        try {
            const groups = Array.from(this.antiLinkGroups);
            const dir = path.dirname(this.antiLinkPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.antiLinkPath, JSON.stringify(groups, null, 2));
        } catch (e) {
            this.logger.error(`❌ Erro ao salvar AntiLink: ${e.message}`);
        }
    }

    /**
    * Ativa/desativa anti-link
    */
    toggleAntiLink(groupId, enable = true) {
        if (enable) {
            this.antiLinkGroups.add(groupId);
        } else {
            this.antiLinkGroups.delete(groupId);
        }
        this._saveAntiLinkSettings();
        return enable;
    }

    /**
    * Verifica se anti-link ativo
    */
    isAntiLinkActive(groupId) {
        return this.antiLinkGroups.has(groupId);
    }

    /**
    * Detecta link em texto e verifica permissão
    */
    checkLink(text, groupId, userId, isAdmin = false) {
        if (!this.isAntiLinkActive(groupId)) return false;
        if (isAdmin) return false; // Admins podem enviar links

        // Regex robusto para links (http, www, wa.me, t.me, IPs)
        const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(bit\.ly\/[^\s]+)|(t\.me\/[^\s]+)|(wa\.me\/[^\s]+)|(chat\.whatsapp\.com\/[^\s]+)|(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/gi;

        return linkRegex.test(text);
    }

    /**
    bage usuário
    */
    banUser(userId, reason = 'violação de regras', expiresIn = null) {
        const key = String(userId);
        let expiresAt = 'PERMANENT';

        if (expiresIn) {
            expiresAt = Date.now() + expiresIn;
        }

        this.bannedUsers?.set(key, {
            reason,
            bannedAt: Date.now(),
            expiresAt
        });

        return { userId, reason, expiresAt };
    }

    /**
    * Remove ban
    */
    unbanUser(userId) {
        return this.bannedUsers?.delete(String(userId));
    }

    /**
    * Verifica se usuário está banido
    */
    isBanned(userId) {
        const key = String(userId);
        const banData = this.bannedUsers?.get(key);

        if (!banData) return false;

        if (banData.expiresAt !== 'PERMANENT' && Date.now() > banData.expiresAt) {
            this.bannedUsers?.delete(key);
            return false;
        }

        return true;
    }

    /**
    * Verifica spam
    */
    checkSpam(userId) {
        const now = Date.now();
        const userData = this.spamCache?.get(userId) || [];

        const filtered = userData.filter(t => (now - t) < this.SPAM_WINDOW_MS);

        if (filtered.length >= this.SPAM_THRESHOLD) {
            return true;
        }

        filtered.push(now);
        this.spamCache?.set(userId, filtered);

        // Limpeza automática
        if (this.spamCache?.size > 1000) {
            const oldestKey = this.spamCache?.keys().next().value;
            this.spamCache?.delete(oldestKey);
        }

        return false;
    }

    /**
    * Limpa cache de spam
    */
    clearSpamCache() {
        this.spamCache?.clear();
    }

    /**
    * ═══════════════════════════════════════════════════════════════════════
    * NOVO: Sistema de Blacklist com Segurança Militar
    * ═══════════════════════════════════════════════════════════════════════
    */

    /**
    * Verifica se usuário está na blacklist
    */
    isUserBlacklisted(userId) {
        const list = this.loadBlacklistData();
        if (!Array.isArray(list)) return false;

        const found = list.find(entry => entry && entry.id === userId);

        if (found) {
            // Verifica se tem expiração
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
    * Adiciona à blacklist com segurança
    */
    addToBlacklist(userId, userName, userNumber, reason = 'spam', expiryMs = null) {
        const list = this.loadBlacklistData();
        const arr = Array.isArray(list) ? list : [];

        // Verifica se já está na blacklist
        if (arr.find(x => x && x.id === userId)) {
            return { success: false, message: 'Já estava na blacklist' };
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
            severity: reason === 'abuse' ? 'CRÍTICO' : reason === 'spam' ? 'ALTO' : 'NORMAL'
        };

        arr.push(entry);

        try {
            import('fs').then(fs => {
                fs.writeFileSync(
                    this.blacklistPath || './database/datauser/blacklist.json',
                    JSON.stringify(arr, null, 2)
                );
            });

            // LOG DETALHADO
            const timestamp = new Date().toLocaleString('pt-BR');
            const severity = entry.severity;
            const expiresStr = expiresAt === 'PERMANENT' ? 'PERMANENTE' : new Date(expiresAt).toLocaleString('pt-BR');

            console.log(`\n${'═'.repeat(100)}`);
            console.log(`🚫 [${timestamp}] BLACKLIST ADICIONADO - SEVERIDADE: ${severity}`);
            console.log(`${'─'.repeat(100)}`);
            console.log(`👤 USUÁRIO`);
            console.log(` ├─ Nome: ${userName}`);
            console.log(` ├─ Número: ${userNumber}`);
            console.log(` └─ JID: ${userId}`);
            console.log(`📋 RAZÃO: ${reason}`);
            console.log(`⏰ EXPIRAÇÃO: ${expiresStr}`);
            console.log(`🔐 STATUS: Agora será ignorado completamente`);
            console.log(`${'═'.repeat(100)}\n`);

            return { success: true, entry };
        } catch (e) {
            console.error('Erro ao adicionar à blacklist:', e);
            return { success: false, message: e.message };
        }
    }

    /**
    * Remove da blacklist
    */
    removeFromBlacklist(userId) {
        const list = this.loadBlacklistData();
        const arr = Array.isArray(list) ? list : [];
        const index = arr.findIndex(x => x && x.id === userId);

        if (index !== -1) {
            const removed = arr[index];
            arr.splice(index, 1);

            try {
                import('fs').then(fs => {
                    fs.writeFileSync(
                        this.blacklistPath || './database/datauser/blacklist.json',
                        JSON.stringify(arr, null, 2)
                    );
                });

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
    * Carrega dados da blacklist
    */
    async loadBlacklistData() {
        try {
            const fs = await import('fs');
            const path = this.blacklistPath || './database/datauser/blacklist.json';

            if (!fs.existsSync(path)) {
                return [];
            }

            const data = fs.readFileSync(path, 'utf8');
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
    * Lista a blacklist
    */
    async getBlacklistReport() {
        const list = await this.loadBlacklistData();
        if (!Array.isArray(list) || list.length === 0) {
            return { total: 0, entries: [] };
        }

        const entries = list.map(entry => ({
            name: entry.name || 'Desconhecido',
            number: entry.number || 'N/A',
            reason: entry.reason || 'indefinida',
            severity: entry.severity || 'NORMAL',
            addedAt: new Date(entry.addedAt).toLocaleString('pt-BR'),
            expiresAt: entry.expiresAt === 'PERMANENT' ? 'PERMANENTE' : new Date(entry.expiresAt).toLocaleString('pt-BR')
        }));

        return { total: entries.length, entries };
    }

    /**
    * Retorna estatísticas
    */
    async getStats() {
        const blacklist = await this.loadBlacklistData();
        return {
            mutedUsers: this.mutedUsers?.size,
            bannedUsers: this.bannedUsers?.size,
            antiLinkGroups: this.antiLinkGroups?.size,
            spamCacheSize: this.spamCache?.size,
            hourlyBlockedUsers: Array.from(this.userRateLimit?.entries() || []).filter(([_, data]) => data.blockedUntil > Date.now()).length,
            blacklistedUsers: blacklist?.length || 0
        };
    }

    /**
    * Limpa estruturas (útil na inicialização)
    */
    reset() {
        this.mutedUsers?.clear();
        this.antiLinkGroups?.clear();
        this.muteCounts?.clear();
        this.bannedUsers?.clear();
        this.spamCache?.clear();
        this.userRateLimit?.clear();
        this.logger?.info('🔄 Sistema de moderação resetado');
    }
}

export default ModerationSystem;
