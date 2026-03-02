<<<<<<< HEAD
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
=======
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
>>>>>>> bca33df3e80ad01e3a871bb67a7d0a8ff9a621a3
