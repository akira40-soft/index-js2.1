# 📋 Complete Commands Inventory - Akira Bot V21

## Overview
This document provides a comprehensive list of all commands available in the Akira Bot system, categorized by their implementation status.

---

## ✅ FULLY IMPLEMENTED COMMANDS (Working in CommandHandler switch)

### Basic Commands
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| ping | | CommandHandler | ✅ |
| menu | help, ajuda, comandos | CommandHandler | ✅ |
| registrar | register, reg | RegistrationSystem | ✅ |
| dono | owner, criador, creator | CommandHandler | ✅ |

### Level & Economy
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| level | lvl, nivel | LevelSystem | ✅ |
| rank | ranking, top | LevelSystem | ✅ |
| daily | diario | EconomySystem | ✅ |
| atm | banco, saldo, balance | EconomySystem | ✅ |
| transfer | transferir, pagar | EconomySystem | ✅ |

### Media & Stickers
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| sticker | s, fig | StickerViewOnceHandler | ✅ |
| toimg | | StickerViewOnceHandler | ✅ |
| take | roubar | StickerViewOnceHandler | ✅ |
| hd | upscale, remini, enhance | ImageEffects | ✅ |
| removebg | bg, rmbg | ImageEffects | ✅ |

### Audio Effects
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| nightcore | | AudioProcessor | ✅ |
| slow | | AudioProcessor | ✅ |
| bass | | AudioProcessor | ✅ |
| bassboost | | AudioProcessor | ✅ |
| deep | | AudioProcessor | ✅ |
| robot | | AudioProcessor | ✅ |
| reverse | | AudioProcessor | ✅ |
| squirrel | | AudioProcessor | ✅ |
| echo | | AudioProcessor | ✅ |
| 8d | | AudioProcessor | ✅ |

### Download Commands
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| play | p | MediaProcessor | ✅ |
| video | playvid, ytmp4 | MediaProcessor | ✅ |
| mp3 | tomp3 | MediaProcessor | ✅ |
| tts | | AudioProcessor | ✅ |

### Image Search
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| pinterest | pin, image, img | CommandHandler | ✅ |

### Games
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| ttt | tictactoe, jogodavelha | GameSystem | ✅ |
| rps | ppt, pedrapapeltesoura | GameSystem | ✅ |
| guess | adivinhe, advinha | GameSystem | ✅ |
| forca | hangman | GameSystem | ✅ |

### Group Management
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| mute | | GroupManagement | ✅ |
| unmute | desmute | GroupManagement | ✅ |
| kick | ban | GroupManagement | ✅ |
| add | | GroupManagement | ✅ |
| promote | | GroupManagement | ✅ |
| demote | | GroupManagement | ✅ |
| fechar | close | GroupManagement | ✅ |
| abrir | open | GroupManagement | ✅ |
| fixar | pin | GroupManagement | ✅ |
| desfazer | unpin | GroupManagement | ✅ |
| link | | GroupManagement | ✅ |
| revlink | revogar | GroupManagement | ✅ |
| tagall | hidetag, totag | GroupManagement | ✅ |
| welcome | bemvindo | GroupManagement | ✅ |
| goodbye | | GroupManagement | ✅ |
| antilink | | ModerationSystem | ✅ |
| antifake | | ModerationSystem | ✅ |
| antispam | | ModerationSystem | ✅ |
| setdesc | descricao | GroupManagement | ✅ |
| setfoto | fotodogrupo | GroupManagement | ✅ |
| groupinfo | infogrupo, ginfo | GroupManagement | ✅ |
| listar | membros | GroupManagement | ✅ |
| admins | listadmins | GroupManagement | ✅ |

### Security Tools
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| nmap | | AdvancedPentestingToolkit | ✅ |
| sqlmap | | AdvancedPentestingToolkit | ✅ |
| hydra | | AdvancedPentestingToolkit | ✅ |
| nuclei | | AdvancedPentestingToolkit | ✅ |
| whois | | CybersecurityToolkit | ✅ |
| dns | | CybersecurityToolkit | ✅ |
| geo | | CybersecurityToolkit | ✅ |
| commix | | AdvancedPentestingToolkit | ✅ |
| searchsploit | | AdvancedPentestingToolkit | ✅ |

### Premium & Owner
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| premium | vip | SubscriptionManager | ✅ |
| addpremium | addvip | SubscriptionManager | ✅ |
| delpremium | delvip | SubscriptionManager | ✅ |
| donate | doar, buy, comprar | PaymentManager | ✅ |
| broadcast | | CommandHandler | ✅ |

### Fun Commands
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| dado | | CommandHandler | ✅ |
| moeda | caracoroa | CommandHandler | ✅ |
| slot | | CommandHandler | ✅ |
| chance | | CommandHandler | ✅ |
| gay | | CommandHandler | ✅ |
| ship | | CommandHandler | ✅ |

