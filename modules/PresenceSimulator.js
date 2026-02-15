/**
 * ═══════════════════════════════════════════════════════════════════════
 * PRESENCE SIMULATOR - AKIRA BOT V21
 * ═══════════════════════════════════════════════════════════════════════
 * ✅ Simulações realistas de presença e status de mensagem
 * ✅ Digitação, gravação de áudio, ticks, leitura
 * ✅ Totalmente compatível com Baileys
 * ═══════════════════════════════════════════════════════════════════════
 */

import { delay } from '@whiskeysockets/baileys';

class PresenceSimulator {
    constructor(sock) {
        this.sock = sock;
        this.logger = console;
    }

    /**
     * Simula digitação realista
     * - Inicia presença como "disponível"
     * - Muda para "digitando"
     * - Aguarda tempo proporcional ao tamanho da resposta
     * - Volta para "pausado"
     * - Retorna para "disponível"
     */
    async simulateTyping(jid, durationMs = 3000) {
        try {
            // Step 1: Garantir que está online
            await this.sock.sendPresenceUpdate('available', jid);
            await delay(300);

            // Step 2: Começar a digitar
            await this.sock.sendPresenceUpdate('composing', jid);
            this.logger.log(`⌨️  [DIGITANDO] Simulando digitação por ${(durationMs / 1000).toFixed(1)}s...`);

            // Step 3: Aguardar conforme tamanho da mensagem
            await delay(durationMs);

            // Step 4: Parar de digitar (transição)
            await this.sock.sendPresenceUpdate('paused', jid);
            await delay(300);

            // Step 5: Voltar ao normal
            await this.sock.sendPresenceUpdate('available', jid);
            this.logger.log('✅ [PRONTO] Digitação simulada concluída');

            return true;
        } catch (error) {
            this.logger.error('❌ Erro ao simular digitação:', error.message);
            return false;
        }
    }

    /**
     * Simula gravação de áudio realista
     * - Muda para "gravando"
     * - Aguarda duração
     * - Volta para "pausado"
     */
    async simulateRecording(jid, durationMs = 2000) {
        try {
            this.logger.log(`🎤 [GRAVANDO] Preparando áudio por ${(durationMs / 1000).toFixed(1)}s...`);

            // Step 1: Começar a "gravar"
            await this.sock.sendPresenceUpdate('recording', jid);

            // Step 2: Aguardar processamento
            await delay(durationMs);

            // Step 3: Concluir gravação
            await this.sock.sendPresenceUpdate('paused', jid);

            this.logger.log('✅ [PRONTO] Áudio preparado para envio');

            return true;
        } catch (error) {
            this.logger.error('❌ Erro ao simular gravação:', error.message);
            return false;
        }
    }

    /**
     * Simula envio de "ticks" (confirmações de entrega/leitura)
     * 
     * Em grupos:
     *   - Sem ativação: Um tick (entregue)
     *   - Com ativação: Dois ticks azuis (lido)
     * 
     * Em PV:
     *   - Sem ativação: Um tick (entregue)
     *   - Com ativação: Dois ticks azuis (lido)
     */
    async simulateTicks(m, wasActivated = true, isAudio = false) {
        try {
            const isGroup = String(m.key.remoteJid || '').endsWith('@g.us');
            const jid = m.key.remoteJid;
            const participant = m.key.participant;
            const messageId = m.key.id;

            if (isGroup) {
                // ═══ GRUPO ═══
                if (!wasActivated) {
                    // Não foi ativada: Apenas um tick (entregue)
                    try {
                        await this.sock.sendReadReceipt(jid, participant, [messageId]);
                        this.logger.log('✓ [ENTREGUE] Grupo - Um tick (mensagem entregue)');
                        return true;
                    } catch (err1) {
                        try {
                            await this.sock.sendReceipt(jid, participant, [messageId]);
                            this.logger.log('✓ [ENTREGUE] Grupo - Método alternativo');
                            return true;
                        } catch (err2) {
                            this.logger.warn('⚠️  Não conseguiu enviar tick em grupo');
                            return false;
                        }
                    }
                } else {
                    // Foi ativada: Dois ticks azuis (lido)
                    try {
                        await this.sock.readMessages([m.key]);
                        this.logger.log('✓✓ [LIDO] Grupo - Dois ticks azuis (mensagem lida)');
                        return true;
                    } catch (err) {
                        this.logger.warn('⚠️  Não conseguiu marcar como lido em grupo');
                        return false;
                    }
                }
            } else {
                // ═══ PV (PRIVADO) ═══
                if (wasActivated || isAudio) {
                    // Marcar como lido (dois ticks azuis)
                    try {
                        await this.sock.readMessages([m.key]);
                        if (isAudio) {
                            this.logger.log('▶️  [REPRODUZIDO] PV - Áudio marcado como reproduzido (✓✓)');
                        } else {
                            this.logger.log('✓✓ [LIDO] PV - Marcado como lido (dois ticks azuis)');
                        }
                        return true;
                    } catch (err) {
                        this.logger.warn('⚠️  Não conseguiu marcar como lido em PV');
                        return false;
                    }
                } else {
                    // Não foi ativada: Um tick (entregue)
                    try {
                        await this.sock.sendReadReceipt(m.key.remoteJid, m.key.participant, [messageId]);
                        this.logger.log('✓ [ENTREGUE] PV - Um tick (mensagem entregue)');
                        return true;
                    } catch (err) {
                        this.logger.warn('⚠️  Não conseguiu enviar tick em PV');
                        return false;
                    }
                }
            }
        } catch (error) {
            this.logger.error('❌ Erro ao simular ticks:', error.message);
            return false;
        }
    }

