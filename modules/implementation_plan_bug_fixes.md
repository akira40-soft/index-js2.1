# Implementation Plan: Bug Fixes for Akira Bot

## Overview
Fix critical bugs in the Akira Bot system including registration errors, Anti-Link admin check, XP curve, and Welcome/Goodbye system enhancements.

## Types
No new types needed. Focus on fixing existing function signatures and logic.

## Files

### 1. modules/RegistrationSystem.ts
**Changes:**
- Add alias method `register()` that calls `registerUser()` for compatibility with CommandHandler

### 2. modules/ModerationSystem.ts
**Changes:**
- Modify `checkLink()` to accept admin status parameter from caller
- Add method `isUserAdmin(groupId: string, userId: string): Promise<boolean>` or accept admin check as parameter

### 3. modules/BotCore.ts
**Changes:**
- In `handleAntiLinkViolation()`, check if user is admin before kicking
- Get admin status from group metadata before calling checkLink

### 4. modules/LevelSystem.ts
**Changes:**
- Change XP formula from exponential (2^level) to polynomial (level * 100 + level^2 * 10)
- Keep backward compatibility with existing levels

### 5. modules/GroupManagement.ts
**Changes:**
- Add `welcomeStatus(groupJid)` method to check if welcome is on/off
- Add `goodbyeStatus(groupJid)` method to check if goodbye is on/off  
- Add `setWelcomeMessage(groupJid, message)` method
- Add `setGoodbyeMessage(groupJid, message)` method

### 6. modules/CommandHandler.ts
**Changes:**
- Fix `registrationSystem.register` to `registrationSystem.registerUser`
- Add status command for welcome/goodbye
- Add customization commands for welcome/goodbye messages

### 7. modules/RateLimiter.ts (New implementation)
**Changes:**
- Enhance rate limiting to add user to blacklist after exceeding limit
- Add proper warning message system

## Functions

### New Functions to Add:
1. `RegistrationSystem.register()` - Alias for registerUser
2. `GroupManagement.getWelcomeStatus(groupJid)` - Returns on/off status
3. `GroupManagement.getGoodbyeStatus(groupJid)` - Returns on/off status
4. `ModerationSystem.checkLink(text, groupId, userId, isAdmin)` - Enhanced with admin check

### Modified Functions:
1. `BotCore.handleAntiLinkViolation()` - Add admin check before kick
2. `LevelSystem.requiredXp()` - Polynomial formula instead of exponential

## Classes
No new classes. Modifications to existing classes only.

## Dependencies
No new dependencies required.

## Testing
1. Test registration command
2. Test Anti-Link with admin user (should not be blocked)
3. Test XP gain for text messages
4. Test Welcome/Goodbye on/off/status commands
5. Test rate limiting behavior

## Implementation Order

1. **Step 1**: Fix RegistrationSystem - Add register() alias
2. **Step 2**: Fix Anti-Link admin check in ModerationSystem and BotCore
3. **Step 3**: Fix XP curve in LevelSystem
4. **Step 4**: Enhance Welcome/Goodbye system in GroupManagement
5. **Step 5**: Add status commands in CommandHandler
6. **Step 6**: Enhance RateLimiter for blacklist functionality
