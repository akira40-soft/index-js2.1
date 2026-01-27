/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: MediaProcessor
 * ═══════════════════════════════════════════════════════════════════════
 * Gerencia processamento de mídia: imagens, vídeos, stickers, YouTube
 * Download, conversão, criação de stickers personalizados
 * ═══════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { exec, execFile, spawn } = require('child_process');
const util = require('util');
const crypto = require('crypto');

// yt-dlp ou ytdl-core (prioritário)
let ytdl = null;
try {
  ytdl = require('@distube/ytdl-core');
} catch (e) {
  try {
    ytdl = require('ytdl-core');
  } catch (e2) {
    ytdl = null;
  }
}

const yts = require('yt-search');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ConfigManager = require('./ConfigManager');

// Webpmux para metadados de stickers
let Webpmux = null;
try {
  Webpmux = require('node-webpmux');
} catch (e) {
  console.warn('⚠️  node-webpmux não instalado. Stickers sem metadados EXIF.');
}

class MediaProcessor {
  constructor(logger = null) {
    this.config = ConfigManager.getInstance();
    this.logger = logger || console;
    this.tempFolder = this.config.TEMP_FOLDER;
    this.downloadCache = new Map();
  }

  /**
   * Gera nome de arquivo aleatório
   */
  generateRandomFilename(ext = '') {
    return path.join(
      this.tempFolder,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? '.' + ext : ''}`
    );
  }

  /**
   * Limpa arquivo
   */
  async cleanupFile(filePath) {
    try {
      if (!filePath || !fs.existsSync(filePath)) return;

      return new Promise((resolve) => {
        fs.unlink(filePath, (err) => {
          if (err && err.code !== 'ENOENT') {
            this.logger.warn(`⚠️  Erro ao limpar ${path.basename(filePath)}`);
          }
          resolve();
        });
      });
    } catch (e) {
      this.logger.error('Erro ao limpar arquivo:', e.message);
    }
  }

  /**
   * Download de mídia via Baileys
   */
  async downloadMedia(message, mimeType = 'image') {
    try {
      const stream = await downloadContentFromMessage(message, mimeType);
      let buffer = Buffer.from([]);

      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      return buffer;
    } catch (e) {
      this.logger.error('❌ Erro ao baixar mídia:', e.message);
      return null;
    }
  }

  /**
   * Converte buffer para base64
   */
  bufferToBase64(buffer) {
    if (!buffer) return null;
    return buffer.toString('base64');
  }

  /**
   * Converte base64 para buffer
   */
  base64ToBuffer(base64String) {
    if (!base64String) return null;
    return Buffer.from(base64String, 'base64');
  }

  /**
   * Adiciona metadados EXIF ao sticker
   */
  async addStickerMetadata(webpBuffer, packName = 'akira-bot', author = 'Akira Bot') {
    try {
      if (!Webpmux) {
        this.logger.debug('⚠️  Webpmux não disponível, retornando buffer sem EXIF');
        return webpBuffer;
      }

      const img = new Webpmux.Image();
      await img.load(webpBuffer);

      const json = {
        'sticker-pack-id': crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)),
        'sticker-pack-name': String(packName || 'akira-bot').slice(0, 30),
        'sticker-pack-publisher': String(author || 'Akira Bot').slice(0, 30),
        'emojis': ['']
      };

      const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00
      ]);

      const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
      const exif = Buffer.concat([exifAttr, jsonBuff]);
      exif.writeUIntLE(jsonBuff.length, 14, 4);

      img.exif = exif;
      const result = await img.save(null);
      
      this.logger.debug(`✅ Metadados EXIF adicionados: ${packName} por ${author}`);
      return result;
    } catch (e) {
      this.logger.warn('⚠️  Erro ao adicionar EXIF:', e.message);
      return webpBuffer;
    }
  }

  /**
   * Cria sticker de imagem
   */
  async createStickerFromImage(imageBuffer, metadata = {}) {
    try {
      this.logger.info('🎨 Criando sticker de imagem...');

      const inputPath = this.generateRandomFilename('jpg');
      const outputPath = this.generateRandomFilename('webp');

      fs.writeFileSync(inputPath, imageBuffer);

      // Pack name = akira-bot, Author = nome do usuário que requisitou
      const { userName = 'User', author = 'akira-bot' } = metadata;
      const packName = `akira-bot-${userName.split(' ')[0].toLowerCase()}`;

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-y',
            '-v', 'error',
            '-c:v', 'libwebp',
            '-lossless', '0',
            '-compression_level', '6',
            '-q:v', '75',
            '-preset', 'default',
            '-vf', 'fps=15,scale=512:-1:flags=lanczos:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white'
          ])
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath);
      });

      const stickerBuffer = fs.readFileSync(outputPath);

      // Adiciona metadados EXIF
      const stickerComMetadados = await this.addStickerMetadata(stickerBuffer, packName, author);

      await Promise.all([
        this.cleanupFile(inputPath),
        this.cleanupFile(outputPath)
      ]);

      this.logger.info('✅ Sticker criado com sucesso');

      return {
        sucesso: true,
        buffer: stickerComMetadados,
        tipo: 'sticker_image',
        size: stickerComMetadados.length,
        packName,
        author
      };

    } catch (error) {
      this.logger.error('❌ Erro ao criar sticker:', error.message);
      return {
        sucesso: false,
        error: error.message
      };
    }
  }

  /**
   * Cria sticker animado de vídeo
   */
  async createAnimatedStickerFromVideo(videoBuffer, maxDuration = 30, metadata = {}) {
    try {
      // Use configured max duration if not explicitly provided
      const cfgMax = parseInt(this.config.STICKER_MAX_ANIMATED_SECONDS || 30);
      maxDuration = parseInt(maxDuration || cfgMax);

      this.logger.info(`🎬 Criando sticker animado (max ${maxDuration}s)...`);

      const inputPath = this.generateRandomFilename('mp4');
      const outputPath = this.generateRandomFilename('webp');

      fs.writeFileSync(inputPath, videoBuffer);

      // Check input duration and log/trim if necessary
      try {
        await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(inputPath, (err, metadataProbe) => {
            if (err) return reject(err);
            const dur = metadataProbe?.format?.duration ? Math.floor(metadataProbe.format.duration) : 0;
            if (dur > maxDuration) {
              this.logger.info(`🛑 Vídeo de entrada tem ${dur}s; será cortado para ${maxDuration}s.`);
            }
            resolve();
          });
        });
      } catch (probeErr) {
        this.logger.debug('⚠️ Não foi possível obter duração do vídeo antes da conversão:', probeErr.message);
      }

      // Pack name = akira-bot, Author = nome do usuário que requisitou
      const { userName = 'User', author = 'akira-bot' } = metadata;
      const packName = `akira-bot-${userName.split(' ')[0].toLowerCase()}`;

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-vcodec libwebp',
            '-vf', `fps=15,scale=512:512:flags=lanczos`,
            '-loop', '0',
            '-lossless', '0',
            '-compression_level', '6',
            '-q:v', '70',
            '-preset', 'default',
            '-an',
            `-t`, String(maxDuration),
            '-metadata', `title=${packName}`,
            '-metadata', `artist=${author}`,
            '-metadata', 'comment=Criado por Akira Bot',
            '-y'
          ])
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath);
      });

      const stickerBuffer = fs.readFileSync(outputPath);

      if (stickerBuffer.length > 500 * 1024) {
        await Promise.all([
          this.cleanupFile(inputPath),
          this.cleanupFile(outputPath)
        ]);

        return {
          sucesso: false,
          error: 'Sticker animado muito grande (>500KB). Use um vídeo mais curto.'
        };
      }

      // Adiciona metadados EXIF ao sticker animado
      const stickerComMetadados = await this.addStickerMetadata(stickerBuffer, packName, author);

      await Promise.all([
        this.cleanupFile(inputPath),
        this.cleanupFile(outputPath)
      ]);

      this.logger.info('✅ Sticker animado criado');

      return {
        sucesso: true,
        buffer: stickerComMetadados,
        tipo: 'sticker_animado',
        size: stickerComMetadados.length,
        packName,
        author
      };

    } catch (error) {
      this.logger.error('❌ Erro ao criar sticker animado:', error.message);
      return {
        sucesso: false,
        error: error.message
      };
    }
  }

  /**
   * Converte sticker para imagem
   */
  async convertStickerToImage(stickerBuffer) {
    try {
      this.logger.info('🔄 Convertendo sticker para imagem...');

      const inputPath = this.generateRandomFilename('webp');
      const outputPath = this.generateRandomFilename('png');

      fs.writeFileSync(inputPath, stickerBuffer);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions('-vcodec png')
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath);
      });

      const imageBuffer = fs.readFileSync(outputPath);

      await Promise.all([
        this.cleanupFile(inputPath),
        this.cleanupFile(outputPath)
      ]);

      this.logger.info('✅ Sticker convertido para imagem');

      return {
        sucesso: true,
        buffer: imageBuffer,
        tipo: 'imagem',
        size: imageBuffer.length
      };

    } catch (error) {
      this.logger.error('❌ Erro ao converter sticker:', error.message);
      return {
        sucesso: false,
        error: error.message
      };
    }
  }

  /**
   * Detecta se buffer é view-once
   */
  detectViewOnce(message) {
    if (!message) return null;
    try {
      if (message.viewOnceMessageV2?.message) return message.viewOnceMessageV2.message;
      if (message.viewOnceMessageV2Extension?.message) return message.viewOnceMessageV2Extension.message;
      if (message.viewOnceMessage?.message) return message.viewOnceMessage.message;
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Extrai conteúdo de view-once e retorna tipo + buffer
   */
  async extractViewOnceContent(quotedMessage) {
    try {
      const unwrapped = this.detectViewOnce(quotedMessage);
      if (!unwrapped) {
        return { sucesso: false, error: 'Não é uma mensagem view-once' };
      }

      const tipo = unwrapped.imageMessage ? 'image' :
                   unwrapped.videoMessage ? 'video' :
                   unwrapped.audioMessage ? 'audio' :
                   unwrapped.stickerMessage ? 'sticker' : null;

      if (!tipo) {
        return { sucesso: false, error: 'Tipo de view-once não suportado' };
      }

      const mimeMap = {
        'image': 'image',
        'video': 'video',
        'audio': 'audio',
        'sticker': 'sticker'
      };

      const buffer = await this.downloadMedia(unwrapped[tipo + 'Message'], mimeMap[tipo]);

      if (!buffer) {
        return { sucesso: false, error: 'Erro ao extrair conteúdo' };
      }

      return {
        sucesso: true,
        buffer,
        tipo,
        size: buffer.length
      };
    } catch (e) {
      this.logger.error('❌ Erro ao extrair view-once:', e.message);
      return { sucesso: false, error: e.message };
    }
  }

  /**
   * Localiza yt-dlp no sistema
   */
  findYtDlp() {
    try {
      const binName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
      const localPath = path.resolve(__dirname, '..', 'bin', binName);
      
      if (fs.existsSync(localPath)) {
        return { modo: 'exe', cmd: localPath };
      }

      // Tenta no PATH
      try {
        const { execSync } = require('child_process');
        execSync(`${binName} --version`, { stdio: 'pipe', shell: true });
        return { modo: 'exe', cmd: binName };
      } catch (_) {}

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Download via yt-dlp
   */
  async _downloadWithYtDlp(url, videoId, tool) {
    try {
      const outputTemplate = this.generateRandomFilename('').replace(/\\.$/, '');

      const command = process.platform === 'win32'
        ? `"${tool.cmd}" --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" --no-playlist --max-filesize 25M --no-warnings "${url}"`
        : `${tool.cmd} --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" --no-playlist --max-filesize 25M --no-warnings "${url}"`;

      await new Promise((resolve, reject) => {
        exec(command, { timeout: 120000, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
          const actualPath = outputTemplate + '.mp3';
          if (fs.existsSync(actualPath)) {
            resolve();
          } else if (error) {
            reject(error);
          } else {
            reject(new Error('Arquivo não foi criado'));
          }
        });
      });

      const actualPath = outputTemplate + '.mp3';
      const stats = fs.statSync(actualPath);

      if (stats.size === 0) {
        await this.cleanupFile(actualPath);
        return { sucesso: false, error: 'Arquivo vazio' };
      }

      const audioBuffer = fs.readFileSync(actualPath);
      await this.cleanupFile(actualPath);

      this.logger.info(`✅ Download yt-dlp completo: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
      return {
        sucesso: true,
        buffer: audioBuffer,
        titulo: 'Música do YouTube',
        tamanho: audioBuffer.length,
        metodo: 'yt-dlp'
      };
    } catch (e) {
      this.logger.debug('yt-dlp error:', e.message);
      return { sucesso: false, error: e.message };
    }
  }

  /**
   * Download via ytdl-core
   */
  async _downloadWithYtdlCore(url, videoId) {
    try {
      const outputPath = this.generateRandomFilename('mp3');

      this.logger.info('🔄 Obtendo informações do vídeo...');

      const info = await ytdl.getInfo(videoId, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }
      });

      // Verifica duração máxima
      try {
        const videoLength = parseInt(info?.videoDetails?.lengthSeconds || 0);
        const maxAllowed = parseInt(this.config.YT_MAX_DURATION_SECONDS || 3600);
        if (videoLength > 0 && videoLength > maxAllowed) {
          return { sucesso: false, error: `Vídeo muito longo (${videoLength}s). Limite: ${maxAllowed}s.` };
        }
      } catch (lenErr) {
        this.logger.debug('Aviso de duração:', lenErr.message);
      }

      const audioFormat = ytdl.chooseFormat(info.formats, {
        quality: 'highestaudio',
        filter: 'audioonly'
      });

      if (!audioFormat) {
        return { sucesso: false, error: 'Nenhum formato de áudio encontrado' };
      }

      this.logger.info(`📦 Formato: ${audioFormat.container}`);
      const writeStream = fs.createWriteStream(outputPath);
      const stream = ytdl.downloadFromInfo(info, { format: audioFormat });

      await new Promise((resolve, reject) => {
        stream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        stream.on('error', reject);
      });

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Arquivo vazio');
      }

      if (stats.size > this.config.YT_MAX_SIZE_MB * 1024 * 1024) {
        await this.cleanupFile(outputPath);
        return { sucesso: false, error: `Arquivo muito grande (>${this.config.YT_MAX_SIZE_MB}MB)` };
      }

      const audioBuffer = fs.readFileSync(outputPath);
      await this.cleanupFile(outputPath);

      this.logger.info(`✅ Download ytdl-core completo: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
      return {
        sucesso: true,
        buffer: audioBuffer,
        titulo: info?.videoDetails?.title || 'Música do YouTube',
        tamanho: audioBuffer.length,
        metodo: 'ytdl-core'
      };

    } catch (e) {
      this.logger.debug('ytdl-core error:', e.message);
      return { sucesso: false, error: e.message };
    }
  }

