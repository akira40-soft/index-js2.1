<<<<<<< HEAD
# TODO - Correções de Segurança e Otimização

## Progresso

- [ ] 1. Atualizar Dockerfile.railway com dependências Perl
- [ ] 2. Modificar AdvancedPentestingToolkit.ts para tratar erros de Perl
- [ ] 3. Atualizar BotCore.ts - remover opção deprecated e otimizar logs
- [ ] 4. Verificar MessageProcessor.ts deduplicação
- [ ] 5. Testar build e verificar logs

## Detalhes das Correções

### 1. Dockerfile.railway
- Adicionar `perl-json` e `perl-xml-writer` ao apk add
- Verificar instalação do searchsploit (criar symlink correto)
- Verificar instalação do theharvester

### 2. AdvancedPentestingToolkit.ts
- Tratar erro específico de módulos Perl no nikto
- Suprimir mensagens de erro de módulos faltantes no log
- Adicionar verificação mais robusta para ferramentas Python

### 3. BotCore.ts
- Remover `printQRInTerminal: true` (deprecated)
- Reduzir frequência de logs "PIPELINE 1" (usar debug em vez de warn)
- Verificar se há múltiplos listeners sendo registrados

### 4. MessageProcessor.ts
- Verificar lógica de deduplicação de mensagens
- Garantir que não há processamento duplicado
=======
# TODO - Correções de Segurança e Otimização

## Progresso

- [ ] 1. Atualizar Dockerfile.railway com dependências Perl
- [ ] 2. Modificar AdvancedPentestingToolkit.ts para tratar erros de Perl
- [ ] 3. Atualizar BotCore.ts - remover opção deprecated e otimizar logs
- [ ] 4. Verificar MessageProcessor.ts deduplicação
- [ ] 5. Testar build e verificar logs

## Detalhes das Correções

### 1. Dockerfile.railway
- Adicionar `perl-json` e `perl-xml-writer` ao apk add
- Verificar instalação do searchsploit (criar symlink correto)
- Verificar instalação do theharvester

### 2. AdvancedPentestingToolkit.ts
- Tratar erro específico de módulos Perl no nikto
- Suprimir mensagens de erro de módulos faltantes no log
- Adicionar verificação mais robusta para ferramentas Python

### 3. BotCore.ts
- Remover `printQRInTerminal: true` (deprecated)
- Reduzir frequência de logs "PIPELINE 1" (usar debug em vez de warn)
- Verificar se há múltiplos listeners sendo registrados

### 4. MessageProcessor.ts
- Verificar lógica de deduplicação de mensagens
- Garantir que não há processamento duplicado
>>>>>>> bca33df3e80ad01e3a871bb67a7d0a8ff9a621a3
