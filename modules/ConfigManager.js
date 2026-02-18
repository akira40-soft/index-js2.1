/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: ConfigManager
 * ═══════════════════════════════════════════════════════════════════════
 * Gerencia todas as configurações, constantes e variáveis de ambiente
 * Singleton pattern para acesso global consistente
 * ═══════════════════════════════════════════════════════════════════════
 */

import path from 'path';

class ConfigManager {
    static instance = null;

    constructor() {
        if (ConfigManager.instance) {
            return ConfigManager.instance;
        }

        // ═══ PORTAS E URLS ═══
        this.PORT = parseInt(process.env?.PORT || process.env?.HF_PORT || 3000);
        this.API_URL = process.env?.API_URL || process.env?.HF_API_URL || 'https://akra35567-akira-index.hf.space/api';
        this.API_TIMEOUT = parseInt(process.env?.API_TIMEOUT || 120000);
        this.API_RETRY_ATTEMPTS = parseInt(process.env?.API_RETRY_ATTEMPTS || 3);
        this.API_RETRY_DELAY = parseInt(process.env?.API_RETRY_DELAY || 1000);
        this.BASE_URL = process.env?.BASE_URL || 'https://index-js21-production.up.railway.app'; // URL de Produção

        // ═══ BOT IDENTITY ═══
        this.BOT_NUMERO_REAL = process.env?.BOT_NUMERO || '40755431264474';
        this.BOT_NAME = process.env?.BOT_NAME || 'belmira';
        this.BOT_VERSION = 'v21.1.02.2025';
        this.PREFIXO = process.env?.PREFIXO || '*';

        // ═══ PATHS E FOLDERS ═══
        // HF SPACES: Usar /tmp para garantir permissões de escrita
        // O HF Spaces tem sistema de arquivos somente-leitura em /
        const isHuggingFaceSpace = process.env?.HF_SPACE === 'true' || process.env?.NODE_ENV === 'production';
        const baseDataPath = isHuggingFaceSpace ? '/tmp/akira_data' : '.';

        this.TEMP_FOLDER = process.env?.TEMP_FOLDER || path.join(baseDataPath, 'temp');
        this.AUTH_FOLDER = process.env?.AUTH_FOLDER || path.join(baseDataPath, 'auth_info_baileys');
        this.DATABASE_FOLDER = process.env?.DATABASE_FOLDER || path.join(baseDataPath, 'database');
        this.LOGS_FOLDER = process.env?.LOGS_FOLDER || path.join(baseDataPath, 'logs');

        // ═══ STT (SPEECH-TO-TEXT) ═══
        this.DEEPGRAM_API_KEY = process.env?.DEEPGRAM_API_KEY || '2700019dc80925c32932ab0aba44d881d20d39f7';
        this.DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';
        this.DEEPGRAM_MODEL = process.env?.DEEPGRAM_MODEL || 'nova-3';
        this.STT_LANGUAGE = process.env?.STT_LANGUAGE || 'pt';

        // ═══ TTS (TEXT-TO-SPEECH) ═══
        this.TTS_LANGUAGE = process.env?.TTS_LANGUAGE || 'pt';
        this.TTS_SLOW = process.env?.TTS_SLOW === 'true';

        // ═══ RATE LIMITING ═══
        this.RATE_LIMIT_WINDOW = parseInt(process.env?.RATE_LIMIT_WINDOW || 8);
        this.RATE_LIMIT_MAX_CALLS = parseInt(process.env?.RATE_LIMIT_MAX_CALLS || 6);

        // ═══ MODERAÇÃO ═══
        this.MUTE_DEFAULT_MINUTES = parseInt(process.env?.MUTE_DEFAULT_MINUTES || 5);
        this.MUTE_MAX_DAILY = parseInt(process.env?.MUTE_MAX_DAILY || 5);
        this.AUTO_BAN_AFTER_MUTES = parseInt(process.env?.AUTO_BAN_AFTER_MUTES || 3);

        // ═══ YOUTUBE DOWNLOAD ═══
        this.YT_MAX_SIZE_MB = parseInt(process.env?.YT_MAX_SIZE_MB || 2048); // Aumentado para 2GB
        this.YT_TIMEOUT_MS = parseInt(process.env?.YT_TIMEOUT_MS || 3600000); // Aumentado para 1 hora (era 15 min)
        this.YT_QUALITY = process.env?.YT_QUALITY || 'highestaudio';
        this.YT_MAX_DURATION_SECONDS = parseInt(process.env?.YT_MAX_DURATION_SECONDS || 21600); // Aumentado para 6 horas

        // ═══ MÍDIA ═══
        this.STICKER_SIZE = parseInt(process.env?.STICKER_SIZE || 512);
        this.STICKER_MAX_ANIMATED_SECONDS = parseInt(process.env?.STICKER_MAX_ANIMATED_SECONDS || 30);
        this.IMAGE_QUALITY = parseInt(process.env?.IMAGE_QUALITY || 85);
        this.MAX_AUDIO_SIZE_MB = parseInt(process.env?.MAX_AUDIO_SIZE_MB || 100); // Aumentado para 100MB

        // ═══ CONVERSAÇÃO ═══
        this.MAX_RESPONSE_CHARS = parseInt(process.env?.MAX_RESPONSE_CHARS || 280);
        this.TYPING_SPEED_MS = parseInt(process.env?.TYPING_SPEED_MS || 50);
        this.MIN_TYPING_TIME_MS = parseInt(process.env?.MIN_TYPING_TIME_MS || 1500);
        this.MAX_TYPING_TIME_MS = parseInt(process.env?.MAX_TYPING_TIME_MS || 30000); // Aumentado para 30s

        // ═══ CACHE E PERFORMANCE ═══
        this.CACHE_TTL_SECONDS = parseInt(process.env?.CACHE_TTL_SECONDS || 3600);
        this.HISTORY_LIMIT_PER_USER = parseInt(process.env?.HISTORY_LIMIT_PER_USER || 50);
        this.MESSAGE_DEDUP_TIME_MS = parseInt(process.env?.MESSAGE_DEDUP_TIME_MS || 30000);

        // ═══ LOGGING ═══
        this.LOG_LEVEL = process.env?.LOG_LEVEL || 'info';
        this.LOG_API_REQUESTS = process.env?.LOG_API_REQUESTS !== 'false';
        this.LOG_DETAILED_MESSAGES = process.env?.LOG_DETAILED_MESSAGES !== 'false';

        // ═══ PERMISSÕES - DONO(S) ═══
        this.DONO_USERS = [
            { numero: '244937035662', nomeExato: 'Isaac Quarenta' },
            { numero: '244978787009', nomeExato: 'Isaac Quarenta' },
            { numero: '202391978787009', nomeExato: 'Isaac Quarenta' },
            { numero: '24491978787009', nomeExato: 'Isaac Quarenta' },
            { numero: '24478787009', nomeExato: 'Isaac Quarenta' },
            { numero: '37839265886398', nomeExato: 'Bot Admin' }
        ];

        // ═══ FEATURES ═══
        this.FEATURE_STT_ENABLED = process.env?.FEATURE_STT !== 'false';
        this.FEATURE_TTS_ENABLED = process.env?.FEATURE_TTS !== 'false';
        this.FEATURE_YT_DOWNLOAD = process.env?.FEATURE_YT !== 'false';
        this.FEATURE_STICKERS = process.env?.FEATURE_STICKERS !== 'false';
        this.FEATURE_MODERATION = process.env?.FEATURE_MODERATION !== 'false';
        this.FEATURE_LEVELING = process.env?.FEATURE_LEVELING !== 'false';
        this.FEATURE_VISION = process.env?.FEATURE_VISION !== 'false';

        ConfigManager.instance = this;
    }

