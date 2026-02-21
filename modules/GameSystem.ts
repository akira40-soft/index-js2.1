/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GAME SYSTEM - JOGO DA VELHA (TIC-TAC-TOE)
 * ═══════════════════════════════════════════════════════════════════════════
 */

class GameSystem {
    private games: Map<string, any>;

    constructor() {
        this.games = new Map();
    }

    /**
     * Inicia ou processa jogada de Tic-Tac-Toe
     */
    public async handleTicTacToe(chatId: string, senderId: string, input: string, opponentId?: string): Promise<{ text: string, finished: boolean }> {
        let game = this.games.get(chatId);

        // Iniciar novo jogo
        if (input === 'start' || (!game && opponentId)) {
            if (game) {
                return { text: '⚠️ Já existe uma partida em andamento neste chat!', finished: false };
            }

            if (!opponentId) {
                return { text: '❌ Mencione alguém para jogar!', finished: false };
            }

            game = {
                board: Array(9).fill(null),
                players: [senderId, opponentId],
                turn: 0, // Índice do jogador atual (0 ou 1)
                symbols: ['❌', '⭕'],
                startTime: Date.now()
            };

            this.games.set(chatId, game);
            return {
                text: `🎮 *JOGO DA VELHA INICIADO!*\n\n` +
                    `❌: @${senderId.split('@')[0]}\n` +
                    `⭕: @${opponentId.split('@')[0]}\n\n` +
                    `${this.renderBoard(game.board)}\n\n` +
                    `Vez de: @${game.players[game.turn].split('@')[0]}\n` +
                    `Digite o número (1-9) para jogar.`,
                finished: false
            };
        }

        if (!game) {
            return { text: '❌ Nenhuma partida ativa. Use #ttt @user para começar.', finished: false };
        }

        // Verificar se é a vez do jogador
        if (senderId !== game.players[game.turn]) {
            return { text: '⏳ Aguarde sua vez!', finished: false };
        }

        const move = parseInt(input) - 1;
        if (isNaN(move) || move < 0 || move > 8 || game.board[move] !== null) {
            return { text: '❌ Jogada inválida! Escolha um número de 1 a 9 que esteja livre.', finished: false };
        }

        // Executar jogada
        game.board[move] = game.symbols[game.turn];

        // Verificar vitória
        if (this.checkWinner(game.board)) {
            const winner = game.players[game.turn];
            this.games.delete(chatId);
            return {
                text: `🎉 *VITÓRIA!*\n\n` +
                    `${this.renderBoard(game.board)}\n\n` +
                    `O jogador @${winner.split('@')[0]} venceu a partida! 🏆`,
                finished: true
            };
        }

        // Verificar empate (Velha)
        if (game.board.every((cell: any) => cell !== null)) {
            this.games.delete(chatId);
            return {
                text: `👵 *DEU VELHA (EMPATE)!*\n\n` +
                    `${this.renderBoard(game.board)}\n\n` +
                    `Ninguém venceu desta vez.`,
                finished: true
            };
        }

        // Trocar turno
        game.turn = game.turn === 0 ? 1 : 0;
        return {
            text: `🎮 *JOGO DA VELHA*\n\n` +
                `${this.renderBoard(game.board)}\n\n` +
                `Vez de: @${game.players[game.turn].split('@')[0]}`,
            finished: false
        };
    }

    private renderBoard(board: any[]): string {
        const b = board.map((cell, i) => cell || (i + 1).toString());
        return `     ${b[0]} | ${b[1]} | ${b[2]}\n` +
            `    ---+---+---\n` +
            `     ${b[3]} | ${b[4]} | ${b[5]}\n` +
            `    ---+---+---\n` +
            `     ${b[6]} | ${b[7]} | ${b[8]}`;
    }

    private checkWinner(board: any[]): boolean {
        const wins = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontais
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Verticais
            [0, 4, 8], [2, 4, 6]             // Diagonais
        ];
        return wins.some(combo => {
            return board[combo[0]] !== null &&
                board[combo[0]] === board[combo[1]] &&
                board[combo[1]] === board[combo[2]];
        });
    }

    public forceStop(chatId: string): boolean {
        return this.games.delete(chatId);
    }
}

export default new GameSystem();
