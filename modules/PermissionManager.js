/**
 * ═══════════════════════════════════════════════════════════════════════
 * PERMISSION MANAGER - AKIRA BOT V21
 * ═══════════════════════════════════════════════════════════════════════
 * Sistema centralizado de gerenciamento de permissões
 * ═══════════════════════════════════════════════════════════════════════
 */

class PermissionManager {
 constructor() {
 // Proprietários - acesso total
 this.owners = [
 { 
 numero: '244937035662',
 nome: 'Isaac Quarenta',
 descricao: 'Desenvolvedor Principal',
 nivel: 'ROOT'
 },
 {
 numero: '244978787009',
 nome: 'Isaac Quarenta',
 descricao: 'Segundo Proprietário',
 nivel: 'ROOT'
 }
 ];

 // Permissões por comando
 this.commandPermissions = {
 // Comandos públicos
 'help': { nivel: 'public', rateLimitMultiplier: 0.5 },
 'menu': { nivel: 'public', rateLimitMultiplier: 0.5 },
 'ping': { nivel: 'public', rateLimitMultiplier: 0.5 },
 'info': { nivel: 'public', rateLimitMultiplier: 0.5 },
 'donate': { nivel: 'public', rateLimitMultiplier: 0.5 },
 'perfil': { nivel: 'public', rateLimitMultiplier: 1 },
 'profile': { nivel: 'public', rateLimitMultiplier: 1 },
 'registrar': { nivel: 'public', rateLimitMultiplier: 1 },
 'level': { nivel: 'public', rateLimitMultiplier: 1 },
 'sticker': { nivel: 'public', rateLimitMultiplier: 2 },
 'gif': { nivel: 'public', rateLimitMultiplier: 2.5 },
 'toimg': { nivel: 'public', rateLimitMultiplier: 1.5 },
 'play': { nivel: 'public', rateLimitMultiplier: 2 },
 'tts': { nivel: 'public', rateLimitMultiplier: 2 },

 // Comandos de dono
 'add': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 'remove': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 'kick': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 'ban': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 'promote': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 'demote': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 'mute': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 'desmute': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 'antilink': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 'warn': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 'clearwarn': { nivel: 'owner', rateLimitMultiplier: 1, grupo: true },
 };

 // Tipos de ações e seus limites
 this.actionLimits = {
 // Premium features com limite de 1x a cada 90 dias
 'premium_feature': {
 maxUsos: 1,
 janelaDias: 90,
 message: 'Feature Premium - Acesso 1x a cada 90 dias'
 },
 // Comandos normais com rate limiting
 'normal_command': {
 janelaSec: 8,
 maxPorJanela: 6,
 message: 'Aguarde antes de usar outro comando'
 },
 // Comandos de admin
 'admin_command': {
 janelaSec: 3,
 maxPorJanela: 10,
 message: 'Muitos comandos de admin muito rapido'
 }
 };

 // Configurações de segurança
 this.securityConfig = {
 // Máximo de mutes antes de remover automaticamente
 maxMutesBeforeRemove: 5,
 
 // Progressão de duração de mute (multiplicador)
 muteProgressionMultiplier: 2,
 
 // Duração base de mute em minutos
 baseMuteDuration: 5,
 
 // Padrões de link a detectar
 linkPatterns: [
 'https://',
 'http://',
 'www.',
 'bit.ly/',
 't.me/',
 'wa.me/',
 'chat.whatsapp.com/',
 'whatsapp.com/'
 ],

 // Comportamento ao detectar abuso
 abuseDetection: {
 enabled: true,
 deleteMessage: true,
 removeUser: true,
 logAction: true
 }
 };
 }

 /**
 * Verifica se usuário é proprietário
 */
 isOwner(numero, nome) {
 try {
 const numeroLimpo = String(numero).trim();
 const nomeLimpo = String(nome).trim();
 
 return this.owners?.some(owner =>
 numeroLimpo === owner.numero && nomeLimpo === owner.nome
 );
 } catch (e) {
 return false;
 }
 }

 /**
 * Obtém informações do proprietário
 */
 getOwnerInfo(numero) {
 const numeroLimpo = String(numero).trim();
 return this.owners?.find(owner => numeroLimpo === owner.numero);
 }

 /**
 * Verifica permissão para comando específico
 */
 hasPermissionForCommand(comando, numero, nome, ehGrupo = false) {
 const permConfig = this.commandPermissions[comando];
 
 if (!permConfig) {
 return false; // Comando não existe
 }

 // Comando público - todos podem usar
 if (permConfig.nivel === 'public') {
 return true;
 }

 // Comando de dono
 if (permConfig.nivel === 'owner') {
 const isOwner = this.isOwner(numero, nome);
 if (!isOwner) return false;
 
 // Se requer grupo, verifica se está em grupo
 if (permConfig.grupo && !ehGrupo) {
 return false;
 }
 
 return true;
 }

 return false;
 }

 /**
 * Obtém configuração de permissão para comando
 */
 getCommandConfig(comando) {
 return this.commandPermissions[comando] || null;
 }

 /**
 * Obtém múltiplo de rate limit para comando
 */
 getRateLimitMultiplier(comando) {
 const config = this.commandPermissions[comando];
 return config?.rateLimitMultiplier || 1;
 }

 /**
 * Valida padrão de link
 */
 containsLink(texto) {
 if (!texto) return false;
 const textLower = String(texto).toLowerCase();
 return this.securityConfig?.linkPatterns?.some(pattern =>
 textLower.includes(pattern.toLowerCase())
 );
 }

 /**
 * Obtém configuração de limite de ação
 */
 getActionLimitConfig(tipoAcao) {
 return this.actionLimits[tipoAcao];
 }

 /**
 * Calcula próxima duração de mute progressivo
 */
 getNextMuteDuration(muteCount) {
 const baseDuration = this.securityConfig?.baseMuteDuration;
 const multiplier = this.securityConfig?.muteProgressionMultiplier;
 
 // Fórmula: 5 * 2^(n-1)
 return Math.min(
 baseDuration * Math.pow(multiplier, muteCount),
 1440 // Máximo de 1 dia (1440 minutos)
 );
 }

 /**
 * Verifica se deve remover após muitos mutes
 */
 shouldRemoveAfterMute(muteCount) {
 return muteCount >= this.securityConfig?.maxMutesBeforeRemove;
 }

 /**
 * Lista todos os proprietários
 */
 listOwners() {
 return this.owners?.map(owner => ({
 numero: owner.numero,
 nome: owner.nome,
 descricao: owner.descricao
 }));
 }

 /**
 * Valida estrutura de permissões
 */
 validateStructure() {
 const errors = [];

 // Valida proprietários
 if (!Array.isArray(this.owners) || this.owners?.length === 0) {
 errors.push('Nenhum proprietário definido');
 }

 this.owners?.forEach((owner, idx) => {
 if (!owner.numero || !owner.nome) {
 errors.push(`Proprietário ${idx} incompleto`);
 }
 });

 // Valida comandos
 if (!this.commandPermissions || Object.keys(this.commandPermissions)?.length === 0) {
 errors.push('Nenhuma permissão de comando definida');
 }

 return {
 isValid: errors.length === 0,
 errors
 };
 }
}

export default PermissionManager;
