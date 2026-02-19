import fs from 'fs';
import path from 'path';
import ConfigManager from './ConfigManager.js';

interface RegisteredUser {
    id: string;
    name: string;
    age: number;
    serial: string;
    date: string;
    platform: string;
}

class RegistrationSystem {
    private config: any;
    private logger: any;
    private dbPath: string;
    private users: RegisteredUser[];

    constructor(logger = console) {
        this.config = ConfigManager.getInstance();
        this.logger = logger;

        // HF SPACES: Usar /tmp para garantir permissões de escrita, ou DATABASE_FOLDER local
        const basePath = this.config.DATABASE_FOLDER || './database';
        this.dbPath = path.join(basePath, 'datauser', 'registered.json');

        this._ensureFiles();
        this.users = this._load(this.dbPath, []);
    }

    private _ensureFiles(): void {
        try {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(this.dbPath)) fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2));
        } catch (e: any) {
            this.logger.warn('RegistrationSystem: erro ao garantir arquivos:', e.message);
        }
    }

    private _load(p: string, fallback: any[]): RegisteredUser[] {
        try {
            const raw = fs.readFileSync(p, 'utf8');
            return JSON.parse(raw || '[]');
        } catch (e) {
            return fallback;
        }
    }

    private _save(): void {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.users, null, 2));
        } catch (e: any) {
            this.logger.warn('RegistrationSystem save erro:', e.message);
        }
    }

    public registerUser(uid: string, name: string, age: number, serial: string): { success: boolean; message?: string; user?: RegisteredUser } {
        const existing = this.users.find(u => u.id === uid);
        if (existing) {
            return { success: false, message: 'Usuário já registrado.' };
        }

        const newUser: RegisteredUser = {
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

    public isRegistered(uid: string): boolean {
        // Normaliza UID para multi-device
        const normalizedUid = uid.split(':')[0] + (uid.includes('@') ? '' : '@s.whatsapp.net');
        return !!this.users.find(u => u.id.split(':')[0] === normalizedUid.split(':')[0]);
    }

    public getUser(uid: string): RegisteredUser | undefined {
        const normalizedUid = uid.split(':')[0];
        return this.users.find(u => u.id.split(':')[0] === normalizedUid);
    }

    public unregisterUser(uid: string): boolean {
        const normalizedUid = uid.split(':')[0];
        const index = this.users.findIndex(u => u.id.split(':')[0] === normalizedUid);
        if (index > -1) {
            this.users.splice(index, 1);
            this._save();
            return true;
        }
        return false;
    }

    public getTotalUsers(): number {
        return this.users.length;
    }
}

export default RegistrationSystem;
