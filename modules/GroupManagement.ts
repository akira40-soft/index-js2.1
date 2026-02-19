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

    constructor(sock: any, config: any = null) {
        this.sock = sock;
        this.config = config || ConfigManager.getInstance();
        this.logger = console;

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
     * Processa comandos de grupo
     */
    async handleCommand(m: any, command: string, args: any[]) {
        // Verifica se é grupo
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        if (!isGroup) {
            if (this.sock) await this.sock.sendMessage(m.key.remoteJid, { text: '📵 Comandos de grupo apenas em grupos.' }, { quoted: m });
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
            await this.sock.sendMessage(groupJid, { text: `❌ Use: *#${setting} on/off*` }, { quoted: m });
            return true;
        }

        if (!this.groupSettings[groupJid]) this.groupSettings[groupJid] = {};

        this.groupSettings[groupJid][setting] = state;
        this.saveGroupSettings();

        const statusStr = state ? 'ATIVADO' : 'DESATIVADO';
        await this.sock.sendMessage(groupJid, { text: `✅ **${setting.toUpperCase()}** agora está **${statusStr}** para este grupo.` }, { quoted: m });
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
        const result = await this.closeGroup(m.key.remoteJid);
        if (result.success) {
            await this.sock.sendMessage(m.key.remoteJid, { text: result.message }, { quoted: m });
        } else {
            await this.sock.sendMessage(m.key.remoteJid, { text: `❌ Erro: ${result.error}` }, { quoted: m });
        }
        return true;
    }

    async openGroupCommand(m: any): Promise<boolean> {
        const result = await this.openGroup(m.key.remoteJid);
        if (result.success) {
            await this.sock.sendMessage(m.key.remoteJid, { text: result.message }, { quoted: m });
        } else {
            await this.sock.sendMessage(m.key.remoteJid, { text: `❌ Erro: ${result.error}` }, { quoted: m });
        }
        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // COMANDOS DE USUÁRIO: MUTE/UNMUTE
    // ═════════════════════════════════════════════════════════════════

    async muteUser(m: any, args: any[]) {
        const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
            m.message?.extendedTextMessage?.contextInfo?.participant;

        if (!target) {
            if (this.sock) await this.sock.sendMessage(m.key.remoteJid, {
                text: '❌ Mencione ou responda a alguém para silenciar.'
            }, { quoted: m });
            return true;
        }

        // Tempo padrão: 5 minutos
        let duration = 5;
        if (args.length > 0) {
            const parsed = parseInt(args[0]);
            if (!isNaN(parsed) && parsed > 0 && parsed <= 1440) {
                duration = parsed;
            }
        }

        // Armazenar mute em memória e no banco
        const groupJid = m.key.remoteJid;
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
        const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
            m.message?.extendedTextMessage?.contextInfo?.participant;

        if (!target) {
            if (this.sock) await this.sock.sendMessage(m.key.remoteJid, {
                text: '❌ Mencione ou responda a alguém para des-silenciar.'
            }, { quoted: m });
            return true;
        }

        const groupJid = m.key.remoteJid;
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
        if (!this.sock) return false;

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
        } catch (e) {
            this.logger?.error('Erro ao fixar mensagem:', e);
            await this.sock.sendMessage(m.key.remoteJid, {
                text: `❌ Erro ao fixar: ${e.message}`
            }, { quoted: m });
        }

        return true;
    }

    async unpinMessage(m: any): Promise<boolean> {
        if (!this.sock) return false;

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
            this.logger?.error('Erro ao desafixar mensagem:', e);
            await this.sock.sendMessage(m.key.remoteJid, {
                text: `❌ Erro ao desafixar: ${e.message}`
            }, { quoted: m });
        }

        return true;
    }

    async markAsRead(m: any): Promise<boolean> {
        if (!this.sock) return false;

        try {
            // Marca a mensagem e todas anteriores como lidas
            await this.sock.readMessages([m.key]);

            // Confirmar silenciosamente (evitar spam)
            this.logger?.info('✅ Mensagens marcadas como lidas');
        } catch (e: any) {
            this.logger?.error('Erro ao marcar como lido:', e);
            await this.sock.sendMessage(m.key.remoteJid, {
                text: `❌ Erro: ${e.message}`
            }, { quoted: m });
        }

        return true;
    }

    async reactToMessage(m: any, args: any[]): Promise<boolean> {
        if (!this.sock) return false;

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
            this.logger?.info(`✅ Reagiu com ${emoji}`);
        } catch (e: any) {
            this.logger?.error('Erro ao reagir:', e);
            await this.sock.sendMessage(m.key.remoteJid, {
                text: `❌ Erro: ${e.message}`
            }, { quoted: m });
        }

        return true;
    }

    async kickUser(m: any, args: any[]): Promise<boolean> {
        // Validação de admin pode ser feita aqui ou no CommandHandler
        if (!m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length && !m.message?.extendedTextMessage?.contextInfo?.participant) {
            if (this.sock) await this.sock.sendMessage(m.key.remoteJid, { text: '❌ Mencione ou responda a alguém para banir.' }, { quoted: m });
            return true;
        }
        const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || m.message?.extendedTextMessage?.contextInfo?.participant;
        if (target && this.sock) {
            try {
                await this.sock.groupParticipantsUpdate(m.key.remoteJid, [target], 'remove');
                await this.sock.sendMessage(m.key.remoteJid, { text: '🔨 Banido.' }, { quoted: m });
            } catch (e: any) {
                console.error('Erro no kick:', e);
                const msg = e.toString().includes('forbidden') ? '❌ Eu preciso ser admin do grupo para fazer isso.' : `❌ Erro: ${e.message}`;
                await this.sock.sendMessage(m.key.remoteJid, { text: msg }, { quoted: m });
            }
        }
        return true;
    }

    async addUser(m: any, args: any[]): Promise<boolean> {
        if (!args[0]) {
            if (this.sock) await this.sock.sendMessage(m.key.remoteJid, { text: '❌ Forneça o número.' }, { quoted: m });
            return true;
        }
        let num = args[0].replace(/\D/g, '');
        if (!num.endsWith('@s.whatsapp.net')) num += '@s.whatsapp.net';
        if (this.sock) {
            try {
                await this.sock.groupParticipantsUpdate(m.key.remoteJid, [num], 'add');
            } catch (e: any) {
                console.error('Erro no add:', e);
                const msg = e.toString().includes('forbidden') ? '❌ Eu preciso ser admin do grupo para fazer isso.' : `❌ Erro: ${e.message}`;
                await this.sock.sendMessage(m.key.remoteJid, { text: msg }, { quoted: m });
            }
        }
        return true;
    }

    async promoteUser(m: any, args: any[]): Promise<boolean> {
        const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || m.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return true;
        if (this.sock) {
            try {
                await this.sock.groupParticipantsUpdate(m.key.remoteJid, [target], 'promote');
                await this.sock.sendMessage(m.key.remoteJid, { text: '👑 Promovido a admin.' }, { quoted: m });
            } catch (e: any) {
                console.error('Erro no promote:', e);
                const msg = e.toString().includes('forbidden') ? '❌ Eu preciso ser admin do grupo para fazer isso.' : `❌ Erro: ${e.message}`;
                await this.sock.sendMessage(m.key.remoteJid, { text: msg }, { quoted: m });
            }
        }
        return true;
    }

    async demoteUser(m: any, args: any[]): Promise<boolean> {
        const target = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || m.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return true;
        if (this.sock) {
            try {
                await this.sock.groupParticipantsUpdate(m.key.remoteJid, [target], 'demote');
                await this.sock.sendMessage(m.key.remoteJid, { text: '📉 Rebaixado a membro.' }, { quoted: m });
            } catch (e: any) {
                console.error('Erro no demote:', e);
                const msg = e.toString().includes('forbidden') ? '❌ Eu preciso ser admin do grupo para fazer isso.' : `❌ Erro: ${e.message}`;
                await this.sock.sendMessage(m.key.remoteJid, { text: msg }, { quoted: m });
            }
        }
        return true;
    }

    async getGroupLink(m: any): Promise<boolean> {
        if (!this.sock) return true;
        try {
            const code = await this.sock.groupInviteCode(m.key.remoteJid);
            await this.sock.sendMessage(m.key.remoteJid, {
                text: `🔗 *Link de Convite do Grupo*\n\nhttps://chat.whatsapp.com/${code}\n\n_Use #revlink para gerar um novo link_`
            }, { quoted: m });
        } catch (e: any) {
            await this.sock.sendMessage(m.key.remoteJid, { text: '❌ Preciso ser admin para obter o link.' }, { quoted: m });
        }
        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // NOVO: REVOGAR LINK
    // ═════════════════════════════════════════════════════════════════

    async revokeGroupLink(m: any): Promise<boolean> {
        if (!this.sock) return true;
        try {
            const newCode = await this.sock.groupRevokeInvite(m.key.remoteJid);
            await this.sock.sendMessage(m.key.remoteJid, {
                text: `🔄 *Link revogado com sucesso!*\n\n🆕 Novo link:\nhttps://chat.whatsapp.com/${newCode}\n\n⚠️ O link antigo não funciona mais.`
            }, { quoted: m });
        } catch (e: any) {
            await this.sock.sendMessage(m.key.remoteJid, { text: '❌ Preciso ser admin para revogar o link.' }, { quoted: m });
        }
        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // NOVO: INFO DO GRUPO
    // ═════════════════════════════════════════════════════════════════

    async getGroupInfo(m: any): Promise<boolean> {
        if (!this.sock) return true;
        try {
            const meta = await this.sock.groupMetadata(m.key.remoteJid);
            const admins = meta.participants.filter((p: any) => p.admin === 'admin' || p.admin === 'superadmin');
            const members = meta.participants.length;
            const criado = meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('pt-BR') : 'Desconhecido';
            const desc = meta.desc?.toString() || 'Sem descrição';

            let linkTxt = '🔒 Apenas para admins';
            try {
                const code = await this.sock.groupInviteCode(m.key.remoteJid);
                linkTxt = `https://chat.whatsapp.com/${code}`;
            } catch (_) { }

            const text =
                `╔══════════════════════════════════╗
║      📋 *INFO DO GRUPO*           ║
╚══════════════════════════════════╝

📛 *Nome:* ${meta.subject}
📝 *Descrição:*
${desc}

👥 *Membros:* ${members}
👑 *Admins:* ${admins.length}
📅 *Criado em:* ${criado}
🔗 *Link:* ${linkTxt}`;

            await this.sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
        } catch (e: any) {
            await this.sock.sendMessage(m.key.remoteJid, { text: `❌ Erro ao obter info: ${e.message}` }, { quoted: m });
        }
        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // NOVO: LISTAR MEMBROS
    // ═════════════════════════════════════════════════════════════════

    async listMembers(m: any): Promise<boolean> {
        if (!this.sock) return true;
        try {
            const meta = await this.sock.groupMetadata(m.key.remoteJid);
            const parts = meta.participants;

            let lista = `👥 *MEMBROS DO GRUPO* (${parts.length})\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            parts.forEach((p: any, i: number) => {
                const num = p.id.split('@')[0];
                const tag = p.admin === 'superadmin' ? '👑' : p.admin === 'admin' ? '⭐' : '👤';
                lista += `${String(i + 1).padStart(2, '0')}. ${tag} +${num}\n`;
            });
            lista += `\n━━━━━━━━━━━━━━━━━━━━━━\n👑 Dono  ⭐ Admin  👤 Membro`;

            await this.sock.sendMessage(m.key.remoteJid, { text: lista }, { quoted: m });
        } catch (e: any) {
            await this.sock.sendMessage(m.key.remoteJid, { text: `❌ Erro: ${e.message}` }, { quoted: m });
        }
        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // NOVO: LISTAR ADMINS
    // ═════════════════════════════════════════════════════════════════

    async listAdmins(m: any): Promise<boolean> {
        if (!this.sock) return true;
        try {
            const meta = await this.sock.groupMetadata(m.key.remoteJid);
            const admins = meta.participants.filter((p: any) => p.admin === 'admin' || p.admin === 'superadmin');

            if (!admins.length) {
                await this.sock.sendMessage(m.key.remoteJid, { text: '❌ Nenhum admin encontrado.' }, { quoted: m });
                return true;
            }

            let lista = `👑 *ADMINISTRADORES* (${admins.length})\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            const mentions: string[] = [];
            admins.forEach((p: any, i: number) => {
                const num = p.id.split('@')[0];
                const tag = p.admin === 'superadmin' ? '👑 Dono' : '⭐ Admin';
                lista += `${i + 1}. @${num} — ${tag}\n`;
                mentions.push(p.id);
            });

            await this.sock.sendMessage(m.key.remoteJid, { text: lista, mentions }, { quoted: m });
        } catch (e: any) {
            await this.sock.sendMessage(m.key.remoteJid, { text: `❌ Erro: ${e.message}` }, { quoted: m });
        }
        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // NOVO: DEFINIR DESCRIÇÃO DO GRUPO
    // ═════════════════════════════════════════════════════════════════

    async setGroupDesc(m: any, args: any[]): Promise<boolean> {
        if (!this.sock) return true;
        const descricao = args.join(' ').trim();
        if (!descricao) {
            await this.sock.sendMessage(m.key.remoteJid, { text: '❌ Uso: *#setdesc <nova descrição>*' }, { quoted: m });
            return true;
        }
        try {
            await this.sock.groupUpdateDescription(m.key.remoteJid, descricao);
            await this.sock.sendMessage(m.key.remoteJid, {
                text: `✅ Descrição do grupo atualizada!\n\n📝 _${descricao}_`
            }, { quoted: m });
        } catch (e: any) {
            await this.sock.sendMessage(m.key.remoteJid, { text: '❌ Preciso ser admin para alterar a descrição.' }, { quoted: m });
        }
        return true;
    }

    // ═════════════════════════════════════════════════════════════════
    // NOVO: DEFINIR FOTO DO GRUPO
    // ═════════════════════════════════════════════════════════════════

    async setGroupPhoto(m: any): Promise<boolean> {
        if (!this.sock) return true;
        try {
            const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');

            // Busca imagem na mensagem atual ou citada
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const imgMsg = m.message?.imageMessage || quoted?.imageMessage;

            if (!imgMsg) {
                await this.sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Envie ou responda uma *imagem* com o comando *#setfoto*'
                }, { quoted: m });
                return true;
            }

            const stream = await downloadContentFromMessage(imgMsg, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream as any) buffer = Buffer.concat([buffer, chunk]);

            await this.sock.updateProfilePicture(m.key.remoteJid, buffer);
            await this.sock.sendMessage(m.key.remoteJid, { text: '✅ Foto do grupo atualizada!' }, { quoted: m });
        } catch (e: any) {
            await this.sock.sendMessage(m.key.remoteJid, { text: '❌ Preciso ser admin para alterar a foto do grupo.' }, { quoted: m });
        }
        return true;
    }

    async tagAll(m: any, args: any[]): Promise<boolean> {
        if (this.sock) {
            const groupMetadata = await this.sock.groupMetadata(m.key.remoteJid);
            const participants = groupMetadata.participants.map((p: any) => p.id);
            const msg = args.length > 0 ? args.join(' ') : '📢 Atenção todos!';
            await this.sock.sendMessage(m.key.remoteJid, { text: msg, mentions: participants }, { quoted: m });
        }
        return true;
    }

    /**
    * Carrega configurações de grupos
    */
    loadGroupSettings() {
        try {
            if (fs.existsSync(this.groupsDataPath)) {
                const data = fs.readFileSync(this.groupsDataPath, 'utf8');
                return JSON.parse(data || '{}');
            }
        } catch (e) {
            this.logger.warn('⚠️ Erro ao carregar configurações de grupo:', e.message);
        }
        return {};
    }

    /**
    * Salva configurações de grupos
    */
    saveGroupSettings() {
        try {
            const dir = path.dirname(this.groupsDataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.groupsDataPath, JSON.stringify(this.groupSettings, null, 2));
        } catch (e) {
            this.logger.error('❌ Erro ao salvar configurações de grupo:', e.message);
        }
    }

    /**
    * Carrega ações programadas
    */
    loadScheduledActions() {
        try {
            if (fs.existsSync(this.scheduledActionsPath)) {
                const data = fs.readFileSync(this.scheduledActionsPath, 'utf8');
                return JSON.parse(data || '{}');
            }
        } catch (e) {
            this.logger.warn('⚠️ Erro ao carregar ações programadas:', e.message);
        }
        return {};
    }

    /**
    * Salva ações programadas
    */
    saveScheduledActions() {
        try {
            const dir = path.dirname(this.scheduledActionsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.scheduledActionsPath, JSON.stringify(this.scheduledActions, null, 2));
        } catch (e) {
            this.logger.error('❌ Erro ao salvar ações programadas:', e.message);
        }
    }

    /**
    * Verifica se o bot é admin do grupo
    */
    async isBotAdmin(groupJid: string): Promise<boolean> {
        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            const botJid = this.sock.user?.id;
            return metadata.participants.some(
                (p: any) => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')
            );
        } catch (e: any) {
            this.logger.error('❌ Erro ao verificar admin:', e.message);
            return false;
        }
    }

    /**
    * Verifica se usuário é admin
    */
    async isUserAdmin(groupJid: string, userJid: string): Promise<boolean> {
        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            // Normaliza JID removendo sufixo de dispositivo (:1, :2, etc) para multi-device
            const normalizedUserJid = userJid ? userJid.split(':')[0] : userJid;
            const participant = metadata.participants.find((p: any) => (p.id || '').split(':')[0] === normalizedUserJid);
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (e: any) {
            return false;
        }
    }

    /**
    * Obtém foto do grupo
    */
    async getGroupPhoto(groupJid: string): Promise<any> {
        try {
            const photoUrl = await this.sock.profilePictureUrl(groupJid, 'image');
            return {
                success: true,
                url: photoUrl,
                hasPhoto: !!photoUrl
            };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
    * Define foto do grupo via buffer (uso programático)
    */
    async setGroupPhotoBuffer(groupJid: string, imageBuffer: Buffer) {
        try {
            // Verificar se é admin
            if (!await this.isBotAdmin(groupJid)) {
                return { success: false, error: 'Bot não é admin do grupo' };
            }

            await this.sock.updateProfilePicture(groupJid, imageBuffer);

            this.logger.info(`✅ Foto do grupo ${groupJid} atualizada`);
            return { success: true, message: 'Foto do grupo atualizada com sucesso' };
        } catch (e: any) {
            this.logger.error('❌ Erro ao definir foto do grupo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Define nome do grupo
    */
    async setGroupName(groupJid: string, newName: string): Promise<any> {
        try {
            // Verificar se é admin
            if (!await this.isBotAdmin(groupJid)) {
                return { success: false, error: 'Bot não é admin do grupo' };
            }

            // Limitar comprimento (limite do WhatsApp é 100 caracteres)
            if (newName.length > 100) {
                newName = newName.substring(0, 100);
            }

            await this.sock.groupUpdateSubject(groupJid, newName);

            this.logger.info(`✅ Nome do grupo ${groupJid} alterado para: ${newName}`);
            return { success: true, message: `Nome do grupo alterado para: ${newName}` };
        } catch (e: any) {
            this.logger.error('❌ Erro ao definir nome do grupo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Define descrição do grupo
    */
    async setGroupDescription(groupJid: string, description: string): Promise<any> {
        try {
            // Verificar se é admin
            if (!await this.isBotAdmin(groupJid)) {
                return { success: false, error: 'Bot não é admin do grupo' };
            }

            // Limitar comprimento (limite do WhatsApp é 512 caracteres)
            if (description.length > 512) {
                description = description.substring(0, 512);
            }

            await this.sock.groupUpdateDescription(groupJid, description);

            this.logger.info(`✅ Descrição do grupo ${groupJid} atualizada`);
            return { success: true, message: 'Descrição do grupo atualizada com sucesso' };
        } catch (e: any) {
            this.logger.error('❌ Erro ao definir descrição do grupo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Fecha o grupo (apenas admins podem enviar mensagens)
    */
    async closeGroup(groupJid: string): Promise<any> {
        try {
            // Verificar se é admin
            if (!await this.isBotAdmin(groupJid)) {
                return { success: false, error: 'Bot não é admin do grupo' };
            }

            await this.sock.groupSettingUpdate(groupJid, 'locked');

            // Atualizar configurações
            if (!this.groupSettings[groupJid]) {
                this.groupSettings[groupJid] = {};
            }
            this.groupSettings[groupJid].locked = true;
            this.saveGroupSettings();

            this.logger.info(`✅ Grupo ${groupJid} fechado`);
            return {
                success: true,
                message: '🔒 Grupo fechado!\n\nApenas administradores podem enviar mensagens agora.',
                action: 'closed'
            };
        } catch (e: any) {
            this.logger.error('❌ Erro ao fechar grupo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Abre o grupo (todos podem enviar mensagens)
    */
    async openGroup(groupJid: string): Promise<any> {
        try {
            // Verificar se é admin
            if (!await this.isBotAdmin(groupJid)) {
                return { success: false, error: 'Bot não é admin do grupo' };
            }

            await this.sock.groupSettingUpdate(groupJid, 'unlocked');

            // Atualizar configurações
            if (!this.groupSettings[groupJid]) {
                this.groupSettings[groupJid] = {};
            }
            this.groupSettings[groupJid].locked = false;
            this.saveGroupSettings();

            this.logger.info(`✅ Grupo ${groupJid} aberto`);
            return {
                success: true,
                message: '🔓 Grupo aberto!\n\nTodos os membros podem enviar mensagens agora.',
                action: 'opened'
            };
        } catch (e: any) {
            this.logger.error('❌ Erro ao abrir grupo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Alterna estado do grupo (fechar/abrir)
    */
    async toggleGroupLock(groupJid: string): Promise<any> {
        try {
            const isLocked = this.groupSettings[groupJid]?.locked || false;

            if (isLocked) {
                return await this.openGroup(groupJid);
            } else {
                return await this.closeGroup(groupJid);
            }
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
    * Programa fechamento do grupo
    */
    async scheduleClose(groupJid: string, timeStr: string, reason: string = ''): Promise<any> {
        try {
            // Validar formato HH:MM
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
            if (!timeRegex.test(timeStr)) {
                return { success: false, error: 'Formato inválido. Use HH:MM (ex: 22:30)' };
            }

            // Calcular timestamp
            const [hours, minutes] = timeStr.split(':').map(Number);
            const now = new Date();
            const scheduledTime = new Date(now);
            scheduledTime.setHours(hours, minutes, 0, 0);

            // Se o horário já passou hoje, agendar para amanhã
            if (scheduledTime <= now) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
            }

            // Verificar se é admin
            if (!await this.isBotAdmin(groupJid)) {
                return { success: false, error: 'Bot não é admin do grupo' };
            }

            // Armazenar ação programada
            const actionId = `${groupJid}_close_${Date.now()}`;

            if (!this.scheduledActions[groupJid]) {
                this.scheduledActions[groupJid] = {};
            }

            this.scheduledActions[groupJid].close = {
                id: actionId,
                scheduledFor: scheduledTime.getTime(),
                timeStr: timeStr,
                reason: reason,
                createdAt: Date.now()
            };

            this.saveScheduledActions();

            const formattedDate = scheduledTime.toLocaleString('pt-BR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            this.logger.info(`✅ Fechamento programado para ${formattedDate}`);
            return {
                success: true,
                message: `⏰ *FECHAMENTO PROGRAMADO*\n\n🕐 Data: ${formattedDate}\n📝 Motivo: ${reason || 'Não informado'}\n\nPara cancelar, use: #cancelarprog`,
                actionId,
                scheduledFor: scheduledTime.getTime()
            };
        } catch (e: any) {
            this.logger.error('❌ Erro ao programar fechamento:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Programa abertura do grupo
    */
    async scheduleOpen(groupJid: string, timeStr: string, reason: string = ''): Promise<any> {
        try {
            // Validar formato HH:MM
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
            if (!timeRegex.test(timeStr)) {
                return { success: false, error: 'Formato inválido. Use HH:MM (ex: 08:00)' };
            }

            // Calcular timestamp
            const [hours, minutes] = timeStr.split(':').map(Number);
            const now = new Date();
            const scheduledTime = new Date(now);
            scheduledTime.setHours(hours, minutes, 0, 0);

            // Se o horário já passou hoje, agendar para amanhã
            if (scheduledTime <= now) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
            }

            // Verificar se é admin
            if (!await this.isBotAdmin(groupJid)) {
                return { success: false, error: 'Bot não é admin do grupo' };
            }

            // Armazenar ação programada
            const actionId = `${groupJid}_open_${Date.now()}`;

            if (!this.scheduledActions[groupJid]) {
                this.scheduledActions[groupJid] = {};
            }

            this.scheduledActions[groupJid].open = {
                id: actionId,
                scheduledFor: scheduledTime.getTime(),
                timeStr: timeStr,
                reason: reason,
                createdAt: Date.now()
            };

            this.saveScheduledActions();

            const formattedDate = scheduledTime.toLocaleString('pt-BR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            this.logger.info(`✅ Abertura programada para ${formattedDate}`);
            return {
                success: true,
                message: `⏰ *ABERTURA PROGRAMADA*\n\n🕐 Data: ${formattedDate}\n📝 Motivo: ${reason || 'Não informado'}\n\nPara cancelar, use: #cancelarprog`,
                actionId,
                scheduledFor: scheduledTime.getTime()
            };
        } catch (e: any) {
            this.logger.error('❌ Erro ao programar abertura:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Cancela todas as programações do grupo
    */
    async cancelScheduledActions(groupJid: string): Promise<any> {
        try {
            if (!this.scheduledActions[groupJid]) {
                return { success: true, message: 'Nenhuma programação ativa para este grupo' };
            }

            const hadActions = Object.keys(this.scheduledActions[groupJid]).length > 0;
            delete this.scheduledActions[groupJid];
            this.saveScheduledActions();

            if (hadActions) {
                return { success: true, message: '✅ Programações canceladas com sucesso!' };
            } else {
                return { success: true, message: 'Nenhuma programação ativa para este grupo' };
            }
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
    * Ver programações ativas
    */
    async getScheduledActions(groupJid: string): Promise<any> {
        try {
            const actions = this.scheduledActions[groupJid];

            if (!actions || Object.keys(actions).length === 0) {
                return { success: true, message: '📅 Nenhuma programação ativa', actions: [] };
            }

            const now = Date.now();
            let response = '📅 *PROGRAMAÇÕES ATIVAS*\n\n';
            const actionList: any[] = [];

            if (actions.close) {
                const time = new Date(actions.close.scheduledFor);
                const formatted = time.toLocaleString('pt-BR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const isPast = actions.close.scheduledFor < now;
                response += `🔒 *FECHAMENTO*\n`;
                response += `🕐 ${formatted}\n`;
                response += `📝 ${actions.close.reason || 'Sem motivo'}\n`;
                response += `Status: ${isPast ? '✅ Já executado' : '⏳ Aguardando'}\n\n`;

                actionList.push({ type: 'close', ...actions.close });
            }

            if (actions.open) {
                const time = new Date(actions.open.scheduledFor);
                const formatted = time.toLocaleString('pt-BR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const isPast = actions.open.scheduledFor < now;
                response += `🔓 *ABERTURA*\n`;
                response += `🕐 ${formatted}\n`;
                response += `📝 ${actions.open.reason || 'Sem motivo'}\n`;
                response += `Status: ${isPast ? '✅ Já executado' : '⏳ Aguardando'}\n`;

                actionList.push({ type: 'open', ...actions.open });
            }

            response += '\nPara cancelar: #cancelarprog';

            return { success: true, message: response, actions: actionList };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
    * Inicia verificador de ações programadas
    */
    startScheduledActionsChecker(): void {
        // Verificar a cada minuto
        setInterval(async () => {
            const now = Date.now();
            let changed = false;

            for (const groupJid of Object.keys(this.scheduledActions)) {
                const actions = this.scheduledActions[groupJid];

                // Verificar fechamento
                if (actions.close && actions.close.scheduledFor <= now) {
                    try {
                        this.logger.info(`⏰ Executando fechamento programado para ${groupJid}`);
                        await this.closeGroup(groupJid);
                        if (this.sock) {
                            await this.sock.sendMessage(groupJid, { text: `🔒 *FECHAMENTO AUTOMÁTICO*\n\nO grupo foi fechado conforme programado.\nMotivo: ${actions.close.reason || 'Horário agendado'}` });
                        }
                        delete actions.close;
                        changed = true;
                    } catch (e: any) {
                        this.logger.error(`❌ Erro ao executar fechamento programado para ${groupJid}:`, e.message);
                    }
                }

                // Verificar abertura
                if (actions.open && actions.open.scheduledFor <= now) {
                    try {
                        this.logger.info(`⏰ Executando abertura programada para ${groupJid}`);
                        await this.openGroup(groupJid);
                        if (this.sock) {
                            await this.sock.sendMessage(groupJid, { text: `🔓 *ABERTURA AUTOMÁTICA*\n\nO grupo foi aberto conforme programado.\nMotivo: ${actions.open.reason || 'Horário agendado'}` });
                        }
                        delete actions.open;
                        changed = true;
                    } catch (e: any) {
                        this.logger.error(`❌ Erro ao executar abertura programada para ${groupJid}:`, e.message);
                    }
                }

                // Se não sobrar ações, remover entrada do grupo
                if (Object.keys(actions).length === 0) {
                    delete this.scheduledActions[groupJid];
                    changed = true;
                }
            }

            if (changed) {
                this.saveScheduledActions();
            }

        }, 60000); // 1 minuto
    }

    /**
     * Ativa/des ativa obrigatoriedade de registro no grupo
     */
    async toggleRequireRegister(m: any, value: string): Promise<boolean> {
        const groupJid = m.key.remoteJid;

        if (!value || (value !== 'on' && value !== 'off')) {
            if (this.sock) {
                await this.sock.sendMessage(groupJid, {
                    text: '❌ Uso correto: `#requireregister on` ou `#requireregister off`'
                }, { quoted: m });
            }
            return true;
        }

        const require = value === 'on';

        // Aqui precisamos do PermissionManager
        // Como não temos acesso direto, vamos armazenar nas configurações do grupo
        if (!this.groupSettings[groupJid]) {
            this.groupSettings[groupJid] = {};
        }

        this.groupSettings[groupJid].requireRegistration = require;
        this.saveGroupSettings();

        // Também salvar no arquivo específico de registro (compatibilidade com PermissionManager)
        try {
            const fsLib = await import('fs');
            const pathLib = await import('path');
            const configPath = './temp/akira_data/group_registration_config.json'; // fix path consistency

            let config: any = {};
            if (fsLib.default.existsSync(configPath)) {
                const data = fsLib.default.readFileSync(configPath, 'utf8');
                config = JSON.parse(data || '{}');
            }

            if (!config[groupJid]) {
                config[groupJid] = {};
            }
            config[groupJid].requireRegistration = require;

            const dir = pathLib.default.dirname(configPath);
            if (!fsLib.default.existsSync(dir)) {
                fsLib.default.mkdirSync(dir, { recursive: true });
            }
            fsLib.default.writeFileSync(configPath, JSON.stringify(config, null, 2));
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
