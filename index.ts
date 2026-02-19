/**
 * ═══════════════════════════════════════════════════════════════════════
 * AKIRA BOT V21 — ARQUITETURA OOP COMPLETA
 * ═══════════════════════════════════════════════════════════════════════
 * ✅ Arquitetura modular com 6+ classes especializadas
 * ✅ Conformidade completa com api.py payload
 * ✅ Integração com computervision.py
 * ✅ STT (Deepgram), TTS (Google), YT Download, Stickers
 * ✅ Sistema de moderação avançado
 * ✅ Rate limiting e proteção contra spam
 * ✅ Performance otimizada com cache e deduplicação
 * ✅ GARANTIA: Responde SEMPRE em REPLY nos grupos (@g.us)
 * ✅ SIMULAÇÕES: Digitação, Gravação, Ticks, Presença (em BotCore)
 * 
 * 📝 NOTA: Este arquivo delega a lógica para classes OOP:
 *    - BotCore.js → Processamento de mensagens e resposta
 *    - PresenceSimulator.js → Simulações de digitação/áudio/ticks
 *    - CommandHandler.js → Processamento de comandos
 * 
 * 🔗 REFERÊNCIA RÁPIDA:
 *    - Lógica de REPLY: modules/BotCore.js linha ~426
 *    - Simulações: modules/PresenceSimulator.js
 *    - Comandos: modules/CommandHandler.js
 *    - Config: modules/ConfigManager.js
 * 
 * ⚡ HF SPACES DNS CORRECTIONS - CRÍTICO PARA QR CODE:
 *    - Força IPv4 para resolver web.whatsapp.com
 *    - Configuração DNS do Google (8.8.8.8) como fallback
 * ═══════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// HF SPACES DNS CORRECTIONS - CORREÇÃO CRÍTICA PARA QR CODE
// ═══════════════════════════════════════════════════════════════════════
import dns from 'dns';
import HFCorrections from './modules/HFCorrections.js';

// Aplica correções globais (DNS, IPv4, Fallbacks)
HFCorrections.apply();

// @ts-nocheck
import express from 'express';
import QRCode from 'qrcode';
import ConfigManager from './modules/ConfigManager.js';
import BotCore from './modules/BotCore.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO GLOBAL
// ═══════════════════════════════════════════════════════════════════════

const config = ConfigManager.getInstance();
let botCore: any = null;
let app: any = null;
let server: any = null;

/**
 * Inicializa o servidor Express
 */
