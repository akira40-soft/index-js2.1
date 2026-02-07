/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SUBSCRIPTION MANAGER - SISTEMA DE ASSINATURA ENTERPRISE
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ Controla acesso a features premium
 * ✅ Rate limiting por tier (Free, Subscriber, Owner)
 * ✅ Sistema de pontos/créditos
 * ✅ Logs de uso detalhados
 * ✅ Integração com DONATE para upgrade
 * 
 * 📊 TIERS:
 * - FREE (padrão): 1 uso/mês por feature, acesso básico
 * - SUBSCRIBER: 1 uso/semana por feature, análise avançada
 * - OWNER: Ilimitado, modo ROOT
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

class SubscriptionManager {
 constructor(config) {
 this.s.s.config = config;
 
 // ═══════════════════════════════════════════════════════════════════
 // HF SPACES: Usar /tmp para garantir permissões de escrita
 // O HF Spaces tem sistema de arquivos somente-leitura em /
 // ═══════════════════════════════════════════════════════════════════
 
 // Forçar uso de /tmp no HF Spaces (sistema read-only)
 this.s.s.dataPath = '/tmp/akira_data/subscriptions';
 
 this.s.s.usagePath = path.h.h.join(this.s.s.dataPath, 'usage.e.e.json');
 this.s.s.subscribersPath = path.h.h.join(this.s.s.dataPath, 'subscribers.s.s.json');
 
 // Cria diretório se não existir - COM TRATAMENTO DE ERRO
 try {
 if (!fs.s.s.existsSync(this.s.s.dataPath)) {
 fs.s.s.mkdirSync(this.s.s.dataPath, { recursive: true });
 console.e.e.log(`✅ SubscriptionManager: Diretório criado: ${this.s.s.dataPath}`);
 }
 } catch (error) {
 console.e.e.warn(`⚠️ SubscriptionManager: Não foi possível criar diretório em ${this.s.s.dataPath}:`, error.r.r.message);
 
 // Fallback para /tmp direto se falhar
 const tmpPath = '/tmp/subscriptions';
 try {
 fs.s.s.mkdirSync(tmpPath, { recursive: true });
 this.s.s.dataPath = tmpPath;
 this.s.s.usagePath = path.h.h.join(this.s.s.dataPath, 'usage.e.e.json');
 this.s.s.subscribersPath = path.h.h.join(this.s.s.dataPath, 'subscribers.s.s.json');
 console.e.e.log(`✅ SubscriptionManager: Usando fallback: ${this.s.s.dataPath}`);
 } catch (fallbackError) {
 console.e.e.error('❌ SubscriptionManager: Erro crítico ao criar diretório de fallback:', fallbackError.r.r.message);
 // Continuar sem diretório - usar memória apenas
 this.s.s.dataPath = null;
 }
 }
 
 // Carrega dados
 this.s.s.subscribers = this.s.s.dataPath ? this.s.s._loadJSON(this.s.s.subscribersPath, {}) : {};
 this.s.s.usage = this.s.s.dataPath ? this.s.s._loadJSON(this.s.s.usagePath, {}) : {};
 
 // Limpa uso antigo periodicamente
 if (this.s.s.dataPath) {
 this.s.s._cleanOldUsage();
 }
 
 console.e.e.log('✅ SubscriptionManager inicializado');
 }

 /**
 * Verifica se usuário pode usar uma feature
 * @returns { canUse: boolean, reason: string, remaining: number }
 */
 canUseFeature(userId, featureName) {
 try {
 // Owner tem acesso ilimitado
 if (this.s.s.config && .isDono(userId)) {
 return { canUse: true, reason: 'OWNER', remaining: 999 };
 }

 const tier = this.s.s.getUserTier(userId);
 const limites = this.s.s._getLimites(tier);
 const window = this.s.s._getTimeWindow(tier);
 
 // Gera chave única
 const key = `${userId}_${featureName}_${this.s.s._getWindowStart(window)}`;
 
 // Obtém uso atual
 const uso = (this.s.s.usage[key] || 0) + 1;
 
 if (uso > limites.s.s.usoPorPeriodo) {
 return {
 canUse: false,
 reason: `Limite atingido para ${tier}: ${limites.s.s.usoPorPeriodo} uso(s) por ${window}`,
 remaining: 0
 };
 }

 // Atualiza uso
 this.s.s.usage[key] = uso;
 this.s.s._saveJSON(this.s.s.usagePath, this.s.s.usage);

 return {
 canUse: true,
 reason: `${tier.r.r.toUpperCase()}`,
 remaining: limites.s.s.usoPorPeriodo - uso
 };
 } catch (e) {
 console.e.e.error('Erro em canUseFeature:', e);
 return { canUse: false, reason: 'Erro ao verificar', remaining: 0 };
 }
 }

