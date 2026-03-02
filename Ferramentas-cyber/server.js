/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FERRAMENTAS CYBER SERVER - Akira Bot V21
 * ═══════════════════════════════════════════════════════════════════════════
 * Servidor Express para ferramentas de Cybersecurity
 * Inclui: Nmap, SQLMap, Hydra, Nuclei, Nikto, Masscan, Commix, etc.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES DE SEGURANÇA
// ═══════════════════════════════════════════════════════════════════════════

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite por IP
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' }
});
app.use('/api/', limiter);

// ═══════════════════════════════════════════════════════════════════════════
// FERRAMENTAS DISPONÍVEIS
// ═══════════════════════════════════════════════════════════════════════════

const tools = {
    // Pentesting
    nmap: {
        name: 'Nmap',
        path: '/usr/bin/nmap',
        description: 'Scanner de portas e redes',
        category: 'pentesting'
    },
    sqlmap: {
        name: 'SQLMap',
        path: '/opt/sqlmap/sqlmap.py',
        description: 'Detecção de SQL Injection',
        category: 'pentesting'
    },
    hydra: {
        name: 'Hydra',
        path: '/usr/bin/hydra',
        description: 'Ferramenta de força bruta',
        category: 'pentesting'
    },
    nuclei: {
        name: 'Nuclei',
        path: '/usr/local/bin/nuclei',
        description: 'Scanner de vulnerabilidades',
        category: 'pentesting'
    },
    nikto: {
        name: 'Nikto',
        path: '/usr/local/bin/nikto',
        description: 'Scanner de servidores web',
        category: 'pentesting'
    },
    masscan: {
        name: 'Masscan',
        path: '/usr/local/bin/masscan',
        description: 'Scanner de portas rápido',
        category: 'pentesting'
    },
    commix: {
        name: 'Commix',
        path: '/usr/local/bin/commix',
        description: 'Detector de Command Injection',
        category: 'pentesting'
    },
    searchsploit: {
        name: 'SearchSploit',
        path: '/usr/local/bin/searchsploit',
        description: 'Banco de dados de exploits',
        category: 'pentesting'
    },
    // Phishing
    socialfish: {
        name: 'SocialFish',
        path: '/usr/local/bin/socialfish',
        description: 'Ferramenta de phishing',
        category: 'phishing'
    },
    blackeye: {
        name: 'BlackEye',
        path: '/usr/local/bin/blackeye',
        description: 'Gerador de páginas de phishing',
        category: 'phishing'
    },
    // OSINT
    sherlock: {
        name: 'Sherlock',
        path: '/usr/local/bin/sherlock',
        description: 'Busca de usernames',
        category: 'osint'
    },
    holehe: {
        name: 'Holehe',
        path: '/usr/local/bin/holehe',
        description: 'Verificação de emails',
        category: 'osint'
    },
    theharvester: {
        name: 'TheHarvester',
        path: '/usr/local/bin/theharvester',
        description: 'Coleta de informações',
        category: 'osint'
    },
    netexec: {
        name: 'NetExec (NXC)',
        path: '/usr/local/bin/nxc',
        description: 'Framework de pós-exploração',
        category: 'osint'
    },
    winrm: {
        name: 'Evil-WinRM',
        path: '/usr/local/bin/evil-winrm',
        description: 'Acesso Windows remoto',
        category: 'osint'
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS DA API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET / - Página principal
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * GET /api/health - Verificar saúde do servidor
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        tools: Object.keys(tools).length
    });
});

/**
 * GET /api/tools - Lista todas as ferramentas
 */
app.get('/api/tools', (req, res) => {
    const toolList = Object.entries(tools).map(([key, tool]) => ({
        id: key,
        name: tool.name,
        description: tool.description,
        category: tool.category,
        status: fs.existsSync(tool.path) ? 'online' : 'offline'
    }));
    
    res.json({
        tools: toolList,
        total: toolList.length,
        categories: [...new Set(toolList.map(t => t.category))]
    });
});

/**
 * GET /api/tools/:name - Status de ferramenta específica
 */
app.get('/api/tools/:name', (req, res) => {
    const { name } = req.params;
    const tool = tools[name.toLowerCase()];
    
    if (!tool) {
        return res.status(404).json({ error: 'Ferramenta não encontrada' });
    }
    
    const exists = fs.existsSync(tool.path);
    res.json({
        id: name.toLowerCase(),
        name: tool.name,
        description: tool.description,
        category: tool.category,
        path: tool.path,
        status: exists ? 'online' : 'offline'
    });
});

