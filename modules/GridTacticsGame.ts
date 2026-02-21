/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GRID TACTICS - JOGO HÍBRIDO ÚNICO
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * CONCEITO: Mistura de Jogo da Velha + Xadrez + Sudoku
 * 
 * REGRAS DO JOGO:
 * 
 * 1. TABULEIRO:
 *    - Grade 4x4 com números de 1-4
 *    - Cada célula pode ter um número (1-4) ou estar vazia
 * 
 * 2. OBJETIVO:
 *    - Formar uma linha (horizontal, vertical ou diagonal) com números iguais
 *    - Ou completar um padrão específico como no Sudoku
 * 
 * 3. COMO JOGAR:
 *    - Cada jogador coloca um número (1-4) em uma célula vazia
 *    - Não pode colocar o mesmo número que o oponente colocou na última jogada
 *    - Não pode colocar o mesmo número em linha completa (estratégia!)
 * 
 * 4. RESTRIÇÕES (como Sudoku):
 *    - Não pode ter números repetidos na mesma LINHA
 *    - Não pode ter números repetidos na mesma COLUNA
 *    - Não pode ter números repetidos no mesmo BLOCO 2x2
 * 
 * 5. COMO GANHAR:
 *    - Primeiro a formar 4 em linha (como Jogo da Velha)
 *    - Ou forçar o oponente a fazer jogada inválida
 *    - Ou ter mais linhas completas no final
 * 
 * 6. DIFICULDADE IA:
 *    - Nível Fácil: Escolhe aleatoriamente
 *    - Nível Médio: Tenta ganhar ou bloquear
 *    - Nível Difícil: Analisa todas as possibilidades (Minimax)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

class GridTacticsGame {
    private games: Map<string, any>;
    
    // Símbolos para os jogadores (números diferentes para cada um)
    private PLAYER_1_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣']; // Jogador 1
    private PLAYER_2_NUMBERS = ['①', '②', '③', '④'];   // Jogador 2 (IA ou Player 2)
    
    constructor() {
        this.games = new Map();
    }

    /**
     * Inicia um novo jogo GRID TACTICS
     */
    public createGame(chatId: string, player1: string, player2: string | null, difficulty: string = 'medio'): any {
        const gameKey = `${chatId}_gridtactics`;
        
        // Se não houver player2, é modo IA
        const isAIMode = !player2;
        const aiPlayer = isAIMode ? 'akira-ai@akira.bot' : player2;
        
        const game: {
            type: string;
            board: (string | null)[];
            players: string[];
            turn: number;
            isAIMode: boolean;
            difficulty: string;
            lastMoves: Array<{row: number; col: number; number: string; player: number}>;
            scores: { player1: number; player2: number };
            startTime: number;
            lastActivity: number;
            moveHistory: Array<{row: number; col: number; number: string; player: number}>;
        } = {
            type: 'gridtactics',
            board: Array(16).fill(null),
            players: [player1, aiPlayer],
            turn: 0,
            isAIMode: isAIMode,
            difficulty: difficulty,
            lastMoves: [],
            scores: { player1: 0, player2: 0 },
            startTime: Date.now(),
            lastActivity: Date.now(),
            moveHistory: []
        };
        
        this.games.set(gameKey, game);
        return game;
    }

    /**
     * Renderiza o tabuleiro 4x4
     */
    public renderBoard(board: any[]): string {
        let display = '';
        
        // Cabeçalho com números de coluna
        display += '    ①  ②  ③  ④\n';
        display += '  ┌────┬────┬────┬────┐\n';
        
        for (let row = 0; row < 4; row++) {
            display += ` ${row + 1} │`;
            
            for (let col = 0; col < 4; col++) {
                const index = row * 4 + col;
                const cell = board[index];
                
                if (cell === null) {
                    display += ' ⬜ │';
                } else if (typeof cell === 'object') {
                    display += ` ${cell.symbol} │`;
                } else {
                    display += ` ${cell} │`;
                }
            }
            
            display += '\n';
            
            if (row < 3) {
                display += '  ├────┼────┼────┼────┤\n';
            }
        }
        
        display += '  └────┴────┴────┴────┘';
        
        return display;
    }

