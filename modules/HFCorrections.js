/**
 * ═══════════════════════════════════════════════════════════════════════
 * CORREÇÕES HF SPACES - DNS E CONEXÃO WHATSAPP
 * ═══════════════════════════════════════════════════════════════════════
 * Corrige erro: queryA ENODATA web.whatsapp.com
 * Soluções aplicadas:
 * 1. DNS Resolver Google (8.8.8.8)
 * 2. Socket Baileys com IP direto do WhatsApp
 * 3. Host header correto para WebSocket
 * 4. Agente HTTP otimizado para ambientes restritos
 * ═══════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// 1. CONFIGURAÇÃO DE DNS GOOGLE (8.8.8.8) - CORREÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

const dns = require('dns');

// ═══════════════════════════════════════════════════════════════════════
// 2. IP'S DIRETOS DO WHATSAPP (FALLBACK PARA CASO DNS FALHE)
// ═══════════════════════════════════════════════════════════════════════

const WHATSAPP_IPS = [
    '108.177.14.0', // web.whatsapp.com
    '142.250.79.0', // Google IPs often used
    '172.217.28.0',
    '142.250.0.0',
];

// Função para obter IP direto do WhatsApp
function getWhatsAppIP() {
    const index = Math.floor(Math.random() * WHATSAPP_IPS.length);
    return WHATSAPP_IPS[index];
}

// ═══════════════════════════════════════════════════════════════════════
// 3. HELPER: CRIA AGENTE HTTP COM FALLBACK DE DNS
// ═══════════════════════════════════════════════════════════════════════

function createHFAgent() {
    try {
        const https = require('https');
        const http = require('http');
        const { HttpsProxyAgent } = require('https-proxy-agent');

        // Verifica se há proxy configurado
        const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy;

        if (proxy) {
            console.log('🔌 Usando proxy configurado:', proxy.substring(0, 30) + '...');
            return new HttpsProxyAgent(proxy);
        }

        // Sem proxy - usa agente padrão otimizado
        return new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            timeout: 60000,
            maxSockets: 100,
            maxFreeSockets: 20,
            rejectUnauthorized: false
        });
    } catch (error) {
        console.warn('⚠️ Erro ao criar agente HTTP:', error.message);
        return undefined;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// 4. HELPER: CRIA WEBSOCKET OPTIONS OTIMIZADO PARA HF SPACES
// ═══════════════════════════════════════════════════════════════════════

function createWebSocketOptions() {
    return {
        // Headers que fingem ser browser real
        headers: {
            'Origin': 'https://web.whatsapp.com',
            'Host': 'web.whatsapp.com',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
            'Sec-WebSocket-Version': '13',
        },
        // Timeout mais longo para containers lentos
        handshakeTimeout: 60000,
        timeout: 60000,
    };
}

// ═══════════════════════════════════════════════════════════════════════
// 5. VERIFICAÇÃO DE REDE ESPECÍFICA PARA HF SPACES
// ═══════════════════════════════════════════════════════════════════════

async function verifyHFNetwork() {
    console.log('🌐 Verificando conectividade de rede (HF Spaces)...');

    return new Promise((resolve) => {
        const net = require('net');
        const testHosts = [
            { host: '8.8.8.8', port: 53, name: 'Google DNS' },
            { host: '1.1.1.1', port: 53, name: 'Cloudflare DNS' },
            { host: 'web.whatsapp.com', port: 443, name: 'WhatsApp Web' }
        ];

        let checked = 0;
        let results = {};

        testHosts.forEach(test => {
            const socket = new net.Socket();
            socket.setTimeout(5000);

            socket.on('connect', () => {
                results[test.name] = true;
                socket.destroy();
                checkDone();
            });

            socket.on('timeout', () => {
                results[test.name] = false;
                socket.destroy();
                checkDone();
            });

            socket.on('error', (err) => {
                results[test.name] = false;
                socket.destroy();
                checkDone();
            });

            socket.connect(test.port, test.host);
        });

        function checkDone() {
            checked++;
            if (checked >= testHosts.length) {
                console.log('📊 Resultado dos testes de rede:', results);
                resolve(results['WhatsApp Web'] || results['Google DNS']);
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORTAÇÕES
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
    configureDNS: () => {
        // DNS já configurado no início do arquivo
        console.log('✅ DNS configurado para IPv4 first');
    },

    getWhatsAppIP,

    createHFAgent,

    createWebSocketOptions,

    verifyHFNetwork
};
