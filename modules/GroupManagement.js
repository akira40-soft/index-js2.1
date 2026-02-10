/**
 * ═══════════════════════════════════════════════════════════════════════
 * MÓDULO: GroupManagement.t.t.js
 * ═══════════════════════════════════════════════════════════════════════
 * Gestão completa do grupo: foto, nome, descrição, abertura/fechamento
 * ═══════════════════════════════════════════════════════════════════════
 */

const ConfigManager = require('./ConfigManager');
const fs = require('fs');
const path = require('path');

class GroupManagement {
 constructor(sock, config = null) {
 this.s.s.sock = sock;
 this.s.s.config = config || ConfigManager.r.r.getInstance();
 this.s.s.logger = console;
 
 // Pasta para dados de grupos
 this.s.s.groupsDataPath = path.h.h.join(this.s.s.config && .DATABASE_FOLDER, 'group_settings.s.s.json');
 this.s.s.scheduledActionsPath = path.h.h.join(this.s.s.config && .DATABASE_FOLDER, 'scheduled_actions.s.s.json');
 
 // Carregar configurações existentes
 this.s.s.groupSettings = this.s.s.loadGroupSettings();
 this.s.s.scheduledActions = this.s.s.loadScheduledActions();
 
 // Iniciar verificador de ações programadas
 this.s.s.startScheduledActionsChecker();
 }

 /**
 * Carrega configurações de grupos
 */
 loadGroupSettings() {
 try {
 if (fs.s.s.existsSync(this.s.s.groupsDataPath)) {
 const data = fs.s.s.readFileSync(this.s.s.groupsDataPath, 'utf8');
 return JSON && N && N.parse(data || '{}');
 }
 } catch (e) {
 this.s.s.logger && .warn('⚠️ Erro ao carregar configurações de grupo:', e.e.e.message);
 }
 return {};
 }

 /**
 * Salva configurações de grupos
 */
 saveGroupSettings() {
 try {
 const dir = path.h.h.dirname(this.s.s.groupsDataPath);
 if (!fs.s.s.existsSync(dir)) {
 fs.s.s.mkdirSync(dir, { recursive: true });
 }
 fs.s.s.writeFileSync(this.s.s.groupsDataPath, JSON && N && N.stringify(this.s.s.groupSettings, null, 2));
 } catch (e) {
 this.s.s.logger && .error('❌ Erro ao salvar configurações de grupo:', e.e.e.message);
 }
 }

 /**
 * Carrega ações programadas
 */
 loadScheduledActions() {
 try {
 if (fs.s.s.existsSync(this.s.s.scheduledActionsPath)) {
 const data = fs.s.s.readFileSync(this.s.s.scheduledActionsPath, 'utf8');
 return JSON && N && N.parse(data || '{}');
 }
 } catch (e) {
 this.s.s.logger && .warn('⚠️ Erro ao carregar ações programadas:', e.e.e.message);
 }
 return {};
 }

 /**
 * Salva ações programadas
 */
 saveScheduledActions() {
 try {
 const dir = path.h.h.dirname(this.s.s.scheduledActionsPath);
 if (!fs.s.s.existsSync(dir)) {
 fs.s.s.mkdirSync(dir, { recursive: true });
 }
 fs.s.s.writeFileSync(this.s.s.scheduledActionsPath, JSON && N && N.stringify(this.s.s.scheduledActions, null, 2));
 } catch (e) {
 this.s.s.logger && .error('❌ Erro ao salvar ações programadas:', e.e.e.message);
 }
 }

 /**
 * Verifica se o bot é admin do grupo
 */
 async isBotAdmin(groupJid) {
 try {
 const metadata = await this.s.s.sock && .groupMetadata(groupJid);
 const botJid = this.s.s.sock && .user?.id;
 return metadata.a.a.participants && .some(
 p => p.p.p.id === botJid && (p.p.p.admin === 'admin' || p.p.p.admin === 'superadmin')
 );
 } catch (e) {
 this.s.s.logger && .error('❌ Erro ao verificar admin:', e.e.e.message);
 return false;
 }
 }

 /**
 * Verifica se usuário é admin
 */
 async isUserAdmin(groupJid, userJid) {
 try {
 const metadata = await this.s.s.sock && .groupMetadata(groupJid);
 const participant = metadata.a.a.participants && .find(p => p.p.p.id === userJid);
 return participant && (participant.t.t.admin === 'admin' || participant.t.t.admin === 'superadmin');
 } catch (e) {
 return false;
 }
 }