    /**
     * Simula leitura de mensagem
     * Marca mensagem como lida (dois ticks azuis)
     */
    async markAsRead(m) {
        try {
            await this.sock.readMessages([m.key]);
            this.logger.log('✓✓ [LIDO] Mensagem marcada como lida');
            return true;
        } catch (error) {
            this.logger.warn('⚠️  Não conseguiu marcar como lido:', error.message);
            return false;
        }
    }

    /**
     * Simula status completo de mensagem
     * Combina: Entrega → Leitura com delays realistas
     */
    async simulateMessageStatus(m, wasActivated = true) {
        try {
            const isGroup = String(m.key.remoteJid || '').endsWith('@g.us');

            // Em grupos, sempre enviar entrega primeiro
            if (isGroup) {
                try {
                    await this.sock.sendReadReceipt(m.key.remoteJid, m.key.participant, [m.key.id]);
                    this.logger.log('✓ [ENTREGUE] Grupo');
                    await delay(300);
                } catch (e) {
                    // Ignorar erro
                }
            }

            // Se foi ativada, marcar como lido
            if (wasActivated) {
                await delay(500);
                await this.markAsRead(m);
            }

            return true;
        } catch (error) {
            this.logger.error('❌ Erro ao simular status completo:', error.message);
            return false;
        }
    }

    /**
     * Simula comportamento completo ao responder
     * 1. Marca entrega
     * 2. Simula digitação
     * 3. Envia mensagem
     * 4. Marca leitura
     */
    async simulateFullResponse(sock, m, responseText, isAudio = false) {
        try {
            const jid = m.key.remoteJid;
            const isGroup = String(jid || '').endsWith('@g.us');

            // Step 1: Marcar como entregue (em grupos)
            if (isGroup) {
                await this.simulateTicks(m, false, false);
                await delay(300);
            }

            // Step 2: Simular digitação ou gravação
            if (isAudio) {
                const estimatedDuration = Math.min(
                    Math.max((responseText.length / 10) * 100, 2000),
                    5000
                );
                await this.simulateRecording(jid, estimatedDuration);
            } else {
                const estimatedDuration = Math.min(
                    Math.max(responseText.length * 50, 2000),
                    10000
                );
                await this.simulateTyping(jid, estimatedDuration);
            }

            // Step 3: Mensagem será enviada pelo caller
            // (Aqui apenas retornamos sucesso)

            // Step 4: Marcar como lido
            await delay(500);
            await this.simulateTicks(m, true, isAudio);

            return true;
        } catch (error) {
            this.logger.error('❌ Erro ao simular resposta completa:', error.message);
            return false;
        }
    }

    /**
     * Calcula duração realista de digitação baseado no tamanho da resposta
     * Fórmula: 30-50ms por caractere, mínimo 1s, máximo 15s
     */
    calculateTypingDuration(text, minMs = 1000, maxMs = 15000) {
        const estimatedMs = Math.max(text.length * 40, minMs);
        return Math.min(estimatedMs, maxMs);
    }

    /**
     * Calcula duração realista de gravação de áudio
     * Fórmula: 100ms por 10 caracteres, mínimo 2s, máximo 10s
     */
    calculateRecordingDuration(text, minMs = 2000, maxMs = 10000) {
        const estimatedMs = Math.max((text.length / 10) * 100, minMs);
        return Math.min(estimatedMs, maxMs);
    }
}

export default PresenceSimulator;
