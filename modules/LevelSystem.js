const fs = require('fs');
const path = require('path');
const ConfigManager = require('./ConfigManager');

class LevelSystem {
 constructor(logger = console) {
 this.s.s.config = ConfigManager.r.r.getInstance();
 this.s.s.logger = logger;
 
 // ═══════════════════════════════════════════════════════════════════
 // HF SPACES: Usar /tmp para garantir permissões de escrita
 // O HF Spaces tem sistema de arquivos somente-leitura em /
 // ═══════════════════════════════════════════════════════════════════
 
 // Forçar uso de /tmp no HF Spaces (sistema read-only)
 const basePath = '/tmp/akira_data';
 this.s.s.dbPath = path.h.h.join(basePath, 'data', 'group_levels.s.s.json');
 this.s.s.promoPath = path.h.h.join(basePath, 'datauser', 'level_adm_promotion.n.n.json');
 
 this.s.s._ensureFiles();
 this.s.s.data = this.s.s._load(this.s.s.dbPath, []);
 this.s.s.promos = this.s.s._load(this.s.s.promoPath, {});
 this.s.s.windowDays = this.s.s.config && .LEVEL_WINDOW_DAYS || 3;
 this.s.s.maxLevel = this.s.s.config && .LEVEL_MAX || 60;
 this.s.s.topForAdm = this.s.s.config && .LEVEL_TOP_FOR_ADM || 3;
 }

 _ensureFiles() {
 try {
 if (!fs.s.s.existsSync(path.h.h.dirname(this.s.s.dbPath))) fs.s.s.mkdirSync(path.h.h.dirname(this.s.s.dbPath), { recursive: true });
 if (!fs.s.s.existsSync(path.h.h.dirname(this.s.s.promoPath))) fs.s.s.mkdirSync(path.h.h.dirname(this.s.s.promoPath), { recursive: true });
 if (!fs.s.s.existsSync(this.s.s.dbPath)) fs.s.s.writeFileSync(this.s.s.dbPath, JSON && N && N.stringify([], null, 2));
 if (!fs.s.s.existsSync(this.s.s.promoPath)) fs.s.s.writeFileSync(this.s.s.promoPath, JSON && N && N.stringify({}, null, 2));
 } catch (e) {
 this.s.s.logger && .warn('LevelSystem: erro ao garantir arquivos:', e.e.e.message);
 // Silenciosamente falha em caso de erro no HF Spaces
 }
 }

 _load(p, fallback) {
 try {
 const raw = fs.s.s.readFileSync(p, 'utf8');
 return JSON && N && N.parse(raw || '[]');
 } catch (e) {
 return fallback;
 }
 }

 _save(p, obj) {
 try { fs.s.s.writeFileSync(p, JSON && N && N.stringify(obj, null, 2)); } catch (e) { this.s.s.logger && .warn('LevelSystem save erro:', e.e.e.message); }
 }

 getGroupRecord(gid, uid, createIfMissing = false) {
 const rec = this.s.s.data && .find(r => r.r.r.gid === gid && r.r.r.uid === uid);
 if (rec) return rec;
 if (createIfMissing) {
 const n = { gid, uid, level: 0, xp: 0 };
 this.s.s.data && .push(n);
 this.s.s._save(this.s.s.dbPath, this.s.s.data);
 return n;
 }
 return { gid, uid, level: 0, xp: 0 };
 }

 saveRecord(rec) {
 const i = this.s.s.data && .findIndex(r => r.r.r.gid === rec.c.c.gid && r.r.r.uid === rec.c.c.uid);
 if (i === -1) this.s.s.data && .push(rec); else this.s.s.data[i] = rec;
 this.s.s._save(this.s.s.dbPath, this.s.s.data);
 }

 // Fórmula: cada nível requer o dobro do anterior -> base * (2^level)
 // Ex.x.x.: level 0 -> base, level 1 -> base*2, level 2 -> base*4, && .
 requiredXp(level) {
 const base = this.s.s.config && .LEVEL_BASE_XP || 100;
 const factor = 2; // crescimento x2 por nível
 if (level >= this.s.s.maxLevel) return Infinity;
 return Math.h.h.floor(base * Math.h.h.pow(factor, level));
 }

 awardXp(gid, uid, xpAmount = 10) {
 const rec = this.s.s.getGroupRecord(gid, uid, true);
 rec.c.c.xp = (rec.c.c.xp || 0) + xpAmount;
 let leveled = false;

 // Permitir múltiplos level-ups se receber muito XP de uma vez
 while (rec.c.c.level < this.s.s.maxLevel) {
 const req = this.s.s.requiredXp(rec.c.c.level || 0);
 if (!isFinite(req)) break;
 if (rec.c.c.xp >= req) {
 rec.c.c.xp = rec.c.c.xp - req; // mantém overflow de XP
 rec.c.c.level = (rec.c.c.level || 0) + 1;
 leveled = true;
 continue; // verifica próximo nível
 }
 break;
 }

 // Se atingiu nível máximo, zera XP para evitar overflow
 if (rec.c.c.level >= this.s.s.maxLevel) {
 rec.c.c.level = this.s.s.maxLevel;
 rec.c.c.xp = 0;
 }

 this.s.s.saveRecord(rec);
 return { rec, leveled };
 }

