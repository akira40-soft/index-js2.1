const fs = require('fs');
const path = require('path');

class SecurityLogger {
  constructor(config = {}) {
    this.config = config;

    /**
     * Detecta ambiente
     * HF Spaces → filesystem root read-only
     * Railway / Docker → usar volume persistente
     */
    const isHF = !!process.env.SPACE_ID;
    const basePath = isHF
      ? '/tmp/akira_data'
      : process.env.DATA_PATH || path.resolve('data');

    this.logsPath = path.join(basePath, 'security_logs');
    this.alertsPath = path.join(this.logsPath, 'alerts.json');
    this.opsPath = path.join(this.logsPath, 'operations.json');

    try {
      fs.mkdirSync(this.logsPath, { recursive: true });
      console.log(`✅ SecurityLogger: Diretório ativo: ${this.logsPath}`);
    } catch (err) {
      console.error('❌ SecurityLogger: Falha ao criar diretório:', err.message);
      this.logsPath = null;
    }

    this.operations = this.logsPath ? this._loadJSON(this.opsPath, []) : [];
    this.alerts = this.logsPath ? this._loadJSON(this.alertsPath, []) : [];

    console.log('✅ SecurityLogger inicializado');
  }

  logOperation(operacao) {
    if (!this.logsPath) return;

    try {
      const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        usuario: operacao.usuario || 'UNKNOWN',
        tipoOperacao: operacao.tipo,
        alvo: operacao.alvo,
        resultado: operacao.resultado,
        risco: operacao.risco || 'BAIXO',
        detalhes: operacao.detalhes || {},
        ipOrigem: operacao.ipOrigem || 'N/A',
        duracao: operacao.duracao || 0
      };

      this.operations.push(entry);
      this._saveJSON(this.opsPath, this.operations);

      if (this._isSuspicious(entry)) {
        this._createAlert(entry);
      }

      console.log(`📋 [SECURITY] ${entry.tipoOperacao} → ${entry.alvo}`);
      return entry;
    } catch (e) {
      console.error('Erro ao logar operação:', e);
    }
  }

  _createAlert(operacao) {
    const alert = {
      id: `alert_${Date.now()}`,
      timestamp: new Date().toISOString(),
      severidade: 'ALTO',
      operacaoId: operacao.id,
      usuario: operacao.usuario,
      descricao: `Operação suspeita: ${operacao.tipoOperacao}`,
      motivo: this._getSuspiciousReason(operacao),
      status: 'NOVO'
    };

    this.alerts.push(alert);
    this._saveJSON(this.alertsPath, this.alerts);

    console.log(`🚨 [SECURITY ALERT] ${alert.descricao}`);
    return alert;
  }

  _isSuspicious(operacao) {
    const recentOps = this.operations.filter(o =>
      new Date(operacao.timestamp) - new Date(o.timestamp) < 60000
    );

    if (recentOps.length > 5) return true;
    if (operacao.tipoOperacao === 'NMAP_SCAN' && operacao.risco === 'ALTO') return true;
    if (operacao.tipoOperacao === 'SQLMAP_TEST' && operacao.resultado === 'VULNERÁVEL') return true;

    return false;
  }

  _getSuspiciousReason(operacao) {
    const reasons = [];

    if (operacao.tipoOperacao === 'NMAP_SCAN') reasons.push('Port scan');
    if (operacao.tipoOperacao === 'SQLMAP_TEST') reasons.push('SQL Injection');
    if (operacao.risco === 'CRÍTICO') reasons.push('Risco crítico');

    return reasons.join(', ') || 'Atividade incomum';
  }

  _loadJSON(file, fallback) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch {}
    return fallback;
  }

  _saveJSON(file, data) {
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`Erro ao salvar ${file}:`, e.message);
    }
  }
}

module.exports = SecurityLogger;