    static getInstance() {
        if (!ConfigManager.instance) {
            new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
    * Valida se um usuário é dono do bot
    */
    isDono(numero, nome = '') {
        try {
            // Remove sufixos de dispositivo (:1, :2, etc) que o Baileys costuma incluir
            const numeroBase = String(numero).split(':')[0];
            const numeroLimpo = numeroBase.replace(/\D/g, '').trim();

            return this.DONO_USERS?.some(
                dono => String(dono.numero).replace(/\D/g, '') === numeroLimpo
            );
        } catch (e) {
            return false;
        }
    }

    /**
    * Retorna configuração por chave com fallback
    */
    get(key, defaultValue = null) {
        return this[key] !== undefined ? this[key] : defaultValue;
    }

    /**
    * Define configuração dinamicamente
    */
    set(key, value) {
        this[key] = value;
    }

    /**
    * Retorna todas as configurações (CUIDADO: dados sensíveis)
    */
    getAll(includeSensitive = false) {
        const config = { ...this };
        if (!includeSensitive) {
            delete config.DEEPGRAM_API_KEY;
            delete config.API_URL;
        }
        return config;
    }

    /**
    * Valida configurações críticas na inicialização
    */
    validate() {
        const errors = [];

        if (!this.API_URL) errors.push('API_URL não configurada');
        if (!this.BOT_NUMERO_REAL) errors.push('BOT_NUMERO não configurada');

        if (this.FEATURE_STT_ENABLED && !this.DEEPGRAM_API_KEY) {
            console.warn('⚠️ STT habilitado mas DEEPGRAM_API_KEY não configurada');
        }

        if (errors.length > 0) {
            console.error('❌ ERROS DE CONFIGURAÇÃO:');
            errors.forEach(e => console.error(` - ${e}`));
            return false;
        }

        console.log('✅ Configurações validadas com sucesso');
        return true;
    }

    /**
    * Log com contexto
    */
    logConfig() {
        console.log('\n' + '═'.repeat(70));
        console.log('⚙️ CONFIGURAÇÕES DO BOT');
        console.log('═'.repeat(70));
        console.log(` 🤖 Nome: ${this.BOT_NAME}`);
        console.log(` 📱 Número: ${this.BOT_NUMERO_REAL}`);
        console.log(` 📌 Versão: ${this.BOT_VERSION}`);
        console.log(` 🎛️ Prefixo: ${this.PREFIXO}`);
        console.log(` 🔌 API: ${this.API_URL?.substring(0, 50)}...`);
        console.log(` 🎤 STT: ${this.FEATURE_STT_ENABLED ? 'Ativado (Deepgram)' : 'Desativado'}`);
        console.log(` 🔊 TTS: ${this.FEATURE_TTS_ENABLED ? 'Ativado (Google)' : 'Desativado'}`);
        console.log(` 📥 YT Download: ${this.FEATURE_YT_DOWNLOAD ? 'Ativado' : 'Desativado'}`);
        console.log(` 🎨 Stickers: ${this.FEATURE_STICKERS ? 'Ativado' : 'Desativado'}`);
        console.log(` 🛡️ Moderação: ${this.FEATURE_MODERATION ? 'Ativado' : 'Desativado'}`);
        console.log(` 👤 Donos: ${this.DONO_USERS?.length} configurado(s)`);
        console.log('═'.repeat(70) + '\n');
    }
}

export default ConfigManager;
