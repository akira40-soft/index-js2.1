/**
 * ═══════════════════════════════════════════════════════════════════════
 * PERMISSION MANAGER - AKIRA BOT V21
 * ═══════════════════════════════════════════════════════════════════════
 * Sistema centralizado de gerenciamento de permissões
 * NOVO: Integração com RegistrationSystem para controle por registro
 * ═══════════════════════════════════════════════════════════════════════
 */

import RegistrationSystem from './RegistrationSystem.js';
import fs from 'fs';
import path from 'path';

class PermissionManager {
    public registrationSystem: RegistrationSystem;
    public groupRegistrationConfig: any;
    public owners: any[];
    public commandPermissions: any;
    public actionLimits: any;
    public securityConfig: any;

    public logger: any;

    constructor(logger: any = console) {
        this.logger = logger;
        // Integração com sistema de registro
        this.registrationSystem = new RegistrationSystem();

        // Configurações de registro por grupo
        this.groupRegistrationConfig = this.loadGroupRegistrationConfig();

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
            },
            {
                numero: '202391978787009',
                nome: 'Isaac Quarenta',
                descricao: 'Proprietário Principal',
                nivel: 'ROOT'
            }
        ];

        // Permissões por comando
        this.commandPermissions = {
            // Comandos SEMPRE LIVRES (não requerem registro)
            'help': { nivel: 'public', requiresRegistration: false, rateLimitMultiplier: 0.5 },
            'menu': { nivel: 'public', requiresRegistration: false, rateLimitMultiplier: 0.5 },
            'ping': { nivel: 'public', requiresRegistration: false, rateLimitMultiplier: 0.5 },
            'info': { nivel: 'public', requiresRegistration: false, rateLimitMultiplier: 0.5 },
            'registrar': { nivel: 'public', requiresRegistration: false, rateLimitMultiplier: 1 },
            'register': { nivel: 'public', requiresRegistration: false, rateLimitMultiplier: 1 },

            // Comandos PÚBLICOS (requerem registro se grupo configurado)
            'donate': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 0.5 },
            'perfil': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'profile': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'level': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'rank': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'sticker': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 2 },
            's': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 2 },
            'gif': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 2.5 },
            'toimg': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1.5 },
            'play': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 2 },
            'p': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 2 },
            'video': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 3 },
            'ytmp4': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 3 },
            'playvid': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 3 },
            'tts': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 2 },
            'daily': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'atm': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'transfer': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1.5 },
            'pinterest': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 2 },
            'img': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 2 },
            'ship': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'gay': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'dado': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'moeda': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'slot': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'chance': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'hd': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 3 },
            'upscale': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 3 },
            'wasted': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 2 },
            'removebg': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 3 },
            'piada': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'joke': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'frases': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'quote': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'fatos': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'curiosidade': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1 },
            'enquete': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1.5, grupo: true },
            'poll': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1.5, grupo: true },

            // Comandos de GRUPO (Requerem Admin/Dono + Registro)
            'add': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'remove': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'kick': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'ban': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'promote': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'demote': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'mute': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'desmute': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'fechar': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'abrir': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'antilink': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'tagall': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'hidetag': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'totag': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'welcome': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'goodbye': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'revlink': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'revogar': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'setdesc': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'setfoto': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 2, grupo: true },
            'antispam': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'sortear': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 2, grupo: true },
            'sorteio': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 2, grupo: true },
            'groupinfo': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'listar': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'admins': { nivel: 'public', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },
            'requireregister': { nivel: 'admin', requiresRegistration: true, rateLimitMultiplier: 1, grupo: true },

            // Comandos de ADMIN/DONO
            'broadcast': { nivel: 'owner', requiresRegistration: true, rateLimitMultiplier: 1 },
            'setbotphoto': { nivel: 'owner', requiresRegistration: true, rateLimitMultiplier: 1 },
            'setbotname': { nivel: 'owner', requiresRegistration: true, rateLimitMultiplier: 1 },
            'setbotstatus': { nivel: 'owner', requiresRegistration: true, rateLimitMultiplier: 1 },
            'nmap': { nivel: 'owner', requiresRegistration: true, rateLimitMultiplier: 5 },
            'sqlmap': { nivel: 'owner', requiresRegistration: true, rateLimitMultiplier: 5 },
            'whois': { nivel: 'owner', requiresRegistration: true, rateLimitMultiplier: 2 },

            // Comandos CYBERSEGURANÇA (requerem pagamento - já implementado)
            'vpn': { nivel: 'premium', requiresPayment: true, requiresRegistration: true, rateLimitMultiplier: 3 },
            'osint': { nivel: 'premium', requiresPayment: true, requiresRegistration: true, rateLimitMultiplier: 3 },
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
    isOwner(numero: string, nome: string = '') {
        try {
            // Remove sufixos de dispositivo (:1, :2, etc) que o Baileys costuma incluir
            const numeroBase = String(numero).split(':')[0];
            const numeroLimpo = numeroBase.replace(/\D/g, '').trim();

            // Prioridade absoluta: número na lista de owners
            const matchByNumber = this.owners?.some(owner =>
                String(owner.numero).replace(/\D/g, '') === numeroLimpo
            );

            if (matchByNumber) return true;

            // Fallback (menos confiável): nome exato (removido para evitar spoofing, mas mantido se numero bater)
            // Por segurança, exigimos que o numero SEJA o identificador principal
            return false;
        } catch (e: any) {
            return false;
        }
    }

    /**
    * Obtém informações do proprietário
    */
    getOwnerInfo(numero: string) {
        const numeroLimpo = String(numero).trim();
        return this.owners?.find(owner => numeroLimpo === owner.numero);
    }

    /**
    * Verifica permissão para comando específico
    */
    hasPermissionForCommand(comando: string, numero: string, nome: string, ehGrupo: boolean = false) {
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
    getCommandConfig(comando: string) {
        return this.commandPermissions[comando] || null;
    }

    /**
    * Obtém múltiplo de rate limit para comando
    */
    getRateLimitMultiplier(comando: string) {
        const config = this.commandPermissions[comando];
        return config?.rateLimitMultiplier || 1;
    }

    /**
    * Valida padrão de link
    */
    containsLink(texto: string) {
        if (!texto) return false;
        const textLower = String(texto).toLowerCase();
        return this.securityConfig?.linkPatterns?.some((pattern: string) =>
            textLower.includes(pattern.toLowerCase())
        );
    }

    /**
    * Obtém configuração de limite de ação
    */
    getActionLimitConfig(tipoAcao: string) {
        return this.actionLimits[tipoAcao];
    }

    /**
    * Calcula próxima duração de mute progressivo
    */
    getNextMuteDuration(muteCount: number) {
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
    shouldRemoveAfterMute(muteCount: number) {
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

    // ═════════════════════════════════════════════════════════════════
    // SISTEMA DE PERMISSÕES POR REGISTRO
    // ═════════════════════════════════════════════════════════════════

    /**
     * Carrega configurações de registro por grupo
     */
    loadGroupRegistrationConfig() {
        try {
            const configPath = '/tmp/akira_data/group_registration_config.json';
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf8');
                return JSON.parse(data || '{}');
            }
        } catch (e: any) {
            console.warn('⚠️ Erro ao carregar config de registro:', e.message);
        }
        return {};
    }

    /**
     * Salva configurações de registro por grupo
     */
    saveGroupRegistrationConfig() {
        try {
            const configPath = '/tmp/akira_data/group_registration_config.json';
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(this.groupRegistrationConfig, null, 2));
        } catch (e: any) {
            console.error('❌ Erro ao salvar config de registro:', e.message);
        }
    }

    /**
     * Verifica se grupo exige registro para comandos comuns
     */
    groupRequiresRegistration(groupJid: string) {
        // Padrão: grupos NÃO exigem registro (para não quebrar comportamento atual)
        return this.groupRegistrationConfig[groupJid]?.requireRegistration === true;
    }

    /**
     * Define se grupo exige registro
     */
    setGroupRequireRegistration(groupJid: string, require: boolean) {
        if (!this.groupRegistrationConfig[groupJid]) {
            this.groupRegistrationConfig[groupJid] = {};
        }
        this.groupRegistrationConfig[groupJid].requireRegistration = require;
        this.saveGroupRegistrationConfig();
    }

    /**
     * Verifica se usuário pode executar comando (NOVO SISTEMA)
     * @param {string} comando - Nome do comando
     * @param {string} userId - ID do usuário (número@s.whatsapp.net)
     * @param {string} userName - Nome do usuário
     * @param {boolean} isGroup - Se está em grupo
     * @param {string} groupJid - JID do grupo (se aplicável)
     * @returns {Object} { allowed: boolean, reason: string }
     */
    canExecuteCommand(comando: string, userId: string, userName: string, isGroup: boolean = false, groupJid: string | null = null) {
        const permConfig = this.commandPermissions[comando];

        if (!permConfig) {
            return { allowed: false, reason: 'Comando não encontrado.' };
        }

        // REGRA 1: Dono SEMPRE pode tudo
        const userNumber = userId.split('@')[0];
        if (this.isOwner(userNumber, userName)) {
            return { allowed: true, reason: 'Owner access' };
        }

        // REGRA 2: Verificar se requer pagamento (cybersegurança)
        if (permConfig.requiresPayment) {
            return {
                allowed: false,
                reason: '⚠️ Este comando requer assinatura premium.\n\nUse #subscribe para conhecer os planos.'
            };
        }

        // REGRA 3: Comandos de grupo só funcionam em grupos
        if (permConfig.grupo && !isGroup) {
            return {
                allowed: false,
                reason: '📵 Este comando só funciona em grupos.'
            };
        }

        // REGRA 4: Comandos de dono (owner level)
        if (permConfig.nivel === 'owner') {
            return {
                allowed: false,
                reason: '🔒 Este comando é restrito ao proprietário do bot.'
            };
        }

        // REGRA 5: Verificar registro (se comando requer E grupo exige)
        if (permConfig.requiresRegistration) {
            // Se não está em grupo, sempre requer registro
            // Se está em grupo, verifica se grupo exige
            const mustCheckRegistration = !isGroup || (isGroup && groupJid && this.groupRequiresRegistration(groupJid));

            if (mustCheckRegistration) {
                const isRegistered = this.registrationSystem.isRegistered(userId);
                if (!isRegistered) {
                    return {
                        allowed: false,
                        reason: '📝 **Registro Necessário**\n\n' +
                            'Para usar este comando, você precisa se registrar.\n' +
                            'Use: `#registrar Nome|Idade`\n' +
                            'Exemplo: `#registrar João Silva|25`'
                    };
                }
            }
        }

        // Se passou por todas as verificações
        return { allowed: true, reason: 'Authorized' };
    }

    /**
     * Obtém mensagem de ajuda sobre registro
     */
    getRegistrationHelpMessage() {
        return '📝 **Como se Registrar**\n\n' +
            'Use o comando: `#registrar Nome|Idade`\n\n' +
            '**Exemplos:**\n' +
            '• `#registrar João Silva|25`\n' +
            '• `#registrar Maria Santos|30`\n\n' +
            '✅ Após o registro, você terá acesso a todos os comandos comuns do bot!';
    }
}

export default PermissionManager;
