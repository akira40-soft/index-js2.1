/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVER - FERRAMENTAS CYBER SERVER (TypeScript)
 * ═══════════════════════════════════════════════════════════════════════════
 * Express server for cybersecurity tools
 * Includes: Nmap, SQLMap, Hydra, Nuclei, Nikto, Masscan, Commix, etc.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import type { Tool, ToolExecutionRequest, ToolExecutionResponse, HealthCheckResponse } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit per IP
    message: { error: 'Too many requests. Please try again later.' }
});
app.use('/api/', limiter);

// ═══════════════════════════════════════════════════════════════════════════
// TOOLS DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

const tools: Record<string, Tool> = {
    // Pentesting
    nmap: {
        name: 'Nmap',
        path: '/usr/bin/nmap',
        description: 'Port and network scanner',
        category: 'pentesting'
    },
    sqlmap: {
        name: 'SQLMap',
        path: '/opt/sqlmap/sqlmap.py',
        description: 'SQL Injection detection',
        category: 'pentesting'
    },
    hydra: {
        name: 'Hydra',
        path: '/usr/bin/hydra',
        description: 'Brute force tool',
        category: 'pentesting'
    },
    nuclei: {
        name: 'Nuclei',
        path: '/usr/local/bin/nuclei',
        description: 'Vulnerability scanner',
        category: 'pentesting'
    },
    nikto: {
        name: 'Nikto',
        path: '/usr/local/bin/nikto',
        description: 'Web server scanner',
        category: 'pentesting'
    },
    masscan: {
        name: 'Masscan',
        path: '/usr/local/bin/masscan',
        description: 'Fast port scanner',
        category: 'pentesting'
    },
    commix: {
        name: 'Commix',
        path: '/usr/local/bin/commix',
        description: 'Command Injection detector',
        category: 'pentesting'
    },
    searchsploit: {
        name: 'SearchSploit',
        path: '/usr/local/bin/searchsploit',
        description: 'Exploit database',
        category: 'pentesting'
    },
    // Phishing
    socialfish: {
        name: 'SocialFish',
        path: '/usr/local/bin/socialfish',
        description: 'Phishing tool',
        category: 'phishing'
    },
    blackeye: {
        name: 'BlackEye',
        path: '/usr/local/bin/blackeye',
        description: 'Phishing page generator',
        category: 'phishing'
    },
    // OSINT
    sherlock: {
        name: 'Sherlock',
        path: '/usr/local/bin/sherlock',
        description: 'Username search',
        category: 'osint'
    },
    holehe: {
        name: 'Holehe',
        path: '/usr/local/bin/holehe',
        description: 'Email verification',
        category: 'osint'
    },
    theharvester: {
        name: 'TheHarvester',
        path: '/usr/local/bin/theharvester',
        description: 'Information gathering',
        category: 'osint'
    },
    netexec: {
        name: 'NetExec (NXC)',
        path: '/usr/local/bin/nxc',
        description: 'Post-exploitation framework',
        category: 'osint'
    },
    winrm: {
        name: 'Evil-WinRM',
        path: '/usr/local/bin/evil-winrm',
        description: 'Windows remote access',
        category: 'osint'
    }
};

// Check tool availability
function checkToolAvailability(): void {
    console.log('🔍 Checking security tools...');
    
    for (const [key, tool] of Object.entries(tools)) {
        try {
            const exists = fs.existsSync(tool.path);
            tools[key].available = exists;
            console.log(`  ${exists ? '✅' : '❌'} ${tool.name}: ${tool.path}`);
        } catch (e) {
            tools[key].available = false;
            console.log(`  ❌ ${tool.name}: Error checking - ${(e as Error).message}`);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET / - Main page
 */
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * GET /api/health - Health check
 */
app.get('/api/health', (req: Request, res: Response) => {
    const toolCount = Object.values(tools).filter(t => t.available).length;
    
    const response: HealthCheckResponse = {
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        tools: {
            total: Object.keys(tools).length,
            available: toolCount,
            unavailable: Object.keys(tools).length - toolCount
        }
    };
    
    res.json(response);
});

/**
 * GET /api/tools - List all tools
 */
app.get('/api/tools', (req: Request, res: Response) => {
    const toolList = Object.entries(tools).map(([key, tool]) => ({
        id: key,
        name: tool.name,
        description: tool.description,
        category: tool.category,
        available: tool.available
    }));
    
    res.json({
        tools: toolList,
        total: toolList.length,
        categories: [...new Set(toolList.map(t => t.category))]
    });
});

/**
 * GET /api/tools/:name - Get specific tool status
 */
app.get('/api/tools/:name', (req: Request, res: Response) => {
    const { name } = req.params;
    const toolName = typeof name === 'string' ? name.toLowerCase() : '';
    const tool = tools[toolName];

    if (!tool) {
        return res.status(404).json({ error: 'Tool not found' });
    }

    res.json({
        id: toolName,
        name: tool.name,
        description: tool.description,
        category: tool.category,
        path: tool.path,
        available: tool.available
    });
});

/**
 * POST /api/exec - Execute a tool
 */
app.post('/api/exec', async (req: Request, res: Response) => {
    const body = req.body as ToolExecutionRequest;
    const tool = body.tool;
    const args = body.args;
    const target = body.target;

    // Validate tool
    if (!tool || typeof tool !== 'string' || !tools[tool.toLowerCase()]) {
        return res.status(400).json({ error: 'Invalid tool' });
    }

    const toolLower = tool.toLowerCase();
    const toolInfo = tools[toolLower];
    
    // Check if tool is available
    if (!toolInfo.available) {
        return res.status(503).json({ error: 'Tool not available on server' });
    }
    
    // Validate target
    if (!target && !['socialfish', 'blackeye'].includes(toolLower)) {
        return res.status(400).json({ error: 'Target not specified' });
    }
    
    // Build command
    let command: string;
    const toolPath = toolInfo.path;
    
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
            return res.status(400).json({ error: 'Tool not implemented' });
    }
    
    console.log(`[EXEC] ${command}`);
    
    // Execute tool
    exec(command, { timeout: 300000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[ERROR] ${error.message}`);
            return res.json({
                success: false,
                tool: toolInfo.name,
                target,
                error: error.message,
                output: stderr || stdout
            } as ToolExecutionResponse);
        }
        
        res.json({
            success: true,
            tool: toolInfo.name,
            target,
            output: stdout || stderr,
            timestamp: new Date().toISOString()
        } as ToolExecutionResponse);
    });
});

/**
 * GET /api/categories - List categories
 */
app.get('/api/categories', (req: Request, res: Response) => {
    const categories: Record<string, Tool[]> = {};

    Object.entries(tools).forEach(([key, tool]) => {
        if (!categories[tool.category]) {
            categories[tool.category] = [];
        }
        categories[tool.category].push({
            ...tool,
            id: key
        } as Tool);
    });

    res.json(categories);
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

checkToolAvailability();

app.listen(PORT, () => {
    console.log(`\n🚀 Ferramentas Cyber Server`);
    console.log(`   📍 http://localhost:${PORT}`);
    console.log(`   📊 API: http://localhost:${PORT}/api\n`);
});

// Process handlers
process.on('uncaughtException', (err: Error) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason: unknown) => {
    console.error('❌ Unhandled Rejection:', reason);
});

export default app;
