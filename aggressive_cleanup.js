import fs from 'fs';

const files = [
    'd:/Disco/Programação/index-js2.1/modules/CommandHandler.js',
    'd:/Disco/Programação/index-js2.1/modules/GroupManagement.js',
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`Aggressive cleaning ${file}...`);
        let content = fs.readFileSync(file, 'utf8');
        let original = content;

        // Fix: JSON && N && N -> JSON
        // Regex: palavra espaço && espaço letra espaço && espaço letra
        content = content.replace(/(\w+) && [A-Z] && [A-Z]/g, '$1');

        // Fix: array access parts[0] && 0] && 0] -> parts[0]
        // Regex: ] && \d] && \d] -> ]
        content = content.replace(/] && \d] && \d]/g, ']');

        // Fix: object access toggles[gid] && d] && d] -> toggles[gid]
        // Regex: ] && [a-z]] && [a-z]] -> ]
        // Note: the pattern seen was toggles[gid] && d] && d]  Wait, view_file showed: toggles[gid] && d] && d].levelingEnabled
        // So pattern is: ] && [letter]] && [letter]] OR ] && [letter] && [letter] ?
        // Line 651: delete toggles[gid] && d] && d].levelingEnabled;
        content = content.replace(/] && [a-z]]? && [a-z]]?/g, ']');

        // Fix: text garbage "ganham mais XP && P && P." -> "ganham mais XP."
        content = content.replace(/ && [A-Z] && [A-Z]\./g, '.');
        content = content.replace(/ && [A-Z] && [A-Z]/g, ''); // General case inside strings?

        // Fix: "status do group && p && p"
        content = content.replace(/ && [a-z] && [a-z]/g, '');

        if (content !== original) {
            fs.writeFileSync(file, content);
            console.log(`Fixed ${file}`);
        } else {
            console.log(`No changes needed for ${file}`);
        }
    }
});