    /**
     * Valida se uma jogada é válida
     * Verifica as regras do Sudoku (não repetição em linha, coluna, bloco)
     */
    public validateMove(board: any[], row: number, col: number, number: string, playerIndex: number): { valid: boolean, reason: string } {
        const index = row * 4 + col;
        
        // 1. Verificar se a célula está vazia
        if (board[index] !== null) {
            return { valid: false, reason: 'Célula já ocupada!' };
        }
        
        // 2. Verificar se o número é válido (1-4)
        if (!['1', '2', '3', '4'].includes(number)) {
            return { valid: false, reason: 'Número inválido! Use 1, 2, 3 ou 4.' };
        }
        
        // Obter símbolo do jogador
        const symbols = playerIndex === 0 ? this.PLAYER_1_NUMBERS : this.PLAYER_2_NUMBERS;
        const symbol = symbols[parseInt(number) - 1];
        
        // 3. Verificar Sudoku: não repetição na LINHA
        for (let c = 0; c < 4; c++) {
            const idx = row * 4 + c;
            if (board[idx] !== null) {
                const cellValue = typeof board[idx] === 'object' ? board[idx].number : board[idx];
                if (cellValue === number) {
                    return { valid: false, reason: `Não pode! Número ${number} já usado nesta linha!` };
                }
            }
        }
        
        // 4. Verificar Sudoku: não repetição na COLUNA
        for (let r = 0; r < 4; r++) {
            const idx = r * 4 + col;
            if (board[idx] !== null) {
                const cellValue = typeof board[idx] === 'object' ? board[idx].number : board[idx];
                if (cellValue === number) {
                    return { valid: false, reason: `Não pode! Número ${number} já usado nesta coluna!` };
                }
            }
        }
        
        // 5. Verificar Sudoku: não repetição no BLOCO 2x2
        const blockRow = Math.floor(row / 2) * 2;
        const blockCol = Math.floor(col / 2) * 2;
        
        for (let r = blockRow; r < blockRow + 2; r++) {
            for (let c = blockCol; c < blockCol + 2; c++) {
                const idx = r * 4 + c;
                if (board[idx] !== null) {
                    const cellValue = typeof board[idx] === 'object' ? board[idx].number : board[idx];
                    if (cellValue === number) {
                        return { valid: false, reason: `Não pode! Número ${number} já usado neste bloco 2x2!` };
                    }
                }
            }
        }
        
        return { valid: true, reason: 'Jogada válida!' };
    }

    /**
     * Verifica se há um vencedor
     * Verifica todas as linhas, colunas e diagonais
     */
    public checkWinner(board: any[]): { winner: number | null, pattern: string } {
        // Verificar linhas horizontais
        for (let row = 0; row < 4; row++) {
            const indices = [row * 4, row * 4 + 1, row * 4 + 2, row * 4 + 3];
            const result = this.checkLine(board, indices);
            if (result.winner !== null) return result;
        }
        
        // Verificar colunas verticais
        for (let col = 0; col < 4; col++) {
            const indices = [col, col + 4, col + 8, col + 12];
            const result = this.checkLine(board, indices);
            if (result.winner !== null) return result;
        }
        
        // Verificar diagonais
        const diag1 = [0, 5, 10, 15]; // Diagonal principal
        const result1 = this.checkLine(board, diag1);
        if (result1.winner !== null) return result1;
        
        const diag2 = [3, 6, 9, 12]; // Diagonal secundária
        const result2 = this.checkLine(board, diag2);
        if (result2.winner !== null) return result2;
        
        return { winner: null, pattern: '' };
    }

