/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CORREÇÕES HF SPACES - DNS E CONEXÃO WHATSAPP
 * ═══════════════════════════════════════════════════════════════════════════
 * Corrige erro: queryA ENODATA web.whatsapp.com
 * Soluções aplicadas:
 * 1. DNS Resolver Google (8.8.8.8)
 * 2. Socket Baileys com IP direto do WhatsApp
 * 3. Host header correto para WebSocket
 * 4. Agente HTTP otimizado para ambientes restritos
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// 1. CONFIGURAÇÃO DE DNS GOOGLE (8.8.8.8) - CORREÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

import dns from 'dns';
import https from 'https';
import http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';

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
        // Verifica se há proxy configurado
        const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy;

        if (proxy) {
            console.log(`🌐 HFCorrections: Usando Proxy: ${proxy}`);
            return new HttpsProxyAgent(proxy);
        }

        // Se não tem proxy, usa DNS customizado no agente
        return new https.Agent({
            lookup: (hostname, options, callback) => {
                // Tenta resolver primeiro
                dns.lookup(hostname, options, (err, address, family) => {
                    if (err) {
                        // Se falhar (comum no HF Spaces para domínios externos às vezes), usa Google DNS
                        // console.warn(`⚠️ DNS Lookup falhou para ${hostname}, tentando IP direto...`);

                        // Se for whatsapp, usa IP hardcoded
                        if (hostname.includes('whatsapp.com')) {
                            return callback(null, getWhatsAppIP(), 4);
                        }

                        return callback(err);
                    }
                    callback(null, address, family);
                });
            },
            keepAlive: true,
            keepAliveMsecs: 20000, // Aumentado para manter conexão
            timeout: 60000 // Timeout maior
        });
    } catch (e) {
        console.error('❌ HFCorrections - Erro ao criar agente:', e.message);
        return undefined; // Deixa o padrão do node/baileys
    }
}

// ═══════════════════════════════════════════════════════════════════════
// 4. CONFIGURAÇÃO DE WEBSOCKET (WSS)
// ═══════════════════════════════════════════════════════════════════════

function createWebSocketOptions() {
    return {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://web.whatsapp.com',
            'Host': 'web.whatsapp.com'
        },
        origin: 'https://web.whatsapp.com',
        // Timeout de handshake mais longo
        handshakeTimeout: 20000
    };
}

// ═══════════════════════════════════════════════════════════════════════
// 5. DIAGNÓSTICO DE REDE
// ═══════════════════════════════════════════════════════════════════════

async function verifyHFNetwork() {
    return new Promise((resolve) => {
        // Tenta resolver google.com para testar DNS
        dns.lookup('google.com', (err, address) => {
            if (err) {
                console.error(`🚨 HFCorrections - FALHA CRÍTICA DE REDE/DNS: ${err.message}`);
                console.log('💡 Tentando forçar DNS do Google (8.8.8.8)...');
                try {
                    dns.setServers(['8.8.8.8', '8.8.4.4']);
                    console.log('✅ DNS Servers configurados para 8.8.8.8');
                } catch (e) {
                    console.error('❌ Falha ao configurar DNS servers:', e.message);
                }
            } else {
                console.log(`✅ HFCorrections - Rede OK (DNS resolveu google.com -> ${address})`);
            }
            resolve();
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════
// 6. APLICAÇÃO GERAL
// ═══════════════════════════════════════════════════════════════════════

function configureDNS() {
    try {
        // Tenta definir servidores DNS para Google
        // Isso ajuda em ambientes onde o DNS local falha ou bloqueia
        dns.setServers(['8.8.8.8', '8.8.4.4']);
        // console.log('✅ HFCorrections: DNS configurado para Google (8.8.8.8)');
    } catch (e) {
        // Ignora erro se não tiver permissão
        // console.warn('⚠️ HFCorrections: Não foi possível definir DNS servers (sem permissão?)');
    }
}

const HFCorrections = {
    getWhatsAppIP,
    createHFAgent,
    createWebSocketOptions,
    verifyHFNetwork,
    configureDNS
};

export default HFCorrections;
