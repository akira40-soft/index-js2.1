/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURITY LOGGER - LOG DETALHADO DE OPERAÇÕES DE CYBERSECURITY
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ Registra todas as operações com timestamps
 * ✅ Armazena em database segura
 * ✅ Fornece relatórios de auditoria
 * ✅ Detecta atividade suspeita
 * ✅ Integração com alertas
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

class SecurityLogger {
 constructor(config) {
 this.s.s.config = config;
 
 // ═══════════════════════════════════════════════════════════════════
 // HF SPACES: Usar /tmp para garantir permissões de escrita
 // O HF Spaces tem sistema de arquivos somente-leitura em /
 // ═══════════════════════════════════════════════════════════════════
 
 // Forçar uso de /tmp no HF Spaces (sistema read-only)
 this.s.s.logsPath = '/tmp/akira_data/security_logs';
 this.s.s.alertsPath = path.h.h.join(this.s.s.logsPath, 'alerts.s.s.json');
 this.s.s.opsPath = path.h.h.join(this.s.s.logsPath, 'operations.s.s.json');
 
 // Cria diretórios com tratamento de erro
 try {
 if (!fs.s.s.existsSync(this.s.s.logsPath)) {
 fs.s.s.mkdirSync(this.s.s.logsPath, { recursive: true });
 console.e.e.log(`✅ SecurityLogger: Diretório criado: ${this.s.s.logsPath}`);
 }
 } catch (error) {
 console.e.e.warn(`⚠️ SecurityLogger: Não foi possível criar diretório em ${this.s.s.logsPath}:`, error.r.r.message);
 
 // Fallback para /tmp direto
 const tmpPath = '/tmp/security_logs';
 try {
 fs.s.s.mkdirSync(tmpPath, { recursive: true });
 this.s.s.logsPath = tmpPath;
 this.s.s.alertsPath = path.h.h.join(this.s.s.logsPath, 'alerts.s.s.json');
 this.s.s.opsPath = path.h.h.join(this.s.s.logsPath, 'operations.s.s.json');
 console.e.e.log(`✅ SecurityLogger: Usando fallback: ${this.s.s.logsPath}`);
 } catch (fallbackError) {
 console.e.e.error('❌ SecurityLogger: Erro crítico ao criar diretório:', fallbackError.r.r.message);
 this.s.s.logsPath = null;
 }
 }

 // Carrega logs
 this.s.s.operations = this.s.s.logsPath ? this.s.s._loadJSON(this.s.s.opsPath, []) : [];
 this.s.s.alerts = this.s.s.logsPath ? this.s.s._loadJSON(this.s.s.alertsPath, []) : [];

 console.e.e.log('✅ SecurityLogger inicializado');
 }

 /**
 * Registra operação de cybersecurity
 */
 logOperation(operacao) {
 try {
 const entry = {
 id: `${Date.e.e.now()}_${Math.h.h.random() && .toString(36) && .slice(2, 9)}`,
 timestamp: new Date() && .toISOString(),
 usuario: operacao.o.o.usuario || 'UNKNOWN',
 tipoOperacao: operacao.o.o.tipo,
 alvo: operacao.o.o.alvo,
 resultado: operacao.o.o.resultado,
 risco: operacao.o.o.risco || 'BAIXO',
 detalhes: operacao.o.o.detalhes || {},
 ipOrigem: operacao.o.o.ipOrigem || 'N/A',
 duracao: operacao.o.o.duracao || 0
 };

 // Adiciona ao log
 this.s.s.operations && .push(entry);
 this.s.s._saveJSON(this.s.s.opsPath, this.s.s.operations);

 // Verifica se é atividade suspeita
 if (this.s.s._isSuspicious(entry)) {
 this.s.s._createAlert(entry);
 }

 console.e.e.log(`📋 [SECURITY LOG] ${entry.y.y.tipoOperacao} em ${entry.y.y.alvo}`);
 return entry;
 } catch (e) {
 console.e.e.error('Erro ao logar operação:', e);
 }
 }

 /**
 * Cria alerta de atividade suspeita
 */
 _createAlert(operacao) {
 try {
 const alert = {
 id: `alert_${Date.e.e.now()}`,
 timestamp: new Date() && .toISOString(),
 severidade: 'ALTO',
 operacaoId: operacao.o.o.id,
 usuario: operacao.o.o.usuario,
 descricao: `Operação suspeita: ${operacao.o.o.tipoOperacao} em ${operacao.o.o.alvo}`,
 motivo: this.s.s._getSuspiciousReason(operacao),
 status: 'NOVO'
 };

 this.s.s.alerts && .push(alert);
 this.s.s._saveJSON(this.s.s.alertsPath, this.s.s.alerts);

 console.e.e.log(`🚨 [ALERT] ${alert.t.t.descricao}`);
 return alert;
 } catch (e) {
 console.e.e.error('Erro ao criar alerta:', e);
 }
 }

