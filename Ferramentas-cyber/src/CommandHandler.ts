/**
 * ═══════════════════════════════════════════════════════════════════════════
 * COMMAND HANDLER - FERRAMENTAS CYBER BOT
 * ═══════════════════════════════════════════════════════════════════════════
 * Handler de comandos simplificado para ferramentas de cybersecurity
 * ═══════════════════════════════════════════════════════════════════════════
 */

class CommandHandler {
    public sock: any;
    public config: any;
    public bot: any;

    constructor(sock: any, config: any, bot: any = null) {
        this.sock = sock;
        this.config = config;
        this.bot = bot;
    }

    public setSocket(sock: any): void {
        this.sock = sock;
    }

    public async handle(m: any, meta: any): Promise<boolean | void> {
        // meta: { nome, numeroReal, texto, replyInfo, ehGrupo }
        try {
            const { nome, numeroReal, texto, replyInfo, ehGrupo } = meta;

            // Extrai comando e argumentos
            const parsed = this.parseCommand(texto);
            if (!parsed) return false;

            const chatJid = m.key.remoteJid;
            const senderId = numeroReal;
            const command = parsed.comando.toLowerCase();
            const args = parsed.args;
            const fullArgs = parsed.textoCompleto;

            // Log de comando
            console.log(`[CMD] ${command} por ${nome} em ${chatJid}`);

            // Verifica permissões de dono
            const isOwner = this.config.isDono(senderId, nome);

            // VERIFICAÇÃO DE REGISTRO GLOBAL - APENAS NO PV, NÃO EM GRUPOS
            // Grupos permitem usuários não registrados usarem comandos
            const isReg = this.bot.registrationSystem.isRegistered(senderId);
            const publicCommands = ['registrar', 'register', 'reg', 'menu', 'help', 'ajuda', 'comandos', 'dono', 'owner', 'criador', 'creator', 'ping'];

            // Only require registration in private chats (PV), not in groups
            if (!isReg && !isOwner && !ehGrupo && !publicCommands.includes(command.toLowerCase())) {
                await this.bot.reply(m, '❌ *ACESSO NEGADO!*\n\nVocê precisa se registrar para usar os comandos do bot.\n\nUse: *#registrar SeuNome*');
                return true;
            }

            // Rate limiting
            if (!isOwner && this.bot?.rateLimiter) {
                const rateCheck = this.bot.rateLimiter.check(senderId, isOwner);
                if (!rateCheck?.allowed) {
                    await this.bot.reply(m, `⏳ Aguarde ${rateCheck?.wait || 1} minuto(s) antes de usar outro comando.`);
                    return true;
                }
            }

            // Dispatch command
            return await this.bot.handleCommand(m, command, args);

        } catch (error: any) {
            console.error('❌ Erro no CommandHandler:', error.message);
            return false;
        }
    }

    public parseCommand(text: string | null | undefined): any {
        if (!text) return null;
        const prefix = this.config.PREFIXO || '*';
        if (!text.startsWith(prefix)) return null;

        const args = text.slice(prefix.length).trim().split(/ +/);
        const comando = args.shift().toLowerCase();

        return {
            comando,
            args,
            textoCompleto: args.join(' ')
        };
    }
}

export default CommandHandler;