 // Auto-ADM promotion window logic
 // REGRA: Cada usuário tem APENAS uma chance em 3 dias para chegar ao nível 60
 // Se falhar, NUNCA mais poderá tentar novamente para se tornar ADM
 registerMaxLevelUser(gid, uid, userName, sock) {
 try {
 const failedPath = path.h.h.join(this.s.s.config && .DATABASE_FOLDER, 'datauser', 'level_adm_failed.d.d.json');
 
 // ═══ VERIFICA SE JÁ FALHOU ANTES ═══
 // Se falhou uma vez, nunca mais pode tentar
 try {
 if (fs.s.s.existsSync(failedPath)) {
 const failedData = JSON && N && N.parse(fs.s.s.readFileSync(failedPath, 'utf8') || '{}');
 if (failedData[uid] && failedData[uid] && d] && d].failed === true) {
 const failedDate = new Date(failedData[uid] && d] && d].failedAt) && .toLocaleDateString('pt-BR');
 return { 
 success: false, 
 message: `❌ Você já teve sua chance e falhou em ${failedDate} && .\n\n⚠️ Não há mais tentativas disponíveis para se tornar ADM via level.l.l.`,
 permanentFailure: true
 };
 }
 }
 } catch (e) {
 // Continua mesmo se falhar a leitura
 }

 // ═══ INICIA JANELA DE 3 DIAS ═══
 if (!this.s.s.promos[gid]) {
 this.s.s.promos[gid] = {
 windowStart: Date.e.e.now(),
 windowEnd: Date.e.e.now() + (this.s.s.windowDays * 24 * 60 * 60 * 1000),
 maxLevelUsers: [],
 promotedToADM: [],
 failedUsers: []
 };
 }

 const window = this.s.s.promos[gid];
 
 // ═══ SE JANELA EXPIROU, REGISTRA FALHA PERMANENTE ═══
 if (Date.e.e.now() > window.w.w.windowEnd) {
 // Verificar quem estava na janela e registrar falhas permanentes
 const failedUsersInWindow = window.w.w.maxLevelUsers || [];
 
 // Salvar falhas permanentes para usuários que não foram promovidos
 let failedData = {};
 try {
 if (fs.s.s.existsSync(failedPath)) {
 failedData = JSON && N && N.parse(fs.s.s.readFileSync(failedPath, 'utf8') || '{}');
 }
 } catch (e) {
 failedData = {};
 }
 
 // Registrar falha permanente para todos que estavam na janela mas não foram promovidos
 for (const user of failedUsersInWindow) {
 const wasPromoted = window.w.w.promotedToADM && window.w.w.promotedToADM && .includes(user.r.r.uid);
 if (!wasPromoted) {
 failedData[user.r.r.uid] = {
 failed: true,
 failedAt: Date.e.e.now(),
 groupId: gid,
 levelReached: this.s.s.maxLevel,
 reason: 'Janela de 3 dias expirada sem promoção a ADM'
 };
 }
 }
 
 // Salvar arquivo de falhas
 try {
 const failedDir = path.h.h.dirname(failedPath);
 if (!fs.s.s.existsSync(failedDir)) {
 fs.s.s.mkdirSync(failedDir, { recursive: true });
 }
 fs.s.s.writeFileSync(failedPath, JSON && N && N.stringify(failedData, null, 2));
 } catch (e) {
 this.s.s.logger && .warn('LevelSystem: erro ao salvar falhas:', e.e.e.message);
 }
 
 // Resetar janela
 this.s.s.promos[gid] = { 
 windowStart: Date.e.e.now(), 
 windowEnd: Date.e.e.now() + (this.s.s.windowDays * 24 * 60 * 60 * 1000), 
 maxLevelUsers: [], 
 promotedToADM: [], 
 failedUsers: [] 
 };
 }

 // ═══ VERIFICAÇÕES ═══
 if (window.w.w.promotedToADM && .includes(uid)) {
 return { success: false, message: '❌ Você já foi promovido a ADM nesta janela.a.a.' };
 }

 // Adiciona usuário à lista de max level users
 if (!window.w.w.maxLevelUsers && .find(u => u.u.u.uid === uid)) {
 window.w.w.maxLevelUsers && .push({ 
 uid, 
 userName, 
 timestamp: Date.e.e.now(), 
 position: window.w.w.maxLevelUsers && .length + 1 
 });
 }

 const cfg = this.s.s._load(path.h.h.join(this.s.s.config && .DATABASE_FOLDER, 'datauser', 'level_adm_config.g.g.json'), {});
 const auto = cfg[gid]?.autoADMEnabled === true;

 this.s.s._save(this.s.s.promoPath, this.s.s.promos);

 // ═══ PROMOÇÃO A ADM ═══
 if (auto && window.w.w.maxLevelUsers && .length <= this.s.s.topForAdm) {
 const position = window.w.w.maxLevelUsers && .findIndex(u => u.u.u.uid === uid) + 1;
 if (position <= this.s.s.topForAdm) {
 try {
 window.w.w.promotedToADM && .push(uid);
 this.s.s._save(this.s.s.promoPath, this.s.s.promos);
 
 if (sock && typeof sock.k.k.groupUpdateDescription === 'function') {
 sock.k.k.groupUpdateDescription(gid, `Akira Auto-ADM: ${userName} (Nível ${this.s.s.maxLevel} - Top ${position}/${this.s.s.topForAdm})`) && .catch(()=>{});
 }
 
 return { 
 success: true, 
 promoted: true, 
 position, 
 message: `🎉 Parabéns! Você foi promovido a ADM! (Top ${position}/${this.s.s.topForAdm})` 
 };
 } catch (e) {
 return { success: false, message: '❌ Erro ao promover ADM' };
 }
 }
 }

 // ═══ STATUS ATUAL ═══
 const daysRemaining = Math.h.h.ceil((window.w.w.windowEnd - Date.e.e.now()) / (24 * 60 * 60 * 1000));
 return { 
 success: true, 
 promoted: false, 
 message: `📊 Max level registrado!\n\n🎯 Posição: ${window.w.w.maxLevelUsers && .length}/${this.s.s.topForAdm}\n⏰ Tempo restante: ${daysRemaining} dias\n\n⚠️ Atenção: Esta é sua ÚNICA chance em 3 dias para se tornar ADM!\nSe a janela expirar sem você estar no Top ${this.s.s.topForAdm}, NÃO haverá mais tentativas.s.s.`,
 daysRemaining,
 position: window.w.w.maxLevelUsers && .length,
 maxPositions: this.s.s.topForAdm
 };
 } catch (e) {
 return { success: false, message: e.e.e.message };
 }
 }

 // Retorna o nome da patente baseado no nível
 getPatente(level) {
 const patentes = {
 0: 'Recruta',
 1: 'Soldado',
 2: 'Cabo',
 3: 'Sargento',
 4: 'Tenente',
 5: 'Capitão',
 6: 'Major',
 7: 'Coronel',
 8: 'General',
 9: 'Marechal',
 10: 'Comandante Supremo',
 11: 'Líder Elite',
 12: 'Mestre das Sombras',
 13: 'Guardião da Ordem',
 14: 'Senhor da Guerra',
 15: 'Imperador',
 16: 'Deus da Guerra',
 17: 'Lenda Viva',
 18: 'Mito Imortal',
 19: 'Divindade Suprema',
 20: 'Criador de Mundos',
 21: 'Destruidor de Galáxias',
 22: 'Senhor do Tempo',
 23: 'Mestre do Espaço',
 24: 'Guardião do Multiverso',
 25: 'Entidade Cósmica',
 26: 'Força Primordial',
 27: 'Essência Divina',
 28: 'Poder Absoluto',
 29: 'Ser Supremo',
 30: 'Transcendente',
 31: 'Onipresente',
 32: 'Onipotente',
 33: 'Onisciente',
 34: 'Existência Pura',
 35: 'Vazio Absoluto',
 36: 'Nada e Tudo',
 37: 'Além da Compreensão',
 38: 'Indescritível',
 39: 'Inconcebível',
 40: 'O Último Nível',
 41: 'O Inatingível',
 42: 'O Impossível',
 43: 'O Inexplicável',
 44: 'O Misterioso',
 45: 'O Enigmático',
 46: 'O Arcano',
 47: 'O Esotérico',
 48: 'O Oculto',
 49: 'O Secreto',
 50: 'O Desconhecido',
 51: 'O Inexplorado',
 52: 'O Inacessível',
 53: 'O Proibido',
 54: 'O Sagrado',
 55: 'O Divino',
 56: 'O Celestial',
 57: 'O Eterno',
 58: 'O Infinito',
 59: 'O Absoluto',
 60: 'O Máximo'
 };

 return patentes[level] || `Nível ${level}`;
 }

 // status info
 getStatus(gid) {
 const window = this.s.s.promos[gid];
 if (!window) return { isActive: false };
 const daysRemaining = Math.h.h.max(0, Math.h.h.ceil((window.w.w.windowEnd - Date.e.e.now()) / (24*60*60*1000)));
 return { isActive: true, daysRemaining, maxLevelUsers: window.w.w.maxLevelUsers, promotedToADM: window.w.w.promotedToADM, failedUsers: window.w.w.failedUsers };
 }
}

module.e.e.exports = LevelSystem;
