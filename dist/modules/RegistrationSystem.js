import fs from 'fs';
import path from 'path';
import ConfigManager from './ConfigManager.js';
import JidUtils from './JidUtils.js';
class RegistrationSystem {
    static instance;
    config;
    logger;
    dbPath;
    users;
    constructor(logger = console) {
        this.config = ConfigManager.getInstance();
        this.logger = logger;
        // HF SPACES: Usar /tmp para garantir permissões de escrita, ou DATABASE_FOLDER local
        const basePath = this.config.DATABASE_FOLDER || './database';
        this.dbPath = path.join(basePath, 'datauser', 'registered.json');
        this._ensureFiles();
        this.users = this._load(this.dbPath, []);
    }
    static getInstance(logger = console) {
        if (!RegistrationSystem.instance) {
            RegistrationSystem.instance = new RegistrationSystem(logger);
        }
        return RegistrationSystem.instance;
    }
    _ensureFiles() {
        try {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(this.dbPath))
                fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2));
        }
        catch (e) {
            this.logger.warn('RegistrationSystem: erro ao garantir arquivos:', e.message);
        }
    }
    _load(p, fallback) {
        try {
            const raw = fs.readFileSync(p, 'utf8');
            let loaded = JSON.parse(raw || '[]');
            // ═══════════════════════════════════════════════════════════════════
            // MIGRATION: JID -> NUMERIC ID (Digits Only)
            // ═══════════════════════════════════════════════════════════════════
            if (Array.isArray(loaded)) {
                let migratedCount = 0;
                loaded = loaded.map(u => {
                    const numericId = JidUtils.toNumeric(u.id);
                    if (u.id !== numericId) {
                        u.id = numericId;
                        migratedCount++;
                    }
                    return u;
                });
                if (migratedCount > 0) {
                    this.logger.info(`✨ [RegistrationSystem] Migrados ${migratedCount} registros para ID Numérico.`);
                    this.users = loaded;
                    this._save();
                }
            }
            return loaded;
        }
        catch (e) {
            return fallback;
        }
    }
    _save() {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.users, null, 2));
        }
        catch (e) {
            this.logger.warn('RegistrationSystem save erro:', e.message);
        }
    }
    /**
     * Generate a unique serial number
     */
    generateSerial() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let serial = '';
        for (let i = 0; i < 8; i++) {
            serial += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return serial;
    }
    /**
     * Generate a unique link for the user
     */
    generateLink(serial) {
        return `https://wa.me/${serial}`;
    }
    /**
     * Register a new user (alias for registerUser for compatibility)
     * Auto-generates serial if not provided
     */
    register(uid, name, age, serial) {
        return this.registerUser(uid, name, age, serial);
    }
    registerUser(uid, name, age, serial) {
        const numericId = JidUtils.toNumeric(uid);
        const existing = this.users.find(u => JidUtils.toNumeric(u.id) === numericId);
        if (existing) {
            return { success: false, message: 'Usuário já registrado.' };
        }
        // Auto-generate serial if not provided
        const userSerial = serial || this.generateSerial();
        const userLink = this.generateLink(userSerial);
        const now = new Date().toISOString();
        const newUser = {
            id: numericId,
            name: name,
            age: age,
            serial: userSerial,
            link: userLink,
            registeredAt: now,
            date: now,
            platform: 'WhatsApp'
        };
        this.users.push(newUser);
        this._save();
        return { success: true, user: newUser, link: userLink };
    }
    /**
     * Get user profile (alias for getUser for compatibility)
     */
    getProfile(uid) {
        return this.getUser(uid);
    }
    isRegistered(uid) {
        const numericId = JidUtils.toNumeric(uid);
        return !!this.users.find(u => JidUtils.toNumeric(u.id) === numericId);
    }
    getUser(uid) {
        const numericId = JidUtils.toNumeric(uid);
        return this.users.find(u => JidUtils.toNumeric(u.id) === numericId);
    }
    unregisterUser(uid) {
        const numericId = JidUtils.toNumeric(uid);
        const index = this.users.findIndex(u => JidUtils.toNumeric(u.id) === numericId);
        if (index > -1) {
            this.users.splice(index, 1);
            this._save();
            return true;
        }
        return false;
    }
    getTotalUsers() {
        return this.users.length;
    }
}
export default RegistrationSystem;
