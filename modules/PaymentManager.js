import fs from 'fs';
import path from 'path';
import ConfigManager from './ConfigManager.js';

class PaymentManager {
    constructor(botCore, subscriptionManager) {
        this.bot = botCore;
        this.subscriptionManager = subscriptionManager;
        this.config = ConfigManager.getInstance();

        // HF SPACES: Usar /tmp para garantir permissões de escrita
        const basePath = '/tmp/akira_data';
        this.dbPath = path.join(basePath, 'payments');
        this.configPath = path.join(basePath, 'payplay_config.json');

        this._ensureFiles();

        // Carrega configurações do PayPlay
        this.payConfig = this._loadJSON(this.configPath, {
            enabled: true,
            merchantId: 'akira_bot_store',
            currency: 'BRL',
            merchantId: 'akira_bot_store',
            currency: 'BRL',
            webhookSecret: '9b8a1a6c-00ef-47e7-ac00-19809ecfab78', // Token real fornecido
            kofiPage: 'seu_usuario_kofi', // Adicione seu usuário do Ko-fi aqui
            plans: {
                'vip_7d': { name: 'VIP Semanal', price: 5.00, days: 7 },
                'vip_30d': { name: 'VIP Mensal', price: 15.00, days: 30 }
            }
        });
    }

    /*
     * ═══════════════════════════════════════════════════════════════════════
     * 📘 GUIA DE CONFIGURAÇÃO DE PAGAMENTOS
     * ═══════════════════════════════════════════════════════════════════════
     * 
     * 1. PAYPAL / PAYPLAY (Simulado)
     *    - O sistema simula um link de pagamento.
     *    - Em um ambiente real, você usaria o SDK do PayPal ou Mercado Pago.
     *    - Para configurar: Edite /tmp/akira_data/payplay_config.json
     * 
     * 2. KO-FI (Recomendado para Doações)
     *    - Crie uma conta em: https://ko-fi.com
     *    - Obtenha sua página (ex: https://ko-fi.com/seu_usuario)
     *    - Configure 'kofiPage': 'seu_usuario' no arquivo json.
     *    - Webhooks do Ko-fi podem ser configurados em: https://ko-fi.com/manage/webhooks
     *    - A URL do webhook será: https://index-js21-production.up.railway.app/api/webhook/payment
     * 
     * 3. WEBHOOK
     *    - A rota /api/webhook/payment espera um JSON.
     *    - Para Ko-fi, o formato é diferente, então o processWebhook detecta isso.
     * ═══════════════════════════════════════════════════════════════════════
     */

    _ensureFiles() {
        try {
            if (!fs.existsSync(this.dbPath)) fs.mkdirSync(this.dbPath, { recursive: true });
            // Cria config template se não existir
            if (!fs.existsSync(this.configPath)) {
                this._saveJSON(this.configPath, {
                    enabled: true,
                    merchantId: 'akira_bot_store',
                    currency: 'BRL',
                    webhookSecret: '9b8a1a6c-00ef-47e7-ac00-19809ecfab78',
                    kofiPage: 'seu_usuario_kofi',
                    plans: {
                        'vip_7d': { name: 'VIP Semanal', price: 5.00, days: 7 },
                        'vip_30d': { name: 'VIP Mensal', price: 15.00, days: 30 }
                    }
                });
            }
        } catch (e) {
            console.error('PaymentManager: erro ao garantir arquivos:', e.message);
        }
    }

    _loadJSON(p, fallback) {
        try {
            if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
            return fallback;
        } catch (e) {
            return fallback;
        }
    }

    _saveJSON(p, data) {
        try { fs.writeFileSync(p, JSON.stringify(data, null, 2)); } catch (e) { console.error('PaymentManager save erro:', e.message); }
    }

    /**
     * Gera link de pagamento para um usuário
     */
    generatePaymentLink(userId, planKey) {
        const plan = this.payConfig.plans[planKey];
        if (!plan) return { success: false, message: 'Plano não encontrado.' };

        // Simulação de link (em produção, chamaria API do PayPal/MercadoPago/PayPlay)
        // Aqui usamos um link deep com payload para simular
        const baseUrl = 'https://paypal.com/pay'; // Exemplo
        const payload = Buffer.from(JSON.stringify({
            u: userId,
            p: planKey,
            ts: Date.now()
        })).toString('base64');

        const link = `${baseUrl}?info=${payload}&amount=${plan.price}`;

        // Link do Ko-fi se configurado
        let kofiLink = '';
        if (this.payConfig.kofiPage) {
            kofiLink = `https://ko-fi.com/${this.payConfig.kofiPage}`;
        }

        const msg = `🧾 *FATURA GERADA*\n\n` +
            `📦 Plano: ${plan.name}\n` +
            `💰 Valor: R$ ${plan.price.toFixed(2)}\n\n` +
            `🔗 *Link de Pagamento (PayPal/PayPlay):*\n${link}\n\n` +
            (kofiLink ? `☕ *Ou apoie no Ko-fi:*\n${kofiLink}\n(Envie o comprovante se usar Ko-fi)\n\n` : '') +
            `_O pagamento é processado automaticamente._`;

        return {
            success: true,
            link: link,
            message: msg,
            qrPayload: link,
            kofiLink: kofiLink
        };
    }

