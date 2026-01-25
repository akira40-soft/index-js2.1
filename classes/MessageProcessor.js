/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: MessageProcessor
 * ═══════════════════════════════════════════════════════════════════════
 * Processamento inteligente de mensagens: análise, detecção de reply, contexto
 * Extração de informações de grupos e usuários
 * ═══════════════════════════════════════════════════════════════════════
 */

const { getContentType } = require('@whiskeysockets/baileys');
const ConfigManager = require('./ConfigManager');

let parsePhoneNumberFromString = null;
try {
  // optional modern phone parsing if available
  ({ parsePhoneNumberFromString } = require('libphonenumber-js'));
} catch (e) {
  // lib not installed — graceful fallback to simple digit extraction
}

class MessageProcessor {
  constructor(logger = null) {
    this.config = ConfigManager.getInstance();
    this.logger = logger || console;
  }

  /**
   * Extrai número real do usuário
   */
  extractUserNumber(message) {
    try {
      const key = message.key || {};
      const remoteJid = key.remoteJid || '';

      // Se for PV (não termina com @g.us)
      if (!String(remoteJid).endsWith('@g.us')) {
        return String(remoteJid).split('@')[0];
      }

      // Se for grupo, obtém do participant
      if (key.participant) {
        const participant = String(key.participant);
        if (participant.includes('@s.whatsapp.net')) {
          return participant.split('@')[0];
        }
        if (participant.includes('@lid')) {
          const limpo = participant.split(':')[0];
          const digitos = limpo.replace(/\D/g, '');

          // If libphonenumber-js is available, try to normalize to E.164 (without '+')
          try {
            const cfg = ConfigManager.getInstance();
            let defaultCountry = null;
            if (cfg.BOT_NUMERO_REAL && String(cfg.BOT_NUMERO_REAL).startsWith('244')) {
              defaultCountry = 'AO';
            }

            if (parsePhoneNumberFromString) {
              const pn = defaultCountry
                ? parsePhoneNumberFromString(digitos, defaultCountry)
                : parsePhoneNumberFromString(digitos);

              if (pn && pn.isValid && pn.isValid()) {
                // return E.164 without '+' to match JID numeric part
                return String(pn.number).replace(/^\+/, '');
              }
            }
          } catch (err) {
            // fallback to raw digits if parsing fails
          }

          // Fallback: return the raw extracted digits (no forced country prefix)
          if (digitos.length > 0) return digitos;
        }
      }

      return 'desconhecido';

    } catch (e) {
      this.logger.error('Erro ao extrair número:', e.message);
      return 'desconhecido';
    }
  }

  /**
   * Extrai texto de mensagem
   */
  extractText(message) {
    try {
      const tipo = getContentType(message.message);
      if (!tipo) return '';

      const msg = message.message;

      switch (tipo) {
        case 'conversation':
          return msg.conversation || '';
        case 'extendedTextMessage':
          return msg.extendedTextMessage?.text || '';
        case 'imageMessage':
          return msg.imageMessage?.caption || '';
        case 'videoMessage':
          return msg.videoMessage?.caption || '';
        case 'audioMessage':
          return '[mensagem de voz]';
        case 'stickerMessage':
          return '[figurinha]';
        case 'documentMessage':
          return msg.documentMessage?.caption || '[documento]';
        default:
          return '';
      }
    } catch (e) {
      return '';
    }
  }

  /**
   * Detecta tipo de conversa (PV ou Grupo)
   */
  getConversationType(message) {
    const remoteJid = message.key?.remoteJid || '';
    return String(remoteJid).endsWith('@g.us') ? 'grupo' : 'pv';
  }

