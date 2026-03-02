const fs = require('fs');
const path = require('path');

const filesToDelete = [
    'modules/AdvancedPentestingToolkit.ts',
    'modules/CybersecurityToolkit.ts',
    'modules/OSINTFramework.ts',
    'modules/SecurityLogger.ts'
];

filesToDelete.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Deleted: ${file}`);
    } else {
        console.log(`Not found: ${file}`);
    }
});

console.log('Done!');