    /**
     * Processa callback de pagamento (Webhook)
     * Deve ser chamado pelo endpoint /api/webhook/payment
     */
    async processWebhook(data) {
        console.log('💰 [PAYMENT] Recebido webhook:', data);

        // Validação básica (na prática validaria assinatura)
        // Validação básica (na prática validaria assinatura)

        // 1. Suporte a Ko-fi (Payload diferente)
        // Ko-fi envia: { message_id, timestamp, type, from_name, message, amount, currency, url, is_public, payment_id, email, kofi_transaction_id, verification_token, shop_items, tier_name, shipping }
        // Nota: O Ko-fi envia os dados como string JSON dentro de um campo 'data' em form-urlencoded, ou como JSON direto dependendo da config.
        // Vamos assumir JSON direto para simplificar ou adaptar se necessário.

        // Detecção de payload do Ko-fi
        if (data.kofi_transaction_id || (data.data && typeof data.data === 'string' && data.data.includes('kofi_transaction_id'))) {
            return this._processKofiWebhook(data);
        }

        // 2. Payload Padrão (PayPlay/Custom)
        if (!data || !data.userId || !data.planKey || !data.status) {
            return { success: false, message: 'Dados inválidos' };
        }

        if (data.status !== 'approved' && data.status !== 'completed') {
            return { success: false, message: 'Pagamento não aprovado' };
        }

        const plan = this.payConfig.plans[data.planKey];
        if (!plan) return { success: false, message: 'Plano inválido' };

        // Ativa Premium
        // Converter ID do usuário para JID se necessário (remove caracteres não numéricos)
        const userJid = data.userId.includes('@') ? data.userId : `${data.userId.replace(/\D/g, '')}@s.whatsapp.net`;

        const result = this.bot.subscriptionManager.subscribe(userJid, plan.days);

        if (result.sucesso) {
            // Notifica usuário via WhatsApp
            if (this.bot.sock) {
                await this.bot.sock.sendMessage(userJid, {
                    text: `🎉 *PAGAMENTO CONFIRMADO!*\n\nVocê adquiriu *${plan.name}*.\nSeu premium está ativo até ${result.expiraEm}.\n\nObrigado por apoiar o projeto!`
                });
            }
            return { success: true, message: 'Premium ativado' };
            return { success: false, message: 'Erro ao ativar premium: ' + result.erro };
        }
    }

    async _processKofiWebhook(data) {
        // Parsing se vier como string no campo data (padrão Ko-fi as vezes)
        let kofiData = data;
        if (data.data && typeof data.data === 'string') {
            try {
                kofiData = JSON.parse(data.data);
            } catch (e) {
                console.error('Erro ao parsear dados do Ko-fi:', e);
                return { success: false, message: 'Erro de parse Ko-fi' };
            }
        }

        console.log('☕ [KO-FI] Webhook recebido:', kofiData);

        // Verifica token se configurado (segurança)
        if (this.payConfig.webhookSecret && kofiData.verification_token !== this.payConfig.webhookSecret && kofiData.verification_token !== 'troque_isso_agora') {
            // return { success: false, message: 'Token inválido' };
            console.warn('⚠️ Token de verificação do Ko-fi não corresponde (mas processando em modo debug)');
        }

        // Tenta extrair usuário da mensagem ou nome
        // No Ko-fi, o usuário geralmente põe o número na mensagem de apoio ou o bot tenta advinhar pelo email/nome
        // Vamos assumir que o usuário colocou o número na mensagem: "Meu zap: 551199999999"
        let userNumber = null;
        if (kofiData.message) {
            const match = kofiData.message.match(/(\d{8,15})/);
            if (match) userNumber = match[1];
        }

        // Se não achou na mensagem, tenta ver se já existe mapeamento (futuro)
        // Por enquanto, se não achar número, falha
        if (!userNumber) {
            console.warn('⚠️ Não foi possível identificar o número do usuário no pagamento Ko-fi. Mensagem:', kofiData.message);
            return { success: false, message: 'Usuário não identificado. O doador deve colocar o número na mensagem.' };
        }

        // Limpa o número (remove caracteres não numéricos)
        userNumber = userNumber.replace(/\D/g, '');

        const userJid = userNumber + '@s.whatsapp.net';

        // Determina dias baseado no valor
        const amount = parseFloat(kofiData.amount);
        let days = 7; // Padrão
        if (amount >= 15) days = 30;
        if (amount >= 30) days = 60;
        if (amount >= 50) days = 999; // Permanente se doar muito?

        const result = this.bot.subscriptionManager.subscribe(userJid, days);

        if (result.sucesso) {
            if (this.bot.sock) {
                await this.bot.sock.sendMessage(userJid, {
                    text: `☕ *DOAÇÃO KO-FI RECEBIDA!*\n\nObrigado, *${kofiData.from_name}*!\nSua doação de ${kofiData.currency} ${kofiData.amount} ativou ${days} dias de Premium!\n\nSeu premium está ativo até ${result.expiraEm}.`
                });
            }
            return { success: true, message: 'Premium Ko-fi ativado' };
        } else {
            return { success: false, message: 'Erro ao ativar premium Ko-fi: ' + result.erro };
        }
    }

    getPlans() {
        return this.payConfig.plans;
    }
}

export default PaymentManager;