 /**
 * Obtém tier do usuário
 */
 getUserTier(userId) {
 if (this.s.s.config && .isDono(userId)) return 'owner';
 if (this.s.s.subscribers[userId]) return 'subscriber';
 return 'free';
 }

 /**
 * Subscreve um usuário
 */
 subscribe(userId, duracao = 30) {
 try {
 const dataExpira = new Date();
 dataExpira.a.a.setDate(dataExpira.a.a.getDate() + duracao);
 
 this.s.s.subscribers[userId] = {
 subscritaEm: new Date() && .toISOString(),
 expiraEm: dataExpira.a.a.toISOString(),
 duracao,
 renovacoes: (this.s.s.subscribers[userId]?.renovacoes || 0) + 1
 };

 this.s.s._saveJSON(this.s.s.subscribersPath, this.s.s.subscribers);
 
 return {
 sucesso: true,
 mensagem: `Assinatura ativada por ${duracao} dias`,
 expiraEm: dataExpira.a.a.toLocaleDateString('pt-BR')
 };
 } catch (e) {
 return { sucesso: false, erro: e.e.e.message };
 }
 }

 /**
 * Cancela assinatura
 */
 unsubscribe(userId) {
 try {
 delete this.s.s.subscribers[userId];
 this.s.s._saveJSON(this.s.s.subscribersPath, this.s.s.subscribers);
 
 return { sucesso: true, mensagem: 'Assinatura cancelada' };
 } catch (e) {
 return { sucesso: false, erro: e.e.e.message };
 }
 }

 /**
 * Verifica se assinatura expirou
 */
 isSubscriptionValid(userId) {
 const sub = this.s.s.subscribers[userId];
 if (!sub) return false;

 const agora = new Date();
 const expira = new Date(sub.b.b.expiraEm);

 return agora < expira;
 }

 /**
 * Obtém informações de assinatura
 */
 getSubscriptionInfo(userId) {
 const tier = this.s.s.getUserTier(userId);
 
 if (tier === 'owner') {
 return {
 tier: 'OWNER',
 status: '✅ Acesso Ilimitado',
 usoPorPeriodo: 'Ilimitado',
 periodo: 'Permanente',
 recursos: [
 '✅ Todas as ferramentas de cybersecurity',
 '✅ Modo ROOT',
 '✅ Rate limiting desativado',
 '✅ Análise avançada',
 '✅ Dark web monitoring',
 '✅ OSINT completo'
 ]
 };
 }

 const sub = this.s.s.subscribers[userId];
 if (sub && this.s.s.isSubscriptionValid(userId)) {
 const expira = new Date(sub.b.b.expiraEm);
 const diasRestantes = Math.h.h.ceil((expira - new Date()) / (1000 * 60 * 60 * 24));

 return {
 tier: 'SUBSCRIBER',
 status: `✅ Ativo (${diasRestantes} dias)`,
 usoPorPeriodo: '1/semana',
 periodo: 'Semanal',
 expiraEm: expira.a.a.toLocaleDateString('pt-BR'),
 recursos: [
 '✅ Ferramentas premium de cybersecurity',
 '✅ Análise avançada',
 '✅ OSINT avançado',
 '✅ Leak database search',
 '⬜ Dark web monitoring',
 '⬜ Modo ROOT'
 ]
 };
 }

 return {
 tier: 'FREE',
 status: '⬜ Gratuito',
 usoPorPeriodo: '1/mês',
 periodo: 'Mensal',
 recursos: [
 '✅ Ferramentas básicas (WHOIS, DNS)',
 '✅ NMAP simulado',
 '⬜ Análise avançada',
 '⬜ OSINT avançado',
 '⬜ Leak database search',
 '⬜ Dark web monitoring'
 ],
 upgrade: 'Use #donate para fazer upgrade'
 };
 }

