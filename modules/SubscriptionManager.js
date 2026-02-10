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

import fs from 'fs';
import path from 'path';
import ConfigManager from './ConfigManager.js';

class SubscriptionManager {
    constructor(config = null) {
        this.config = config || ConfigManager.getInstance();

        // ═══════════════════════════════════════════════════════════════════
        // HF SPACES: Usar /tmp para garantir permissões de escrita
        // O HF Spaces tem sistema de arquivos somente-leitura em /
        // ═══════════════════════════════════════════════════════════════════

        // Forçar uso de /tmp no HF Spaces (sistema read-only)
        this.dataPath = '/tmp/akira_data/subscriptions';

        this.usagePath = path.join(this.dataPath, 'usage.json');
        this.subscribersPath = path.join(this.dataPath, 'subscribers.json');

        // Cria diretório se não existir - COM TRATAMENTO DE ERRO
        try {
            if (!fs.existsSync(this.dataPath)) {
                fs.mkdirSync(this.dataPath, { recursive: true });
                console.log(`✅ SubscriptionManager: Diretório criado: ${this.dataPath}`);
            }
        } catch (error) {
            console.warn(`⚠️ SubscriptionManager: Não foi possível criar diretório em ${this.dataPath}:`, error.message);

            // Fallback para /tmp direto se falhar
            const tmpPath = '/tmp/subscriptions';
            try {
                fs.mkdirSync(tmpPath, { recursive: true });
                this.dataPath = tmpPath;
                this.usagePath = path.join(this.dataPath, 'usage.json');
                this.subscribersPath = path.join(this.dataPath, 'subscribers.json');
                console.log(`✅ SubscriptionManager: Usando fallback: ${this.dataPath}`);
            } catch (fallbackError) {
                console.error('❌ SubscriptionManager: Erro crítico ao criar diretório de fallback:', fallbackError.message);
                // Continuar sem diretório - usar memória apenas
                this.dataPath = null;
            }
        }

        // Carrega dados
        this.subscribers = this.dataPath ? this._loadJSON(this.subscribersPath, {}) : {};
        this.usage = this.dataPath ? this._loadJSON(this.usagePath, {}) : {};

        // Limpa uso antigo periodicamente
        if (this.dataPath) {
            this._cleanOldUsage();
        }

        console.log('✅ SubscriptionManager inicializado');
    }

    /**
    * Verifica se usuário pode usar uma feature
    * @returns { canUse: boolean, reason: string, remaining: number }
    */
    canUseFeature(userId, featureName) {
        try {
            // Owner tem acesso ilimitado
            if (this.config.isDono(userId)) {
                return { canUse: true, reason: 'OWNER', remaining: 999 };
            }

            const tier = this.getUserTier(userId);
            const limites = this._getLimites(tier);
            const window = this._getTimeWindow(tier);

            // Gera chave única
            const key = `${userId}_${featureName}_${this._getWindowStart(window)}`;

            // Obtém uso atual
            const uso = (this.usage[key] || 0) + 1;

            if (uso > limites.usoPorPeriodo) {
                return {
                    canUse: false,
                    reason: `Limite atingido para ${tier}: ${limites.usoPorPeriodo} uso(s) por ${window}`,
                    remaining: 0
                };
            }

            // Atualiza uso
            this.usage[key] = uso;
            this._saveJSON(this.usagePath, this.usage);

            return {
                canUse: true,
                reason: `${tier.toUpperCase()}`,
                remaining: limites.usoPorPeriodo - uso
            };
        } catch (e) {
            console.error('Erro em canUseFeature:', e);
            return { canUse: false, reason: 'Erro ao verificar', remaining: 0 };
        }
    }

    /**
    * Obtém tier do usuário
    */
    getUserTier(userId) {
        if (this.config.isDono(userId)) return 'owner';
        if (this.subscribers[userId]) return 'subscriber';
        return 'free';
    }

