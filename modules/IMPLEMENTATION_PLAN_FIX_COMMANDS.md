# Implementation Plan: Fix Missing Commands in Akira Bot

## Overview
Fix the critical issue where many commands exist in modules but are not accessible through the CommandHandler switch statement. This resolves the "comandos não sendo encontrados" problem reported by the user.

## Root Cause Analysis

### Primary Issue: Incomplete CommandHandler Switch
The CommandHandler switch statement is missing many commands that exist in the modules:
- ImageEffects commands (wasted, jail, triggered, etc.)
- Economy commands (withdraw, transacoes)
- OSINT commands (dork, email, phone, username)
- Moderation commands (blacklist, warn, etc.)
- GridTactics game commands

### Secondary Issue: GridTactics Import Problem
GridTacticsGame is imported but not properly connected to the CommandHandler.

## Files to Modify

### 1. modules/CommandHandler.ts
**Changes:**
- Add missing command cases to the switch statement
- Import GridTacticsGame properly
- Add missing handler methods
- Fix GridTactics command implementation

### 2. modules/GridTacticsGame.ts
**Changes:**
- Ensure proper export/import compatibility
- Fix any missing methods referenced in CommandHandler

## Commands to Add

### Image Effects Commands
```typescript
case 'wasted':
case 'jail':
case 'triggered':
case 'communism':
case 'sepia':
case 'grey':
case 'invert':
case 'mission':
case 'angola':
case 'addbg':
    return await this._handleImageEffect(m, command, args);
```

### Economy Commands
```typescript
case 'withdraw':
case 'sacar':
    return await this._handleWithdraw(m, userId, args);

case 'transacoes':
case 'transactions':
    return await this._handleTransactions(m, userId);
```

### OSINT Commands
```typescript
case 'dork':
    if (!isOwner) {
        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
        return true;
    }
    return await this._handleDork(m, args);

case 'email':
    if (!isOwner) {
        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
        return true;
    }
    return await this._handleEmailCheck(m, args);

case 'phone':
    if (!isOwner) {
        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
        return true;
    }
    return await this._handlePhoneLookup(m, args);

case 'username':
    if (!isOwner) {
        await this.bot.reply(m, '🚫 Este comando requer privilégios de administrador.');
        return true;
    }
    return await this._handleUsernameCheck(m, args);
```

### Moderation Commands
```typescript
case 'blacklist':
    if (!isOwner) return false;
    return await this._handleBlacklist(m, args);

case 'mutelist':
    if (!isOwner) return false;
    return await this._handleMuteList(m);

case 'warn':
    if (!isOwner && !isAdminUsers) return false;
    return await this._handleManualWarn(m, args);

case 'unwarn':
case 'resetwarns':
    if (!isOwner && !isAdminUsers) return false;
    return await this._handleResetWarns(m, args);
```

### GridTactics Commands
```typescript
case 'gridtactics':
case 'grid':
    const gameRes = await this.gridTacticsGame.handleGridTactics(chatJid, userId, args[0] || 'start', args.slice(1));
    return await this._reply(m, gameRes.text);
```

## Handler Methods to Add

### Economy Handlers
```typescript
public async _handleWithdraw(m: any, userId: string, args: string[]): Promise<boolean> {
    // Implementation similar to _handleDeposit
}

public async _handleTransactions(m: any, userId: string): Promise<boolean> {
    // Implementation to show transaction history
}
```

### OSINT Handlers
```typescript
public async _handleDork(m: any, args: string[]): Promise<boolean> {
    // Proxy to OSINTFramework
}

public async _handleEmailCheck(m: any, args: string[]): Promise<boolean> {
    // Proxy to OSINTFramework
}

public async _handlePhoneLookup(m: any, args: string[]): Promise<boolean> {
    // Proxy to OSINTFramework
}

public async _handleUsernameCheck(m: any, args: string[]): Promise<boolean> {
    // Proxy to OSINTFramework
}
```

### Moderation Handlers
```typescript
public async _handleBlacklist(m: any, args: string[]): Promise<boolean> {
    // Implementation for blacklist management
}

public async _handleMuteList(m: any): Promise<boolean> {
    // Implementation to show muted users
}
```

## Implementation Steps

### Step 1: Add Missing Command Cases
Add all missing command cases to the switch statement in CommandHandler.ts

### Step 2: Implement Handler Methods
Add the missing handler method implementations

### Step 3: Fix GridTactics Integration
Ensure GridTacticsGame is properly imported and the handleGridTactics method exists

### Step 4: Test Commands
Test that all newly added commands work correctly

## Priority Order

### High Priority (Core Functionality)
1. Image Effects commands (wasted, jail, etc.) - Most requested
2. Economy commands (withdraw, transacoes) - Basic functionality
3. GridTactics commands - Game functionality

### Medium Priority (Advanced Features)
4. OSINT commands (dork, email, phone, username) - Owner only
5. Moderation commands (blacklist, warn) - Admin functionality

## Testing Strategy

### Test Cases
1. Test each new command individually
2. Verify owner/admin permissions work
3. Test error handling for invalid inputs
4. Verify commands appear in menu system

### Regression Testing
1. Ensure existing commands still work
2. Verify no conflicts with existing functionality
3. Test in both group and private chat contexts

## Success Criteria

### Functional Requirements
- [ ] All commands listed in inventory are accessible
- [ ] Commands work with proper permissions
- [ ] Error messages are user-friendly
- [ ] Commands integrate with existing menu system

### Quality Requirements
- [ ] Code follows existing patterns
- [ ] Proper error handling implemented
- [ ] Logging added where appropriate
- [ ] No performance degradation

## Risk Assessment

### Low Risk
- Adding new command cases (follows existing pattern)
- Adding handler methods (follows existing pattern)

### Medium Risk
- GridTactics integration (may need method signature fixes)
- OSINT command permissions (owner-only commands)

### Mitigation Strategies
- Test each command individually before bulk testing
- Have rollback plan (comment out new code if issues)
- Verify with existing command patterns

## Timeline

### Phase 1: Core Commands (1-2 hours)
- Add ImageEffects commands
- Add Economy commands
- Fix GridTactics integration

### Phase 2: Advanced Commands (1-2 hours)
- Add OSINT commands
- Add Moderation commands
- Test all functionality

### Phase 3: Validation (30 minutes)
- Comprehensive testing
- Menu system integration
- Documentation update

## Dependencies

### Internal Dependencies
- All existing modules must be properly initialized
- GridTacticsGame must export handleGridTactics method
- OSINTFramework must have the required methods

### External Dependencies
- No new external dependencies required
- All functionality uses existing libraries

## Documentation Updates

### Update Commands Inventory
- Mark newly implemented commands as ✅
- Update status for any commands that were previously ❌

### Update Menu System
- Ensure new commands appear in appropriate menu categories
- Update help text and examples

## Conclusion

This implementation plan will resolve the core issue of missing commands by systematically adding all command cases to the CommandHandler switch statement and implementing the necessary handler methods. The phased approach ensures quality and minimizes risk of introducing bugs.
