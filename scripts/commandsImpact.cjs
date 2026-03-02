const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUDIT = path.join(ROOT, 'COMMANDS_AUDIT_REPORT.md');
const OUT = path.join(ROOT, 'COMMANDS_IMPACT.md');

function readAuditCommands() {
  const txt = fs.readFileSync(AUDIT, 'utf8');
  const m = txt.match(/## Implementados mas NÃO listados no menu([\s\S]*?)##/);
  const section = m ? m[1] : txt.split('## Implementados mas NÃO listados no menu')[1] || '';
  const lines = section.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('- '));
  return lines.map(l => l.replace(/^-\s*/, '').trim());
}

function walk(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === 'dist' || f === 'bin') continue;
    const fp = path.join(dir, f);
    try {
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) walk(fp, filelist);
      else filelist.push(fp);
    } catch (e) {
      // ignore
    }
  }
  return filelist;
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const textExts = ['.ts', '.js', '.md', '.json', '.py', '.sh', '.yml', '.yaml', '.txt', '.html', '.css', '.cjs', '.mjs'];
  return textExts.includes(ext);
}

function main() {
  const cmds = readAuditCommands();
  const files = walk(ROOT, []);
  const mapping = {};
  for (const cmd of cmds) mapping[cmd] = [];

  for (const file of files) {
    if (!isTextFile(file)) continue;
    let content = '';
    try { content = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    for (const cmd of cmds) {
      const re = new RegExp('\\b' + cmd.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
      if (re.test(content)) {
        mapping[cmd].push(path.relative(ROOT, file));
      }
    }
  }

  let md = '# Impacto de Comandos (Implementados mas não listados no menu)\n\n';
  md += `Gerado em: ${new Date().toISOString()}\n\n`;
  for (const cmd of cmds) {
    md += `## ${cmd}\n\n`;
    if (mapping[cmd].length === 0) md += '- Nenhuma referência encontrada no repositório.\n\n';
    else md += mapping[cmd].map(f => `- ${f}`).join('\n') + '\n\n';
  }

  fs.writeFileSync(OUT, md, 'utf8');
  console.log('Relatório gerado em', OUT);
}

main();
