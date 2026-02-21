#!/bin/bash

#═══════════════════════════════════════════════════════════════════════════
# INSTALL-TOOLS.SH - INSTALAÇÃO DE FERRAMENTAS REAIS PARA AKIRA BOT
#═══════════════════════════════════════════════════════════════════════════
# ✅ YT-DLP - Download de vídeos YouTube
# ✅ NMAP - Port scanning REAL
# ✅ SQLMAP - SQL injection REAL
# ✅ HYDRA - Password cracking REAL
# ✅ NUCLEI - Vulnerability scanning REAL
# ✅ MASSCAN - Fast port scanner REAL
# ✅ NIKTO - Web server scanner REAL
# ✅ COMMIX - Command Injection Scanner (NOVO)
# ✅ SEARCHSPLOIT - Exploit Database (NOVO)
# ✅ FFMPEG - Processamento de mídia
#═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔧 INSTALAÇÃO DE FERRAMENTAS DE PENTESTING - AKIRA BOT${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# ════════════════════════════════════════════════════════════════════
# 1️⃣  SYSTEM UPDATES
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[1/12] Atualizando package manager...${NC}"
if command -v apt-get &> /dev/null; then
    apt-get update -qq
    apt-get upgrade -y -qq
    PKG_MANAGER="apt-get"
elif command -v apk &> /dev/null; then
    apk update
    PKG_MANAGER="apk"
else
    echo -e "${RED}❌ Nenhum package manager encontrado!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Package manager atualizado${NC}\n"

# ════════════════════════════════════════════════════════════════════
# 2️⃣  YT-DLP
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[2/12] Instalando YT-DLP...${NC}"
if ! command -v yt-dlp &> /dev/null; then
    if command -v pip3 &> /dev/null; then
        pip3 install yt-dlp --quiet 2>/dev/null || true
    fi
    if ! command -v yt-dlp &> /dev/null; then
        ARCH=$(uname -m)
        if [ "$ARCH" = "x86_64" ]; then
            DOWNLOAD_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
        else
            DOWNLOAD_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64"
        fi
        curl -L "$DOWNLOAD_URL" -o /usr/local/bin/yt-dlp 2>/dev/null || true
        chmod +x /usr/local/bin/yt-dlp 2>/dev/null || true
    fi
fi
command -v yt-dlp &> /dev/null && echo -e "${GREEN}✅ YT-DLP instalado${NC}" || echo -e "${RED}❌ YT-DLP falhou${NC}"

# ════════════════════════════════════════════════════════════════════
# 3️⃣  NMAP
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[3/12] Instalando NMAP...${NC}"
if ! command -v nmap &> /dev/null; then
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y nmap -qq
    elif [ "$PKG_MANAGER" = "apk" ]; then
        apk add nmap --quiet
    fi
fi
command -v nmap &> /dev/null && echo -e "${GREEN}✅ NMAP instalado${NC}" || echo -e "${RED}❌ NMAP falhou${NC}"

# ════════════════════════════════════════════════════════════════════
# 4️⃣  SQLMAP
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[4/12] Instalando SQLMAP...${NC}"
if [ ! -d "/opt/sqlmap" ]; then
    mkdir -p /opt
    cd /opt
    git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git 2>/dev/null || true
    cd - > /dev/null
fi
if [ -f "/opt/sqlmap/sqlmap.py" ]; then
    chmod +x /opt/sqlmap/sqlmap.py
    [ ! -L "/usr/local/bin/sqlmap" ] && ln -s /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap 2>/dev/null || true
    echo -e "${GREEN}✅ SQLMAP instalado${NC}"
else
    echo -e "${RED}❌ SQLMAP falhou${NC}"
fi

# ════════════════════════════════════════════════════════════════════
# 5️⃣  HYDRA
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[5/12] Instalando HYDRA...${NC}"
if ! command -v hydra &> /dev/null; then
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y hydra -qq
    elif [ "$PKG_MANAGER" = "apk" ]; then
        apk add hydra --quiet
    fi
fi
command -v hydra &> /dev/null && echo -e "${GREEN}✅ HYDRA instalado${NC}" || echo -e "${RED}❌ HYDRA falhou${NC}"

# ════════════════════════════════════════════════════════════════════
# 6️⃣  NUCLEI
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[6/12] Instalando NUCLEI...${NC}"
if ! command -v nuclei &> /dev/null; then
    if command -v go &> /dev/null; then
        go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest 2>/dev/null || true
    fi
    if ! command -v nuclei &> /dev/null; then
        ARCH=$(uname -m)
        if [ "$ARCH" = "x86_64" ]; then
            NUCLEI_URL="https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_amd64.zip"
        else
            NUCLEI_URL="https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_arm64.zip"
        fi
        mkdir -p /tmp/nuclei_install && cd /tmp/nuclei_install
        curl -L "$NUCLEI_URL" -o nuclei.zip 2>/dev/null || true
        unzip -q nuclei.zip 2>/dev/null || true
        [ -f "nuclei" ] && mv nuclei /usr/local/bin/ && chmod +x /usr/local/bin/nuclei
        cd - > /dev/null && rm -rf /tmp/nuclei_install
    fi
fi
command -v nuclei &> /dev/null && echo -e "${GREEN}✅ NUCLEI instalado${NC}" || echo -e "${RED}❌ NUCLEI falhou${NC}"

