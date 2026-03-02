/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES - FERRAMENTAS CYBER SERVER
 * ═══════════════════════════════════════════════════════════════════════
 * TypeScript types for Ferramentas-cyber server
 * ═══════════════════════════════════════════════════════════════════════
 */

export interface Tool {
    name: string;
    path: string;
    description: string;
    category: 'pentesting' | 'phishing' | 'osint' | 'exploitation' | 'social_engineering';
    available?: boolean;
}

export interface ToolExecutionRequest {
    tool: string;
    args?: string;
    target?: string;
    userId?: string;
}

export interface ToolExecutionResponse {
    success: boolean;
    tool: string;
    target?: string;
    output?: string;
    error?: string;
    timestamp: string;
}

export interface UserPermissions {
    tier: 'free' | 'subscriber' | 'owner';
    canUseTool: (toolName: string) => boolean;
    rateLimitRemaining: number;
}

export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

export interface SecurityConfig {
    allowedTargets: string[];
    blockedTargets: string[];
    requireAuth: boolean;
}

export interface HealthCheckResponse {
    status: 'online' | 'offline';
    uptime: number;
    timestamp: string;
    tools: {
        total: number;
        available: number;
        unavailable: number;
    };
}
