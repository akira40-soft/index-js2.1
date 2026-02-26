/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MÓDULO: GroupManagement.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Gestão completa do grupo: foto, nome, descrição, abertura/fechamento
 * ═══════════════════════════════════════════════════════════════════════════
 */

import ConfigManager from './ConfigManager.js';
import fs from 'fs';
import path from 'path';

class GroupManagement {
    public sock: any;
    public config: any;
    public logger: any;
    public groupsDataPath: string;
    public scheduledActionsPath: string;
    public groupSettings: any;
    public scheduledActions: any;
    public moderationSystem: any;

    /**
     * Cria uma lista de alvos a partir da mensagem, incluindo mentions e
     * usuário citado no reply. Retorna array vazio se nenhum alvo encontrado.
     */
    private _extractTargets(m: any): string[] {
        // primeiro, menções diretas
        const mentioned: string[] = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length > 0) {
            return mentioned;
        }

        // depois, verifica se algum replyInfo foi anexado (pelo CommandHandler)
        const replyInfo = m.replyInfo || m._replyInfo;
        if (replyInfo && replyInfo.quemEscreveuCitacaoJid) {
            return [replyInfo.quemEscreveuCitacaoJid];
        }

        // fallback para a forma antiga de obter participante do contextInfo
        const participant = m.message?.extendedTextMessage?.contextInfo?.participant;
        if (participant) {
            return [participant];
        }