  /**
   * Download de áudio do YouTube - ROBUSTO COM FALLBACK
   */
  async downloadYouTubeAudio(url) {
    try {
      this.logger.info('🎵 Iniciando download de áudio do YouTube...');

      let videoId = '';
      if (url.includes('youtube.com/watch?v=')) {
        videoId = url.split('v=')[1]?.split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
      } else {
        videoId = url;
      }

      if (!videoId || videoId.length !== 11) {
        return { sucesso: false, error: 'URL do YouTube inválida' };
      }

      this.logger.info(`📹 Video ID: ${videoId}`);

      // Tenta yt-dlp primeiro (mais robusto)
      const ytdlpTool = this.findYtDlp();
      if (ytdlpTool) {
        this.logger.info('🔧 Tentando yt-dlp (método 1 - mais robusto)...');
        const result = await this._downloadWithYtDlp(url, videoId, ytdlpTool);
        if (result.sucesso) return result;
        this.logger.info('⚠️  yt-dlp falhou, tentando ytdl-core...');
      }

      // Fallback para ytdl-core
      if (ytdl) {
        this.logger.info('🔧 Tentando ytdl-core (método 2 - fallback)...');
        return await this._downloadWithYtdlCore(url, videoId);
      }

      return {
        sucesso: false,
        error: 'Nenhum método de download disponível. Instale yt-dlp ou @distube/ytdl-core.'
      };

    } catch (error) {
      this.logger.error('❌ Erro geral:', error.message);
      return { sucesso: false, error: error.message };
    }
  }

