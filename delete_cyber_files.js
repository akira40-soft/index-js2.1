<<<<<<< HEAD
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
=======
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
>>>>>>> bca33df3e80ad01e3a871bb67a7d0a8ff9a621a3
