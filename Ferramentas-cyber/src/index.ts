/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FERRAMENTAS CYBER BOT - MAIN ENTRY POINT
 * ═══════════════════════════════════════════════════════════════════════════
 * Independent WhatsApp bot for cybersecurity tools
 * Separate from main Akira bot
 * ═══════════════════════════════════════════════════════════════════════════
 */

import CyberBotCore from './BotCore.js';
import ConfigManager from './ConfigManager.js';

async function main() {
    try {
        console.log('\n' + '═'.repeat(70));
        console.log('🛡️ INICIANDO FERRAMENTAS CYBER BOT');
        console.log('═'.repeat(70) + '\n');

        // Initialize configuration
        const config = ConfigManager.getInstance();
        config.logConfig();

        // Initialize bot
        const bot = new CyberBotCore();

        // Handle QR code generation
        bot.eventListeners.onQRGenerated = (qr: string) => {
            console.log('\n📱 QR CODE GERADO!');
            console.log('Escaneie com WhatsApp para conectar o bot de ferramentas cyber');
            console.log('QR Code disponível em: http://localhost:' + config.PORT + '/qr\n');
        };

        // Handle connection
        bot.eventListeners.onConnected = (jid: string) => {
            console.log('✅ BOT DE FERRAMENTAS CYBER CONECTADO!');
            console.log(`🤖 JID: ${jid}`);
            console.log('\n📋 COMANDOS DISPONÍVEIS:');
            console.log('• #menu - Menu principal');
            console.log('• #menucyber - Ferramentas de pentesting');
            console.log('• #menuosint - Ferramentas OSINT');
            console.log('• #nmap <target> - Scanner de portas');
            console.log('• #sqlmap <url> - Teste SQL injection');
            console.log('• #email <email> - Verificar vazamentos');
            console.log('• #phone <number> - Lookup telefone');
            console.log('• #geo <ip> - Geolocalização IP');
            console.log('\n⚠️  ATENÇÃO: Use apenas em ambientes autorizados!');
            console.log('O uso indevido pode ser ilegal.\n');
        };

        // Handle disconnection
        bot.eventListeners.onDisconnected = (reason: any) => {
            console.log('🔴 BOT DE FERRAMENTAS CYBER DESCONECTADO:', reason);
        };

        // Start bot
        await bot.start();

    } catch (error: any) {
        console.error('❌ ERRO FATAL:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔴 Recebido SIGINT. Encerrando bot de ferramentas cyber...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🔴 Recebido SIGTERM. Encerrando bot de ferramentas cyber...');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
    console.error('❌ ERRO NÃO TRATADO:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
    console.error('❌ PROMISE REJEITADA:', reason);
    process.exit(1);
});

// Start the bot
main().catch(error => {
    console.error('❌ ERRO AO INICIAR:', error);
    process.exit(1);
});
