const fs = require('fs');
const path = require('path');

const CH_PATH = path.join(__dirname, '..', 'modules', 'CommandHandler.ts');
const OUT_MD = path.join(__dirname, '..', 'COMMANDS_AUDIT_REPORT.md');

const content = fs.readFileSync(CH_PATH, 'utf8');

// 1) Extrai comandos do switch (casos)
const caseRe = /case\s+'([^']+)'/g;
const implemented = new Set();
let m;
while ((m = caseRe.exec(content)) !== null) {
  implemented.add(m[1].toLowerCase());
}

// 2) Extrai comandos mencionados nos menus via ${P}token
const menuRe = /\$\{P\}\s*([a-zA-Z0-9_\-]+)/g;
const inMenu = new Set();
while ((m = menuRe.exec(content)) !== null) {
  inMenu.add(m[1].toLowerCase());
}

// Também capturar ocorrências com bullets e espaços (ex: • prefixoplay)
// Já coberto pela regex acima.

// 3) Calcular discrepâncias
const implementedList = Array.from(implemented).sort();
const inMenuList = Array.from(inMenu).sort();

const missingInMenu = implementedList.filter(c => !inMenu.has(c));
const staleInMenu = inMenuList.filter(c => !implemented.has(c));

// 4) Gerar relatório
let md = '# Relatório de Auditoria de Comandos\n\n';
md += `Arquivo auditado: modules/CommandHandler.ts\n\n`;
md += '## Resumo\n\n';
md += `- Comandos implementados: **${implementedList.length}**\n`;
md += `- Comandos listados no menu: **${inMenuList.length}**\n`;
md += `- Comandos implementados faltando no menu: **${missingInMenu.length}**\n`;
md += `- Comandos listados no menu que não estão implementados: **${staleInMenu.length}**\n\n`;

md += '---\n\n';
md += '## Implementados (amostra)\n\n';
md += implementedList.slice(0, 200).map(c => `- ${c}`).join('\n') + '\n\n';

md += '## Listados no Menu (amostra)\n\n';
md += inMenuList.slice(0, 200).map(c => `- ${c}`).join('\n') + '\n\n';

md += '## Implementados mas NÃO listados no menu\n\n';
if (missingInMenu.length === 0) md += 'Nenhum.\n\n'; else md += missingInMenu.map(c => `- ${c}`).join('\n') + '\n\n';

md += '## Listados no menu mas NÃO implementados\n\n';
if (staleInMenu.length === 0) md += 'Nenhum.\n\n'; else md += staleInMenu.map(c => `- ${c}`).join('\n') + '\n\n';

md += '---\n\n';
md += '## Observações e próximas ações sugeridas\n\n';
md += '- Remover os comandos listados no menu que aparecem em "Listados no menu mas NÃO implementados"\n';
md += '- Adicionar ou documentar os comandos em "Implementados mas NÃO listados" no menu (categorizar)\n';
md += '- Considerar gerar menus dinamicamente a partir do switch de handlers para evitar desatualizações\n';

fs.writeFileSync(OUT_MD, md, 'utf8');

console.log('Audit complete. Report written to COMMANDS_AUDIT_REPORT.md');
console.log('Implemented commands:', implementedList.length);
console.log('Menu commands:', inMenuList.length);
console.log('Missing in menu:', missingInMenu.length ? missingInMenu.join(', ') : '(none)');
console.log('Stale in menu:', staleInMenu.length ? staleInMenu.join(', ') : '(none)');

process.exit(0);
