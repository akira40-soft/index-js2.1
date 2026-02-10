/**
 * ═══════════════════════════════════════════════════════════════════════
 * CLASSE: AudioProcessor
 * ═══════════════════════════════════════════════════════════════════════
 * Gerencia STT (Speech-to-Text), TTS (Text-to-Speech) e processamento de áudio
 * Integração com Deepgram e Google TTS
 * ═══════════════════════════════════════════════════════════════════════
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import googleTTS from 'google-tts-api';
import ConfigManager from './ConfigManager.js';

class AudioProcessor {
 constructor(logger = null) {
 this.config = ConfigManager.getInstance();
 this.logger = logger || console;
 this.tempFolder = this.config?.TEMP_FOLDER || './temp';
 this.sttCache = new Map();
 this.ttsCache = new Map();
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
 * Limpa arquivo após uso
 */
 async cleanupFile(filePath) {
 try {
 if (!filePath || !fs.existsSync(filePath)) return;

 return new Promise((resolve) => {
 fs.unlink(filePath, (err) => {
 if (err && err.code !== 'ENOENT') {
 this.logger?.warn(`⚠️ Erro ao limpar ${path.basename(filePath)}: ${err.code}`);
 }
 resolve();
 });
 });
 } catch (e) {
 this.logger?.error('Erro ao limpar arquivo:', e.message);
 }
 }

 /**
 * STT usando Deepgram
 * Transcreve áudio para texto
 */
 async speechToText(audioBuffer, language = 'pt') {
 try {
 if (!this.config?.DEEPGRAM_API_KEY) {
 this.logger?.warn('⚠️ Deepgram API Key não configurada');
 return {
 sucesso: false,
 texto: '[Audio recebido mas Deepgram não configurado]',
 erro: 'API_KEY_MISSING'
 };
 }

 this.logger?.info('🔊 Iniciando STT (Deepgram)...');

 // Converte OGG para MP3
 const audioPath = this.generateRandomFilename('ogg');
 const convertedPath = this.generateRandomFilename('mp3');

 fs.writeFileSync(audioPath, audioBuffer);

 // Converte para MP3
 await new Promise((resolve, reject) => {
 ffmpeg(audioPath)
 .toFormat('mp3')
 .audioCodec('libmp3lame')
 .on('end', resolve)
 .on('error', reject)
 .save(convertedPath);
 });

 const convertedBuffer = fs.readFileSync(convertedPath);

 // Chama Deepgram API
 this.logger?.info('📤 Enviando para Deepgram...');

 const response = await axios.post(
 this.config?.DEEPGRAM_API_URL,
 convertedBuffer,
 {
 headers: {
 'Authorization': `Token ${this.config?.DEEPGRAM_API_KEY}`,
 'Content-Type': 'audio/mpeg'
 },
 params: {
 model: this.config?.DEEPGRAM_MODEL,
 language: language || this.config?.STT_LANGUAGE,
 smart_format: true,
 punctuate: true,
 diarize: false,
 numerals: true
 },
 timeout: 30000
 }
 );

 let textoTranscrito = '';
 if (response.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
 textoTranscrito = response.data.results.channels[0].alternatives[0].transcript.trim();
 }

 if (!textoTranscrito || textoTranscrito.length < 2) {
 textoTranscrito = '[Não consegui entender claramente]';
 }

 // Limpeza
 await Promise.all([
 this.cleanupFile(audioPath),
 this.cleanupFile(convertedPath)
 ]);

 this.logger?.info(`📝 STT Completo: ${textoTranscrito.substring(0, 80)}...`);

 return {
 sucesso: true,
 texto: textoTranscrito,
 fonte: 'Deepgram STT',
 confidence: response.data?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0
 };

 } catch (error) {
 this.logger?.error('❌ Erro STT:', error.message);

 let errorCode = 'UNKNOWN';
 if (error.response?.status === 401) {
 errorCode = 'INVALID_API_KEY';
 } else if (error.code === 'ECONNREFUSED') {
 errorCode = 'CONNECTION_FAILED';
 }

 return {
 sucesso: false,
 texto: '[Recebi seu áudio mas houve um erro na transcrição]',
 erro: errorCode,
 mensagem: error.message
 };
 }
 }

 /**
 * TTS usando Google TTS
 * Converte texto para áudio
 */
 async textToSpeech(text, language = 'pt') {
 try {
 if (!text || text.length === 0) {
 return {
 sucesso: false,
 error: 'Texto vazio'
 };
 }

 // Verifica cache
 const cacheKey = `${text.substring(0, 50)}_${language}`;
 if (this.ttsCache?.has(cacheKey)) {
 this.logger?.debug('💾 TTS from cache');
 return this.ttsCache.get(cacheKey);
 }

 this.logger?.info('🔊 Iniciando TTS (Google)...');

 // Trunca texto se necessário (Google TTS tem limite)
 const maxChars = 500;
 const textTruncated = text.substring(0, maxChars);

 const audioUrl = googleTTS.getAudioUrl(textTruncated, {
 lang: language || this.config?.TTS_LANGUAGE,
 slow: this.config?.TTS_SLOW,
 host: 'https://translate.google.com'
 });

 const outputPath = this.generateRandomFilename('mp3');

 // Download do áudio
 const response = await axios({
 url: audioUrl,
 method: 'GET',
 responseType: 'arraybuffer',
 timeout: 15000
 });

 const audioBuffer = Buffer.from(response.data);

 if (audioBuffer.length === 0) {
 throw new Error('Audio buffer vazio');
 }

 fs.writeFileSync(outputPath, audioBuffer);

 const stats = fs.statSync(outputPath);
 if (stats.size > this.config?.MAX_AUDIO_SIZE_MB * 1024 * 1024) {
 await this.cleanupFile(outputPath);
 return {
 sucesso: false,
 error: 'Áudio TTS muito grande'
 };
 }

 const finalBuffer = fs.readFileSync(outputPath);
 await this.cleanupFile(outputPath);

 const result = {
 sucesso: true,
 buffer: finalBuffer,
 fonte: 'Google TTS',
 size: finalBuffer.length
 };

 // Cache
 this.ttsCache.set(cacheKey, result);
 if (this.ttsCache.size > 50) {
 const firstKey = this.ttsCache.keys().next().value;
 this.ttsCache.delete(firstKey);
 }

 this.logger?.info(`🔊 TTS Completo: ${textTruncated.substring(0, 50)}... (${finalBuffer.length} bytes)`);

 return result;

 } catch (error) {
 this.logger?.error('❌ Erro TTS:', error.message);

 return {
 sucesso: false,
 error: 'Erro ao gerar TTS: ' + error.message
 };
 }
 }

 /**
 * Detecta se é áudio animado (apenas tipo)
 */
 detectAudioType(buffer) {
 if (!buffer || buffer.length < 12) return 'unknown';

 const header = buffer.slice(0, 4).toString('hex').toLowerCase();

 // OGG Vorbis
 if (header === '4f676753') return 'ogg';
 // RIFF (WAV)
 if (header === '52494646') return 'wav';
 // MP3
 if (header === '494433' || header === 'fffb') return 'mp3';
 // FLAC
 if (header === '664c6143') return 'flac';
 // AAC
 if (header === 'fff1' || header === 'fff9') return 'aac';

 return 'unknown';
 }

 /**
 * Aplica efeito de áudio (nightcore, slow, bass, etc)
 */
 async applyAudioEffect(inputBuffer, effect = 'normal') {
 try {
 const inputPath = this.generateRandomFilename('mp3');
 const outputPath = this.generateRandomFilename('mp3');

 fs.writeFileSync(inputPath, inputBuffer);

 let audioFilter = '';
 let speed = 1;
 let pitch = 0;

 switch (effect.toLowerCase()) {
 case 'nightcore':
 speed = 1.5;
 pitch = 8;
 audioFilter = 'asetrate=44100*1.5,atempo=1/1.5';
 break;
 case 'slow':
 speed = 0.7;
 audioFilter = 'atempo=0.7';
 break;
 case 'fast':
 speed = 1.3;
 audioFilter = 'atempo=1.3';
 break;
 case 'bass':
 audioFilter = 'bass=g=10';
 break;
 case 'treble':
 audioFilter = 'treble=g=10';
 break;
 case 'echo':
 audioFilter = 'aecho=0.8:0.9:1000:0.3';
 break;
 default:
 // normal - no filter
 break;
 }

 if (!audioFilter) {
 // Sem efeito, copia direto
 await this.cleanupFile(inputPath);
 return { sucesso: true, buffer: inputBuffer };
 }

 await new Promise((resolve, reject) => {
 let cmd = ffmpeg(inputPath);
 if (audioFilter) {
 cmd = cmd.audioFilter(audioFilter);
 }
 cmd
 .outputOptions('-q:a 5')
 .on('end', resolve)
 .on('error', reject)
 .save(outputPath);
 });

 const resultBuffer = fs.readFileSync(outputPath);

 await Promise.all([
 this.cleanupFile(inputPath),
 this.cleanupFile(outputPath)
 ]);

 return {
 sucesso: true,
 buffer: resultBuffer,
 effect: effect,
 size: resultBuffer.length
 };

 } catch (error) {
 this.logger?.error(`❌ Erro ao aplicar efeito ${effect}:`, error.message);
 return {
 sucesso: false,
 error: error.message
 };
 }
 }

 /**
 * Limpa cache de TTS
 */
 clearCache() {
 this.sttCache?.clear();
 this.ttsCache?.clear();
 this.logger?.info('💾 Caches de áudio limpos');
 }

 /**
 * Retorna estatísticas
 */
 getStats() {
 return {
 sttCacheSize: this.sttCache?.size,
 ttsCacheSize: this.ttsCache?.size,
 deepgramConfigured: !!this.config?.DEEPGRAM_API_KEY,
 sttEnabled: this.config?.FEATURE_STT_ENABLED,
 ttsEnabled: this.config?.FEATURE_TTS_ENABLED
 };
 }
}

export default AudioProcessor;
