# Implementation Plan

## Overview

This plan addresses three main issues in the Akira Bot V21:
1. **YouTube download metadata error**: Fix the metadata extraction that fails when downloading audio/video
2. **High ping (6s)**: Separate cybersecurity tools to reduce startup load
3. **Create Ferramentas-cyber server**: Host cybersecurity tools on a separate server with Docker

## Issues Identified

### 1. YouTube Metadata Error
- **Problem**: `getYouTubeMetadata()` returns "Não foi possível obter metadados" 
- **Root Cause**: The `_runYtDlpWithFallback` function with `captureOutput=true` doesn't properly capture the JSON output from `--dump-json`
- **Current behavior**: When downloading audio/video, metadata extraction fails even though the download might work

### 2. High Ping (6s)
- **Problem**: Bot startup takes ~6 seconds due to cybersecurity tool verification
- **Root Cause**: `AdvancedPentestingToolkit._checkAvailableTools()` runs during initialization and checks all tools synchronously
- **Impact**: Every startup or command that loads tools adds delay

### 3. Cybersecurity Tools Server
- **Problem**: Tools are bundled with main bot, slowing it down
- **Solution**: Create separate "Ferramentas-cyber" folder with:
  - Independent Express server
  - Docker configuration
  - All cybersecurity tools (nmap, sqlmap, hydra, nuclei, etc.)
- **Main menu**: Should show tools available on external server

## Types

### New Interface for External Tool Server
```
typescript
interface CyberToolServer {
    url: string;
    availableTools: string[];
    status: 'online' | 'offline';
}
```

### YouTube Metadata Response
```
typescript
interface YouTubeMetadata {
    sucesso: boolean;
    titulo?: string;
    canal?: string;
    duracao?: number;
    duracaoFormatada?: string;
    views?: string;
    thumbnail?: string;
    url?: string;
    id?: string;
    error?: string;
}
```

## Files

### New Files to Create
1. **Ferramentas-cyber/**
   - `index.html` - Main page showing available tools
   - `server.js` - Express server for cyber tools
   - `Dockerfile` - Docker configuration
   - `package.json` - Dependencies

2. **modules/CybersecurityToolkit.ts** (MODIFIED)
   - Remove local tool execution
   - Add proxy to external server
   - Update menu references

### Files to Modify

1. **modules/MediaProcessor.ts**
   - Fix `_runYtDlpWithFallback` to properly capture JSON output
   - Add better error handling for metadata extraction

2. **modules/BotCore.ts**
   - Remove or defer AdvancedPentestingToolkit initialization
   - Add lazy loading for cybersecurity tools

3. **modules/CommandHandler.ts**
   - Update menu to reference external cyber tools server

## Functions

### New Functions to Add

1. **Ferramentas-cyber/server.js**
   - `startServer()` - Start Express server
   - `handleToolRequest()` - Route tool requests
   - `getToolsStatus()` - Return available tools

2. **modules/MediaProcessor.ts**
   - `_extractYouTubeJson()` - Extract JSON from yt-dlp output properly

### Modified Functions

1. **MediaProcessor._runYtDlpWithFallback()**
   - Fix JSON capture with `captureOutput=true`
   - Handle multi-line JSON output correctly

2. **MediaProcessor.getYouTubeMetadata()**
   - Better error handling
   - Retry logic for transient failures

3. **BotCore.initializeComponents()**
   - Lazy load AdvancedPentestingToolkit
   - Remove synchronous tool verification

## Classes

### New Classes

1. **CyberToolProxy** (new file)
   - Proxies requests to external cyber tools server
   - Handles fallback to local if server unavailable

### Modified Classes

1. **AdvancedPentestingToolkit**
   - Make tool checking optional/deferred
   - Add lazy initialization

## Dependencies

### New Dependencies
- `express` - For Ferramentas-cyber server
- `cors` - For cross-origin requests

### No New Dependencies for Main Bot

## Testing

### Test YouTube Download
1. Test `#play akira` - Should get metadata and download
2. Test `#video akira` - Should get metadata and download
3. Verify metadata (title, duration, channel) is returned

### Test Startup Performance
1. Measure bot startup time
2. Verify ping is under 2 seconds

### Test Ferramentas-cyber
1. Build Docker container
2. Access server endpoints
3. Verify tools are available

## Implementation Order

### Step 1: Fix YouTube Metadata (Priority: HIGH)
- [ ] Fix `_runYtDlpWithFallback` JSON capture
- [ ] Test YouTube download commands
- [ ] Verify metadata is returned correctly

### Step 2: Create Ferramentas-cyber Server (Priority: MEDIUM)
- [ ] Create folder structure
- [ ] Create Express server
- [ ] Create Dockerfile
- [ ] Create index.html with tool listing

### Step 3: Update Main Bot (Priority: MEDIUM)
- [ ] Update CommandHandler menu
- [ ] Add cyber tool proxy
- [ ] Lazy load AdvancedPentestingToolkit

### Step 4: Testing (Priority: HIGH)
- [ ] Test all YouTube commands
- [ ] Test startup performance
- [ ] Test external server connectivity