    /**
     * Verifica uma linha específica (horizontal, vertical ou diagonal)
     */
    private checkLine(board: any[], indices: number[]): { winner: number | null, pattern: string } {
        const values = indices.map(i => board[i]);
        
        // Verificar se todas as células estão preenchidas
        if (values.some(v => v === null)) {
            return { winner: null, pattern: '' };
        }
        
        // Extrair números
        const numbers = values.map(v => typeof v === 'object' ? v.number : v);
        
        // Verificar se todos os números são iguais (vitória)
        if (numbers.every(n => n === numbers[0])) {
            const firstCell = values[0];
            const winner = typeof firstCell === 'object' ? firstCell.player : null;
            return { winner, pattern: 'line' };
        }
        
        // Verificar progressão aritmética (estratégia adicional)
        // 1,2,3,4 ou 4,3,2,1
        const numArray = numbers.map(n => parseInt(n)).sort((a, b) => a - b);
        if (numArray[0] === 1 && numArray[1] === 2 && numArray[2] === 3 && numArray[3] === 4) {
            // Progressão 1-2-3-4 dá ponto extra!
            const firstCell = values[0];
            const winner = typeof firstCell === 'object' ? firstCell.player : null;
            return { winner, pattern: 'sequence' };
        }
        
        return { winner: null, pattern: '' };
    }

    /**
     * Conta linhas completas de cada jogador
     */
    public countLines(board: any[]): { player1: number, player2: number } {
        let player1Lines = 0;
        let player2Lines = 0;
        
        // Linhas horizontais
        for (let row = 0; row < 4; row++) {
            const indices = [row * 4, row * 4 + 1, row * 4 + 2, row * 4 + 3];
            const { winner } = this.checkLine(board, indices);
            if (winner === 0) player1Lines++;
            else if (winner === 1) player2Lines++;
        }
        
        // Colunas
        for (let col = 0; col < 4; col++) {
            const indices = [col, col + 4, col + 8, col + 12];
            const { winner } = this.checkLine(board, indices);
            if (winner === 0) player1Lines++;
            else if (winner === 1) player2Lines++;
        }
        
        // Diagonais
        const diag1 = [0, 5, 10, 15];
        const { winner: w1 } = this.checkLine(board, diag1);
        if (w1 === 0) player1Lines++;
        else if (w1 === 1) player2Lines++;
        
        const diag2 = [3, 6, 9, 12];
        const { winner: w2 } = this.checkLine(board, diag2);
        if (w2 === 0) player1Lines++;
        else if (w2 === 1) player2Lines++;
        
        return { player1: player1Lines, player2: player2Lines };
    }

    /**
     * Calcula a melhor jogada da IA
     */
    public calculateAIMove(board: any[], difficulty: string): number {
        const availableMoves: number[] = [];
        
        // Encontrar todas as células vazias
        for (let i = 0; i < 16; i++) {
            if (board[i] === null) availableMoves.push(i);
        }
        
        if (availableMoves.length === 0) return -1;
        
        // DIFICULDADE: FÁCIL - Escolha aleatória
        if (difficulty === 'facil') {
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }
        
        // DIFICULDADE: MÉDIO - Tenta ganhar ou bloquear
        if (difficulty === 'medio') {
            // 1. Tentar ganhar
            for (const move of availableMoves) {
                for (const num of ['1', '2', '3', '4']) {
                    const testBoard = [...board];
                    testBoard[move] = { number: num, player: 1, symbol: this.PLAYER_2_NUMBERS[parseInt(num) - 1] };
                    const { winner } = this.checkWinner(testBoard);
                    if (winner === 1) return move;
                }
            }
            
            // 2. Bloquear vitória do oponente
            for (const move of availableMoves) {
                for (const num of ['1', '2', '3', '4']) {
                    const testBoard = [...board];
                    testBoard[move] = { number: num, player: 0, symbol: this.PLAYER_1_NUMBERS[parseInt(num) - 1] };
                    const { winner } = this.checkWinner(testBoard);
                    if (winner === 0) return move;
                }
            }
            
            // 3. Jogar no centro se disponível
            const centers = [5, 6, 9, 10];
            const availableCenters = centers.filter(c => board[c] === null);
            if (availableCenters.length > 0) {
                return availableCenters[Math.floor(Math.random() * availableCenters.length)];
            }
            
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }
        
        // DIFICULDADE: DIFÍCIL - Minimax (análise completa)
        if (difficulty === 'dificil') {
            let bestScore = -Infinity;
            let bestMove = availableMoves[0];
            
            for (const move of availableMoves) {
                for (const num of ['1', '2', '3', '4']) {
                    const testBoard = [...board];
                    
                    // Verificar se a jogada é válida
                    const row = Math.floor(move / 4);
                    const col = move % 4;
                    const validation = this.validateMove(board, row, col, num, 1);
                    
                    if (!validation.valid) continue;
                    
                    testBoard[move] = { number: num, player: 1, symbol: this.PLAYER_2_NUMBERS[parseInt(num) - 1] };
                    
                    const score = this.minimax(testBoard, 4, false, -Infinity, Infinity);
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = move;
                    }
                }
            }
            
            return bestMove;
        }
        