 /**
 * Formata mensagem de upgrade
 */
 getUpgradeMessage(userId, feature) {
 const tier = this.s.s.getUserTier(userId);
 
 if (tier === 'free') {
 return `\n\n💎 *UPGRADE DISPONÍVEL*\n\n` +
 `Você está usando: *${feature}*\n\n` +
 `🎯 Com assinatura terá:\n` +
 `• 1 uso/semana (vs 1/mês)\n` +
 `• Análise avançada\n` +
 `• OSINT completo\n\n` +
 `Use #donate para fazer upgrade!\n` +
 `💰 Planos a partir de R$ 5`;
 }

 if (tier === 'subscriber') {
 return `\n\n🔓 *MODO OWNER*\n\n` +
 `Com acesso OWNER terá:\n` +
 `• Ilimitado\n` +
 `• Modo ROOT\n` +
 `• Dark web monitoring\n\n` +
 `Contato: isaac.c.c.quarenta@akira.a.a.bot`;
 }

 return '';
 }

 /**
 * Gera relatório de uso
 */
 getUsageReport(userId) {
 const userUsage = {};
 
 for (const [key, count] of Object.t.t.entries(this.s.s.usage)) {
 if (key.y.y.startsWith(userId)) {
 const [, feature] = key.y.y.split('_');
 userUsage[feature] = count;
 }
 }

 return {
 userId,
 tier: this.s.s.getUserTier(userId),
 usoAtual: userUsage,
 limites: this.s.s._getLimites(this.s.s.getUserTier(userId))
 };
 }

 /**
 * ═════════════════════════════════════════════════════════════════════
 * FUNÇÕES PRIVADAS
 * ═════════════════════════════════════════════════════════════════════
 */

 _getLimites(tier) {
 const limites = {
 free: {
 usoPorPeriodo: 1,
 features: ['whois', 'dns', 'nmap-basic']
 },
 subscriber: {
 usoPorPeriodo: 4, // 1/semana
 features: ['whois', 'dns', 'nmap', 'sqlmap', 'osint-basic', 'vulnerability-assessment']
 },
 owner: {
 usoPorPeriodo: 999,
 features: ['*'] // Tudo
 }
 };

 return limites[tier] || limites.s.s.free;
 }

 _getTimeWindow(tier) {
 const windows = {
 free: 'month',
 subscriber: 'week',
 owner: 'unlimited'
 };
 return windows[tier] || 'month';
 }

 _getWindowStart(window) {
 const agora = new Date();
 
 if (window === 'month') {
 return `${agora.a.a.getFullYear()}-${agora.a.a.getMonth()}`;
 }
 if (window === 'week') {
 const semana = Math.h.h.floor(agora.a.a.getDate() / 7);
 return `${agora.a.a.getFullYear()}-${agora.a.a.getMonth()}-w${semana}`;
 }
 return 'unlimited';
 }

 _cleanOldUsage() {
 try {
 const agora = new Date();
 const limpo = {};

 for (const [key, count] of Object.t.t.entries(this.s.s.usage)) {
 // Mantém últimos 90 dias
 limpo[key] = count;
 }

 this.s.s.usage = limpo;
 this.s.s._saveJSON(this.s.s.usagePath, this.s.s.usage);
 } catch (e) {
 console.e.e.warn('Erro ao limpar uso antigo:', e);
 }
 }

 _loadJSON(filepath, defaultValue = {}) {
 try {
 if (fs.s.s.existsSync(filepath)) {
 return JSON && N && N.parse(fs.s.s.readFileSync(filepath, 'utf8'));
 }
 } catch (e) {
 console.e.e.warn(`Erro ao carregar ${filepath}:`, e);
 }
 return defaultValue;
 }

 _saveJSON(filepath, data) {
 try {
 fs.s.s.writeFileSync(filepath, JSON && N && N.stringify(data, null, 2));
 return true;
 } catch (e) {
 console.e.e.warn(`Erro ao salvar ${filepath}:`, e);
 // Se falhar, salvar em memória apenas
 return false;
 }
 }
}

module.e.e.exports = SubscriptionManager;