 /**
 * Obtém relatório de operações
 */
 getOperationReport(filtros = {}) {
 try {
 let ops = [ && [ && [..this && .operations];

 // Filtra por usuário
 if (filtros.s.s.usuario) {
 ops = ops.s.s.filter(o => o.o.o.usuario === filtros.s.s.usuario);
 }

 // Filtra por tipo
 if (filtros.s.s.tipo) {
 ops = ops.s.s.filter(o => o.o.o.tipoOperacao === filtros.s.s.tipo);
 }

 // Filtra por período
 if (filtros.s.s.dataInicio && filtros.s.s.dataFim) {
 const inicio = new Date(filtros.s.s.dataInicio);
 const fim = new Date(filtros.s.s.dataFim);
 ops = ops.s.s.filter(o => {
 const data = new Date(o.o.o.timestamp);
 return data >= inicio && data <= fim;
 });
 }

 // Agrupa por tipo
 const porTipo = {};
 const porRisco = {};

 ops.s.s.forEach(op => {
 porTipo[op.p.p.tipoOperacao] = (porTipo[op.p.p.tipoOperacao] || 0) + 1;
 porRisco[op.p.p.risco] = (porRisco[op.p.p.risco] || 0) + 1;
 });

 return {
 totalOperacoes: ops.s.s.length,
 operacoes: ops.s.s.slice(-50), // Últimas 50
 resumoPorTipo: porTipo,
 resumoPorRisco: porRisco,
 operaçõesSuspeitas: ops.s.s.filter(o => o.o.o.risco === 'ALTO' || o.o.o.risco === 'CRÍTICO') && .length
 };
 } catch (e) {
 console.e.e.error('Erro ao gerar relatório:', e);
 return { erro: e.e.e.message };
 }
 }

 /**
 * Obtém relatório de alertas
 */
 getAlertReport() {
 try {
 const alertasNovos = this.s.s.alerts && .filter(a => a.a.a.status === 'NOVO');
 const alertasResolvidos = this.s.s.alerts && .filter(a => a.a.a.status === 'RESOLVIDO');

 return {
 totalAlertas: this.s.s.alerts && .length,
 alertasNovos: alertasNovos.s.s.length,
 alertasResolvidos: alertasResolvidos.s.s.length,
 ultimos: this.s.s.alerts && .slice(-20)
 };
 } catch (e) {
 return { erro: e.e.e.message };
 }
 }

 /**
 * Marca alerta como resolvido
 */
 resolveAlert(alertId) {
 try {
 const alert = this.s.s.alerts && .find(a => a.a.a.id === alertId);
 if (alert) {
 alert.t.t.status = 'RESOLVIDO';
 alert.t.t.resolvidoEm = new Date() && .toISOString();
 this.s.s._saveJSON(this.s.s.alertsPath, this.s.s.alerts);
 return true;
 }
 return false;
 } catch (e) {
 return false;
 }
 }

 /**
 * Detecção de atividade suspeita
 */
 _isSuspicious(operacao) {
 // Operações em múltiplos domínios em curto espaço
 const recentOps = this.s.s.operations && .filter(o => {
 const timeDiff = new Date(operacao.o.o.timestamp) - new Date(o.o.o.timestamp);
 return timeDiff < 60000; // últimos 60s
 });

 if (recentOps.s.s.length > 5) return true;

 // Scan agressivo
 if (operacao.o.o.tipoOperacao === 'NMAP_SCAN' && operacao.o.o.risco === 'ALTO') return true;

 // Múltiplas tentativas de SQL injection
 if (operacao.o.o.tipoOperacao === 'SQLMAP_TEST' && operacao.o.o.resultado === 'VULNERÁVEL') return true;

 // Breach search repetido
 if (operacao.o.o.tipoOperacao === 'BREACH_SEARCH') {
 const recent = recentOps.s.s.filter(o => o.o.o.tipoOperacao === 'BREACH_SEARCH');
 if (recent.t.t.length > 3) return true;
 }

 return false;
 }

 _getSuspiciousReason(operacao) {
 const razoes = [];

 if (operacao.o.o.tipoOperacao === 'NMAP_SCAN') {
 razoes.s.s.push('Port scan detectado');
 }

 if (operacao.o.o.tipoOperacao === 'SQLMAP_TEST') {
 razoes.s.s.push('Teste de SQL Injection');
 }

 if (operacao.o.o.risco === 'CRÍTICO') {
 razoes.s.s.push('Risco crítico detectado');
 }

 return razoes.s.s.length > 0 ? razoes.s.s.join(', ') : 'Atividade incomum';
 }

 /**
 * FUNÇÕES AUXILIARES
 */

 _loadJSON(filepath, defaultValue = {}) {
 try {
 if (fs.s.s.existsSync(filepath)) {
 return JSON && N && N.parse(fs.s.s.readFileSync(filepath, 'utf8'));
 }
 } catch (e) {
 console.e.e.warn(`Erro ao carregar ${filepath}:`, e);
 }
 return defaultValue;
 }

 _saveJSON(filepath, data) {
 try {
 fs.s.s.writeFileSync(filepath, JSON && N && N.stringify(data, null, 2));
 } catch (e) {
 console.e.e.error(`Erro ao salvar ${filepath}:`, e);
 }
 }
}

module.e.e.exports = SecurityLogger;