  async downloadYouTubeAudio(url) {
    try {
      this.logger.info('🎵 Iniciando download de áudio do YouTube...');

      if (!ytdl) {
        return {
          sucesso: false,
          error: 'Nenhum módulo de download do YouTube disponível (instale @distube/ytdl-core ou ytdl-core) ou configure yt-dlp no sistema.'
        };
      }

      let videoId = '';
      if (url.includes('youtube.com/watch?v=')) {
        videoId = url.split('v=')[1]?.split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
      } else {
        videoId = url;
      }

      if (!videoId || videoId.length !== 11) {
        return {
          sucesso: false,
          error: 'URL do YouTube inválida'
        };
      }

      this.logger.info(`📹 Video ID: ${videoId}`);

      // Tenta buscar info do vídeo
      let videoTitle = 'Música do YouTube';
      try {
        const searchResult = await yts({ videoId });
        if (searchResult && searchResult.title) {
          videoTitle = searchResult.title;
        }
      } catch (e) {
        this.logger.debug('Aviso ao buscar título:', e.message);
      }

      // Download via ytdl-core
      const outputPath = this.generateRandomFilename('mp3');

      try {
        this.logger.info('🔄 Obtendo informações do vídeo...');

        const info = await ytdl.getInfo(videoId, {
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        });

        // Enforce maximum duration (seconds)
        try {
          const videoLength = parseInt(info?.videoDetails?.lengthSeconds || 0);
          const maxAllowed = parseInt(this.config.YT_MAX_DURATION_SECONDS || 3600);
          if (videoLength > 0 && videoLength > maxAllowed) {
            return {
              sucesso: false,
              error: `Vídeo muito longo (${videoLength}s). Limite: ${maxAllowed}s.`
            };
          }
        } catch (lenErr) {
          this.logger.debug('Aviso: não foi possível verificar duração do vídeo:', lenErr.message);
        }

        const audioFormat = ytdl.chooseFormat(info.formats, {
          quality: this.config.YT_QUALITY,
          filter: 'audioonly'
        });

        if (!audioFormat) {
          return {
            sucesso: false,
            error: 'Nenhum formato de áudio encontrado'
          };
        }

        this.logger.info(`📦 Formato: ${audioFormat.container}`);

        const writeStream = fs.createWriteStream(outputPath);
        const stream = ytdl.downloadFromInfo(info, { format: audioFormat });

        await new Promise((resolve, reject) => {
          stream.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          stream.on('error', reject);
        });

        const stats = fs.statSync(outputPath);

        if (stats.size === 0) {
          await this.cleanupFile(outputPath);
          return { sucesso: false, error: 'Arquivo vazio' };
        }

        const audioBuffer = fs.readFileSync(outputPath);
        await this.cleanupFile(outputPath);

        this.logger.info(`✅ Download ytdl-core completo: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);

        return {
          sucesso: true,
          buffer: audioBuffer,
          titulo: info?.videoDetails?.title || 'Música do YouTube',
          tamanho: audioBuffer.length,
          metodo: 'ytdl-core'
        };

      } catch (e) {
        this.logger.debug('ytdl-core error:', e.message);
        await this.cleanupFile(outputPath);
        return {
          sucesso: false,
          error: `Erro no download: ${e.message}`
        };
      }

    } catch (error) {
      this.logger.error('❌ Erro geral:', error.message);
      return { sucesso: false, error: error.message };
    }
  }

  /**
   * Processa link do YouTube (validação)
   */
  isValidYouTubeUrl(url) {
    const regex = /^(https?:\/\/(www\.)?)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/.*$/i;
    return regex.test(String(url));
  }

  /**
   * Busca música no YouTube por nome
   */
  async searchYouTube(query, limit = 5) {
    try {
      this.logger.info(`🔍 Buscando: ${query}`);

      const result = await yts(query);

      if (!result || !result.videos || result.videos.length === 0) {
        return {
          sucesso: false,
          error: 'Nenhum resultado encontrado'
        };
      }

      const videos = result.videos.slice(0, limit).map(v => ({
        titulo: v.title,
        url: v.url,
        duracao: v.duration.toString(),
        views: v.views || 0,
        uploadedAt: v.uploadedAt || 'unknown'
      }));

      this.logger.info(`✅ Encontrados ${videos.length} resultados`);

      return {
        sucesso: true,
        resultados: videos,
        query
      };

    } catch (error) {
      this.logger.error('❌ Erro na busca:', error.message);
      return {
        sucesso: false,
        error: error.message
      };
    }
  }

  /**
   * Limpa cache
   */
  clearCache() {
    this.downloadCache.clear();
    this.logger.info('💾 Cache de mídia limpo');
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    return {
      cacheSize: this.downloadCache.size,
      ytDownloadEnabled: this.config.FEATURE_YT_DOWNLOAD,
      stickerEnabled: this.config.FEATURE_STICKERS,
      maxVideoSize: `${this.config.YT_MAX_SIZE_MB}MB`,
      stickerSize: this.config.STICKER_SIZE,
      stickerAnimatedMax: `${this.config.STICKER_MAX_ANIMATED_SECONDS}s`
    };
  }
}

module.exports = MediaProcessor;
