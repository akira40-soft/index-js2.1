const fs = require('fs');
const path = require('path');

const modulesDir = 'd:/Disco/Programação/index-js2.1/modules';
const filesToTest = [
    'AdvancedPentestingToolkit.js',
    'CybersecurityToolkit.js',
    'OSINTFramework.js',
    'PresenceSimulator.js',
    'RateLimiter.js',
    'SubscriptionManager.js',
    'SecurityLogger.js',
    'LevelSystem.js',
    'GroupManagement.js',
    // These are ES modules so we can't require them easily in this CJS script without dynamic import
    // 'UserProfile.js', 
    // 'BotProfile.js',
    // 'ImageEffects.js' 
];

const esModulesToTest = [
    'UserProfile.js',
    'BotProfile.js',
    'ImageEffects.js'
];

async function testModules() {
    console.log('🧪 Testing CommonJS modules...');
    for (const file of filesToTest) {
        const filePath = path.join(modulesDir, file);
        try {
            require(filePath);
            console.log(`✅ ${file} loaded successfully`);
        } catch (e) {
            console.error(`❌ ${file} failed to load:`, e.message);
            // Ignore missing dependencies (like nmap, etc) as we just want to check syntax
            if (e.code === 'MODULE_NOT_FOUND' && !e.message.includes(file)) {
                console.log(`   (Ignored dependency error: ${e.message})`);
            }
        }
    }

    console.log('\n🧪 Testing ES modules...');
    for (const file of esModulesToTest) {
        const filePath = 'file://' + path.join(modulesDir, file).replace(/\\/g, '/');
        try {
            await import(filePath);
            console.log(`✅ ${file} loaded successfully`);
        } catch (e) {
            console.error(`❌ ${file} failed to load:`, e.message);
            if (e.code === 'ERR_MODULE_NOT_FOUND') {
                console.log(`   (Ignored dependency error: ${e.message})`);
            }
        }
    }
}

testModules();
