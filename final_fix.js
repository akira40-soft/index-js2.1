import fs from 'fs';

const files = [
    'd:/Disco/Programação/index-js2.1/modules/CommandHandler.js',
    'd:/Disco/Programação/index-js2.1/modules/GroupManagement.js',
    'd:/Disco/Programação/index-js2.1/modules/BotCore.js'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`Finalizing ${file}...`);
        let content = fs.readFileSync(file, 'utf8');

        // Fix property access: word..word -> word.word
        // Run multiple times to handle ... -> . if spread operator is not matched (spread usually is ...args,space before dots?)
        // Spread operator: ...args -> dot dot dot word.
        // My regex (\w)\.\.(\w) only matches double dots between words. So ...args (space...args) wont match. 
        // But object...prop matches. 
        // Let's be safe.

        content = content.replace(/([a-zA-Z0-9_])\.\.([a-zA-Z0-9_])/g, '$1.$2');

        // Fix message.essage glitch
        // Loop to fix nested ones if any
        let prev;
        do {
            prev = content;
            content = content.replace(/message\.essage/g, 'message');
            content = content.replace(/extendedTextMessage\.extendedTextMessage/g, 'extendedTextMessage');
            content = content.replace(/contextInfo\.contextInfo/g, 'contextInfo');
        } while (content !== prev);

        // Fix weird text end
        content = content.replace(/([a-z])\.\.$/gm, '$1.');

        fs.writeFileSync(file, content);
    }
});
