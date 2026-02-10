import fs from 'fs';
import path from 'path';

const files = [
    'd:/Disco/Programação/index-js2.1/modules/CommandHandler.js',
    'd:/Disco/Programação/index-js2.1/modules/GroupManagement.js',
    'd:/Disco/Programação/index-js2.1/modules/BotCore.js',
    'd:/Disco/Programação/index-js2.1/modules/ModerationSystem.js',
    'd:/Disco/Programação/index-js2.1/index.js'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`Processing ${file}...`);
        let content = fs.readFileSync(file, 'utf8');
        let original = content;

        // Fix property access duplications (e.g. .s.s -> .)
        content = content.replace(/\.([a-z])\.\1(?=[^a-z]|$)/gi, '.');
        content = content.replace(/\.([a-z])\.\1(?=[^a-z]|$)/gi, '.');

        // Specific patterns
        content = content.replace(/\.s\.s/g, '.');
        content = content.replace(/\.r\.r/g, '.');
        content = content.replace(/\.k\.k/g, '.');
        content = content.replace(/\.e\.e/g, '.');
        content = content.replace(/\.o\.o/g, '.');
        content = content.replace(/\.t\.t/g, '.');
        content = content.replace(/\.n\.n/g, '.');
        content = content.replace(/\.m\.m/g, '.');
        content = content.replace(/\.a\.a/g, '.');
        content = content.replace(/\.u\.u/g, '.');
        content = content.replace(/\.l\.l/g, '.');
        content = content.replace(/\.c\.c/g, '.');
        content = content.replace(/\.i\.i/g, '.');
        content = content.replace(/\.y\.y/g, '.');
        content = content.replace(/\.h\.h/g, '.');

        // Fix weird ' && .' pattern
        content = content.replace(/ && \./g, '.');

        // Fix trailing repetitions 
        content = content.replace(/([a-z])\.([a-z])\.\2\./g, '$1.');

        if (content !== original) {
            fs.writeFileSync(file, content);
            console.log(`Fixed ${file}`);
        } else {
            console.log(`No changes needed for ${file}`);
        }
    } else {
        console.log(`File not found: ${file}`);
    }
});
