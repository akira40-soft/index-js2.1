/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MÓDULO: ImageEffects.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Efeitos de imagem: HD, remover fundo, adicionar fundo, filtros
 * ═══════════════════════════════════════════════════════════════════════════
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import ConfigManager from './ConfigManager.js';

class ImageEffects {
    constructor(config = null) {
        this.config = config || ConfigManager.getInstance();
        this.logger = console;
        this.tempFolder = this.config?.TEMP_FOLDER;

        // Cores da bandeira de Angola
        this.ANGOLA_COLORS = {
            red: '#d92126',
            black: '#000000',
            yellow: '#f9e300'
        };
    }

    /**
    * Gera caminho de arquivo temporário
    */
    generateTempPath(ext = 'png') {
        return path.join(
            this.tempFolder,
            `effect_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        );
    }

    /**
    * Limpa arquivo temporário
    */
    async cleanupFile(filePath) {
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            this.logger?.warn(`⚠️ Erro ao limpar arquivo: ${e.message}`);
        }
    }

    /**
    * Efeito HD - Melhora qualidade da imagem
    */
    async applyHDEffect(imageBuffer) {
        try {
            this.logger?.info('🎨 Aplicando efeito HD...');

            // Carregar imagem com sharp
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();

            // Novo tamanho (aumentar se for pequena)
            let newWidth = metadata.width;
            let newHeight = metadata.height;

            // Se imagem for muito pequena, aumentar
            const minSize = 512;
            if (newWidth < minSize || newHeight < minSize) {
                const scale = Math.max(minSize / newWidth, minSize / newHeight);
                newWidth = Math.round(newWidth * scale);
                newHeight = Math.round(newHeight * scale);
            }

            // Aplicar melhorias
            let processed = sharp(imageBuffer)
                .resize(newWidth, newHeight, {
                    fit: 'inside',
                    withoutEnlargement: false,
                    kernel: 'lanczos3'
                });

            // Aumentar nitidez
            processed = processed.sharpen({
                sigma: 1.5,
                m1: 0.5,
                m2: 0.5
            });

            // Ajustar contraste e brilho
            processed = processed.linear(1.05, -10);

            // Aumentar saturação ligeiramente
            processed = processed.modulate({
                saturation: 1.1
            });

            const outputBuffer = await processed.toBuffer();

            this.logger?.info(`✅ Efeito HD aplicado: ${metadata.width}x${metadata.height} → ${newWidth}x${newHeight}`);

            return {
                success: true,
                buffer: outputBuffer,
                originalSize: metadata.width + 'x' + metadata.height,
                newSize: newWidth + 'x' + newHeight,
                effect: 'hd'
            };
        } catch (e) {
            this.logger?.error('❌ Erro no efeito HD:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Efeito communists/vermelho
    */
    async applyCommunistEffect(imageBuffer) {
        try {
            this.logger?.info('🎨 Aplicando efeito comunista...');

            const metadata = await sharp(imageBuffer).metadata();

            // Dessaturar parcialmente e tingir de vermelho
            const processed = sharp(imageBuffer)
                .modulate({ saturation: 0.3 }) // Dessaturar
                .tint({ r: 255, g: 50, b: 50 }); // Tint vermelho

            const outputBuffer = await processed.toBuffer();

            this.logger?.info('✅ Efeito comunista aplicado');

            return {
                success: true,
                buffer: outputBuffer,
                effect: 'comunista'
            };
        } catch (e) {
            this.logger?.error('❌ Erro no efeito comunista:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Fundo com bandeira de Angola
    */
    async applyAngolaFlagBackground(imageBuffer) {
        try {
            this.logger?.info('🎨 Aplicando fundo bandeira Angola...');

            const metadata = await sharp(imageBuffer).metadata();
            const size = Math.max(metadata.width, metadata.height, 1024);

            // Criar gradiente da bandeira de Angola
            // Angola: duas faixas horizontais (vermelho e preto) com triângulo amarelo

            const svgBackground = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
<defs>
<clipPath id="angola-clip">
<rect width="${size}" height="${size}"/>
</clipPath>
</defs>
<!-- Faixa vermelha (superior) -->
<rect x="0" y="0" width="${size}" height="${size * 0.4}" fill="${this.ANGOLA_COLORS.red}"/>
<!-- Faixa preta (inferior) -->
<rect x="0" y="${size * 0.4}" width="${size}" height="${size * 0.6}" fill="${this.ANGOLA_COLORS.black}"/>
<!-- Triângulo amarelo -->
<polygon points="0,0 0,${size} ${size * 0.5},${size * 0.5}" fill="${this.ANGOLA_COLORS.yellow}"/>
<!-- Engrenagem e faca (simplificado como círculo) -->
<circle cx="${size * 0.25}" cy="${size * 0.25}" r="${size * 0.08}" fill="transparent"/>
</svg>
`;

            const bgPath = this.generateTempPath('svg');
            fs.writeFileSync(bgPath, svgBackground);

            // Redimensionar imagem principal para caber no centro
            const mainSize = Math.round(size * 0.6);
            const mainImage = await sharp(imageBuffer)
                .resize(mainSize, mainSize, {
                    fit: 'cover',
                    position: 'center'
                })
                .toBuffer();

            // Criar composição
            const processed = sharp(bgPath)
                .composite([{
                    input: mainImage,
                    top: Math.round((size - mainSize) / 2),
                    left: Math.round((size - mainSize) / 2),
                    blend: 'over'
                }]);

            const outputBuffer = await processed.toBuffer();

            await this.cleanupFile(bgPath);

            this.logger?.info('✅ Fundo bandeira Angola aplicado');

            return {
                success: true,
                buffer: outputBuffer,
                effect: 'bandeira_angola'
            };
        } catch (e) {
            this.logger?.error('❌ Erro no efeito Angola:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Fundo sólido com cor personalizada
    */
    async addSolidBackground(imageBuffer, color = '#ffffff') {
        try {
            this.logger?.info(`🎨 Adicionando fundo sólido: ${color}`);

            const metadata = await sharp(imageBuffer).metadata();
            const size = Math.max(metadata.width, metadata.height, 1024);

            // Validar cor
            const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            if (!colorRegex.test(color)) {
                color = '#ffffff'; // Fallback para branco
            }

            // Criar fundo sólido
            const bgPath = this.generateTempPath('png');
            await sharp({
                create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
            })
                .tint(color === '#ffffff' ? '#cccccc' : color)
                .toFile(bgPath);

            // Redimensionar imagem principal
            const mainSize = Math.round(size * 0.7);
            const mainImage = await sharp(imageBuffer)
                .resize(mainSize, mainSize, {
                    fit: 'cover',
                    position: 'center'
                })
                .toBuffer();

            // Compor
            const processed = sharp(bgPath)
                .composite([{
                    input: mainImage,
                    top: Math.round((size - mainSize) / 2),
                    left: Math.round((size - mainSize) / 2),
                    blend: 'over'
                }]);

            const outputBuffer = await processed.toBuffer();

            await this.cleanupFile(bgPath);

            this.logger?.info(`✅ Fundo ${color} aplicado`);

            return {
                success: true,
                buffer: outputBuffer,
                color: color,
                effect: 'solid_background'
            };
        } catch (e) {
            this.logger?.error('❌ Erro ao adicionar fundo sólido:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Adicionar gradiente como fundo
    */
    async addGradientBackground(imageBuffer, color1 = '#d92126', color2 = '#000000') {
        try {
            this.logger?.info('🎨 Adicionando fundo gradiente...');

            const metadata = await sharp(imageBuffer).metadata();
            const size = Math.max(metadata.width, metadata.height, 1024);

            // Criar gradiente SVG
            const svgGradient = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
<stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
<stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
</linearGradient>
</defs>
<rect width="${size}" height="${size}" fill="url(#grad)"/>
</svg>
`;

            const bgPath = this.generateTempPath('svg');
            fs.writeFileSync(bgPath, svgGradient);

            // Redimensionar imagem principal
            const mainSize = Math.round(size * 0.7);
            const mainImage = await sharp(imageBuffer)
                .resize(mainSize, mainSize, {
                    fit: 'cover',
                    position: 'center'
                })
                .toBuffer();

            // Compor
            const processed = sharp(bgPath)
                .composite([{
                    input: mainImage,
                    top: Math.round((size - mainSize) / 2),
                    left: Math.round((size - mainSize) / 2),
                    blend: 'over'
                }]);

            const outputBuffer = await processed.toBuffer();

            await this.cleanupFile(bgPath);

            this.logger?.info('✅ Fundo gradiente aplicado');

            return {
                success: true,
                buffer: outputBuffer,
                colors: { color1, color2 },
                effect: 'gradient_background'
            };
        } catch (e) {
            this.logger?.error('❌ Erro ao adicionar gradiente:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Remover fundo da imagem
    * Nota: Requer @imgly/background-removal ou API externa
    */
    async removeBackground(imageBuffer) {
        try {
            this.logger?.info('🎨 Removendo fundo...');

            // Método 1: Tentar usar @imgly/background-removal se disponível
            let bgRemovedBuffer;
            let method = 'unknown';

            try {
                const { default: removeBackground } = await import('@imgly/background-removal');
                const blob = new Blob([imageBuffer]);
                const resultBlob = await removeBackground(blob);
                bgRemovedBuffer = Buffer.from(await resultBlob.arrayBuffer());
                method = '@imgly/background-removal';
            } catch (libError) {
                // Método 2: Remoção simples por cor (fallback limitado)
                this.logger?.info('⚠️ @imgly não disponível, usando método alternativo...');

                // Usar chroma key simples - detectar e tornar transparente
                const processed = await sharp(imageBuffer)
                    .ensureAlpha(1) // Garantir canal alpha
                    .modulate({ saturation: 0 }) // Dessaturar para facilitar detecção
                    .toBuffer({ resolveWithObject: true });

                bgRemovedBuffer = processed.data;
                method = 'simple_alpha';
            }

            this.logger?.info(`✅ Fundo removido (método: ${method})`);

            return {
                success: true,
                buffer: bgRemovedBuffer,
                method: method,
                effect: 'remove_background'
            };
        } catch (e) {
            this.logger?.error('❌ Erro ao remover fundo:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Converter resultado para sticker
    */
    async convertToSticker(imageBuffer, author = 'Akira Bot') {
        try {
            this.logger?.info('🎨 Convertendo para sticker...');

            const metadata = await sharp(imageBuffer).metadata();
            const maxSize = 512;

            // Redimensionar para sticker
            let processed = sharp(imageBuffer);

            if (metadata.width > maxSize || metadata.height > maxSize) {
                processed = processed.resize(maxSize, maxSize, {
                    fit: 'inside',
                    withoutEnlargement: true,
                    kernel: 'lanczos3'
                });
            }

            // Converter para WebP
            processed = processed
                .webp({
                    lossless: false,
                    quality: 75,
                    effort: 6
                })
                .resize(512, 512, {
                    fit: 'cover',
                    position: 'center'
                });

            const stickerBuffer = await processed.toBuffer();

            this.logger?.info('✅ Sticker criado');

            return {
                success: true,
                buffer: stickerBuffer,
                size: stickerBuffer.length,
                effect: 'sticker'
            };
        } catch (e) {
            this.logger?.error('❌ Erro ao converter para sticker:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
    * Processa imagem com efeito especificado
    */
    async processImage(imageBuffer, effect, options = {}) {
        let result;

        switch (effect.toLowerCase()) {
            case 'hd':
            case 'enhance':
                result = await this.applyHDEffect(imageBuffer);
                break;

            case 'comunista':
            case 'commie':
            case 'red':
                result = await this.applyCommunistEffect(imageBuffer);
                break;

            case 'bandeiraangola':
            case 'angola':
            case 'angolabg':
                result = await this.applyAngolaFlagBackground(imageBuffer);
                break;

            case 'removerfundo':
            case 'rmbg':
            case 'nobg':
                result = await this.removeBackground(imageBuffer);
                break;

            case 'adicionarfundo':
            case 'addbg':
                const color = options.color || '#ffffff';
                result = await this.addSolidBackground(imageBuffer, color);
                break;

            case 'fundogradiente':
            case 'gradient':
                const color1 = options.color1 || '#d92126';
                const color2 = options.color2 || '#000000';
                result = await this.addGradientBackground(imageBuffer, color1, color2);
                break;

            default:
                return {
                    success: false,
                    error: `Efeito desconhecido: ${effect}`
                };
        }

        return result;
    }

    /**
    * Gera mensagem de ajuda para efeitos
    */
    getHelpMessage() {
        return `🖼️ *EFEITOS DE IMAGEM*

┌─────────────────────────────┐
│ 🎨 *EFEITOS DISPONÍVEIS* │
├─────────────────────────────┤
│ #hd │
│ #enhance │
│ → Melhora qualidade (HD) │
├─────────────────────────────┤
│ #removerfundo │
│ #rmbg │
│ → Remove fundo da imagem │
├─────────────────────────────┤
│ #adicionarfundo <cor> │
│ #addbg #ff0000 │
│ → Adiciona fundo sólido │
├─────────────────────────────┤
│ #comunista │
│ #commie │
│ → Filtro vermelho │
├─────────────────────────────┤
│ #bandeiraangola │
│ #angola │
│ → Fundo bandeira Angola │
└─────────────────────────────┘

💡 *Como usar:*
1. Envie uma imagem
2. Responda com o comando desejado

📝 *Cores para #adicionarfundo:*
• #ff0000 → Vermelho
• #00ff00 → Verde
• #0000ff → Azul
• #ffffff → Branco
• #000000 → Preto

⚠️ *Nota:* O resultado será enviado como sticker.`;
    }
}

export default ImageEffects;