# ════════════════════════════════════════════════════════════════════
# 7️⃣  MASSCAN
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[7/12] Instalando MASSCAN...${NC}"
if ! command -v masscan &> /dev/null; then
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y masscan -qq 2>/dev/null || true
    elif [ "$PKG_MANAGER" = "apk" ]; then
        apk add masscan --quiet 2>/dev/null || true
    fi
fi
command -v masscan &> /dev/null && echo -e "${GREEN}✅ MASSCAN instalado${NC}" || echo -e "${YELLOW}⚠️  MASSCAN opcional${NC}"

# ════════════════════════════════════════════════════════════════════
# 8️⃣  NIKTO
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[8/12] Instalando NIKTO...${NC}"
if ! command -v nikto &> /dev/null; then
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y nikto -qq 2>/dev/null || true
    elif [ "$PKG_MANAGER" = "apk" ]; then
        apk add nikto --quiet 2>/dev/null || true
    fi
    if ! command -v nikto &> /dev/null; then
        mkdir -p /opt && cd /opt
        git clone https://github.com/sullo/nikto.git 2>/dev/null || true
        cd nikto/program && chmod +x nikto.pl
        [ ! -L "/usr/local/bin/nikto" ] && ln -s /opt/nikto/program/nikto.pl /usr/local/bin/nikto 2>/dev/null || true
        cd - > /dev/null
    fi
fi
command -v nikto &> /dev/null && echo -e "${GREEN}✅ NIKTO instalado${NC}" || echo -e "${RED}❌ NIKTO falhou${NC}"

# ════════════════════════════════════════════════════════════════════
# 9️⃣  COMMIX (NOVO)
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[9/12] Instalando COMMIX...${NC}"
if ! command -v commix &> /dev/null; then
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y commix -qq 2>/dev/null || true
    fi
    # Se não conseguir via apt, instalar via pip
    if ! command -v commix &> /dev/null; then
        pip3 install commix --quiet 2>/dev/null || true
    fi
fi
command -v commix &> /dev/null && echo -e "${GREEN}✅ COMMIX instalado${NC}" || echo -e "${YELLOW}⚠️  COMMIX opcional (pip install commix)${NC}"

# ════════════════════════════════════════════════════════════════════
# 🔟  SEARCHSPLOIT (NOVO)
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[10/12] Instalando SEARCHSPLOIT...${NC}"
if ! command -v searchsploit &> /dev/null; then
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y exploitdb -qq 2>/dev/null || true
    fi
fi
command -v searchsploit &> /dev/null && echo -e "${GREEN}✅ SEARCHSPLOIT instalado${NC}" || echo -e "${YELLOW}⚠️  SEARCHSPLOIT opcional (apt-get install exploitdb)${NC}"

# ════════════════════════════════════════════════════════════════════
# 1️⃣1️⃣  FFMPEG
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[11/12] Instalando FFMPEG...${NC}"
if ! command -v ffmpeg &> /dev/null; then
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y ffmpeg -qq
    elif [ "$PKG_MANAGER" = "apk" ]; then
        apk add ffmpeg --quiet
    fi
fi
command -v ffmpeg &> /dev/null && echo -e "${GREEN}✅ FFMPEG instalado${NC}" || echo -e "${RED}❌ FFMPEG falhou${NC}"

# ════════════════════════════════════════════════════════════════════
# 1️⃣2️⃣  PYTHON E DEPENDÊNCIAS
# ════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[12/12] Instalando dependências Python...${NC}"
if command -v pip3 &> /dev/null; then
    pip3 install --quiet pip setuptools wheel 2>/dev/null || true
    pip3 install --quiet python-dotenv requests beautifulsoup4 lxml 2>/dev/null || true
    echo -e "${GREEN}✅ Dependências Python instaladas${NC}"
else
    echo -e "${YELLOW}⚠️  pip3 não encontrado${NC}"
fi

# ════════════════════════════════════════════════════════════════════
# RESUMO FINAL
# ════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 RESUMO DA INSTALAÇÃO${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

# Criar diretório de resultados
mkdir -p /tmp/pentest_results

# Criar arquivo de verificação
cat > /tmp/tools_installed.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "system": "$(uname -a)",
  "tools": {
    "yt-dlp": "$(command -v yt-dlp 2>/dev/null || echo 'NOT_INSTALLED')",
    "nmap": "$(command -v nmap 2>/dev/null || echo 'NOT_INSTALLED')",
    "sqlmap": "$(command -v sqlmap 2>/dev/null || echo '/opt/sqlmap/sqlmap.py')",
    "hydra": "$(command -v hydra 2>/dev/null || echo 'NOT_INSTALLED')",
    "nuclei": "$(command -v nuclei 2>/dev/null || echo 'NOT_INSTALLED')",
    "masscan": "$(command -v masscan 2>/dev/null || echo 'NOT_INSTALLED')",
    "nikto": "$(command -v nikto 2>/dev/null || echo 'NOT_INSTALLED')",
    "commix": "$(command -v commix 2>/dev/null || echo 'NOT_INSTALLED')",
    "searchsploit": "$(command -v searchsploit 2>/dev/null || echo 'NOT_INSTALLED')",
    "ffmpeg": "$(command -v ffmpeg 2>/dev/null || echo 'NOT_INSTALLED')"
  }
}
EOF

echo -e "${GREEN}✅ Instalação concluída!${NC}\n"
echo -e "${BLUE}📝 Arquivo de verificação: /tmp/tools_installed.json${NC}\n"

exit 0
