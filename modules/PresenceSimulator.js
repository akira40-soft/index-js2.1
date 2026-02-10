/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRESENCE SIMULATOR - AKIRA BOT V21
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ Simulações realistas de presença e status de mensagem
 * ✅ Digitação, gravação de áudio, ticks, leitura
 * ✅ Totalmente compatível com Baileys
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { delay } from '@whiskeysockets/baileys';

class PresenceSimulator {
    constructor(sock) {
        this.sock = sock;
        this.logger = console;
    }

    /**
    * Simula digitação realista
    * @param {string} jid - ID do chat
    * @param {string} text - Texto que será "digitado" (para calcular tempo)
    */
    async simulateTyping(jid, text = '') {
        if (!jid) return;

        try {
            await this.sock.sendPresenceUpdate('composing', jid);

            // Tempo base + tempo por caractere
            // Média de digitação humana: ~300-400ms por caractere + pausas
            const baseTime = 1000;
            const timePerChar = 100; // Rápido, mas perceptível
            const maxTime = 15000; // Teto máximo

            let duration = baseTime + (text.length * timePerChar);
            if (duration > maxTime) duration = maxTime;

            await delay(duration);

            await this.sock.sendPresenceUpdate('paused', jid);
        } catch (e) {
            this.logger.warn(`Erro ao simular digitação em ${jid}:`, e.message);
        }
    }

    /**
    * Simula gravação de áudio
    * @param {string} jid - ID do chat
    * @param {number} durationMs - Duração da "gravação" em ms
    */
    async simulateRecording(jid, durationMs = 3000) {
        if (!jid) return;

        try {
            await this.sock.sendPresenceUpdate('recording', jid);
            await delay(durationMs);
            await this.sock.sendPresenceUpdate('paused', jid);
        } catch (e) {
            this.logger.warn(`Erro ao simular gravação em ${jid}:`, e.message);
        }
    }

    /**
    * Marca mensagem como lida (blue ticks)
    */
    async markAsRead(jid, messageKey) {
        if (!jid || !messageKey) return;

        try {
            await this.sock.readMessages([messageKey]);
        } catch (e) {
            this.logger.warn(`Erro ao marcar lida em ${jid}:`, e.message);
        }
    }
}

export default PresenceSimulator;
