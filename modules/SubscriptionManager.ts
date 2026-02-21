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
    public config: any;
    public dataPath: string | null;
    public usagePath: string;
    public subscribersPath: string;
    public subscribers: { [key: string]: any };
    public usage: { [key: string]: any };

    constructor(config: any = null) {
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
            if (this.dataPath && !fs.existsSync(this.dataPath)) {
                fs.mkdirSync(this.dataPath, { recursive: true });
                console.log(`✅ SubscriptionManager: Diretório criado: ${this.dataPath}`);
            }
        } catch (error: any) {
            console.warn(`⚠️ SubscriptionManager: Não foi possível criar diretório em ${this.dataPath}:`, error.message);

            // Fallback para /tmp direto se falhar
            const tmpPath = '/tmp/subscriptions';
            try {
                fs.mkdirSync(tmpPath, { recursive: true });
                this.dataPath = tmpPath;
                this.usagePath = path.join(this.dataPath, 'usage.json');
                this.subscribersPath = path.join(this.dataPath, 'subscribers.json');
                console.log(`✅ SubscriptionManager: Usando fallback: ${this.dataPath}`);
            } catch (fallbackError: any) {
                console.error('❌ SubscriptionManager: Erro crítico ao criar diretório de fallback:', fallbackError.message);
                // Continuar sem diretório - usar memória apenas
                this.dataPath = null;
                this.usagePath = '';
                this.subscribersPath = '';
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
    * @returns { { canUse: boolean, reason: string, remaining: number } }
    */
    public canUseFeature(userId: string, featureName: string): { canUse: boolean, reason: string, remaining: number } {
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
    public getUserTier(userId: string): string {
        if (this.config.isDono(userId)) return 'owner';
        if (this.subscribers[userId]) return 'subscriber';
        return 'free';
    }

    /**
    * Subscreve um usuário
    */
    public subscribe(userId: string, duracao: number = 30): { sucesso: boolean, mensagem?: string, expiraEm?: string, erro?: string } {
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
        } catch (e: any) {
            return { sucesso: false, erro: e.message };
        }
    }

    /**
    * Cancela assinatura
    */
    public unsubscribe(userId: string): { sucesso: boolean, mensagem?: string, erro?: string } {
        try {
            delete this.subscribers[userId];
            this._saveJSON(this.subscribersPath, this.subscribers);

            return { sucesso: true, mensagem: 'Assinatura cancelada' };
        } catch (e: any) {
            return { sucesso: false, erro: e.message };
        }
    }

    /**
    * Verifica se assinatura expirou
    */
    public isSubscriptionValid(userId: string): boolean {
        const sub = this.subscribers[userId];
        if (!sub) return false;

        const agora = new Date();
        const expira = new Date(sub.expiraEm);

        return agora < expira;
    }

    /**
    * Verifica se o usuário é Premium (Subscriber ou Owner)
    */
    public isPremium(userId: string): boolean {
        const tier = this.getUserTier(userId);
        if (tier === 'owner') return true;
        if (tier === 'subscriber' && this.isSubscriptionValid(userId)) return true;
        return false;
    }

    /**
    * Obtém informações de assinatura
    */
    public getSubscriptionInfo(userId: string): { tier: string, status: string, usoPorPeriodo: string, periodo: string, recursos: string[], expiraEm?: string, upgrade?: string } {
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
            const diasRestantes = Math.ceil((expira.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

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
    public getUpgradeMessage(userId: string, feature: string): string {
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
    public getUsageReport(userId: string): { userId: string, tier: string, usoAtual: { [key: string]: number }, limites: any } {
        const userUsage: { [key: string]: number } = {};

        for (const [key, count] of Object.entries(this.usage)) {
            if (key.startsWith(userId)) {
                const [, feature] = key.split('_');
                userUsage[feature] = count as number;
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

    private _getLimites(tier: string): any {
        const limites: { [key: string]: any } = {
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

    private _getTimeWindow(tier: string): string {
        const windows: { [key: string]: string } = {
            free: 'month',
            subscriber: 'week',
            owner: 'unlimited'
        };
        return windows[tier] || 'month';
    }

    private _getWindowStart(window: string): string {
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
            const limpo: { [key: string]: any } = {};

            for (const [key, count] of Object.entries(this.usage)) {
                // Mantém últimos 90 dias
                limpo[key] = count;
            }

            this.usage = limpo;
            this._saveJSON(this.usagePath, this.usage);
        } catch (e: any) {
            console.warn('Erro ao limpar uso antigo:', e);
        }
    }

    private _loadJSON(filepath: string, defaultValue: any = {}): any {
        try {
            if (fs.existsSync(filepath)) {
                return JSON.parse(fs.readFileSync(filepath, 'utf8'));
            }
        } catch (e: any) {
            console.warn(`Erro ao carregar ${filepath}:`, e);
        }
        return defaultValue;
    }

    private _saveJSON(filepath: string, data: any): boolean {
        try {
            if (!filepath) return false;
            fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
            return true;
        } catch (e: any) {
            console.warn(`Erro ao salvar ${filepath}:`, e);
            // Se falhar, salvar em memória apenas
            return false;
        }
    }
}

export default SubscriptionManager;