function initializeServer() {
  app = express();
  app.use(express.json());
  // Ko-fi envia webhooks como application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: true }));

  // ═══ Middleware para logging ═══
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    const path = req.path;
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // ═══ Rota: Status ═══
  app.get('/', (req: any, res: any) => {
    if (!botCore) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>🤖 Akira Bot V21 - Inicializando...</title>
          <style>
            body { background: #000; color: #ffaa00; font-family: 'Courier New', monospace; padding: 40px; line-height: 1.6; text-align: center; }
            h1 { color: #ffaa00; text-shadow: 0 0 10px #ffaa00; }
            .loading:after { content: '.'; animation: dots 1.5s steps(5, end) infinite; }
            @keyframes dots { 0%, 20% { content: '.'; } 40% { content: '..'; } 60% { content: '...'; } 80%, 100% { content: ''; } }
          </style>
          <meta http-equiv="refresh" content="3">
        </head>
        <body>
          <h1>🤖 AKIRA BOT V21</h1>
          <p>Inicializando o sistema<span class="loading"></span></p>
          <p>Por favor, aguarde alguns segundos</p>
          <p>Atualizando automaticamente</p>
        </body>
        </html>
      `);
    }

    const status = botCore.getStatus();
    const qr = botCore.getQRCode();

    // Se tem QR code mas ainda não está conectado
    const hasQR = qr !== null && qr !== undefined;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>🤖 Akira Bot V21</title>
        <style>
          body { background: #000; color: #0f0; font-family: 'Courier New', monospace; padding: 40px; line-height: 1.6; }
          h1 { text-align: center; color: #00ff00; text-shadow: 0 0 10px #00ff00; }
          .container { max-width: 600px; margin: 0 auto; background: #0a0a0a; padding: 20px; border: 2px solid #00ff00; border-radius: 5px; }
          .status { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #00ff00; }
          .label { font-weight: bold; }
          .links { text-align: center; margin-top: 20px; }
          a { color: #00ff00; text-decoration: none; margin: 0 15px; padding: 8px 16px; border: 1px solid #00ff00; border-radius: 5px; display: inline-block; transition: all 0.3s; }
          a:hover { background: #00ff00; color: #000; text-decoration: none; }
          .version { color: #0099ff; }
          .qr-indicator { background: ${hasQR ? '#00ff00' : '#ffaa00'}; color: #000; padding: 5px 10px; border-radius: 3px; font-weight: bold; margin-left: 10px; }
          .status-indicator { background: ${status.isConnected ? '#00ff00' : '#ff4444'}; color: #000; padding: 5px 10px; border-radius: 3px; font-weight: bold; margin-left: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🤖 AKIRA BOT V21</h1>
          <div class="status">
            <span class="label">Status:</span>
            <span>${status.isConnected ? '✅ ONLINE' : '❌ OFFLINE'} <span class="status-indicator">${status.isConnected ? 'CONECTADO' : 'DESCONECTADO'}</span></span>
          </div>
          <div class="status">
            <span class="label">QR Code:</span>
            <span>${hasQR ? '📱 DISPONÍVEL' : '⏳ AGUARDANDO'} <span class="qr-indicator">${hasQR ? 'PRONTO' : 'GERANDO'}</span></span>
          </div>
          <div class="status">
            <span class="label">Número:</span>
            <span>${status.botNumero}</span>
          </div>
          <div class="status">
            <span class="label">JID:</span>
            <span>${status.botJid || 'Desconectado'}</span>
          </div>
          <div class="status">
            <span class="label">Uptime:</span>
            <span>${status.uptime}s</span>
          </div>
          <div class="status version">
            <span class="label">Versão:</span>
            <span>${status.version}</span>
          </div>
          <div class="links">
            <a href="/qr">📱 QR Code</a>
            <a href="/health">💚 Health</a>
            <a href="/stats">📊 Stats</a>
            ${!status.isConnected ? '<a href="/force-qr">🔄 Forçar QR</a>' : ''}
            <a href="/reset-auth" onclick="return confirm(\'Isso vai desconectar o bot e exigir novo login. Continuar?\')">🔄 Reset Auth</a>
          </div>
          <div style="margin-top: 20px; text-align: center; color: #666; font-size: 12px;">
            Porta: ${config.PORT} | API: ${config.API_URL ? 'Conectada' : 'Desconectada'}
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // ═══ Rota: QR Code ═══
  app.get('/qr', async (req: any, res: any) => {
    try {
      if (!botCore) {
        return res.status(503).send(`
          <html>
          <head>
            <meta http-equiv="refresh" content="3">
            <style>
              body { background: #000; color: #ffaa00; font-family: monospace; text-align: center; padding: 50px; }
              .loading:after { content: '.'; animation: dots 1.5s steps(5, end) infinite; }
              @keyframes dots { 0%, 20% { content: '.'; } 40% { content: '..'; } 60% { content: '...'; } 80%, 100% { content: ''; } }
            </style>
          </head>
          <body>
            <h1>🔄 INICIALIZANDO BOT</h1>
            <p>O bot ainda está sendo inicializado<span class="loading"></span></p>
            <p>Por favor, aguarde alguns segundos</p>
            <p>Atualizando automaticamente em 3 segundos</p>
            <p><a href="/" style="color: #0f0;">← Voltar</a></p>
          </body>
          </html>
        `);
      }

      const status = botCore.getStatus();
      const qr = botCore.getQRCode();

      // Se já está conectado
      if (status.isConnected) {
        return res.send(`
          <html>
          <head>
            <style>
              body { background: #000; color: #0f0; font-family: monospace; text-align: center; padding: 50px; }
              .connected { color: #00ff00; font-size: 24px; margin: 20px 0; padding: 20px; border: 2px solid #00ff00; border-radius: 10px; }
            </style>
          </head>
          <body>
            <h1>✅ BOT CONECTADO!</h1>
            <div class="connected">
              <p>✅ <strong>ONLINE E OPERACIONAL</strong></p>
              <p>🤖 Nome: ${config.BOT_NAME}</p>
              <p>📱 Número: ${status.botNumero}</p>
              <p>🔗 JID: ${status.botJid || 'N/A'}</p>
              <p>⏱️ Uptime: ${status.uptime} segundos</p>
            </div>
            <p>O bot já está conectado ao WhatsApp e pronto para uso.</p>
            <p>Nenhum QR Code necessário agora.</p>
            <p><a href="/" style="color: #0f0;">← Voltar para Página Inicial</a></p>
          </body>
          </html>
        `);
      }

      // Se não está conectado e não tem QR
      if (!qr) {
        return res.send(`
          <html>
          <head>
            <meta http-equiv="refresh" content="5">
            <title>🔄 Gerando QR Code - Akira Bot</title>
            <style>
              body { 
                background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                color: #ffaa00; 
                font-family: 'Courier New', monospace; 
                text-align: center; 
                padding: 40px;
                margin: 0;
                min-height: 100vh;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background: rgba(10, 10, 10, 0.9);
                padding: 40px;
                border: 2px solid #ffaa00;
                border-radius: 10px;
                box-shadow: 0 0 30px rgba(255, 170, 0, 0.3);
              }
              h1 { 
                color: #ffaa00; 
                text-shadow: 0 0 10px #ffaa00;
                margin-bottom: 30px;
              }
              .loading-container {
                margin: 30px 0;
                padding: 20px;
              }
              .spinner {
                width: 60px;
                height: 60px;
                border: 5px solid rgba(255, 170, 0, 0.3);
                border-top: 5px solid #ffaa00;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .loading-text:after {
                content: '.';
                animation: dots 1.5s steps(5, end) infinite;
              }
              @keyframes dots {
                0%, 20% { content: '.'; }
                40% { content: '..'; }
                60% { content: '...'; }
                80%, 100% { content: ''; }
              }
              .instructions {
                background: rgba(255, 170, 0, 0.1);
                border: 1px solid #ffaa00;
                border-radius: 5px;
                padding: 20px;
                margin: 30px 0;
                text-align: left;
              }
              a { 
                color: #ffaa00; 
                text-decoration: none; 
                margin: 0 10px;
                padding: 8px 16px;
                border: 1px solid #ffaa00;
                border-radius: 5px;
                display: inline-block;
                transition: all 0.3s;
              }
              a:hover { 
                background: #ffaa00; 
                color: #000;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🔄 GERANDO QR CODE</h1>
              
              <div class="loading-container">
                <div class="spinner"></div>
                <h2 class="loading-text">Aguardando geração do QR Code</h2>
                <p>Isso pode levar alguns segundos</p>
              </div>
              
              <div class="instructions">
                <h3>📋 O QUE ESTÁ ACONTECENDO:</h3>
                <ul>
                  <li>O bot está iniciando a conexão com o WhatsApp</li>
                  <li>O servidor está solicitando um novo QR code</li>
                  <li>O QR code será gerado automaticamente</li>
                  <li>A página será atualizada quando o QR code estiver pronto</li>
                </ul>
                <p><strong>Tempo estimado:</strong> 10-30 segundos</p>
              </div>
              
              <div style="margin-top: 30px;">
                <p>⏳ Atualizando automaticamente em 5 segundos</p>
                <div style="margin-top: 20px;">
                  <a href="/qr" onclick="location.reload();">🔄 Atualizar Agora</a>
                  <a href="/">🏠 Página Inicial</a>
                  <a href="/force-qr">⚡ Forçar Geração</a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `);
      }

      // Gerar imagem do QR code
      const img = await QRCode.toDataURL(qr, {
        errorCorrectionLevel: 'H',
        scale: 10,
        margin: 2,
        width: 400
      });

      res.send(`
        <html>
        <head>
          <meta http-equiv="refresh" content="30">
          <title>📱 QR Code - Akira Bot</title>
          <style>
            body { 
              background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
              color: #0f0; 
              font-family: 'Courier New', monospace; 
              text-align: center; 
              padding: 20px;
              margin: 0;
              min-height: 100vh;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: rgba(10, 10, 10, 0.9);
              padding: 30px;
              border: 3px solid #00ff00;
              border-radius: 15px;
              box-shadow: 0 0 40px rgba(0, 255, 0, 0.4);
            }
            h1 { 
              color: #00ff00; 
              text-shadow: 0 0 15px #00ff00;
              margin-bottom: 20px;
              font-size: 2.5em;
            }
            .qr-container {
              margin: 30px auto;
              padding: 25px;
              background: #000;
              border: 4px solid #00ff00;
              border-radius: 15px;
              display: inline-block;
              box-shadow: 0 0 25px rgba(0, 255, 0, 0.5);
            }
            img { 
              display: block;
              margin: 0 auto;
              max-width: 100%;
              height: auto;
              border-radius: 10px;
            }
            .status-badge {
              display: inline-block;
              background: #00ff00;
              color: #000;
              padding: 8px 20px;
              border-radius: 20px;
              font-weight: bold;
              margin: 15px 0;
              font-size: 1.2em;
            }
            .timer {
              color: #0099ff;
              font-size: 1.1em;
              margin: 20px 0;
              padding: 10px;
              background: rgba(0, 153, 255, 0.1);
              border-radius: 5px;
              display: inline-block;
            }
            .instructions {
              background: rgba(0, 255, 0, 0.1);
              border: 2px solid #00ff00;
              border-radius: 10px;
              padding: 25px;
              margin: 30px 0;
              text-align: left;
            }
            .instructions h3 {
              color: #00ff00;
              margin-top: 0;
              font-size: 1.4em;
              border-bottom: 1px solid #00ff00;
              padding-bottom: 10px;
            }
            .instructions ol {
              padding-left: 25px;
              font-size: 1.1em;
            }
            .instructions li {
              margin-bottom: 15px;
              padding: 5px 0;
            }
            .instructions strong {
              color: #00ff00;
            }
            .warning {
              color: #ffaa00;
              background: rgba(255, 170, 0, 0.1);
              border: 1px solid #ffaa00;
              border-radius: 5px;
              padding: 15px;
              margin: 20px 0;
              font-size: 0.9em;
            }
            .actions {
              margin: 30px 0;
            }
            a { 
              color: #00ff00; 
              text-decoration: none; 
              margin: 10px;
              padding: 12px 24px;
              border: 2px solid #00ff00;
              border-radius: 8px;
              display: inline-block;
              font-weight: bold;
              transition: all 0.3s;
              font-size: 1.1em;
            }
            a:hover { 
              background: #00ff00; 
              color: #000;
              text-decoration: none;
              transform: translateY(-3px);
              box-shadow: 0 5px 15px rgba(0, 255, 0, 0.4);
            }
            .footer {
              margin-top: 40px;
              color: #666;
              font-size: 0.9em;
              border-top: 1px solid #333;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📱 QR CODE DISPONÍVEL</h1>
            
            <div class="status-badge">
              ✅ QR CODE PRONTO PARA SCAN
            </div>
            
            <div class="timer">
              ⏳ Válido por 90 segundos | Atualizando em 30s
            </div>
            
            <div class="qr-container">
              <img src="${img}" alt="QR Code para conectar WhatsApp">
            </div>
            
            <div class="instructions">
              <h3>📋 COMO CONECTAR:</h3>
              <ol>
                <li><strong>Abra o WhatsApp</strong> no seu celular</li>
                <li>Toque nos <strong>três pontos</strong> → <strong>Linked devices</strong></li>
                <li>Toque em <strong>Link a device</strong></li>
                <li><strong>Aponte a câmera</strong> para o QR Code acima</li>
                <li>Aguarde a confirmação de conexão</li>
              </ol>
              
              <div class="warning">
                ⚠️ <strong>IMPORTANTE:</strong> Este QR code expira em 90 segundos.
                Se expirar, a página será atualizada automaticamente com um novo código.
              </div>
            </div>
            
            <div class="actions">
              <a href="/qr" onclick="location.reload();">🔄 Atualizar QR Code</a>
              <a href="/">🏠 Página Inicial</a>
              <a href="/health">💚 Status do Sistema</a>
              <a href="/force-qr">⚡ Forçar Novo QR</a>
            </div>
            
            <div class="footer">
              Akira Bot V21 | Sistema de conexão WhatsApp | Porta: ${config.PORT}
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('❌ Erro na rota /qr:', error);
      res.status(500).send(`
        <html>
        <head>
          <style>
            body { background: #000; color: #ff4444; font-family: monospace; text-align: center; padding: 50px; }
          </style>
        </head>
<body>
          <h1>❌ ERRO AO GERAR QR CODE</h1>
          <p>Ocorreu um erro ao processar o QR code:</p>
          <p><strong>${error.message}</strong></p>
          <p style="margin-top: 30px;">
            <a href="/" style="color: #0f0; text-decoration: none; border: 1px solid #0f0; padding: 10px 20px; border-radius: 5px;">← Voltar</a>
            <a href="/qr" style="color: #ffaa00; text-decoration: none; border: 1px solid #ffaa00; padding: 10px 20px; border-radius: 5px; margin-left: 20px;">🔄 Tentar Novamente</a>
          </p>
        </body>
        </html>
      `);
    }
  });

  // ═══ Rota: Forçar geração de QR ═══
  app.get('/force-qr', async (req: any, res: any) => {
    try {
      if (!botCore) {
        return res.redirect('/qr');
      }

      console.log('🔄 Forçando geração de QR code via web...');
      await botCore._forceQRGeneration();

      res.send(`
        <html>
        <head>
          <meta http-equiv="refresh" content="2;url=/qr">
          <style>
            body { background: #000; color: #ffaa00; font-family: monospace; text-align: center; padding: 50px; }
          </style>
        </head>
        <body>
          <h1>⚡ FORÇANDO GERAÇÃO DE QR</h1>
          <p>Reiniciando conexão para gerar novo QR code...</p>
          <p>Redirecionando em 2 segundos</p>
          <p><a href="/qr" style="color: #0f0;">↪️ Ir para QR Code agora</a></p>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('❌ Erro ao forçar QR:', error);
      res.redirect('/qr');
    }
  });

  // ═══ Rota: Health Check ═══
  // CRÍTICO: Railway healthcheck - SEMPRE retorna 200 para garantir deployment
  app.get('/health', (req: any, res: any) => {
    // ✅ SEMPRE retorna 200 se servidor está rodando
    // Isso garante que Railway aceite o deployment mesmo durante inicialização do bot

    const health: any = {
      status: 'healthy',
      server: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      node_version: process.version
    };

    // Informações adicionais sobre BotCore (não afeta healthcheck)
    if (!botCore) {
      health.bot_status = 'initializing';
      health.bot_ready = false;
      health.message = 'Servidor rodando - Bot inicializando em background';
    } else {
      const status = botCore.getStatus();
      health.bot_status = status.isConnected ? 'connected' : 'disconnected';
      health.bot_ready = true;
      health.bot_info = {
        numero: status.botNumero,
        name: status.botName,
        version: status.version,
        jid: status.botJid || null,
        uptime: status.uptime
      };
    }

    // Informações sobre features (se BotCore estiver pronto)
    if (botCore) {
      health.features = {
        stt: config.FEATURE_STT_ENABLED,
        tts: config.FEATURE_TTS_ENABLED,
        youtube: config.FEATURE_YT_DOWNLOAD,
        stickers: config.FEATURE_STICKERS,
        moderation: config.FEATURE_MODERATION,
        leveling: config.FEATURE_LEVELING,
        vision: config.FEATURE_VISION
      };
    }

    health.environment = {
      port: config.PORT,
      api_url: config.API_URL ? 'configured' : 'not_configured',
      railway: process.env.RAILWAY_ENVIRONMENT === 'true'
    };

    // ✅ SEMPRE 200 OK - Railway precisa ver isso
    res.status(200).json(health);
  });

  // ═══ Rota: Estatísticas ═══
  app.get('/stats', (req: any, res: any) => {
    if (!botCore) {
      return res.status(503).json({
        status: 'initializing',
        message: 'Bot ainda está inicializando',
        timestamp: new Date().toISOString()
      });
    }

    const stats = botCore.getStats();
    res.json({
      bot: stats,
      timestamp: new Date().toISOString()
    });
  });

  // ═══ Rota: Reset de cache ═══
  app.post('/reset-cache', (req: any, res: any) => {
    try {
      if (!botCore) {
        return res.status(503).json({
          status: 'error',
          message: 'Bot não inicializado'
        });
      }

      botCore.audioProcessor.clearCache();
      botCore.mediaProcessor.clearCache();
      botCore.messageProcessor.clearCache();

      res.json({
        status: 'success',
        message: 'Caches foram resetados',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Erro ao resetar caches',
        error: error.message
      });
    }
  });

  // ═══ Rota: Reset de autenticação (força novo login) ═══
  app.post('/reset-auth', async (req: any, res: any) => {
    try {
      if (!botCore) {
        return res.status(503).json({
          status: 'error',
          message: 'Bot não inicializado'
        });
      }

      const { default: fs } = await import('fs');
      const authPath = botCore.config.AUTH_FOLDER;

      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        botCore.isConnected = false;
        botCore.currentQR = null;
        botCore.BOT_JID = null;
      }

      // Reinicia a conexão
      setTimeout(() => {
        botCore.connect().catch((err: any) => console.error('Erro ao reconectar:', err));
      }, 1000);

      res.json({
        status: 'success',
        message: 'Credenciais resetadas. Faça login novamente.',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Erro ao resetar autenticação',
        error: error.message
      });
    }
  });

  // ═══ Rota: Verificar Privilégios ═══
  app.post('/check-privileges', (req: any, res: any) => {
    try {
      const { numero } = req.body;

      if (!numero) {
        return res.status(400).json({
          error: 'Número obrigatório'
        });
      }

      // Verificar privilégios via API interna
      const isPrivileged = config.isDono(numero, '');

      res.json({
        numero: numero,
        privilegiado: isPrivileged,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Erro interno',
        message: error.message
      });
    }
  });

  // ═══ Rota: Moderação ═══
  app.post('/moderation/toggle-antilink', (req: any, res: any) => {
    try {
      const { groupId, enable } = req.body;

      if (!groupId) {
        return res.status(400).json({ error: 'groupId é obrigatório' });
      }

      if (!botCore) {
        return res.status(503).json({
          status: 'error',
          message: 'Bot não inicializado'
        });
      }

      const result = botCore.moderationSystem.toggleAntiLink(groupId, enable);

      res.json({
        status: 'success',
        groupId,
        antiLinkEnabled: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message
      });
    }
  });

  // ═══ Rota: Debug - Status detalhado ═══
  app.get('/debug', (req: any, res: any) => {
    if (!botCore) {
      return res.json({
        status: 'not_initialized',
        timestamp: new Date().toISOString()
      });
    }

    const status = botCore.getStatus();
    const qr = botCore.getQRCode();

    res.json({
      bot_core_initialized: true,
      bot_status: status,
      qr_code: qr ? 'available' : 'not_available',
      qr_length: qr ? qr.length : 0,
      socket_state: botCore.sock ? 'created' : 'not_created',
      socket_ws_state: botCore.sock && botCore.sock.ws ? botCore.sock.ws.readyState : 'no_ws',
      config: {
        port: config.PORT,
        api_url: config.API_URL,
        auth_folder: config.AUTH_FOLDER
      },
      timestamp: new Date().toISOString()
    });
  });

  // ═══ Error handler ═══
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('❌ Erro no servidor:', err);
    res.status(500).json({
      status: 'error',
      error: err.message || 'Erro desconhecido',
      timestamp: new Date().toISOString()
    });
  });

  // ═══ 404 handler ═══
  app.use((req: any, res: any) => {
    res.status(404).json({
      status: 'error',
      error: 'Rota não encontrada',
      path: req.path,
      timestamp: new Date().toISOString()
    });
  });

  server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`\n🌐 Servidor Express rodando na porta ${config.PORT}`);
    console.log(`   📍 Local: http://localhost:${config.PORT}`);
    console.log(`   📍 QR Code: http://localhost:${config.PORT}/qr`);
    console.log(`   📍 Health: http://localhost:${config.PORT}/health\n`);
  });

  return server;
}

/**
 * Inicializa BotCore de forma assíncrona (não-bloqueante)
 */
async function initializeBotCoreAsync() {
  try {
    console.log('🔧 [2/3] Inicializando BotCore em background...');
    const startTime = Date.now();

    // Timeout de 120 segundos para inicialização
    const timeout = 120000;

    const initPromise = (async () => {
      botCore = new BotCore();
      await botCore.initialize();
      console.log('✅ BotCore inicializado em ' + (Date.now() - startTime) + 'ms');

      // Conectar ao WhatsApp em background
      console.log('🔗 Conectando ao WhatsApp...');
      console.log('⚠️  Aguarde a geração do QR code...');
      console.log('📱 Acesse: http://localhost:' + config.PORT + '/qr');
      console.log('⏳ Pode levar alguns segundos para o QR code aparecer\n');

      botCore.connect().catch((error: any) => {
        console.error('❌ Erro na conexão WhatsApp:', error.message);
        console.log('🔄 Tentando reconectar automaticamente...');
      });
    })();

    // Aguarda com timeout
    await Promise.race([
      initPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout na inicialização do BotCore')), timeout)
      )
    ]);

  } catch (error) {
    console.error('❌ Erro ao inicializar BotCore:', error.message);
    console.error(error.stack);
    console.log('⚠️  AVISO: Sistema continuará rodando, mas bot pode não funcionar corretamente');
    console.log('⚠️  O servidor HTTP permanece ativo e respondendo ao healthcheck');
    // NÃO fazer process.exit(1) - deixar servidor funcionando
  }
}

/**
 * Função principal com inicialização otimizada para Railway
 */
async function main() {
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('🚀 INICIANDO AKIRA BOT V21 - MODO RAILWAY OPTIMIZED');
    console.log('═'.repeat(70) + '\n');

    // ═══ ETAPA 1: Servidor Express PRIMEIRO (CRÍTICO PARA HEALTHCHECK) ═══
    console.log('🌐 [1/3] Inicializando servidor web...');
    const serverStartTime = Date.now();
    initializeServer();
    console.log('✅ Servidor web rodando em ' + (Date.now() - serverStartTime) + 'ms');
    console.log('✅ Healthcheck endpoint ativo: http://localhost:' + config.PORT + '/health\n');

    // ═══ ETAPA 2: BotCore em background (NÃO-BLOQUEANTE) ═══
    // Não usar await aqui - permite que o processo continue
    initializeBotCoreAsync().then(() => {
      console.log('\n' + '═'.repeat(70));
      console.log('✅ SISTEMA TOTALMENTE INICIALIZADO');
      console.log('═'.repeat(70));
      console.log('📋 LINKS IMPORTANTES:');
      console.log('═'.repeat(70));
      console.log(`📊 Status: http://localhost:${config.PORT}`);
      console.log(`📱 QR Code: http://localhost:${config.PORT}/qr`);
      console.log(`💚 Health: http://localhost:${config.PORT}/health`);
      console.log(`🐛 Debug: http://localhost:${config.PORT}/debug`);
      console.log('═'.repeat(70) + '\n');
      console.log('🤖 Bot pronto! Aguardando conexão do WhatsApp...');
      console.log('🔗 Escaneie o QR code quando ele aparecer na página web\n');
    }).catch(error => {
      console.error('⚠️  BotCore não inicializou completamente:', error.message);
    });

    // ═══ ETAPA 3: Sistema pronto (servidor já está respondendo) ═══
    console.log('🎯 [3/3] Sistema base inicializado');
    console.log('✅ Servidor HTTP ativo e respondendo');
    console.log('⏳ BotCore inicializando em background...\n');

    console.log('💡 IMPORTANTE: O healthcheck já está respondendo!');
    console.log('💡 O bot finalizará a inicialização em background\n');

  } catch (error) {
    console.error('❌ ERRO FATAL NA INICIALIZAÇÃO DO SERVIDOR:', error.message);
    console.error(error.stack);

    if (server) {
      server.close();
    }

    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
function shutdown() {
  console.log('\n🔴 Recebido sinal de desligamento...');

  if (server) {
    console.log('🌐 Fechando servidor web...');
    server.close(() => {
      console.log('✅ Servidor web fechado');
      process.exit(0);
    });

    setTimeout(() => {
      console.log('⚠️  Timeout no fechamento do servidor');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

/**
 * Tratamento de erros não capturados
 */
process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════════════
// HANDLERS PARA SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Erro ao iniciar:', error);
    process.exit(1);
  });
}

export { botCore, app, config };
