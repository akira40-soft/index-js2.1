import fs from 'fs';
import path from 'path';
import ConfigManager from './ConfigManager.js';

class RegistrationSystem {
    constructor(logger = console) {
        this.config = ConfigManager.getInstance();
        this.logger = logger;

        // HF SPACES: Usar /tmp para garantir permissões de escrita
        const basePath = '/tmp/akira_data';
        this.dbPath = path.join(basePath, 'datauser', 'registered.json');

        this._ensureFiles();
        this.users = this._load(this.dbPath, []);
    }

    _ensureFiles() {
        try {
            if (!fs.existsSync(path.dirname(this.dbPath))) fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
            if (!fs.existsSync(this.dbPath)) fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2));
        } catch (e) {
            this.logger.warn('RegistrationSystem: erro ao garantir arquivos:', e.message);
        }
    }

    _load(p, fallback) {
        try {
            const raw = fs.readFileSync(p, 'utf8');
            return JSON.parse(raw || '[]');
        } catch (e) {
            return fallback;
        }
    }

    _save() {
        try { fs.writeFileSync(this.dbPath, JSON.stringify(this.users, null, 2)); } catch (e) { this.logger.warn('RegistrationSystem save erro:', e.message); }
    }

    registerUser(uid, name, age, serial) {
        const existing = this.users.find(u => u.id === uid);
        if (existing) {
            return { success: false, message: 'Usuário já registrado.' };
        }

        const newUser = {
            id: uid,
            name: name,
            age: age,
            serial: serial,
            date: new Date().toISOString(),
            platform: 'WhatsApp'
        };

        this.users.push(newUser);
        this._save();
        return { success: true, user: newUser };
    }

    isRegistered(uid) {
        return !!this.users.find(u => u.id === uid);
    }

    getUser(uid) {
        return this.users.find(u => u.id === uid);
    }

    unregisterUser(uid) {
        const index = this.users.findIndex(u => u.id === uid);
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
