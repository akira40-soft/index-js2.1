const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUDIT = path.join(ROOT, 'COMMANDS_AUDIT_REPORT.md');

const txt = fs.readFileSync(AUDIT, 'utf8');
const m = txt.match(/## Implementados mas NÃO listados no menu([\s\S]*?)## Listados/);
const section = m ? m[1] : txt.split('## Implementados mas NÃO listados no menu')[1];
const cmds = (section || '').split(/\r?\n/).map(l => l.trim().replace(/^-\s*/, '')).filter(Boolean);

const categories = {
  'Conta & Economia': ['registrar','register','reg','perfil','profile','level','lvl','nivel','rank','ranking','top','daily','diario','atm','balance','banco','transfer','transferir','pagar','deposit','depositar','withdraw','sacar','transactions','transacoes','saldo','balance','mp3'],
  'Mídia & Video': ['play','p','playvid','ytmp4','video','tomp3','tomp3','mp3','pinterest','image','img','sticker','s','take','toimg','playvid','play'],
  'Áudio & Efeitos': ['tts','nightcore','slow','bass','bassboost','deep','robot','reverse','squirrel','echo','8d','enhance','remini'],
  'Imagem & Efeitos': ['hd','upscale','removebg','rmbg','addbg','bg','fotodogrupo','image','img','addbg'],
  'Grupos & Administração': ['groupinfo','ginfo','listar','membros','admins','listadmins','tagall','hidetag','totag','fechar','abrir','open','close','kick','ban','add','promote','demote','mute','desmute','unmute','pin','fixar','desafixar','revlink','revogar','setdesc','setfoto','setbotphoto'],
  'Diversão & Jogos': ['ttt','tictactoe','jogodavelha','rps','ppt','pedrapapeltesoura','guess','advinha','advinhe','forca','hangman','gridtactics','grid','slot','sorteio','sortear','raffle','piada','joke','frases','quote','fatos','curiosidade','caracoroa','chance','gay','ship'],
  'Cybersecurity & Pentest': ['nmap','sqlmap','hydra','nuclei','nikto','masscan','commix','searchsploit','socialfish','blackeye','theharvester','shodan','cve','impacket','winrm','setoolkit','metasploit','netexec','whois','dns','geo'],
  'OSINT & Intel': ['dork','email','phone','username','sherlock','holehe','theharvester','netexec'],
  'Moderação & Segurança': ['antilink','antifake','antiimage','antisticker','antispam','blacklist','mutelist','silenciados','warn','unwarn','resetwarns','blacklist'],
  'Configuração & Bot': ['dono','owner','criador','creator','setbotname','setbotstatus','setbotphoto','setbotpic','setname','setphoto','setwelcome','setgoodbye','setdesc','setfoto','setbio'],
  'Pagamento & Premium': ['premium','vip','buy','comprar','donate','doar','donate','addpremium','addvip','delpremium','delvip','subscription','subscriptionmanager'],
  'Utilitários & Admin': ['help','ajuda','menu','comandos','info','perfil','ping','report','reportar','bug','getprofile','getuser','delete','del','apagar','restart','restart','restart'],
  'Outros': []
};

const assigned = {};
for (const c of Object.keys(categories)) assigned[c]=[];
assigned['Outros']=[];

for (const cmd of cmds) {
  let placed = false;
  const lc = cmd.toLowerCase();
  for (const [cat, arr] of Object.entries(categories)) {
    if (arr.includes(lc)) { assigned[cat].push(cmd); placed=true; break; }
  }
  if (!placed) {
    // heuristic by substring
    if (/play|video|yt|mp3|tomp3|sticker|image|img|pinterest/.test(lc)) { assigned['Mídia & Video'].push(cmd); continue; }
    if (/nmap|sqlmap|hydra|shodan|impacket|searchsploit|socialfish|blackeye/.test(lc)) { assigned['Cybersecurity & Pentest'].push(cmd); continue; }
    if (/ban|kick|mute|promote|demote|pin|fixar|revogar|add|remove|del/.test(lc)) { assigned['Grupos & Administração'].push(cmd); continue; }
    if (/tts|nightcore|slow|bass|remini|enhance/.test(lc)) { assigned['Áudio & Efeitos'].push(cmd); continue; }
    if (/bg|removebg|hd|upscale|image|img|foto|remini/.test(lc)) { assigned['Imagem & Efeitos'].push(cmd); continue; }
    if (/prime|vip|premium|buy|donate|doar/.test(lc)) { assigned['Pagamento & Premium'].push(cmd); continue; }
    if (/help|ajuda|menu|comandos|info|perfil|ping|report|bug/.test(lc)) { assigned['Utilitários & Admin'].push(cmd); continue; }
    assigned['Outros'].push(cmd);
  }
}

let out = '🔧 COMANDOS ADICIONAIS AGRUPADOS\n\n';
for (const [cat, arr] of Object.entries(assigned)) {
  if (arr.length===0) continue;
  out += `*${cat}*\n`;
  out += arr.map(x=>`• ${x}`).join('  ');
  out += '\n\n';
}

const OUTFILE = path.join(ROOT, 'scripts', 'grouped_extras.txt');
fs.writeFileSync(OUTFILE, out, 'utf8');
console.log('Grouped extras written to', OUTFILE);