        // Padrão: aléatório
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    /**
     * Algoritmo Minimax para IA difícil
     */
    private minimax(board: any[], depth: number, isMaximizing: boolean, alpha: number, beta: number): number {
        const { winner } = this.checkWinner(board);
        
        if (winner === 1) return 100 + depth; // IA ganha
        if (winner === 0) return -100 - depth; // Humano ganha
        
        // Verificar se há mais jogadas disponíveis
        const availableMoves: number[] = [];
        for (let i = 0; i < 16; i++) {
            if (board[i] === null) availableMoves.push(i);
        }
        
        if (availableMoves.length === 0 || depth <= 0) {
            const lines = this.countLines(board);
            return lines.player2 - lines.player1;
        }
        
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of availableMoves) {
                for (const num of ['1', '2', '3', '4']) {
                    const testBoard = [...board];
                    const row = Math.floor(move / 4);
                    const col = move % 4;
                    const validation = this.validateMove(board, row, col, num, 1);
                    
                    if (!validation.valid) continue;
                    
                    testBoard[move] = { number: num, player: 1, symbol: this.PLAYER_2_NUMBERS[parseInt(num) - 1] };
                    const evaluation = this.minimax(testBoard, depth - 1, false, alpha, beta);
                    maxEval = Math.max(maxEval, evaluation);
                    alpha = Math.max(alpha, evaluation);
                    if (beta <= alpha) break;
                }
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of availableMoves) {
                for (const num of ['1', '2', '3', '4']) {
                    const testBoard = [...board];
                    const row = Math.floor(move / 4);
                    const col = move % 4;
                    const validation = this.validateMove(board, row, col, num, 0);
                    
                    if (!validation.valid) continue;
                    
                    testBoard[move] = { number: num, player: 0, symbol: this.PLAYER_1_NUMBERS[parseInt(num) - 1] };
                    const evaluation = this.minimax(testBoard, depth - 1, true, alpha, beta);
                    minEval = Math.min(minEval, evaluation);
                    beta = Math.min(beta, evaluation);
                    if (beta <= alpha) break;
                }
            }
            return minEval;
        }
    }

    /**
     * Retorna mensagem de ajuda do jogo
     */
    public getHelpMessage(): string {
        return `
🎯 *GRID TACTICS* - Jogo Híbrido

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *COMO JOGAR:*

1️⃣ Tabuleiro 4x4 com números 1-4
2️⃣ Cada jogador coloca um número em célula vazia
3️⃣ Objetivo: Formar 4 em linha!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *REGRAS (como Sudoku):*

• Não use o mesmo número na mesma LINHA
• Não use o mesmo número na mesma COLUNA  
• Não use o mesmo número no mesmo BLOCO 2x2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 *COMO GANHAR:*

• Forme 4 números iguais em linha (↔↕↘↙)
• Complete mais linhas que o oponente
• Force o oponente a fazer jogada inválida

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 *COMANDOS:*

• #gridtactics start - Iniciar jogo
• #gridtactics start facil - IA fácil
• #gridtactics start medio - IA média
• #gridtactics start dificil - IA difícil
• #gridtactics 1 2 - Colocar número 1 na posição 2
• #gridtactics help - Ver regras

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *DICA:*
Números em sequência (1-2-3-4) dão ponto extra!
`;
    }

    /**
     * Obtém o jogo atual
     */
    public getGame(chatId: string): any {
        return this.games.get(`${chatId}_gridtactics`);
    }

    /**
     * Remove o jogo
     */
    public deleteGame(chatId: string): boolean {
        return this.games.delete(`${chatId}_gridtactics`);
    }
}

export default new GridTacticsGame();