/**
 * POST /api/exec - Executar ferramenta
 */
app.post('/api/exec', async (req, res) => {
    const { tool, args, target } = req.body;
    
    // Validar ferramenta
    if (!tool || !tools[tool.toLowerCase()]) {
        return res.status(400).json({ error: 'Ferramenta inválida' });
    }
    
    const toolInfo = tools[tool.toLowerCase()];
    
    // Verificar se ferramenta existe
    if (!fs.existsSync(toolInfo.path)) {
        return res.status(503).json({ error: 'Ferramenta não disponível no servidor' });
    }
    
    // Validar alvo
    if (!target && !['socialfish', 'blackeye'].includes(tool.toLowerCase())) {
        return res.status(400).json({ error: 'Alvo não especificado' });
    }
    
    // Construir comando
    let command;
    const toolPath = toolInfo.path;
    const toolLower = tool.toLowerCase();
    
    switch (toolLower) {
        case 'nmap':
            command = `${toolPath} ${args || '-sV'} ${target}`;
            break;
        case 'sqlmap':
            command = `python3 ${toolPath} -u ${target} --batch ${args || ''}`;
            break;
        case 'hydra':
            command = `${toolPath} ${args || '-l root -P /usr/share/wordlists/rockyou.txt'} ${target} ${args?.split(' ')[0] || 'ssh'}`;
            break;
        case 'nuclei':
            command = `${toolPath} -target ${target} ${args || '-severity critical,high'}`;
            break;
        case 'nikto':
            command = `${toolPath} -h ${target} ${args || ''}`;
            break;
        case 'masscan':
            command = `${toolPath} -p 1-1000 ${target} ${args || '--rate 1000'}`;
            break;
        case 'commix':
            command = `python3 ${toolPath} -u ${target} --batch ${args || ''}`;
            break;
        case 'searchsploit':
            command = `${toolPath} ${target} ${args || ''}`;
            break;
        case 'sherlock':
            command = `${toolPath} ${target} ${args || '--timeout 2'}`;
            break;
        case 'holehe':
            command = `${toolPath} ${target} ${args || ''}`;
            break;
        case 'theharvester':
            command = `${toolPath} -d ${target} ${args || '-b google'}`;
            break;
        case 'socialfish':
            command = `python3 ${toolPath} --help 2>&1 | head -5`;
            break;
        case 'blackeye':
            command = `python3 ${toolPath} 2>&1 | head -5`;
            break;
        default:
            return res.status(400).json({ error: 'Ferramenta não implementada' });
    }
    
    console.log(`[EXEC] ${command}`);
    
    // Executar ferramenta
    exec(command, { timeout: 300000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[ERROR] ${error.message}`);
            return res.json({
                success: false,
                tool: toolInfo.name,
                target,
                error: error.message,
                output: stderr || stdout
            });
        }
        
        res.json({
            success: true,
            tool: toolInfo.name,
            target,
            output: stdout || stderr,
            timestamp: new Date().toISOString()
        });
    });
});

/**
 * GET /api/categories - Lista categorias
 */
app.get('/api/categories', (req, res) => {
    const categories = {};
    
    Object.entries(tools).forEach(([key, tool]) => {
        if (!categories[tool.category]) {
            categories[tool.category] = [];
        }
        categories[tool.category].push({
            id: key,
            name: tool.name,
            description: tool.description,
            status: fs.existsSync(tool.path) ? 'online' : 'offline'
        });
    });
    
    res.json(categories);
});

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICAÇÃO DE FERRAMENTAS
// ═══════════════════════════════════════════════════════════════════════════

async function checkTools() {
    console.log('🔍 Verificando ferramentas de segurança...');
    
    for (const [key, tool] of Object.entries(tools)) {
        try {
            const exists = fs.existsSync(tool.path);
            console.log(`  ${exists ? '✅' : '❌'} ${tool.name}: ${tool.path}`);
        } catch (e) {
            console.log(`  ❌ ${tool.name}: Erro ao verificar - ${e.message}`);
        }
    }
    
    console.log(`\n🛡️ Servidor de ferramentas cyber iniciado na porta ${PORT}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════

checkTools();

app.listen(PORT, () => {
    console.log(`\n🚀 Ferramentas Cyber Server`);
    console.log(`   📍 http://localhost:${PORT}`);
    console.log(`   📊 API: http://localhost:${PORT}/api\n`);
});

// Tratamento de erros
process.on('uncaughtException', (err) => {
    console.error('❌ Erro não tratado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada:', reason);
});
