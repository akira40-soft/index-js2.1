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
          return (msg.extendedTextMessage && msg.extendedTextMessage.text) || '';
        case 'imageMessage':
          return (msg.imageMessage && msg.imageMessage.caption) || '';
        case 'videoMessage':
          return (msg.videoMessage && msg.videoMessage.caption) || '';
        case 'audioMessage':
          return '[mensagem de voz]';
        case 'stickerMessage':
          return '[figurinha]';
        case 'documentMessage':
          return (msg.documentMessage && msg.documentMessage.caption) || '[documento]';
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
    const remoteJid = (message.key && message.key.remoteJid) || '';
    return String(remoteJid).endsWith('@g.us') ? 'grupo' : 'pv';
  }

  /**
   * Extrai hint de contexto baseado no texto citado e mensagem atual
   * Adaptado de reply_context_handler.py
   */
  extractContextHint(quotedText, mensagemAtual) {
    const hints = [];
    const quotedLower = (quotedText || '').toLowerCase();
    const mensagemLower = (mensagemAtual || '').toLowerCase();

    // Detecta tipo de reply
    if (quotedLower.includes('akira') || quotedLower.includes('bot') || 
        quotedLower.includes('você') || quotedLower.includes('vc') || quotedLower.includes('tu')) {
      hints.push('pergunta_sobre_akira');
    }

    // Pergunta factual
    if (quotedLower.match(/\b(oq|o que|qual|quanto|onde|quando|como|quem|por que|pq)\b/)) {
      hints.push('pergunta_factual');
    }

    // Ironia/deboche detectado
    if (quotedLower.match(/(kkk|haha|😂|🤣|eita|lol|mdr)/)) {
      hints.push('tom_irreverente');
    }

    // Expressão de opinião
    if (quotedLower.match(/\b(acho|penso|creio|imagino|acredito)\b/)) {
      hints.push('expressao_opiniao');
    }

    // Pergunta curta detectada
    const wordCount = mensagemAtual ? mensagemAtual.split(/\s+/).length : 0;
    const hasQuestion = mensagemLower.includes('?') || 
                       mensagemLower.match(/\b(qual|quais|quem|como|onde|quando|por que|pq|oq)\b/);
    if (wordCount <= 5 && hasQuestion) {
      hints.push('pergunta_curta');
    }

    return hints.join(' | ') || 'contexto_geral';
  }

  /**
   * Calcula nível de prioridade do reply
   * Adaptado de reply_context_handler.py
   * Returns: 1=normal, 2=reply, 3=reply_to_bot, 4=reply_to_bot_short_question
   */
  calculateReplyPriority(isReply, replyToBot, mensagemAtual) {
    const PRIORITY_NORMAL = 1;
    const PRIORITY_REPLY = 2;
    const PRIORITY_REPLY_TO_BOT = 3;
    const PRIORITY_REPLY_TO_BOT_SHORT_QUESTION = 4;
    const PERGUNTA_CURTA_LIMITE = 5;

    if (!isReply) return PRIORITY_NORMAL;

    // Reply para o bot
    if (replyToBot) {
      const wordCount = mensagemAtual ? mensagemAtual.split(/\s+/).length : 0;
      const hasQuestion = mensagemAtual && (
        mensagemAtual.includes('?') || 
        mensagemAtual.toLowerCase().match(/\b(qual|quais|quem|como|onde|quando|por que|pq|oq|o que)\b/)
      );
      
      // Pergunta curta = prioridade máxima
      if (wordCount <= PERGUNTA_CURTA_LIMITE && hasQuestion) {
        return PRIORITY_REPLY_TO_BOT_SHORT_QUESTION;
      }
      return PRIORITY_REPLY_TO_BOT;
    }

    // Reply normal
    return PRIORITY_REPLY;
  }

  /**
   * Extrai informações de reply
   * Enhanced version adapted from akira's reply_context_handler.py
   */
  extractReplyInfo(message) {
    try {
      const context = message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.contextInfo;
      if (!context || !context.quotedMessage) return null;

      const quoted = context.quotedMessage;
      const tipo = getContentType(quoted);

      // Extrai texto da mensagem citada
      let textoMensagemCitada = '';
      let tipoMidia = 'texto';
      let quotedTextOriginal = '';

      if (tipo === 'conversation') {
        quotedTextOriginal = quoted.conversation || '';
        textoMensagemCitada = quotedTextOriginal;
        tipoMidia = 'texto';
      } else if (tipo === 'extendedTextMessage') {
        quotedTextOriginal = (quoted.extendedTextMessage && quoted.extendedTextMessage.text) || '';
        textoMensagemCitada = quotedTextOriginal;
        tipoMidia = 'texto';
      } else if (tipo === 'imageMessage') {
        quotedTextOriginal = (quoted.imageMessage && quoted.imageMessage.caption) || '';
        textoMensagemCitada = quotedTextOriginal || '[imagem]';
        tipoMidia = 'imagem';
      } else if (tipo === 'videoMessage') {
        quotedTextOriginal = (quoted.videoMessage && quoted.videoMessage.caption) || '';
        textoMensagemCitada = quotedTextOriginal || '[vídeo]';
        tipoMidia = 'video';
      } else if (tipo === 'audioMessage') {
        quotedTextOriginal = '[áudio]';
        textoMensagemCitada = '[áudio]';
        tipoMidia = 'audio';
      } else if (tipo === 'stickerMessage') {
        quotedTextOriginal = '[figurinha]';
        textoMensagemCitada = '[figurinha]';
        tipoMidia = 'sticker';
      } else if (tipo === 'documentMessage') {
        quotedTextOriginal = (quoted.documentMessage && quoted.documentMessage.caption) || '[documento]';
        textoMensagemCitada = quotedTextOriginal;
        tipoMidia = 'documento';
      } else {
        quotedTextOriginal = '[conteúdo]';
        textoMensagemCitada = '[conteúdo]';
        tipoMidia = 'outro';
      }

      // Try to get participant from context or from quoted message key
      const participantJidCitado = context.participant || (context.quotedMessage && context.quotedMessage.key && context.quotedMessage.key.participant) || null;
      
      // Extract author number
      let quotedAuthorNumero = 'desconhecido';
      if (participantJidCitado) {
        quotedAuthorNumero = this.extractUserNumber({ key: { participant: participantJidCitado } });
      }

      // Check if reply is to bot
      const ehRespostaAoBot = this.isReplyToBot(participantJidCitado);
      
      // Get current message text for context hint calculation
      const currentMessageText = this.extractText(message);
      
      // Calculate context hint
      const contextHint = this.extractContextHint(quotedTextOriginal, currentMessageText);
      
      // Calculate priority
      const priorityLevel = this.calculateReplyPriority(true, ehRespostaAoBot, currentMessageText);

      return {
        textoMensagemCitada,
        tipoMidia,
        participantJidCitado,
        ehRespostaAoBot,
        quemEscreveuCitacao: quotedAuthorNumero,
        quotedAuthorNumero: quotedAuthorNumero,
        quotedType: tipoMidia,
        quotedTextOriginal: quotedTextOriginal,
        contextHint: contextHint,
        priorityLevel: priorityLevel,
        isReply: true
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
   * Detecta se tem imagem
   */
  hasImage(message) {
    try {
      const tipo = getContentType(message.message);
      return tipo === 'imageMessage';
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
      const mentions = (message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.contextInfo && message.message.extendedTextMessage.contextInfo.mentionedJid) || [];
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
      return (message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.contextInfo && message.message.extendedTextMessage.contextInfo.mentionedJid) || [];
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
      rateLimitEntries: (this.rateLimitMap && this.rateLimitMap.size) || 0,
      prefixo: this.config.PREFIXO
    };
  }
}

module.exports = MessageProcessor;
