#!/bin/sh
# ═══════════════════════════════════════════════════════
# AKIRA BOT — Docker Entrypoint
# ═══════════════════════════════════════════════════════
# Descodifica cookies do YouTube se fornecidos em Base64
# (útil no Railway onde não existe volume persistente)
# ═══════════════════════════════════════════════════════

set -e

# Se YT_COOKIES_BASE64 estiver definido, descodifica e guarda em ficheiro
if [ -n "$YT_COOKIES_BASE64" ]; then
    COOKIES_DIR="/tmp/akira_data/cookies"
    mkdir -p "$COOKIES_DIR"
    COOKIES_FILE="$COOKIES_DIR/youtube_cookies.txt"
    echo "$YT_COOKIES_BASE64" | base64 -d > "$COOKIES_FILE"
    export YT_COOKIES_PATH="$COOKIES_FILE"
    echo "✅ Cookies do YouTube descodificados para: $COOKIES_FILE"
fi

# Cria directorias de dados necessárias
mkdir -p /tmp/akira_data/temp
mkdir -p /tmp/akira_data/auth_info_baileys
mkdir -p /tmp/akira_data/database
mkdir -p /tmp/akira_data/logs
mkdir -p /tmp/akira_data/subscriptions

# ═══════════════════════════════════════════════════════
# FIXAR SYMLINKS DAS FERRAMENTAS
# ═══════════════════════════════════════════════════════
echo "🔧 Corrigindo symlinks de ferramentas..."

# Lista de ferramentas pip e seus possíveis locais
for tool in theHarvester sherlock holehe impacket-psexec impacket-secretsdump searchsploit; do
    # Verifica se o symlink já existe
    if [ ! -L "/usr/local/bin/$tool" ] 2>/dev/null; then
        # Procura pela ferramenta em múltiplos locais
        FOUND=$(find /usr /opt /root -name "$tool" -type f 2>/dev/null | head -1)
        if [ -n "$FOUND" ] && [ -x "$FOUND" ]; then
            ln -sf "$FOUND" "/usr/local/bin/$tool" 2>/dev/null || true
            echo "✅ $tool: linked"
        fi
    fi
done

# Garante que comandos alternativos pip também estejam symlinked
for tool in theharvester netexec evil-winrm; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        FOUND=$(find /usr -name "$tool" -type f 2>/dev/null | head -1)
        if [ -n "$FOUND" ] && [ -x "$FOUND" ]; then
            ln -sf "$FOUND" "/usr/local/bin/$tool" 2>/dev/null || true
            echo "✅ $tool: linked"
        fi
    fi
done

echo "✅ Symlinks corrigidos com sucesso"

# Arranca a aplicação com os argumentos passados ao CMD
exec "$@"