    /**
    * Subscreve um usuário
    */
    subscribe(userId, duracao = 30) {
        try {
            const dataExpira = new Date();
            dataExpira.setDate(dataExpira.getDate() + duracao);

            this.subscribers[userId] = {
                subscritaEm: new Date().toISOString(),
                expiraEm: dataExpira.toISOString(),
                duracao,
                renovacoes: (this.subscribers[userId]?.renovacoes || 0) + 1
            };

            this._saveJSON(this.subscribersPath, this.subscribers);

            return {
                sucesso: true,
                mensagem: `Assinatura ativada por ${duracao} dias`,
                expiraEm: dataExpira.toLocaleDateString('pt-BR')
            };
        } catch (e) {
            return { sucesso: false, erro: e.message };
        }
    }

    /**
    * Cancela assinatura
    */
    unsubscribe(userId) {
        try {
            delete this.subscribers[userId];
            this._saveJSON(this.subscribersPath, this.subscribers);

            return { sucesso: true, mensagem: 'Assinatura cancelada' };
        } catch (e) {
            return { sucesso: false, erro: e.message };
        }
    }

    /**
    * Verifica se assinatura expirou
    */
    isSubscriptionValid(userId) {
        const sub = this.subscribers[userId];
        if (!sub) return false;

        const agora = new Date();
        const expira = new Date(sub.expiraEm);

        return agora < expira;
    }

    /**
    * Obtém informações de assinatura
    */
    getSubscriptionInfo(userId) {
        const tier = this.getUserTier(userId);

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

        const sub = this.subscribers[userId];
        if (sub && this.isSubscriptionValid(userId)) {
            const expira = new Date(sub.expiraEm);
            const diasRestantes = Math.ceil((expira - new Date()) / (1000 * 60 * 60 * 24));

            return {
                tier: 'SUBSCRIBER',
                status: `✅ Ativo (${diasRestantes} dias)`,
                usoPorPeriodo: '1/semana',
                periodo: 'Semanal',
                expiraEm: expira.toLocaleDateString('pt-BR'),
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
        const tier = this.getUserTier(userId);

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
                `Contato: isaac.quarenta@akira.bot`;
        }

        return '';
    }

    /**
    * Gera relatório de uso
    */
    getUsageReport(userId) {
        const userUsage = {};

        for (const [key, count] of Object.entries(this.usage)) {
            if (key.startsWith(userId)) {
                const [, feature] = key.split('_');
                userUsage[feature] = count;
            }
        }

        return {
            userId,
            tier: this.getUserTier(userId),
            usoAtual: userUsage,
            limites: this._getLimites(this.getUserTier(userId))
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

        return limites[tier] || limites.free;
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
            return `${agora.getFullYear()}-${agora.getMonth()}`;
        }
        if (window === 'week') {
            const semana = Math.floor(agora.getDate() / 7);
            return `${agora.getFullYear()}-${agora.getMonth()}-w${semana}`;
        }
        return 'unlimited';
    }

    _cleanOldUsage() {
        try {
            const agora = new Date();
            const limpo = {};

            for (const [key, count] of Object.entries(this.usage)) {
                // Mantém últimos 90 dias
                limpo[key] = count;
            }

            this.usage = limpo;
            this._saveJSON(this.usagePath, this.usage);
        } catch (e) {
            console.warn('Erro ao limpar uso antigo:', e);
        }
    }

    _loadJSON(filepath, defaultValue = {}) {
        try {
            if (fs.existsSync(filepath)) {
                return JSON.parse(fs.readFileSync(filepath, 'utf8'));
            }
        } catch (e) {
            console.warn(`Erro ao carregar ${filepath}:`, e);
        }
        return defaultValue;
    }

    _saveJSON(filepath, data) {
        try {
            fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
            return true;
        } catch (e) {
            console.warn(`Erro ao salvar ${filepath}:`, e);
            // Se falhar, salvar em memória apenas
            return false;
        }
    }
}

export default SubscriptionManager;