        return [];
    }

    constructor(sock: any, config: any = null, moderationSystem: any = null) {
        this.sock = sock;
        this.config = config || ConfigManager.getInstance();
        this.logger = console;
        this.moderationSystem = moderationSystem;

        // Pasta para dados de grupos
        this.groupsDataPath = path.join(this.config.DATABASE_FOLDER, 'group_settings.json');
        this.scheduledActionsPath = path.join(this.config.DATABASE_FOLDER, 'scheduled_actions.json');

        // Carregar configurações existentes
        this.groupSettings = this.loadGroupSettings();
        this.scheduledActions = this.loadScheduledActions();

        // Iniciar verificador de ações programadas
        this.startScheduledActionsChecker();
    }

    setSocket(sock: any) {
        this.sock = sock;
    }

    /**
     * Verifica se o socket está conectado e pronto
     */
    private _checkSocket(): boolean {
        if (!this.sock) {
            this.logger.error('❌ [GroupManagement] Socket não disponível');
            return false;
        }
        if (!this.sock.ws) {
            this.logger.error('❌ [GroupManagement] WebSocket não inicializado');
            return false;
        }
        if (this.sock.ws.readyState !== 1) { // 1 = OPEN
            this.logger.error(`❌ [GroupManagement] WebSocket não está aberto (estado: ${this.sock.ws.readyState})`);
            return false;
        }
        return true;
    }

    /**
     * Carrega configurações dos grupos do arquivo
     */
    loadGroupSettings(): any {
        try {
            if (fs.existsSync(this.groupsDataPath)) {
                const data = fs.readFileSync(this.groupsDataPath, 'utf8');
                return JSON.parse(data || '{}');
            }
        } catch (e: any) {
            this.logger.error('❌ [GroupManagement] Erro ao carregar configurações:', e.message);
        }
        return {};
    }

    /**
     * Salva configurações dos grupos no arquivo
     */
    saveGroupSettings(): void {
        try {
            const dir = path.dirname(this.groupsDataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.groupsDataPath, JSON.stringify(this.groupSettings, null, 2));
        } catch (e: any) {
            this.logger.error('❌ [GroupManagement] Erro ao salvar configurações:', e.message);
        }
    }

    /**
     * Carrega ações programadas do arquivo
     */
    loadScheduledActions(): any {
        try {
            if (fs.existsSync(this.scheduledActionsPath)) {
                const data = fs.readFileSync(this.scheduledActionsPath, 'utf8');
                return JSON.parse(data || '[]');
            }
        } catch (e: any) {
            this.logger.error('❌ [GroupManagement] Erro ao carregar ações programadas:', e.message);
        }
        return [];
    }

    /**
     * Inicia verificador de ações programadas
     */
    startScheduledActionsChecker(): void {
        // Verifica ações programadas a cada minuto
        setInterval(() => {
            this.checkScheduledActions();
        }, 60000);
    }

    /**
     * Verifica e executa ações programadas
     */
    async checkScheduledActions(): Promise<void> {
        const now = Date.now();
        const actionsToExecute = this.scheduledActions.filter((action: any) => action.executeAt <= now);
        
        for (const action of actionsToExecute) {
            try {
                if (action.type === 'unmute') {
                    if (this.moderationSystem) {
                        this.moderationSystem.unmuteUser(action.groupJid, action.userJid);
                    }
                    // Remove do groupSettings também
                    if (this.groupSettings[action.groupJid]?.mutedUsers?.[action.userJid]) {
                        delete this.groupSettings[action.groupJid].mutedUsers[action.userJid];
                    }
                } else if (action.type === 'openGroup') {
                    await this.openGroup(action.groupJid);
                } else if (action.type === 'closeGroup') {
                    await this.closeGroup(action.groupJid);
                }
            } catch (e: any) {
                this.logger.error(`❌ [GroupManagement] Erro ao executar ação programada:`, e.message);
            }
        }

        // Remove ações executadas
        this.scheduledActions = this.scheduledActions.filter((action: any) => action.executeAt > now);
        this.saveScheduledActions();
    }

    /**
     * Salva ações programadas no arquivo
     */
    saveScheduledActions(): void {
        try {
            const dir = path.dirname(this.scheduledActionsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.scheduledActionsPath, JSON.stringify(this.scheduledActions, null, 2));
        } catch (e: any) {
            this.logger.error('❌ [GroupManagement] Erro ao salvar ações programadas:', e.message);
        }
    }

    /**
     * Processa comandos de grupo
     */
    async handleCommand(m: any, command: string, args: any[]) {
        // Verifica se é grupo
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        if (!isGroup) {
            if (this._checkSocket()) {
                await this.sock.sendMessage(m.key.remoteJid, { text: '📵 Comandos de grupo apenas em grupos.' }, { quoted: m });
            }
            return true;
        }

        // Verifica socket antes de processar comandos que precisam de conexão
        const needsSocket = ['mute', 'desmute', 'unmute', 'kick', 'ban', 'add', 'promote', 'demote', 
                             'fechar', 'close', 'abrir', 'open', 'link', 'revlink', 'revogar',
                             'fixar', 'pin', 'desafixar', 'unpin', 'tagall', 'totag'].includes(command);
        
        if (needsSocket && !this._checkSocket()) {
            this.logger.error(`❌ [GroupManagement] Comando ${command} falhou: socket não disponível`);
            // Não envia mensagem de erro para o usuário, apenas loga no terminal
            return true;
        }

        switch (command) {
            case 'antilink':
                return await this.toggleSetting(m, 'antilink', args[0]);
            // COMANDOS DE USUÁRIO (Mute/Unmute)
            case 'mute':
                return await this.muteUser(m, args);
            case 'desmute':
            case 'unmute':
                return await this.unmuteUser(m, args);
            // COMANDOS DE GRUPO (Fechar/Abrir)
            case 'fechar':
            case 'close':
                return await this.closeGroupCommand(m);
            case 'abrir':
            case 'open':
                return await this.openGroupCommand(m);
            // COMANDOS DE AUTONOMIA
            case 'fixar':
            case 'pin':
                return await this.pinMessage(m, args);
            case 'desafixar':
            case 'unpin':
                return await this.unpinMessage(m);
            case 'lido':
            case 'read':
                return await this.markAsRead(m);
            case 'reagir':
            case 'react':
                return await this.reactToMessage(m, args);
            // COMANDOS DE GERENCIAMENTO
            case 'ban':
            case 'kick':
                return await this.kickUser(m, args);
            case 'add':
                return await this.addUser(m, args);
            case 'promote':
                return await this.promoteUser(m, args);
            case 'demote':
                return await this.demoteUser(m, args);
            case 'link':
                return await this.getGroupLink(m);
            case 'revlink':
            case 'revogar':
                return await this.revokeGroupLink(m);
            case 'totag':
                return await this.tagAll(m, args);
            // INFO DE GRUPO
            case 'groupinfo':
            case 'infogrupo':
            case 'ginfo':
                return await this.getGroupInfo(m);
            case 'listar':
            case 'membros':
                return await this.listMembers(m);
            case 'admins':
            case 'listadmins':
                return await this.listAdmins(m);
            // CONFIGURAÇÕES
            case 'welcome':
                return await this.toggleSetting(m, 'welcome', args[0]);
            case 'antifake':
                return await this.toggleSetting(m, 'antifake', args[0]);
            case 'antispam':
                return await this.toggleSetting(m, 'antispam', args[0]);
            case 'setdesc':
            case 'descricao':
                return await this.setGroupDesc(m, args);
            case 'setfoto':
            case 'fotodogrupo':
                return await this.setGroupPhoto(m);
            case 'requireregister':
                return await this.toggleRequireRegister(m, args[0]);
            default:
                return false;
        }
    }

    /**
     * Alterna uma configuração de grupo
     */
    async toggleSetting(m: any, setting: string, value: any) {
        const groupJid = m.key.remoteJid;
        const state = value === 'on' ? true : value === 'off' ? false : null;

        if (state === null) {
            if (this._checkSocket()) {
                await this.sock.sendMessage(groupJid, { text: `❌ Use: *#${setting} on/off*` }, { quoted: m });
            }
            return true;
        }

        if (!this.groupSettings[groupJid]) this.groupSettings[groupJid] = {};

        this.groupSettings[groupJid][setting] = state;
        this.saveGroupSettings();

        const statusStr = state ? 'ATIVADO' : 'DESATIVADO';
        if (this._checkSocket()) {
            await this.sock.sendMessage(groupJid, { text: `✅ **${setting.toUpperCase()}** agora está **${statusStr}** para este grupo.` }, { quoted: m });
        }
        return true;
    }

    /**
     * Define uma mensagem personalizada (welcome, goodbye)
     */
    async setCustomMessage(groupJid: string, type: string, text: string) {
        if (!this.groupSettings[groupJid]) this.groupSettings[groupJid] = {};
        if (!this.groupSettings[groupJid].messages) this.groupSettings[groupJid].messages = {};

        this.groupSettings[groupJid].messages[type] = text;
        this.saveGroupSettings();
        return true;
    }

    /**
     * Obtém uma mensagem personalizada
     */
    getCustomMessage(groupJid: string, type: string): string | null {
        return this.groupSettings[groupJid]?.messages?.[type] || null;
    }

    /**
     * Verifica se welcome está ativo
     */
    getWelcomeStatus(groupJid: string): boolean {
        return this.groupSettings[groupJid]?.welcome === true;
    }

    /**
     * Verifica se goodbye está ativo
     */
    getGoodbyeStatus(groupJid: string): boolean {
        return this.groupSettings[groupJid]?.goodbye === true;
    }

    /**
     * Define mensagem de welcome
     */
    async setWelcomeMessage(groupJid: string, message: string): Promise<boolean> {
        return await this.setCustomMessage(groupJid, 'welcome', message);
    }

    /**
     * Define mensagem de goodbye
     */
    async setGoodbyeMessage(groupJid: string, message: string): Promise<boolean> {
        return await this.setCustomMessage(groupJid, 'goodbye', message);
    }

    /**
     * Formata uma mensagem com placeholders
     */
    async formatMessage(groupJid: string, participantJid: string, template: string) {
        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            const groupName = metadata.subject || 'Grupo';
            const groupDesc = metadata.desc?.toString() || 'Sem descrição';
            const userTag = `@${participantJid.split('@')[0]}`;

            // Link do grupo se o bot for admin
            let groupLink = 'Apenas admins podem gerar link';
            try {
                if (metadata.participants.find((p: any) => p.id === this.sock.user?.id && (p.admin === 'admin' || p.admin === 'superadmin'))) {
                    const code = await this.sock.groupInviteCode(groupJid);
                    groupLink = `https://chat.whatsapp.com/${code}`;
                }
            } catch (e) { }

            return template
                .replace(/@user/g, userTag)
                .replace(/@group/g, groupName)
                .replace(/@desc/g, groupDesc)
                .replace(/@links/g, groupLink);
        } catch (e) {
            console.error('Erro ao formatar mensagem:', e);
            return template; // Fallback para o template sem substituições se falhar
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // COMANDOS DE GRUPO: FECHAR/ABRIR
    // ═════════════════════════════════════════════════════════════════

    async closeGroupCommand(m: any): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível fechar grupo: socket não disponível');
            return true;
        }
        const result = await this.closeGroup(m.key.remoteJid);
        if (result.success) {
            await this.sock.sendMessage(m.key.remoteJid, { text: result.message }, { quoted: m });
        } else {
            await this.sock.sendMessage(m.key.remoteJid, { text: `❌ Erro: ${result.error}` }, { quoted: m });
        }
        return true;
    }

    async openGroupCommand(m: any): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível abrir grupo: socket não disponível');
            return true;
        }
        const result = await this.openGroup(m.key.remoteJid);
        if (result.success) {
            await this.sock.sendMessage(m.key.remoteJid, { text: result.message }, { quoted: m });
        } else {
            await this.sock.sendMessage(m.key.remoteJid, { text: `❌ Erro: ${result.error}` }, { quoted: m });
        }
        return true;
    }

    /**
     * Fecha o grupo (apenas admins podem enviar mensagens)
     */
    async closeGroup(groupJid: string): Promise<{ success: boolean; message?: string; error?: string }> {
        if (!this._checkSocket()) {
            return { success: false, error: 'Socket não disponível' };
        }

        try {
            await this.sock.groupSettingUpdate(groupJid, 'announcement');
            this.logger.info(`✅ [GroupManagement] Grupo ${groupJid} fechado`);
            return { success: true, message: '🔒 Grupo fechado. Apenas admins podem enviar mensagens.' };
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao fechar grupo:`, e.message);
            return { success: false, error: 'Não foi possível fechar o grupo' };
        }
    }

    /**
     * Abre o grupo (todos podem enviar mensagens)
     */
    async openGroup(groupJid: string): Promise<{ success: boolean; message?: string; error?: string }> {
        if (!this._checkSocket()) {
            return { success: false, error: 'Socket não disponível' };
        }

        try {
            await this.sock.groupSettingUpdate(groupJid, 'not_announcement');
            this.logger.info(`✅ [GroupManagement] Grupo ${groupJid} aberto`);
            return { success: true, message: '🔓 Grupo aberto. Todos podem enviar mensagens.' };
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao abrir grupo:`, e.message);
            return { success: false, error: 'Não foi possível abrir o grupo' };
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // COMANDOS DE USUÁRIO: MUTE/UNMUTE
    // ═════════════════════════════════════════════════════════════════

    async muteUser(m: any, args: any[]) {
        const targets = this._extractTargets(m);
        const target = targets[0];

        if (!target) {
            if (this.sock) await this.sock.sendMessage(m.key.remoteJid, {
                text: '❌ Mencione ou responda a alguém para silenciar.'
            }, { quoted: m });
            return true;
        }

        const groupJid = m.key.remoteJid;
        // Tempo padrão base: 5 minutos
        let duration = 5;
        if (args.length > 0) {
            const parsed = parseInt(args[0]);
            if (!isNaN(parsed) && parsed > 0 && parsed <= 1440) {
                duration = parsed;
            }
        }

        // Se houver ModerationSystem, delega para ele (fonte única de verdade para enforcement)
        if (this.moderationSystem) {
            const muteInfo = this.moderationSystem.muteUser(groupJid, target, duration);

            // Opcional: persistir expiração também em groupSettings para relatórios externos
            if (!this.groupSettings[groupJid]) {
                this.groupSettings[groupJid] = {};
            }
            if (!this.groupSettings[groupJid].mutedUsers) {
                this.groupSettings[groupJid].mutedUsers = {};
            }
            this.groupSettings[groupJid].mutedUsers[target] = muteInfo.expires;
            this.saveGroupSettings();

            if (this.sock) {
                const userName = target.split('@')[0];
                const extra =
                    muteInfo.muteCount && muteInfo.muteCount > 1
                        ? `\n⚠️ Reincidência: ${muteInfo.muteCount} mute(s) hoje. Tempo ajustado automaticamente.`
                        : '';
                await this.sock.sendMessage(m.key.remoteJid, {
                    text: `🔇 Usuário @${userName} silenciado por ${muteInfo.muteMinutes} minuto(s).${extra}`,
                    mentions: [target]
                }, { quoted: m });
            }

            return true;
        }

        // Fallback: comportamento antigo baseado apenas em groupSettings
        if (!this.groupSettings[groupJid]) {
            this.groupSettings[groupJid] = {};
        }
        if (!this.groupSettings[groupJid].mutedUsers) {
            this.groupSettings[groupJid].mutedUsers = {};
        }

        const muteUntil = Date.now() + (duration * 60 * 1000);
        this.groupSettings[groupJid].mutedUsers[target] = muteUntil;
        this.saveGroupSettings();

        if (this.sock) {
            const userName = target.split('@')[0];
            await this.sock.sendMessage(m.key.remoteJid, {
                text: `🔇 Usuário @${userName} silenciado por ${duration} minuto(s).`,
                mentions: [target]
            }, { quoted: m });
        }

        return true;
    }

    async unmuteUser(m: any, args: any[]): Promise<boolean> {
        const targets = this._extractTargets(m);
        const target = targets[0];

        if (!target) {
            if (this.sock) await this.sock.sendMessage(m.key.remoteJid, {
                text: '❌ Mencione ou responda a alguém para des-silenciar.'
            }, { quoted: m });
            return true;
        }

        const groupJid = m.key.remoteJid;

        // Sempre tenta desmutar no ModerationSystem se disponível
        if (this.moderationSystem) {
            this.moderationSystem.unmuteUser(groupJid, target);
        }

        if (this.groupSettings[groupJid]?.mutedUsers?.[target]) {
            delete this.groupSettings[groupJid].mutedUsers[target];
            this.saveGroupSettings();

            if (this.sock) {
                const userName = target.split('@')[0];
                await this.sock.sendMessage(m.key.remoteJid, {
                    text: `🔊 Usuário @${userName} pode falar novamente.`,
                    mentions: [target]
                }, { quoted: m });
            }
        } else {
            if (this.sock) {
                await this.sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Este usuário não está silenciado.'
                }, { quoted: m });
            }
        }

        return true;
    }

    // Método auxiliar para verificar se usuário está mutado
    isUserMuted(groupJid: string, userJid: string): boolean {
        const mutedUsers = this.groupSettings[groupJid]?.mutedUsers || {};
        const muteUntil = mutedUsers[userJid];

        if (!muteUntil) return false;

        // Se o tempo expirou, remover o mute
        if (Date.now() > muteUntil) {
            delete mutedUsers[userJid];
            this.saveGroupSettings();
            return false;
        }

        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // COMANDOS DE AUTONOMIA WHATSAPP
    // ═════════════════════════════════════════════════════════════════

    async pinMessage(m: any, args: any[]) {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível fixar mensagem: socket não disponível');
            return false;
        }

        // Fixar mensagem quotada
        const quotedMsg = m.message?.extendedTextMessage?.contextInfo;
        if (!quotedMsg) {
            await this.sock.sendMessage(m.key.remoteJid, {
                text: '❌ Responda a uma mensagem para fixá-la.'
            }, { quoted: m });
            return true;
        }

        try {
            // Duração padrão: 24 horas (86400 segundos)
            let duration = 86400;
            if (args.length > 0) {
                const time = args[0].toLowerCase();
                if (time.endsWith('h')) duration = parseInt(time) * 3600;
                else if (time.endsWith('d')) duration = parseInt(time) * 86400;
                else if (time.endsWith('m')) duration = parseInt(time) * 60;
            }

            await this.sock.sendMessage(m.key.remoteJid, {
                pin: quotedMsg.stanzaId,
                type: 1,
                time: duration
            });

            await this.sock.sendMessage(m.key.remoteJid, {
                text: `📌 Mensagem fixada por ${duration >= 86400 ? Math.floor(duration / 86400) + 'd' : duration >= 3600 ? Math.floor(duration / 3600) + 'h' : Math.floor(duration / 60) + 'm'}`
            }, { quoted: m });
        } catch (e: any) {
            this.logger?.error('❌ [GroupManagement] Erro ao fixar mensagem:', e.message);
            await this.sock.sendMessage(m.key.remoteJid, {
                text: `❌ Não foi possível fixar a mensagem.`
            }, { quoted: m });
        }

        return true;
    }

    async unpinMessage(m: any): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível desafixar mensagem: socket não disponível');
            return false;
        }

        const quotedMsg = m.message?.extendedTextMessage?.contextInfo;
        if (!quotedMsg) {
            await this.sock.sendMessage(m.key.remoteJid, {
                text: '❌ Responda a uma mensagem fixada para desafixá-la.'
            }, { quoted: m });
            return true;
        }

        try {
            await this.sock.sendMessage(m.key.remoteJid, {
                pin: quotedMsg.stanzaId,
                type: 0
            });

            await this.sock.sendMessage(m.key.remoteJid, {
                text: '📌🚫 Mensagem desafixada.'
            }, { quoted: m });
        } catch (e: any) {
            this.logger?.error('❌ [GroupManagement] Erro ao desafixar mensagem:', e.message);
            await this.sock.sendMessage(m.key.remoteJid, {
                text: `❌ Não foi possível desafixar a mensagem.`
            }, { quoted: m });
        }

        return true;
    }

    async markAsRead(m: any): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível marcar como lido: socket não disponível');
            return false;
        }

        try {
            // Marca a mensagem e todas anteriores como lidas
            await this.sock.readMessages([m.key]);

            // Confirmar silenciosamente (evitar spam)
            this.logger?.info('✅ [GroupManagement] Mensagens marcadas como lidas');
        } catch (e: any) {
            this.logger?.error('❌ [GroupManagement] Erro ao marcar como lido:', e.message);
        }

        return true;
    }

    async reactToMessage(m: any, args: any[]): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível reagir: socket não disponível');
            return false;
        }

        const quotedMsg = m.message?.extendedTextMessage?.contextInfo;
        if (!quotedMsg) {
            await this.sock.sendMessage(m.key.remoteJid, {
                text: '❌ Responda a uma mensagem para reagir. Uso: #reagir 👍'
            }, { quoted: m });
            return true;
        }

        const emoji = args[0] || '👍';

        try {
            await this.sock.sendMessage(m.key.remoteJid, {
                react: {
                    text: emoji,
                    key: quotedMsg
                }
            });

            // Confirmação silenciosa
            this.logger?.info(`✅ [GroupManagement] Reagiu com ${emoji}`);
        } catch (e: any) {
            this.logger?.error('❌ [GroupManagement] Erro ao reagir:', e.message);
        }

        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // COMANDOS DE GERENCIAMENTO DE MEMBROS
    // ═════════════════════════════════════════════════════════════════

    async kickUser(m: any, args: any[]): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível remover usuário: socket não disponível');
            return true;
        }

        const targets = this._extractTargets(m);
        const groupJid = m.key.remoteJid;

        if (targets.length === 0) {
            await this.sock.sendMessage(groupJid, {
                text: '❌ Mencione ou responda a alguém para remover.'
            }, { quoted: m });
            return true;
        }

        try {
            await this.sock.groupParticipantsUpdate(groupJid, targets, 'remove');
            
            const mentions = targets.map((t: string) => `@${t.split('@')[0]}`).join(', ');
            await this.sock.sendMessage(groupJid, {
                text: `👢 Usuário(s) ${mentions} removido(s) do grupo.`,
                mentions: targets
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] Usuários removidos: ${targets.join(', ')}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao remover usuário:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível remover o usuário.'
            }, { quoted: m });
        }

        return true;
    }

    async addUser(m: any, args: any[]): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível adicionar usuário: socket não disponível');
            return true;
        }

        const groupJid = m.key.remoteJid;

        if (args.length === 0) {
            await this.sock.sendMessage(groupJid, {
                text: '❌ Informe o número do usuário para adicionar.\nExemplo: #add 5511999999999'
            }, { quoted: m });
            return true;
        }

        // Extrai números dos argumentos
        const numbers = args.map((arg: string) => {
            const cleaned = arg.replace(/\D/g, '');
            return cleaned.length > 0 ? `${cleaned}@s.whatsapp.net` : null;
        }).filter(Boolean);

        if (numbers.length === 0) {
            await this.sock.sendMessage(groupJid, {
                text: '❌ Nenhum número válido encontrado.'
            }, { quoted: m });
            return true;
        }

        try {
            const result = await this.sock.groupParticipantsUpdate(groupJid, numbers, 'add');
            
            // Verifica resultados
            const success = result.filter((r: any) => r.status === 200);
            const failed = result.filter((r: any) => r.status !== 200);

            let message = '';
            if (success.length > 0) {
                const mentions = success.map((r: any) => `@${r.jid.split('@')[0]}`).join(', ');
                message += `✅ Usuário(s) ${mentions} adicionado(s) com sucesso.\n`;
            }
            if (failed.length > 0) {
                message += `❌ Falha ao adicionar ${failed.length} usuário(s). Verifique se os números estão corretos e se o grupo permite adições.`;
            }

            await this.sock.sendMessage(groupJid, { text: message.trim() }, { quoted: m });
            this.logger.info(`✅ [GroupManagement] Tentativa de adicionar: ${numbers.join(', ')}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao adicionar usuário:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível adicionar o usuário. Verifique se o número está correto.'
            }, { quoted: m });
        }

        return true;
    }

    async promoteUser(m: any, args: any[]): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível promover usuário: socket não disponível');
            return true;
        }

        const targets = this._extractTargets(m);
        const groupJid = m.key.remoteJid;

        if (targets.length === 0) {
            await this.sock.sendMessage(groupJid, {
                text: '❌ Mencione ou responda a alguém para promover a admin.'
            }, { quoted: m });
            return true;
        }

        try {
            await this.sock.groupParticipantsUpdate(groupJid, targets, 'promote');
            
            const mentions = targets.map((t: string) => `@${t.split('@')[0]}`).join(', ');
            await this.sock.sendMessage(groupJid, {
                text: `👑 Usuário(s) ${mentions} promovido(s) a admin.`,
                mentions: targets
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] Usuários promovidos: ${targets.join(', ')}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao promover usuário:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível promover o usuário.'
            }, { quoted: m });
        }

        return true;
    }

    async demoteUser(m: any, args: any[]): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível rebaixar usuário: socket não disponível');
            return true;
        }

        const targets = this._extractTargets(m);
        const groupJid = m.key.remoteJid;

        if (targets.length === 0) {
            await this.sock.sendMessage(groupJid, {
                text: '❌ Mencione ou responda a alguém para rebaixar de admin.'
            }, { quoted: m });
            return true;
        }

        try {
            await this.sock.groupParticipantsUpdate(groupJid, targets, 'demote');
            
            const mentions = targets.map((t: string) => `@${t.split('@')[0]}`).join(', ');
            await this.sock.sendMessage(groupJid, {
                text: `⬇️ Usuário(s) ${mentions} rebaixado(s) de admin.`,
                mentions: targets
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] Usuários rebaixados: ${targets.join(', ')}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao rebaixar usuário:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível rebaixar o usuário.'
            }, { quoted: m });
        }

        return true;
    }

    /**
     * Verifica se um usuário é admin do grupo
     */
    async isUserAdmin(groupJid: string, userJid: string): Promise<boolean> {
        if (!this._checkSocket()) {
            return false;
        }

        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            const participant = metadata.participants.find((p: any) => p.id === userJid);
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao verificar admin:`, e.message);
            return false;
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // COMANDOS DE LINK DO GRUPO
    // ═════════════════════════════════════════════════════════════════

    async getGroupLink(m: any): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível obter link: socket não disponível');
            return true;
        }

        const groupJid = m.key.remoteJid;

        try {
            const code = await this.sock.groupInviteCode(groupJid);
            const link = `https://chat.whatsapp.com/${code}`;
            
            await this.sock.sendMessage(groupJid, {
                text: `🔗 *Link do Grupo:*\n\n${link}\n\n⚠️ Não compartilhe com pessoas não autorizadas.`
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] Link gerado para ${groupJid}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao obter link:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível obter o link. Verifique se o bot é admin do grupo.'
            }, { quoted: m });
        }

        return true;
    }

    async revokeGroupLink(m: any): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível revogar link: socket não disponível');
            return true;
        }

        const groupJid = m.key.remoteJid;

        try {
            await this.sock.groupRevokeInvite(groupJid);
            
            await this.sock.sendMessage(groupJid, {
                text: '✅ Link do grupo revogado com sucesso!\n\n🔗 O link antigo não funciona mais.'
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] Link revogado para ${groupJid}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao revogar link:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível revogar o link. Verifique se o bot é admin do grupo.'
            }, { quoted: m });
        }

        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // COMANDOS DE INFORMAÇÃO DO GRUPO
    // ═════════════════════════════════════════════════════════════════

    async tagAll(m: any, args: any[]): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível taguear todos: socket não disponível');
            return true;
        }

        const groupJid = m.key.remoteJid;
        const message = args.join(' ') || '📢 Chamando todos...';

        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            const participants = metadata.participants.map((p: any) => p.id);

            await this.sock.sendMessage(groupJid, {
                text: `${message}\n\n${participants.map((p: string) => `@${p.split('@')[0]}`).join(' ')}`,
                mentions: participants
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] TagAll executado em ${groupJid}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro no tagAll:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível taguear todos.'
            }, { quoted: m });
        }

        return true;
    }

    async getGroupInfo(m: any): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível obter info: socket não disponível');
            return true;
        }

        const groupJid = m.key.remoteJid;

        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            
            const creationDate = metadata.creation ? new Date(metadata.creation * 1000).toLocaleDateString('pt-BR') : 'Desconhecida';
            const owner = metadata.owner ? `@${metadata.owner.split('@')[0]}` : 'Desconhecido';
            
            const admins = metadata.participants
                .filter((p: any) => p.admin === 'admin' || p.admin === 'superadmin')
                .map((p: any) => `@${p.id.split('@')[0]}`);
            
            const totalMembers = metadata.participants.length;
            const totalAdmins = admins.length;

            const infoText = `📊 *Informações do Grupo*\n\n` +
                `🏷️ *Nome:* ${metadata.subject}\n` +
                `📝 *Descrição:* ${metadata.desc || 'Sem descrição'}\n` +
                `👥 *Total de Membros:* ${totalMembers}\n` +
                `👑 *Total de Admins:* ${totalAdmins}\n` +
                `📅 *Criado em:* ${creationDate}\n` +
                `👤 *Criador:* ${owner}\n\n` +
                `👑 *Admins:*\n${admins.slice(0, 10).join('\n')}${admins.length > 10 ? `\n...e mais ${admins.length - 10} admins` : ''}`;

            await this.sock.sendMessage(groupJid, {
                text: infoText,
                mentions: metadata.participants.map((p: any) => p.id)
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] Info obtida para ${groupJid}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao obter info:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível obter informações do grupo.'
            }, { quoted: m });
        }

        return true;
    }

    async listMembers(m: any): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível listar membros: socket não disponível');
            return true;
        }

        const groupJid = m.key.remoteJid;

        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            const participants = metadata.participants;

            let text = `👥 *Lista de Membros (${participants.length})*\n\n`;
            
            participants.forEach((p: any, index: number) => {
                const admin = p.admin === 'superadmin' ? '👑 Criador' : p.admin === 'admin' ? '⭐ Admin' : '👤 Membro';
                text += `${index + 1}. @${p.id.split('@')[0]} - ${admin}\n`;
            });

            await this.sock.sendMessage(groupJid, {
                text: text,
                mentions: participants.map((p: any) => p.id)
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] Lista de membros enviada para ${groupJid}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao listar membros:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível listar os membros.'
            }, { quoted: m });
        }

        return true;
    }

    async listAdmins(m: any): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível listar admins: socket não disponível');
            return true;
        }

        const groupJid = m.key.remoteJid;

        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            const admins = metadata.participants.filter((p: any) => p.admin === 'admin' || p.admin === 'superadmin');

            if (admins.length === 0) {
                await this.sock.sendMessage(groupJid, {
                    text: '❌ Nenhum admin encontrado neste grupo.'
                }, { quoted: m });
                return true;
            }

            let text = `👑 *Lista de Admins (${admins.length})*\n\n`;
            
            admins.forEach((p: any, index: number) => {
                const role = p.admin === 'superadmin' ? '👑 Criador' : '⭐ Admin';
                text += `${index + 1}. @${p.id.split('@')[0]} - ${role}\n`;
            });

            await this.sock.sendMessage(groupJid, {
                text: text,
                mentions: admins.map((p: any) => p.id)
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] Lista de admins enviada para ${groupJid}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao listar admins:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível listar os admins.'
            }, { quoted: m });
        }

        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // COMANDOS DE CONFIGURAÇÃO DO GRUPO
    // ═════════════════════════════════════════════════════════════════

    async setGroupDesc(m: any, args: any[]): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível definir descrição: socket não disponível');
            return true;
        }

        const groupJid = m.key.remoteJid;
        const description = args.join(' ');

        if (!description) {
            await this.sock.sendMessage(groupJid, {
                text: '❌ Informe a descrição do grupo.\nExemplo: #setdesc Bem-vindos ao nosso grupo!'
            }, { quoted: m });
            return true;
        }

        try {
            await this.sock.groupUpdateDescription(groupJid, description);
            
            await this.sock.sendMessage(groupJid, {
                text: '✅ Descrição do grupo atualizada com sucesso!'
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] Descrição atualizada para ${groupJid}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao definir descrição:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível atualizar a descrição. Verifique se o bot é admin.'
            }, { quoted: m });
        }

        return true;
    }

    async setGroupPhoto(m: any): Promise<boolean> {
        if (!this._checkSocket()) {
            this.logger.error('❌ [GroupManagement] Não foi possível definir foto: socket não disponível');
            return true;
        }

        const groupJid = m.key.remoteJid;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted?.imageMessage) {
            await this.sock.sendMessage(groupJid, {
                text: '❌ Responda a uma imagem para definir como foto do grupo.'
            }, { quoted: m });
            return true;
        }

        try {
            const stream = await this.sock.downloadContentFromMessage(quoted.imageMessage, 'image');
            let buffer = Buffer.from([]);
            
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            await this.sock.updateProfilePicture(groupJid, buffer);
            
            await this.sock.sendMessage(groupJid, {
                text: '✅ Foto do grupo atualizada com sucesso!'
            }, { quoted: m });
            
            this.logger.info(`✅ [GroupManagement] Foto atualizada para ${groupJid}`);
        } catch (e: any) {
            this.logger.error(`❌ [GroupManagement] Erro ao definir foto:`, e.message);
            await this.sock.sendMessage(groupJid, {
                text: '❌ Não foi possível atualizar a foto. Verifique se o bot é admin e se a imagem é válida.'
            }, { quoted: m });
        }

        return true;
    }

    async toggleRequireRegister(m: any, value: string): Promise<boolean> {
        const groupJid = m.key.remoteJid;
        const require = value === 'on';

        if (!this.groupSettings[groupJid]) {
            this.groupSettings[groupJid] = {};
        }

        this.groupSettings[groupJid].requireRegistration = require;
        this.saveGroupSettings();

        // Também salvar no arquivo específico de registro (compatibilidade com PermissionManager)
        try {
            const configPath = './temp/akira_data/group_registration_config.json';
            
            let config: any = {};
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf8');
                config = JSON.parse(data || '{}');
            }

            if (!config[groupJid]) {
                config[groupJid] = {};
            }
            config[groupJid].requireRegistration = require;

            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        } catch (e: any) {
            this.logger?.error('Erro ao salvar config de registro:', e);
        }

        if (this.sock) {
            const messageText = require
                ? '✅ **Registro Obrigatório Ativado**\n\n' +
                'A partir de agora, usuários NÃO registrados não poderão usar comandos comuns neste grupo.\n\n' +
                '📝 Para se registrar: `#registrar Nome|Idade`'
                : '✅ **Registro Opcional**\n\n' +
                'Usuários podem usar comandos comuns sem se registrar.';

            await this.sock.sendMessage(groupJid, { text: messageText }, { quoted: m });
        }

        return true;
    }
}

export default GroupManagement;
