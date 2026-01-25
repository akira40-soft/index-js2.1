const fs = require('fs');
const path = require('path');
const ConfigManager = require('./ConfigManager');

class LevelSystem {
  constructor(logger = console) {
    this.config = ConfigManager.getInstance();
    this.logger = logger;
    this.dbPath = path.join(this.config.DATABASE_FOLDER, 'data', 'group_levels.json');
    this.promoPath = path.join(this.config.DATABASE_FOLDER, 'datauser', 'level_adm_promotion.json');
    this._ensureFiles();
    this.data = this._load(this.dbPath, []);
    this.promos = this._load(this.promoPath, {});
    this.windowDays = this.config.LEVEL_WINDOW_DAYS || 3;
    this.maxLevel = this.config.LEVEL_MAX || 60; // agora 60 níveis por padrão
    this.topForAdm = this.config.LEVEL_TOP_FOR_ADM || 3;
  }

  _ensureFiles() {
    try {
      if (!fs.existsSync(path.dirname(this.dbPath))) fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      if (!fs.existsSync(path.dirname(this.promoPath))) fs.mkdirSync(path.dirname(this.promoPath), { recursive: true });
      if (!fs.existsSync(this.dbPath)) fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2));
      if (!fs.existsSync(this.promoPath)) fs.writeFileSync(this.promoPath, JSON.stringify({}, null, 2));
    } catch (e) {
      this.logger.warn('LevelSystem: erro ao garantir arquivos:', e.message);
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

  _save(p, obj) {
    try { fs.writeFileSync(p, JSON.stringify(obj, null, 2)); } catch (e) { this.logger.warn('LevelSystem save erro:', e.message); }
  }

  getGroupRecord(gid, uid, createIfMissing = false) {
    const rec = this.data.find(r => r.gid === gid && r.uid === uid);
    if (rec) return rec;
    if (createIfMissing) {
      const n = { gid, uid, level: 0, xp: 0 };
      this.data.push(n);
      this._save(this.dbPath, this.data);
      return n;
    }
    return { gid, uid, level: 0, xp: 0 };
  }

  saveRecord(rec) {
    const i = this.data.findIndex(r => r.gid === rec.gid && r.uid === rec.uid);
    if (i === -1) this.data.push(rec); else this.data[i] = rec;
    this._save(this.dbPath, this.data);
  }

  // Fórmula: cada nível requer o dobro do anterior -> base * (2^level)
  // Ex.: level 0 -> base, level 1 -> base*2, level 2 -> base*4, ...
  requiredXp(level) {
    const base = this.config.LEVEL_BASE_XP || 100;
    const factor = 2; // crescimento x2 por nível
    if (level >= this.maxLevel) return Infinity;
    return Math.floor(base * Math.pow(factor, level));
  }

  awardXp(gid, uid, xpAmount = 10) {
    const rec = this.getGroupRecord(gid, uid, true);
    rec.xp = (rec.xp || 0) + xpAmount;
    let leveled = false;

    // Permitir múltiplos level-ups se receber muito XP de uma vez
    while (rec.level < this.maxLevel) {
      const req = this.requiredXp(rec.level || 0);
      if (!isFinite(req)) break;
      if (rec.xp >= req) {
        rec.xp = rec.xp - req; // mantém overflow de XP
        rec.level = (rec.level || 0) + 1;
        leveled = true;
        continue; // verifica próximo nível
      }
      break;
    }

    // Se atingiu nível máximo, zera XP para evitar overflow
    if (rec.level >= this.maxLevel) {
      rec.level = this.maxLevel;
      rec.xp = 0;
    }

    this.saveRecord(rec);
    return { rec, leveled };
  }

  // Auto-ADM promotion window logic
  registerMaxLevelUser(gid, uid, userName, sock) {
    try {
      if (!this.promos[gid]) {
        this.promos[gid] = {
          windowStart: Date.now(),
          windowEnd: Date.now() + (this.windowDays * 24 * 60 * 60 * 1000),
          maxLevelUsers: [],
          promotedToADM: [],
          failedUsers: []
        };
      }

      const window = this.promos[gid];
      if (Date.now() > window.windowEnd) {
        this.promos[gid] = { windowStart: Date.now(), windowEnd: Date.now() + (this.windowDays * 24 * 60 * 60 * 1000), maxLevelUsers: [], promotedToADM: [], failedUsers: [] };
      }

      if (window.failedUsers.includes(uid)) return { success: false, message: 'Você já falhou nesta janela.' };
      if (window.promotedToADM.includes(uid)) return { success: false, message: 'Já promovido nesta janela.' };

      if (!window.maxLevelUsers.find(u => u.uid === uid)) window.maxLevelUsers.push({ uid, userName, timestamp: Date.now(), position: window.maxLevelUsers.length + 1 });

      const cfg = this._load(path.join(this.config.DATABASE_FOLDER, 'datauser', 'level_adm_config.json'), {});
      const auto = cfg[gid]?.autoADMEnabled === true;

      this._save(this.promoPath, this.promos);

      if (auto && window.maxLevelUsers.length <= this.topForAdm) {
        const position = window.maxLevelUsers.findIndex(u => u.uid === uid) + 1;
        if (position <= this.topForAdm) {
          try {
            window.promotedToADM.push(uid);
            this._save(this.promoPath, this.promos);
            if (sock && typeof sock.groupUpdateDescription === 'function') {
              sock.groupUpdateDescription(gid, `Akira Auto-ADM: ${userName} (Nível ${this.maxLevel} - Top ${position}/${this.topForAdm})`).catch(()=>{});
            }
            return { success: true, promoted: true, position, message: `Promovido a ADM (Top ${position})` };
          } catch (e) {
            return { success: false, message: 'Erro ao promover ADM' };
          }
        }
      }

      return { success: true, promoted: false, message: `Max level registrado (${window.maxLevelUsers.length}/${this.topForAdm})` };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // status info
  getStatus(gid) {
    const window = this.promos[gid];
    if (!window) return { isActive: false };
    const daysRemaining = Math.max(0, Math.ceil((window.windowEnd - Date.now()) / (24*60*60*1000)));
    return { isActive: true, daysRemaining, maxLevelUsers: window.maxLevelUsers, promotedToADM: window.promotedToADM, failedUsers: window.failedUsers };
  }
}

module.exports = LevelSystem;