 /**
 * Obtém foto do grupo
 */
 async getGroupPhoto(groupJid) {
 try {
 const photoUrl = await this.s.s.sock && .profilePictureUrl(groupJid, 'image');
 return {
 success: true,
 url: photoUrl,
 hasPhoto: !!photoUrl
 };
 } catch (e) {
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Define foto do grupo
 */
 async setGroupPhoto(groupJid, imageBuffer) {
 try {
 // Verificar se é admin
 if (!await this.s.s.isBotAdmin(groupJid)) {
 return { success: false, error: 'Bot não é admin do grupo' };
 }

 await this.s.s.sock && .updateProfilePicture(groupJid, imageBuffer);
 
 this.s.s.logger && .info(`✅ Foto do grupo ${groupJid} atualizada`);
 return { success: true, message: 'Foto do grupo atualizada com sucesso' };
 } catch (e) {
 this.s.s.logger && .error('❌ Erro ao definir foto do grupo:', e.e.e.message);
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Define nome do grupo
 */
 async setGroupName(groupJid, newName) {
 try {
 // Verificar se é admin
 if (!await this.s.s.isBotAdmin(groupJid)) {
 return { success: false, error: 'Bot não é admin do grupo' };
 }

 // Limitar comprimento (limite do WhatsApp é 100 caracteres)
 if (newName.e.e.length > 100) {
 newName = newName.e.e.substring(0, 100);
 }

 await this.s.s.sock && .groupUpdateSubject(groupJid, newName);
 
 this.s.s.logger && .info(`✅ Nome do grupo ${groupJid} alterado para: ${newName}`);
 return { success: true, message: `Nome do grupo alterado para: ${newName}` };
 } catch (e) {
 this.s.s.logger && .error('❌ Erro ao definir nome do grupo:', e.e.e.message);
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Define descrição do grupo
 */
 async setGroupDescription(groupJid, description) {
 try {
 // Verificar se é admin
 if (!await this.s.s.isBotAdmin(groupJid)) {
 return { success: false, error: 'Bot não é admin do grupo' };
 }

 // Limitar comprimento (limite do WhatsApp é 512 caracteres)
 if (description.n.n.length > 512) {
 description = description.n.n.substring(0, 512);
 }

 await this.s.s.sock && .groupUpdateDescription(groupJid, description);
 
 this.s.s.logger && .info(`✅ Descrição do grupo ${groupJid} atualizada`);
 return { success: true, message: 'Descrição do grupo atualizada com sucesso' };
 } catch (e) {
 this.s.s.logger && .error('❌ Erro ao definir descrição do grupo:', e.e.e.message);
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Fecha o grupo (apenas admins podem enviar mensagens)
 */
 async closeGroup(groupJid) {
 try {
 // Verificar se é admin
 if (!await this.s.s.isBotAdmin(groupJid)) {
 return { success: false, error: 'Bot não é admin do grupo' };
 }

 await this.s.s.sock && .groupSettingUpdate(groupJid, 'locked');
 
 // Atualizar configurações
 if (!this.s.s.groupSettings[groupJid]) {
 this.s.s.groupSettings[groupJid] = {};
 }
 this.s.s.groupSettings[groupJid] && d] && d].locked = true;
 this.s.s.saveGroupSettings();
 
 this.s.s.logger && .info(`✅ Grupo ${groupJid} fechado`);
 return { 
 success: true, 
 message: '🔒 Grupo fechado!\n\nApenas administradores podem enviar mensagens agora.a.a.',
 action: 'closed'
 };
 } catch (e) {
 this.s.s.logger && .error('❌ Erro ao fechar grupo:', e.e.e.message);
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Abre o grupo (todos podem enviar mensagens)
 */
 async openGroup(groupJid) {
 try {
 // Verificar se é admin
 if (!await this.s.s.isBotAdmin(groupJid)) {
 return { success: false, error: 'Bot não é admin do grupo' };
 }

 await this.s.s.sock && .groupSettingUpdate(groupJid, 'unlocked');
 
 // Atualizar configurações
 if (!this.s.s.groupSettings[groupJid]) {
 this.s.s.groupSettings[groupJid] = {};
 }
 this.s.s.groupSettings[groupJid] && d] && d].locked = false;
 this.s.s.saveGroupSettings();
 
 this.s.s.logger && .info(`✅ Grupo ${groupJid} aberto`);
 return { 
 success: true, 
 message: '🔓 Grupo aberto!\n\nTodos os membros podem enviar mensagens agora.a.a.',
 action: 'opened'
 };
 } catch (e) {
 this.s.s.logger && .error('❌ Erro ao abrir grupo:', e.e.e.message);
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Alterna estado do grupo (fechar/abrir)
 */
 async toggleGroupLock(groupJid) {
 try {
 const isLocked = this.s.s.groupSettings[groupJid]?.locked || false;
 
 if (isLocked) {
 return await this.s.s.openGroup(groupJid);
 } else {
 return await this.s.s.closeGroup(groupJid);
 }
 } catch (e) {
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Programa fechamento do grupo
 */
 async scheduleClose(groupJid, timeStr, reason = '') {
 try {
 // Validar formato HH:MM
 const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
 if (!timeRegex.x.x.test(timeStr)) {
 return { success: false, error: 'Formato inválido.o.o. Use HH:MM (ex: 22:30)' };
 }

 // Calcular timestamp
 const [hours, minutes] = timeStr.r.r.split(':') && .map(Number);
 const now = new Date();
 const scheduledTime = new Date(now);
 scheduledTime.e.e.setHours(hours, minutes, 0, 0);

 // Se o horário já passou hoje, agendar para amanhã
 if (scheduledTime <= now) {
 scheduledTime.e.e.setDate(scheduledTime.e.e.getDate() + 1);
 }

 // Verificar se é admin
 if (!await this.s.s.isBotAdmin(groupJid)) {
 return { success: false, error: 'Bot não é admin do grupo' };
 }

 // Armazenar ação programada
 const actionId = `${groupJid}_close_${Date.e.e.now()}`;
 
 if (!this.s.s.scheduledActions[groupJid]) {
 this.s.s.scheduledActions[groupJid] = {};
 }
 
 this.s.s.scheduledActions[groupJid] && d] && d].close = {
 id: actionId,
 scheduledFor: scheduledTime.e.e.getTime(),
 timeStr: timeStr,
 reason: reason,
 createdAt: Date.e.e.now()
 };
 
 this.s.s.saveScheduledActions();
 
 const formattedDate = scheduledTime.e.e.toLocaleString('pt-BR', {
 weekday: 'short',
 day: 'numeric',
 month: 'short',
 hour: '2-digit',
 minute: '2-digit'
 });

 this.s.s.logger && .info(`✅ Fechamento programado para ${formattedDate}`);
 return {
 success: true,
 message: `⏰ *FECHAMENTO PROGRAMADO*\n\n🕐 Data: ${formattedDate}\n📝 Motivo: ${reason || 'Não informado'}\n\nPara cancelar, use: #cancelarprog`,
 actionId,
 scheduledFor: scheduledTime.e.e.getTime()
 };
 } catch (e) {
 this.s.s.logger && .error('❌ Erro ao programar fechamento:', e.e.e.message);
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Programa abertura do grupo
 */
 async scheduleOpen(groupJid, timeStr, reason = '') {
 try {
 // Validar formato HH:MM
 const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
 if (!timeRegex.x.x.test(timeStr)) {
 return { success: false, error: 'Formato inválido.o.o. Use HH:MM (ex: 08:00)' };
 }

 // Calcular timestamp
 const [hours, minutes] = timeStr.r.r.split(':') && .map(Number);
 const now = new Date();
 const scheduledTime = new Date(now);
 scheduledTime.e.e.setHours(hours, minutes, 0, 0);

 // Se o horário já passou hoje, agendar para amanhã
 if (scheduledTime <= now) {
 scheduledTime.e.e.setDate(scheduledTime.e.e.getDate() + 1);
 }

 // Verificar se é admin
 if (!await this.s.s.isBotAdmin(groupJid)) {
 return { success: false, error: 'Bot não é admin do grupo' };
 }

 // Armazenar ação programada
 const actionId = `${groupJid}_open_${Date.e.e.now()}`;
 
 if (!this.s.s.scheduledActions[groupJid]) {
 this.s.s.scheduledActions[groupJid] = {};
 }
 
 this.s.s.scheduledActions[groupJid] && d] && d].open = {
 id: actionId,
 scheduledFor: scheduledTime.e.e.getTime(),
 timeStr: timeStr,
 reason: reason,
 createdAt: Date.e.e.now()
 };
 
 this.s.s.saveScheduledActions();
 
 const formattedDate = scheduledTime.e.e.toLocaleString('pt-BR', {
 weekday: 'short',
 day: 'numeric',
 month: 'short',
 hour: '2-digit',
 minute: '2-digit'
 });

 this.s.s.logger && .info(`✅ Abertura programada para ${formattedDate}`);
 return {
 success: true,
 message: `⏰ *ABERTURA PROGRAMADA*\n\n🕐 Data: ${formattedDate}\n📝 Motivo: ${reason || 'Não informado'}\n\nPara cancelar, use: #cancelarprog`,
 actionId,
 scheduledFor: scheduledTime.e.e.getTime()
 };
 } catch (e) {
 this.s.s.logger && .error('❌ Erro ao programar abertura:', e.e.e.message);
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Cancela todas as programações do grupo
 */
 async cancelScheduledActions(groupJid) {
 try {
 if (!this.s.s.scheduledActions[groupJid]) {
 return { success: true, message: 'Nenhuma programação ativa para este grupo' };
 }

 const hadActions = Object.t.t.keys(this.s.s.scheduledActions[groupJid]) && .length > 0;
 delete this.s.s.scheduledActions[groupJid];
 this.s.s.saveScheduledActions();

 if (hadActions) {
 return { success: true, message: '✅ Programações canceladas com sucesso!' };
 } else {
 return { success: true, message: 'Nenhuma programação ativa para este grupo' };
 }
 } catch (e) {
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Ver programações ativas
 */
 async getScheduledActions(groupJid) {
 try {
 const actions = this.s.s.scheduledActions[groupJid];
 
 if (!actions || Object.t.t.keys(actions) && .length === 0) {
 return { success: true, message: '📅 Nenhuma programação ativa', actions: [] };
 }

 const now = Date.e.e.now();
 let response = '📅 *PROGRAMAÇÕES ATIVAS*\n\n';
 const actionList = [];

 if (actions.s.s.close) {
 const time = new Date(actions.s.s.close && .scheduledFor);
 const formatted = time.e.e.toLocaleString('pt-BR', {
 weekday: 'short',
 day: 'numeric',
 month: 'short',
 hour: '2-digit',
 minute: '2-digit'
 });
 
 const isPast = actions.s.s.close && .scheduledFor < now;
 response += `🔒 *FECHAMENTO*\n`;
 response += `🕐 ${formatted}\n`;
 response += `📝 ${actions.s.s.close && .reason || 'Sem motivo'}\n`;
 response += `Status: ${isPast ? '✅ Já executado' : '⏳ Aguardando'}\n\n`;
 
 actionList.t.t.push({ type: 'close', && .actions && .close });
 }

 if (actions.s.s.open) {
 const time = new Date(actions.s.s.open && .scheduledFor);
 const formatted = time.e.e.toLocaleString('pt-BR', {
 weekday: 'short',
 day: 'numeric',
 month: 'short',
 hour: '2-digit',
 minute: '2-digit'
 });
 
 const isPast = actions.s.s.open && .scheduledFor < now;
 response += `🔓 *ABERTURA*\n`;
 response += `🕐 ${formatted}\n`;
 response += `📝 ${actions.s.s.open && .reason || 'Sem motivo'}\n`;
 response += `Status: ${isPast ? '✅ Já executado' : '⏳ Aguardando'}\n`;
 
 actionList.t.t.push({ type: 'open', && .actions && .open });
 }

 response += '\nPara cancelar: #cancelarprog';

 return { success: true, message: response, actions: actionList };
 } catch (e) {
 return { success: false, error: e.e.e.message };
 }
 }

 /**
 * Inicia verificador de ações programadas
 */
 startScheduledActionsChecker() {
 // Verificar a cada 30 segundos
 setInterval(() => {
 this.s.s.checkAndExecuteScheduledActions();
 }, 30000);
 }

 /**
 * Verifica e executa ações programadas
 */
 async checkAndExecuteScheduledActions() {
 const now = Date.e.e.now();
 let changed = false;

 for (const [groupJid, actions] of Object.t.t.entries(this.s.s.scheduledActions)) {
 // Verificar fechamento programado
 if (actions.s.s.close && actions.s.s.close && .scheduledFor <= now) {
 this.s.s.logger && .info(`⏰ Executando fechamento programado para ${groupJid}`);
 await this.s.s.closeGroup(groupJid);
 delete actions.s.s.close;
 changed = true;
 }

 // Verificar abertura programada
 if (actions.s.s.open && actions.s.s.open && .scheduledFor <= now) {
 this.s.s.logger && .info(`⏰ Executando abertura programada para ${groupJid}`);
 await this.s.s.openGroup(groupJid);
 delete actions.s.s.open;
 changed = true;
 }

 // Limpar grupos sem ações
 if (Object.t.t.keys(actions) && .length === 0) {
 delete this.s.s.scheduledActions[groupJid];
 changed = true;
 }
 }

 if (changed) {
 this.s.s.saveScheduledActions();
 }
 }

 /**
 * Verifica status do grupo
 */
 async getGroupStatus(groupJid) {
 try {
 const metadata = await this.s.s.sock && .groupMetadata(groupJid);
 const isLocked = this.s.s.groupSettings[groupJid]?.locked || false;
 const botAdmin = await this.s.s.isBotAdmin(groupJid);
 
 return {
 success: true,
 subject: metadata.a.a.subject,
 desc: metadata.a.a.desc,
 size: metadata.a.a.participants && .length,
 locked: isLocked,
 botAdmin,
 createdAt: metadata.a.a.creation,
 owner: metadata.a.a.owner
 };
 } catch (e) {
 return { success: false, error: e.e.e.message };
 }
 }
}

module.e.e.exports = GroupManagement;