  /**
   * Extrai informações de reply
   */
  extractReplyInfo(message) {
    try {
      const context = message.message?.extendedTextMessage?.contextInfo;
      if (!context || !context.quotedMessage) return null;

      const quoted = context.quotedMessage;
      const tipo = getContentType(quoted);

      // Extrai texto da mensagem citada
      let textoMensagemCitada = '';
      let tipoMidia = 'texto';

      if (tipo === 'conversation') {
        textoMensagemCitada = quoted.conversation || '';
        tipoMidia = 'texto';
      } else if (tipo === 'extendedTextMessage') {
        textoMensagemCitada = quoted.extendedTextMessage?.text || '';
        tipoMidia = 'texto';
      } else if (tipo === 'imageMessage') {
        textoMensagemCitada = quoted.imageMessage?.caption || '[imagem]';
        tipoMidia = 'imagem';
      } else if (tipo === 'videoMessage') {
        textoMensagemCitada = quoted.videoMessage?.caption || '[vídeo]';
        tipoMidia = 'video';
      } else if (tipo === 'audioMessage') {
        textoMensagemCitada = '[áudio]';
        tipoMidia = 'audio';
      } else if (tipo === 'stickerMessage') {
        textoMensagemCitada = '[figurinha]';
        tipoMidia = 'sticker';
      } else {
        textoMensagemCitada = '[conteúdo]';
        tipoMidia = 'outro';
      }

      const participantJidCitado = context.participant || null;

      return {
        textoMensagemCitada,
        tipoMidia,
        participantJidCitado,
        ehRespostaAoBot: this.isReplyToBot(participantJidCitado),
        quemEscreveuCitacao: this.extractUserNumber({ key: { participant: participantJidCitado } })
      };

    } catch (e) {
      this.logger.error('Erro ao extrair reply info:', e.message);
      return null;
    }
  }

  /**
   * Verifica se é reply ao bot
   */
  isReplyToBot(jid) {
    if (!jid) return false;

    const jidStr = String(jid).toLowerCase();
    const jidNumero = jidStr.split('@')[0].split(':')[0];
    const botNumero = String(this.config.BOT_NUMERO_REAL).toLowerCase();

    return jidNumero === botNumero || jidStr.includes(botNumero);
  }

  /**
   * Detecta se tem áudio
   */
  hasAudio(message) {
    try {
      const tipo = getContentType(message.message);
      return tipo === 'audioMessage';
    } catch (e) {
      return false;
    }
  }

  /**
   * Detecta tipo de mídia
   */
  getMediaType(message) {
    try {
      const tipo = getContentType(message.message);

      const mimeMap = {
        'imageMessage': 'imagem',
        'videoMessage': 'video',
        'audioMessage': 'audio',
        'stickerMessage': 'sticker',
        'documentMessage': 'documento'
      };

      return mimeMap[tipo] || 'texto';
    } catch (e) {
      return 'texto';
    }
  }

  /**
   * Verifica se é menção do bot
   */
  isBotMentioned(message) {
    try {
      const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      return mentions.some(jid => this.isReplyToBot(jid));
    } catch (e) {
      return false;
    }
  }

  /**
   * Extrai menções
   */
  extractMentions(message) {
    try {
      return message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Verifica se é comando
   */
  isCommand(text) {
    if (!text) return false;
    return text.trim().startsWith(this.config.PREFIXO);
  }

  /**
   * Parseia comando
   */
  parseCommand(text) {
    if (!this.isCommand(text)) return null;

    const args = text.slice(this.config.PREFIXO.length).trim().split(/ +/);
    const comando = args.shift().toLowerCase();

    return {
      comando,
      args,
      textoCompleto: args.join(' ')
    };
  }

  /**
   * Valida taxa de requisições
   */
  checkRateLimit(userId, windowSeconds = null, maxCalls = null) {
    const window = windowSeconds || this.config.RATE_LIMIT_WINDOW;
    const max = maxCalls || this.config.RATE_LIMIT_MAX_CALLS;

    if (!this.rateLimitMap) {
      this.rateLimitMap = new Map();
    }

    const now = Date.now();
    const rec = this.rateLimitMap.get(userId) || [];
    const filtered = rec.filter(t => (now - t) < window * 1000);

    if (filtered.length >= max) {
      return false;
    }

    filtered.push(now);
    this.rateLimitMap.set(userId, filtered);
    return true;
  }

  /**
   * Sanitiza texto para segurança
   */
  sanitizeText(text, maxLength = 2000) {
    if (!text) return '';

    let sanitized = String(text)
      .trim()
      .substring(0, maxLength);

    // Remove caracteres de controle perigosos
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Limpa cache
   */
  clearCache() {
    if (this.rateLimitMap) {
      this.rateLimitMap.clear();
    }
    this.logger.info('💾 Cache de processamento limpo');
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    return {
      rateLimitEntries: this.rateLimitMap?.size || 0,
      prefixo: this.config.PREFIXO
    };
  }
}

module.exports = MessageProcessor;
