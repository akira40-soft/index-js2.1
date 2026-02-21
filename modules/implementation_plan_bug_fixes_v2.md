# Implementation Plan: Comprehensive Bug Fixes for Akira Bot

## Overview
Fix critical bugs in the Akira Bot system including registration errors, Anti-Link admin check, XP curve, Welcome/Goodbye system enhancements, and Rate Limiting improvements with blacklist functionality.

## Issues Identified

### 1. Registration Error
- **Problem**: `this.registrationSystem.register is not a function` error
- **Root Cause**: In `_handleRegister`, the `register()` method is called with only 3 parameters (uid, name, age) but it expects 4 parameters (uid, name, age, serial). Additionally, the method generates serial internally but the call doesn't match the expected signature.
- **Additional Issue**: `RegistrationSystem` doesn't have `getProfile()` method (used in CommandHandler) - only `getUser()` exists

### 2. Registration Logic Error (Groups vs PV)
- **Problem**: Registration is being required in groups when it should only be required in PV
- **Current Behavior**: All commands check registration globally
- **Expected Behavior**: Groups should allow unregistered users, only PV should require registration

### 3. Welcome/Goodbye System Missing Features
- **Problem**: Missing commands for viewing status and customizing messages
- **Missing Commands**:
  - `#welcome status` - Show welcome on/off status
  - `#goodbye status` - Show goodbye on/off status  
  - `#setwelcome [message]` - Custom welcome message
  - `#setgoodbye [message]` - Custom goodbye message

### 4. Anti-Link Missing Admin Check
- **Problem**: Anti-Link doesn't check if user is admin before kicking
- **Current**: Anyone can be kicked including admins
- **Expected**: Admins should be exempt from Anti-Link

### 5. Rate Limiting Issues
- **Problem**: System doesn't warn users before blocking, and doesn't add to blacklist after repeated violations
- **Expected Behavior**:
  - Warn at 80% of limit
  - Block at 100% with warning message
  - If user tries again after being blocked (without waiting 1 hour), add to blacklist

### 6. Level System XP Formula
- **Problem**: Current exponential formula (2^level) makes it impossible to level up after level 10
- **Expected**: Polynomial formula (level * 100 + level^2 * 10)

### 7. XP Not Given for Text Messages
- **Problem**: XP only given for commands and images, not regular text messages
- **Expected**: Give XP for all messages (text, image, etc.)

## Types

### New Interface for Registration
```
typescript
interface RegisteredUser {
    id: string;
    name: string;
    age: number;
    serial: string;
    link: string;
    registeredAt: string;
    platform: string;
}
```

### New Interface for Welcome/Goodbye Settings
```
typescript
interface GroupWelcomeSettings {
    welcome: boolean;
    goodbye: boolean;
    welcomeMessage?: string;
    goodbyeMessage?: string;
}
```

## Files

### 1. modules/RegistrationSystem.ts
**Changes:**
- Add `getProfile()` method (alias for getUser()) for compatibility
- Fix `register()` to auto-generate serial if not provided
- Add `link` property to user object for registration confirmation

### 2. modules/CommandHandler.ts
**Changes:**
- Fix `_handleRegister()` to properly use registration system
- Add logic to skip registration check for groups (only require in PV)
- Add new commands for Welcome/Goodbye status and customization
- Add rate limit warning message to users

### 3. modules/GroupManagement.ts
**Changes:**
- Add `goodbye` case in handleCommand switch
- Add methods for getting/setting goodbye messages
- Add methods for getting welcome/goodbye status
- Fix handleCommand to include 'goodbye' case

### 4. modules/ModerationSystem.ts
**Changes:**
- Fix `checkLink()` to accept and check admin status
- Enhance rate limiting to send warning messages before blocking
- Add logic to add user to blacklist after blocked + retry without waiting

### 5. modules/LevelSystem.ts
**Changes:**
- Fix `requiredXp()` formula from exponential to polynomial
- Add text message XP awarding in message processing

### 6. modules/BotCore.ts
**Changes:**
- Add admin check in Anti-Link handling
- Add XP award for text messages
- Fix message processing to call XP system

## Functions

### New Functions to Add:

1. **RegistrationSystem.getProfile(uid)** - Alias for getUser()
2. **RegistrationSystem.generateSerial()** - Generate unique serial
3. **GroupManagement.getWelcomeStatus(groupJid)** - Returns welcome on/off status (already exists, verify)
4. **GroupManagement.getGoodbyeStatus(groupJid)** - Returns goodbye on/off status (already exists, verify)
5. **ModerationSystem.checkLinkWithAdminCheck()** - Enhanced checkLink with admin verification
6. **ModerationSystem.handleRateLimitWithWarning()** - Rate limit with warning messages

### Modified Functions:

1. **CommandHandler._handleRegister()** - Fix parameter passing and serial generation
2. **CommandHandler._handleWelcome()** - Add status, setwelcome, setgoodbye cases
3. **ModerationSystem.checkLink()** - Add admin parameter and check
4. **LevelSystem.requiredXp()** - Change formula to polynomial
5. **BotCore.processMessage()** - Add XP for text messages

## Classes

### Modified Classes:

1. **RegistrationSystem**
   - Add getProfile() method
   - Fix register() to auto-generate serial

2. **CommandHandler**
   - Fix registration logic for groups
   - Add welcome/goodbye status commands

3. **GroupManagement**
   - Add goodbye command handling
   - Add status getters

4. **ModerationSystem**
   - Add admin check in checkLink
   - Enhance rate limiting

5. **LevelSystem**
   - Fix XP formula

6. **BotCore**
   - Add Anti-Link admin check
   - Add text XP awarding

## Dependencies

No new dependencies required.

## Testing

1. Test registration command - should work without errors
2. Test Anti-Link with admin user - should not be blocked
3. Test XP gain for text messages
4. Test Welcome/Goodbye on/off/status commands
5. Test rate limiting behavior - warning at 80%, block at 100%
6. Test blacklist after repeated violations

## Implementation Order

### Step 1: Fix RegistrationSystem
- Add getProfile() method
- Fix register() auto-serial generation
- Verify registerUser() signature

### Step 2: Fix CommandHandler Registration
- Fix _handleRegister() to call properly
- Add group vs PV logic

### Step 3: Fix Welcome/Goodbye System
- Add missing commands in CommandHandler
- Add goodbye handling in GroupManagement

### Step 4: Fix Anti-Link Admin Check
- Update ModerationSystem.checkLink()
- Update BotCore message processing

### Step 5: Fix Rate Limiting
- Add warning messages
- Add blacklist logic for retry after block

### Step 6: Fix Level System XP
- Change formula to polynomial
- Add text message XP

## Task Progress

- [x] Step 1: Fix RegistrationSystem - Added getProfile() method, fixed register() to auto-generate serial
- [x] Step 2: Fix CommandHandler Registration - Registration now only required in PV, not in groups
- [x] Step 3: Fix Welcome/Goodbye System - Added status commands for welcome and goodbye
- [x] Step 4: Fix Anti-Link Admin Check - Already implemented in ModerationSystem.checkLink() with isAdmin parameter
- [x] Step 5: Fix Rate Limiting - Already implemented with warning at 80% and auto-blacklist after 3 violations
- [x] Step 6: Fix Level System XP - Changed from exponential (2^level) to polynomial formula
