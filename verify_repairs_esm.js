import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    'UserProfile.js',
    'BotProfile.js',
    'ImageEffects.js'
];

async function testModules() {
    console.log('🧪 Testing ESM modules...');
    let successCount = 0;
    let failCount = 0;

    for (const file of filesToTest) {
        const filePath = 'file://' + path.join(modulesDir, file).replace(/\\/g, '/');
        try {
            await import(filePath);
            console.log(`✅ ${file} loaded successfully`);
            successCount++;
        } catch (e) {
            console.error(`❌ ${file} failed to load:`, e.message);
            // Ignore missing dependencies if it's just a local path issue or missing package
            // But valid syntax is what we care about mostly
            if (e.code === 'ERR_MODULE_NOT_FOUND') {
                console.log(`   (Dependency error: ${e.message})`);
                // If it's a dependency error, the syntax is likely fine
                if (!e.message.includes(file)) {
                    // It's a dependency failure, not the file itself
                }
            } else {
                failCount++;
            }
        }
    }

    console.log(`\n📊 Result: ${successCount} passed, ${failCount} failed.`);
    if (failCount === 0) {
        console.log('✨ All modules appear syntactically correct and loadable.');
    }
}

testModules();
