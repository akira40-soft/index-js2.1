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
 * 📄 Para entender a lógica PROCEDURAL completa:
 *    - Consulte: COPIAR_COLAR_INDEX.js (trechos prontos)
 *    - Este arquivo tem TUDO explicado passo a passo
 *    - Pode ser usado como referência se precisar editar BotCore
 * 
 * 🔗 REFERÊNCIA RÁPIDA:
 *    - Lógica de REPLY: modules/BotCore.js linha ~426
 *    - Simulações: modules/PresenceSimulator.js
 *    - Comandos: modules/CommandHandler.js
 *    - Config: modules/ConfigManager.js
 * ═══════════════════════════════════════════════════════════════════════
 */

// @ts-nocheck
const express = require('express');
const QRCode = require('qrcode');
const ConfigManager = require('./modules/ConfigManager');
const BotCore = require('./modules/BotCore');

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO GLOBAL
// ═══════════════════════════════════════════════════════════════════════

const config = ConfigManager.getInstance();
let botCore = null;
let app = null;

/**
 * Inicializa o servidor Express
 */
function initializeServer() {
  app = express();
  app.use(express.json());

  // ═══ Rota: Status ═══
  app.get('/', (req, res) => {
    const status = botCore.getStatus();
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
          a { color: #00ff00; text-decoration: none; margin: 0 15px; }
          a:hover { text-decoration: underline; }
          .version { color: #0099ff; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🤖 AKIRA BOT V21</h1>
          <div class="status">
            <span class="label">Status:</span>
            <span>${status.isConnected ? '✅ ONLINE' : '❌ OFFLINE'}</span>
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
            <a href="/reset-auth" onclick="return confirm('Isso vai desconectar o bot e exigir novo login. Continuar?')">🔄 Reset Auth</a>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // ═══ Rota: QR Code ═══
  app.get('/qr', async (req, res) => {
    try {
      const qr = botCore.getQRCode();
      const status = botCore.getStatus();

      if (!qr) {
        // Se não tem QR mas também não está conectado, precisa de login
        if (!status.isConnected) {
          return res.send(`
            <html>
            <head><style>
              body { background: #000; color: #ff4444; font-family: monospace; text-align: center; padding: 50px; }
              .warning { color: #ffaa00; font-size: 18px; margin: 20px 0; }
            </style></head>
            <body>
              <h1>🔄 AGUARDANDO CONEXÃO</h1>
              <p>Bot não está conectado ao WhatsApp.</p>
              <div class="warning">
                <p>📱 Se você nunca logou, escaneie o QR code quando aparecer.</p>
                <p>🔄 Se já logou antes, as credenciais podem ter expirado.</p>
                <p>⏰ Tente novamente em alguns segundos...</p>
              </div>
              <p><a href="/" style="color: #0f0;">← Voltar</a></p>
              <script>
                setTimeout(() => { location.reload(); }, 5000);
              </script>
            </body>
            </html>
          `);
        } else {
          // Já está conectado
          return res.send(`
            <html>
            <head><style>
              body { background: #000; color: #0f0; font-family: monospace; text-align: center; padding: 50px; }
            </style></head>
            <body>
              <h1>✅ BOT CONECTADO!</h1>
              <p>Nenhum QR Code necessário agora.</p>
              <p>Status: ${status.botJid ? 'Online' : 'Conectando...'}</p>
              <p><a href="/" style="color: #0f0;">← Voltar</a></p>
            </body>
            </html>
          `);
        }
      }

      const img = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'H', scale: 10 });

      res.send(`
        <html>
        <head>
          <meta http-equiv="refresh" content="5">
          <style>
            body { background: #000; color: #0f0; font-family: monospace; text-align: center; padding: 40px; }
            img { border: 12px solid #0f0; border-radius: 10px; }
          </style>
        </head>
        <body>
          <h1>📱 ESCANEIE O QR CODE</h1>
          <img src="${img}" alt="QR Code">
          <p>Atualizando em 5 segundos...</p>
          <p><a href="/" style="color: #0f0;">← Voltar</a></p>
        </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send('Erro ao gerar QR Code');
    }
  });

  // ═══ Rota: Health Check ═══
  app.get('/health', (req, res) => {
    const status = botCore.getStatus();
    res.json({
      status: status.isConnected ? 'online' : 'offline',
      timestamp: new Date().toISOString(),
      bot: {
        numero: status.botNumero,
        name: status.botName,
        version: status.version,
        jid: status.botJid || null,
        uptime: status.uptime
      },
      features: {
        stt: config.FEATURE_STT_ENABLED,
        tts: config.FEATURE_TTS_ENABLED,
        youtube: config.FEATURE_YT_DOWNLOAD,
        stickers: config.FEATURE_STICKERS,
        moderation: config.FEATURE_MODERATION,
        leveling: config.FEATURE_LEVELING,
        vision: config.FEATURE_VISION
      }
    });
  });

  // ═══ Rota: Estatísticas ═══
  app.get('/stats', (req, res) => {
    const stats = botCore.getStats();
    res.json({
      bot: stats,
      timestamp: new Date().toISOString()
    });
  });

  // ═══ Rota: Reset de cache ═══
  app.post('/reset-cache', (req, res) => {
    try {
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
  app.post('/reset-auth', (req, res) => {
    try {
      const fs = require('fs');
      const authPath = botCore.config.AUTH_FOLDER;

      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        botCore.isConnected = false;
        botCore.currentQR = null;
        botCore.BOT_JID = null;
      }

      // Reinicia a conexão
      setTimeout(() => {
        botCore.connect().catch(err => console.error('Erro ao reconectar:', err));
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
  app.post('/check-privileges', (req, res) => {
    try {
      const { numero } = req.body;
      
      if (!numero) {
        return res.status(400).json({
          error: 'Número obrigatório'
        });
      }

      // Verificar privilégios via API interna
      const isPrivileged = config.isPrivileged(numero);
      
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

  // ═══ Rota: Conceder Privilégio Temporário ═══
  app.post('/grant-temp-privilege', (req, res) => {
    try {
      const { admin_numero, target_numero, duracao_horas = 24 } = req.body;
      
      if (!admin_numero || !target_numero) {
        return res.status(400).json({
          error: 'Admin e target obrigatórios'
        });
      }

      // Verificar se admin é privilegiado
      if (!config.isPrivileged(admin_numero)) {
        return res.status(403).json({
          error: 'Acesso negado: apenas admins'
        });
      }

      // Conceder privilégio temporário
      const result = config.conceder_privilegio_temporario(target_numero, duracao_horas);
      
      if (result.success) {
        res.json({
          success: true,
          codigo: result.codigo,
          instrucoes: result.instrucoes,
          expira_em: result.expira_em,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'Falha ao conceder privilégio'
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Erro interno',
        message: error.message
      });
    }
  });

  // ═══ Rota: Validar Código de Privilégio ═══
  app.post('/validate-privilege-code', (req, res) => {
    try {
      const { numero, codigo } = req.body;
      
      if (!numero || !codigo) {
        return res.status(400).json({
          error: 'Número e código obrigatórios'
        });
      }

      const result = config.validar_codigo_privilegio(numero, codigo);
      
      if (result.valido) {
        res.json({
          valido: true,
          permissoes: result.permissoes,
          nivel: result.nivel,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          valido: false,
          motivo: result.motivo,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Erro interno',
        message: error.message
      });
    }
  });

  // ═══ Rota: Moderação ═══
  app.post('/moderation/toggle-antilink', (req, res) => {
    try {
      const { groupId, enable } = req.body;

      if (!groupId) {
        return res.status(400).json({ error: 'groupId é obrigatório' });
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

  // ═══ Error handler ═══
  app.use((err, req, res, next) => {
    console.error('❌ Erro no servidor:', err);
    res.status(500).json({
      status: 'error',
      error: err.message || 'Erro desconhecido'
    });
  });

  const server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`\n🌐 Servidor rodando na porta ${config.PORT}`);
    console.log(`   http://localhost:${config.PORT}\n`);
  });

  return server;
}

/**
 * Função principal
 */
async function main() {
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('🚀 INICIANDO AKIRA BOT V21');
    console.log('═'.repeat(70) + '\n');

    // ═══ Inicializa BotCore ═══
    // ✅ BotCore contém TUDO:
    //    - Processamento de mensagens
    //    - Simulação de digitação (1-15 seg)
    //    - Simulação de gravação (2-10 seg)
    //    - Simulação de ticks (✓ e ✓✓)
    //    - Resposta em REPLY nos grupos (GARANTIDO)
    //    - STT (Deepgram), TTS (Google)
    //    - Comandos e moderação
    botCore = new BotCore();
    await botCore.initialize();

    // ═══ Inicializa servidor Express ═══
    initializeServer();

    // ═══ Conecta ao WhatsApp ═══
    // Aqui é onde BotCore liga ao Baileys e começa a ouvir mensagens
    await botCore.connect();

    // ═══ Info final ═══
    console.log('✅ Sistema pronto para receber mensagens\n');

  } catch (error) {
    console.error('❌ ERRO FATAL:', error.message);
    process.exit(1);
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
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro ao iniciar:', error);
    process.exit(1);
  });
}

module.exports = { botCore, app };
