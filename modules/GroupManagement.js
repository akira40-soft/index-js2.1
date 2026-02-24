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
    constructor(sock, config = null) {
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
    async isBotAdmin(groupJid) {
        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            const botJid = this.sock.user?.id;
            return metadata.participants.some(
                p => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')
            );
        } catch (e) {
            this.logger.error('❌ Erro ao verificar admin:', e.message);
            return false;
        }
    }

    /**
    * Verifica se usuário é admin
    */
    async isUserAdmin(groupJid, userJid) {
        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            const participant = metadata.participants.find(p => p.id === userJid);
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (e) {
            return false;
        }
    }

    /**
    * Obtém foto do grupo
    */
    async getGroupPhoto(groupJid) {
        try {
            const photoUrl = await this.sock.profilePictureUrl(groupJid, 'image');
            return {
                success: true,
                url: photoUrl,
                hasPhoto: !!photoUrl
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
    * Define foto do grupo
    */
    async setGroupPhoto(groupJid, imageBuffer) {
        try {
            // Verificar se é admin
            if (!await this.isBotAdmin(groupJid)) {
                return { success: false, error: 'Bot não é admin do grupo' };
            }

            await this.sock.updateProfilePicture(groupJid, imageBuffer);

            this.logger.info(`✅ Foto do grupo ${groupJid} atualizada`);
            return { success: true, message: 'Foto do grupo atualizada com sucesso' };
        } catch (e) {
            this.logger.error('❌ Erro ao definir foto do grupo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Define nome do grupo
    */
    async setGroupName(groupJid, newName) {
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
        } catch (e) {
            this.logger.error('❌ Erro ao definir nome do grupo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Define descrição do grupo
    */
    async setGroupDescription(groupJid, description) {
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
        } catch (e) {
            this.logger.error('❌ Erro ao definir descrição do grupo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Fecha o grupo (apenas admins podem enviar mensagens)
    */
    async closeGroup(groupJid) {
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
        } catch (e) {
            this.logger.error('❌ Erro ao fechar grupo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Abre o grupo (todos podem enviar mensagens)
    */
    async openGroup(groupJid) {
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
        } catch (e) {
            this.logger.error('❌ Erro ao abrir grupo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Alterna estado do grupo (fechar/abrir)
    */
    async toggleGroupLock(groupJid) {
        try {
            const isLocked = this.groupSettings[groupJid]?.locked || false;

            if (isLocked) {
                return await this.openGroup(groupJid);
            } else {
                return await this.closeGroup(groupJid);
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
    * Programa fechamento do grupo
    */
    async scheduleClose(groupJid, timeStr, reason = '') {
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
        } catch (e) {
            this.logger.error('❌ Erro ao programar fechamento:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Programa abertura do grupo
    */
    async scheduleOpen(groupJid, timeStr, reason = '') {
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
        } catch (e) {
            this.logger.error('❌ Erro ao programar abertura:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Cancela todas as programações do grupo
    */
    async cancelScheduledActions(groupJid) {
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
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
    * Ver programações ativas
    */
    async getScheduledActions(groupJid) {
        try {
            const actions = this.scheduledActions[groupJid];

            if (!actions || Object.keys(actions).length === 0) {
                return { success: true, message: '📅 Nenhuma programação ativa', actions: [] };
            }

            const now = Date.now();
            let response = '📅 *PROGRAMAÇÕES ATIVAS*\n\n';
            const actionList = [];

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
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
    * Inicia verificador de ações programadas
    */
    startScheduledActionsChecker() {
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
                    } catch (e) {
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
                    } catch (e) {
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
}

export default GroupManagement;