### Profile
| Command | Aliases | Module | Status |
|---------|---------|--------|--------|
| perfil | profile, info | UserProfile | ✅ |
| report | bug, reportar | CommandHandler | ✅ |

---

## ⚠️ COMMANDS THAT EXIST IN MODULES BUT NOT IN COMMANDHANDLER SWITCH

### Image Effects (ImageEffects module)
| Command | Module | Status | Issue |
|---------|--------|--------|-------|
| wasted | ImageEffects | ❌ | Not in switch |
| jail | ImageEffects | ❌ | Not in switch |
| triggered | ImageEffects | ❌ | Not in switch |
| communism | ImageEffects | ❌ | Not in switch |
| sepia | ImageEffects | ❌ | Not in switch |
| grey | ImageEffects | ❌ | Not in switch |
| invert | ImageEffects | ❌ | Not in switch |
| mission | ImageEffects | ❌ | Not in switch |
| angola | ImageEffects | ❌ | Not in switch |
| addbg | ImageEffects | ❌ | Not in switch |
| gay (effect) | ImageEffects | ❌ | Not in switch |

### Grid Tactics Game
| Command | Module | Status | Issue |
|---------|--------|--------|-------|
| gridtactics | GridTacticsGame | ⚠️ | Has case but incomplete |
| grid | GridTacticsGame | ⚠️ | Has case but incomplete |

### Economy System
| Command | Module | Status | Issue |
|---------|--------|--------|-------|
| deposit | EconomySystem | ❌ | Not in switch |
| withdraw | EconomySystem | ❌ | Not in switch |
| transacoes | EconomySystem | ❌ | Not in switch |

### OSINT Framework
| Command | Module | Status | Issue |
|---------|--------|--------|-------|
| dork | OSINTFramework | ❌ | Not in switch (uses CybersecurityToolkit) |
| email | OSINTFramework | ❌ | Not in switch |
| phone | OSINTFramework | ❌ | Not in switch |
| username | OSINTFramework | ❌ | Not in switch |

### Level System Auto-ADM
| Command | Module | Status | Issue |
|---------|--------|--------|-------|
| top | LevelSystem | ⚠️ | Partial implementation |
| autoadm | LevelSystem | ❌ | Not in switch |

### Moderation System
| Command | Module | Status | Issue |
|---------|--------|--------|-------|
| blacklist | ModerationSystem | ❌ | Not in switch |
| mutelist | ModerationSystem | ❌ | Not in switch |
| warn | ModerationSystem | ❌ | Not in switch |
| unwarn | ModerationSystem | ❌ | Not in switch |

---

## 🔧 COMMANDS THAT NEED TO BE FIXED

### Missing Submenus
- Main menu shows categories but submenu commands are not fully implemented:
  - `#menu cyber` - Should show cybersecurity commands
  - `#menu midi` - Should show media commands  
  - `#menugrupo` - Should show group management commands
  - `#menujogos` - Should show game commands
  - `#menudiversao` - Should show fun commands

### Incomplete Implementations
1. **welcome/setwelcome** - Need message customization
2. **goodbye/setgoodbye** - Need message customization
3. **gridtactics** - Game exists but incomplete
4. **anti-image/sticker** - Not in switch

---

## 📝 IMPLEMENTATION PRIORITY

### Priority 1 - Critical (Not Working)
1. Add ImageEffects commands to switch: wasted, jail, triggered, etc.
2. Add GridTactics to switch (complete implementation)
3. Add Economy deposit/withdraw
4. Add submenus to _showMenu

### Priority 2 - Important
1. Add OSINT commands: dork, email, phone, username
2. Add Moderation commands: blacklist, mutelist, warn

### Priority 3 - Nice to Have
1. Add Auto-ADM status command
2. Add transaction history command

---

## 🔍 ROOT CAUSE ANALYSIS

### Why submenus don't work:
The `_showMenu()` method returns a text menu but doesn't handle the submenu parameter. The switch statement in `handle()` doesn't check for submenu commands like `#menu cyber`.

### Why some commands aren't found:
When user types a command that's not in the switch, the system logs "Comando não encontrado" - this is the "comandos não sendo encontrados" issue from the user report.

### Why GridTactics issues:
The GridTactics module has a separate class but is imported differently than GameSystem.

---

## ✅ SOLUTION

The fix requires:
1. Adding missing commands to the CommandHandler switch statement
2. Implementing submenu handling in _showMenu
3. Ensuring GridTacticsGame is properly imported and connected
4. Adding the missing economy commands

See implementation_plan_fix_submenus.md for detailed fix steps.
