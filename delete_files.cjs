const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'modules');

const filesToDelete = [
    'AdvancedPentestingToolkit.ts',
    'CybersecurityToolkit.ts', 
    'OSINTFramework.ts',
    'SecurityLogger.ts'
];

filesToDelete.forEach(file => {
    const filePath = path.join(modulesDir, file);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Deleted: ${file}`);
    } else {
        console.log(`⚠️ Not found: ${file}`);
    }
});

console.log('Done!');
