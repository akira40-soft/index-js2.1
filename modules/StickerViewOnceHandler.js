/**
 * ═══════════════════════════════════════════════════════════════════════
 * HANDLER: Sticker + View-Once Commands
 * ═══════════════════════════════════════════════════════════════════════
 * 🎨 Comandos de sticker com metadados personalizados
 * 👁️  Comandos para revelar e converter view-once
 * ═══════════════════════════════════════════════════════════════════════
 */

const MediaProcessor = require('./MediaProcessor');
const { getContentType } = require('@whiskeysockets/baileys');

class StickerViewOnceHandler {
  constructor(sock, config) {
    this.sock = sock;
    this.config = config;
    this.media = new MediaProcessor();
  }

  /**
   * Processa comando #sticker / #s / #fig
   * Cria sticker a partir de imagem ou sticker existente
   */
  async handleSticker(m, userData, texto, ehGrupo) {
    try {
      const { nome: userName } = userData;
      
      // Procura mensagem citada
      let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
      else if (quoted?.viewOnceMessageV2Extension?.message) quoted = quoted.viewOnceMessageV2Extension.message;
      else if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;

      const hasImage = m.message?.imageMessage || quoted?.imageMessage;
      const hasSticker = quoted?.stickerMessage;

      if (!hasImage && !hasSticker) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: '📸 *COMANDO #sticker*\n\n' +
                '✅ Envie uma imagem com legenda `#sticker`\n' +
                '✅ OU responda uma imagem com `#sticker`\n' +
                '✅ OU responda um sticker com `#sticker`\n\n' +
                '⚠️ Para stickers animados de vídeos, use `#gif`\n\n' +
                '📝 Metadados:\n' +
                '🏷️ Pack: akira-bot-[seu_nome]\n' +
                '👤 Autor: akira-bot\n' +
                '✨ Automaticamente personalizados!'
        }, { quoted: m });
        return true;
      }

      // Processa sticker de sticker
      if (hasSticker) {
        const stickerMsg = quoted.stickerMessage;
        const stickerBuf = await this.media.downloadMedia(stickerMsg, 'sticker');

        if (!stickerBuf) {
          await this.sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao baixar sticker.'
          }, { quoted: m });
          return true;
        }

        const out = await this.media.addStickerMetadata(
          stickerBuf,
          `akira-bot-${userName.split(' ')[0].toLowerCase()}`,
          'akira-bot'
        );

        if (!out) {
          await this.sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao personalizar sticker.'
          }, { quoted: m });
          return true;
        }

        await this.sock.sendMessage(m.key.remoteJid, {
          sticker: out
        }, { quoted: m });

        return true;
      }

      // Processa imagem → sticker
      if (hasImage) {
        const mediaMsg = quoted?.imageMessage || m.message.imageMessage;
        const imgBuf = await this.media.downloadMedia(mediaMsg, 'image');

        if (!imgBuf) {
          await this.sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao baixar imagem.'
          }, { quoted: m });
          return true;
        }

        const result = await this.media.createStickerFromImage(imgBuf, {
          userName,
          author: 'akira-bot'
        });

        if (!result.sucesso) {
          await this.sock.sendMessage(m.key.remoteJid, {
            text: `❌ ${result.error}`
          }, { quoted: m });
          return true;
        }

        await this.sock.sendMessage(m.key.remoteJid, {
          sticker: result.buffer
        }, { quoted: m });

        return true;
      }

    } catch (e) {
      console.error('❌ Erro em handleSticker:', e);
      await this.sock.sendMessage(m.key.remoteJid, {
        text: '❌ Erro ao processar sticker.'
      }, { quoted: m });
    }

    return true;
  }

  /**
   * Processa comando #gif
   * Cria sticker animado de vídeo
   */
  async handleGif(m, userData, texto, ehGrupo) {
    try {
      const { nome: userName } = userData;

      let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
      else if (quoted?.viewOnceMessageV2Extension?.message) quoted = quoted.viewOnceMessageV2Extension.message;
      else if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;

      const hasVideo = m.message?.videoMessage || quoted?.videoMessage;
      const hasSticker = quoted?.stickerMessage;

      if (!hasVideo && !hasSticker) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: '🎥 *COMANDO #gif*\n\n' +
                '✅ Envie um vídeo com legenda `#gif`\n' +
                '✅ OU responda um vídeo com `#gif`\n' +
                '✅ OU responda um sticker animado com `#gif`\n\n' +
                '⏱️ Máximo: 30 segundos\n' +
                '📏 Dimensão: 512x512 (automático)\n' +
                '💾 Máximo: 500KB\n\n' +
                '✨ Seu sticker será automaticamente personalizado!'
        }, { quoted: m });
        return true;
      }

      // Processa sticker animado existente
      if (hasSticker) {
        const stickerMsg = quoted.stickerMessage;
        const stickerBuf = await this.media.downloadMedia(stickerMsg, 'sticker');

        if (!stickerBuf) {
          await this.sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao baixar sticker.'
          }, { quoted: m });
          return true;
        }

        // Tenta apenas re-injetar metadados
        const out = await this.media.addStickerMetadata(
          stickerBuf,
          `akira-bot-${userName.split(' ')[0].toLowerCase()}`,
          'akira-bot'
        );

        if (out) {
          await this.sock.sendMessage(m.key.remoteJid, {
            sticker: out
          }, { quoted: m });
        } else {
          await this.sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao personalizar sticker animado.'
          }, { quoted: m });
        }

        return true;
      }

      // Processa vídeo → sticker animado
      if (hasVideo) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: '⏳ Processando vídeo... Isto pode levar alguns segundos.'
        }, { quoted: m });

        const vidMsg = quoted?.videoMessage || m.message.videoMessage;
        const vidBuf = await this.media.downloadMedia(vidMsg, 'video');

        if (!vidBuf) {
          await this.sock.sendMessage(m.key.remoteJid, {
            text: '❌ Erro ao baixar vídeo.'
          }, { quoted: m });
          return true;
        }

        const result = await this.media.createAnimatedStickerFromVideo(vidBuf, 30, {
          userName,
          author: 'akira-bot'
        });

        if (!result.sucesso) {
          await this.sock.sendMessage(m.key.remoteJid, {
            text: `❌ ${result.error}`
          }, { quoted: m });
          return true;
        }

        await this.sock.sendMessage(m.key.remoteJid, {
          sticker: result.buffer
        }, { quoted: m });

        return true;
      }

    } catch (e) {
      console.error('❌ Erro em handleGif:', e);
      await this.sock.sendMessage(m.key.remoteJid, {
        text: '❌ Erro ao criar sticker animado.'
      }, { quoted: m });
    }

    return true;
  }

  /**
   * Processa comando #reveal / #revelar / #openvo
   * Revela view-once (apenas dono/admin)
   */
  async handleReveal(m, userData, ehGrupo, isOwnerOrAdmin) {
    try {
      if (!isOwnerOrAdmin) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: '🚫 Comando restrito ao dono ou admin do grupo.'
        }, { quoted: m });
        return true;
      }

      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: '👁️ *COMANDO #reveal*\n\n' +
                'Responda uma mensagem view-once com `#reveal`\n\n' +
                '✅ Imagens view-once\n' +
                '✅ Vídeos view-once\n' +
                '✅ Áudios view-once\n' +
                '✅ Stickers animados view-once\n\n' +
                '🔒 Apenas dono/admin podem usar.'
        }, { quoted: m });
        return true;
      }

      // Extrai conteúdo view-once
      const result = await this.media.extractViewOnceContent(quoted);

      if (!result.sucesso) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: `❌ ${result.error}`
        }, { quoted: m });
        return true;
      }

      // Envia conteúdo revelado
      const tipoEmoji = {
        'image': '🖼️',
        'video': '🎬',
        'audio': '🎤',
        'sticker': '🎨'
      };

      const caption = `${tipoEmoji[result.tipo] || '📦'} *Conteúdo Revelado (View-Once)*\n\nTipo: ${result.tipo}\nTamanho: ${(result.size / 1024).toFixed(2)}KB`;

      const msgObj = {};
      if (result.tipo === 'image') {
        msgObj.image = result.buffer;
        msgObj.caption = caption;
      } else if (result.tipo === 'video') {
        msgObj.video = result.buffer;
        msgObj.mimetype = 'video/mp4';
        msgObj.caption = caption;
      } else if (result.tipo === 'audio') {
        msgObj.audio = result.buffer;
        msgObj.mimetype = 'audio/mpeg';
        msgObj.ptt = false;
      } else if (result.tipo === 'sticker') {
        msgObj.sticker = result.buffer;
      }

      await this.sock.sendMessage(m.key.remoteJid, msgObj, { quoted: m });
      return true;

    } catch (e) {
      console.error('❌ Erro em handleReveal:', e);
      await this.sock.sendMessage(m.key.remoteJid, {
        text: '❌ Erro ao revelar view-once.'
      }, { quoted: m });
    }

    return true;
  }

  /**
   * Processa comando #toimg
   * Converte sticker para imagem PNG
   */
  async handleToImage(m, userData, texto, ehGrupo) {
    try {
      let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
      else if (quoted?.viewOnceMessageV2Extension?.message) quoted = quoted.viewOnceMessageV2Extension.message;
      else if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;

      const hasSticker = m.message?.stickerMessage || quoted?.stickerMessage;

      if (!hasSticker) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: '🖼️ *COMANDO #toimg*\n\n' +
                '✅ Envie um sticker com legenda `#toimg`\n' +
                '✅ OU responda um sticker com `#toimg`\n\n' +
                '📝 Converte qualquer sticker para imagem PNG\n' +
                '⚠️ Stickers animados não podem ser convertidos para imagem estática'
        }, { quoted: m });
        return true;
      }

      await this.sock.sendMessage(m.key.remoteJid, {
        text: '⏳ Convertendo sticker para imagem...'
      }, { quoted: m });

      const stickerMsg = quoted?.stickerMessage || m.message.stickerMessage;
      const stickerBuf = await this.media.downloadMedia(stickerMsg, 'sticker');

      if (!stickerBuf) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: '❌ Erro ao baixar sticker.'
        }, { quoted: m });
        return true;
      }

      // Converte WebP para PNG
      const result = await this.media.convertStickerToImage(stickerBuf);

      if (!result.sucesso) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: `❌ ${result.error || 'Erro ao converter sticker.'}`
        }, { quoted: m });
        return true;
      }

      await this.sock.sendMessage(m.key.remoteJid, {
        image: result.buffer,
        caption: '🖼️ Convertido de sticker para imagem PNG'
      }, { quoted: m });

      return true;

    } catch (e) {
      console.error('❌ Erro em handleToImage:', e);
      await this.sock.sendMessage(m.key.remoteJid, {
        text: '❌ Erro ao converter sticker para imagem.'
      }, { quoted: m });
    }

    return true;
  }

  /**
   * Processa comando #vosticker / #vostk
   * Converte view-once image/video em sticker
   */
  async handleViewOnceToSticker(m, userData, ehGrupo) {
    try {
      const { nome: userName } = userData;
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: '👁️➡️🎨 *COMANDO #vosticker*\n\n' +
                'Converte imagem/vídeo view-once em sticker\n\n' +
                'Uso: Responda uma imagem/vídeo view-once com `#vosticker`\n\n' +
                '✅ View-once image → sticker\n' +
                '✅ View-once video → sticker animado (até 30s)\n' +
                '✅ Metadados: akira-bot-[seu_nome]'
        }, { quoted: m });
        return true;
      }

      const result = await this.media.extractViewOnceContent(quoted);

      if (!result.sucesso) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: `❌ ${result.error}`
        }, { quoted: m });
        return true;
      }

      let stickerResult;

      if (result.tipo === 'image') {
        stickerResult = await this.media.createStickerFromImage(result.buffer, {
          userName,
          author: 'akira-bot'
        });
      } else if (result.tipo === 'video') {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: '⏳ Convertendo vídeo view-once para sticker animado...'
        }, { quoted: m });

        stickerResult = await this.media.createAnimatedStickerFromVideo(result.buffer, 30, {
          userName,
          author: 'akira-bot'
        });
      } else {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: `❌ Tipo ${result.tipo} não pode ser convertido para sticker.`
        }, { quoted: m });
        return true;
      }

      if (!stickerResult.sucesso) {
        await this.sock.sendMessage(m.key.remoteJid, {
          text: `❌ ${stickerResult.error}`
        }, { quoted: m });
        return true;
      }

      await this.sock.sendMessage(m.key.remoteJid, {
        sticker: stickerResult.buffer
      }, { quoted: m });

      return true;

    } catch (e) {
      console.error('❌ Erro em handleViewOnceToSticker:', e);
      await this.sock.sendMessage(m.key.remoteJid, {
        text: '❌ Erro ao converter view-once para sticker.'
      }, { quoted: m });
    }

    return true;
  }
}

module.exports = StickerViewOnceHandler;
