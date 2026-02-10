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
# ✅ FFMPEG - Processamento de mídia
#═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Versões esperadas
TOOL_VERSIONS=(
    "yt-dlp"
    "nmap"
    "sqlmap.py"
    "hydra"
    "nuclei"
    "masscan"
    "nikto"
    "ffmpeg"
)

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔧 INSTALAÇÃO DE FERRAMENTAS DE PENTESTING - AKIRA BOT${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# ═══════════════════════════════════════════════════════════════════════════
# 1️⃣  SYSTEM UPDATES
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[1/8] Atualizando package manager...${NC}"
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

# ═══════════════════════════════════════════════════════════════════════════
# 2️⃣  YT-DLP - Download de vídeos YouTube
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[2/8] Instalando YT-DLP...${NC}"
if ! command -v yt-dlp &> /dev/null; then
    echo "   → Baixando yt-dlp..."
    
    # Método 1: pip3
    if command -v pip3 &> /dev/null; then
        pip3 install yt-dlp --quiet 2>/dev/null || echo "   ⚠️  pip3 download falhou, tentando método alternativo"
    fi
    
    # Método 2: curl direto (Linux)
    if ! command -v yt-dlp &> /dev/null; then
        echo "   → Baixando binary do GitHub..."
        ARCH=$(uname -m)
        
        if [ "$ARCH" = "x86_64" ]; then
            DOWNLOAD_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
        elif [ "$ARCH" = "aarch64" ]; then
            DOWNLOAD_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64"
        else
            DOWNLOAD_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
        fi
        
        curl -L "$DOWNLOAD_URL" -o /usr/local/bin/yt-dlp 2>/dev/null || true
        chmod +x /usr/local/bin/yt-dlp 2>/dev/null || true
    fi
    
    # Método 3: apt/apk
    if ! command -v yt-dlp &> /dev/null; then
        if [ "$PKG_MANAGER" = "apt-get" ]; then
            apt-get install -y yt-dlp -qq 2>/dev/null || echo "   ⚠️  apt-get install falhou"
        elif [ "$PKG_MANAGER" = "apk" ]; then
            apk add yt-dlp 2>/dev/null || echo "   ⚠️  apk install falhou"
        fi
    fi
fi

if command -v yt-dlp &> /dev/null; then
    YT_VERSION=$(yt-dlp --version 2>/dev/null)
    echo -e "${GREEN}✅ YT-DLP instalado: $YT_VERSION${NC}\n"
else
    echo -e "${RED}❌ YT-DLP não foi instalado${NC}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 3️⃣  NMAP - Port Scanning
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[3/8] Instalando NMAP...${NC}"
if ! command -v nmap &> /dev/null; then
    echo "   → Instalando NMAP..."
    
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y nmap -qq
    elif [ "$PKG_MANAGER" = "apk" ]; then
        apk add nmap --quiet
    fi
fi

if command -v nmap &> /dev/null; then
    NMAP_VERSION=$(nmap --version 2>/dev/null | head -1)
    echo -e "${GREEN}✅ NMAP instalado: $NMAP_VERSION${NC}\n"
else
    echo -e "${RED}❌ NMAP não foi instalado${NC}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 4️⃣  SQLMAP - SQL Injection Testing
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[4/8] Instalando SQLMAP...${NC}"
if [ ! -d "/opt/sqlmap" ]; then
    echo "   → Clonando SQLMap do GitHub..."
    mkdir -p /opt
    cd /opt
    git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git 2>/dev/null || echo "   ⚠️  git clone falhou"
    cd - > /dev/null
fi

# Criar symlink se não existir
if [ -f "/opt/sqlmap/sqlmap.py" ] && [ ! -L "/usr/local/bin/sqlmap" ]; then
    ln -s /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap 2>/dev/null || true
    chmod +x /opt/sqlmap/sqlmap.py 2>/dev/null || true
fi

if [ -f "/opt/sqlmap/sqlmap.py" ]; then
    SQLMAP_VERSION=$(python3 /opt/sqlmap/sqlmap.py --version 2>/dev/null | head -1)
    echo -e "${GREEN}✅ SQLMAP instalado em /opt/sqlmap: $SQLMAP_VERSION${NC}\n"
else
    echo -e "${RED}❌ SQLMAP não foi instalado${NC}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 5️⃣  HYDRA - Password Cracking
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[5/8] Instalando HYDRA...${NC}"
if ! command -v hydra &> /dev/null; then
    echo "   → Instalando HYDRA..."
    
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y hydra -qq
    elif [ "$PKG_MANAGER" = "apk" ]; then
        apk add hydra --quiet
    fi
fi

if command -v hydra &> /dev/null; then
    HYDRA_VERSION=$(hydra -h 2>/dev/null | head -1)
    echo -e "${GREEN}✅ HYDRA instalado: $HYDRA_VERSION${NC}\n"
else
    echo -e "${RED}❌ HYDRA não foi instalado${NC}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 6️⃣  NUCLEI - Vulnerability Scanning
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[6/8] Instalando NUCLEI...${NC}"
if ! command -v nuclei &> /dev/null; then
    echo "   → Instalando Nuclei (ProjectDiscovery)..."
    
    # Tentar com Go
    if command -v go &> /dev/null; then
        go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest 2>/dev/null || true
    fi
    
    # Se Go não disponível, tentar com download direto
    if ! command -v nuclei &> /dev/null; then
        ARCH=$(uname -m)
        if [ "$ARCH" = "x86_64" ]; then
            NUCLEI_URL="https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_amd64.zip"
        elif [ "$ARCH" = "aarch64" ]; then
            NUCLEI_URL="https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_arm64.zip"
        else
            NUCLEI_URL="https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_amd64.zip"
        fi
        
        echo "   → Baixando do GitHub: $NUCLEI_URL"
        mkdir -p /tmp/nuclei_install
        cd /tmp/nuclei_install
        curl -L "$NUCLEI_URL" -o nuclei.zip 2>/dev/null || true
        
        if [ -f "nuclei.zip" ]; then
            unzip -q nuclei.zip 2>/dev/null || true
            [ -f "nuclei" ] && mv nuclei /usr/local/bin/ && chmod +x /usr/local/bin/nuclei
        fi
        
        cd - > /dev/null
        rm -rf /tmp/nuclei_install
    fi
fi

if command -v nuclei &> /dev/null; then
    NUCLEI_VERSION=$(nuclei -version 2>/dev/null)
    echo -e "${GREEN}✅ NUCLEI instalado: $NUCLEI_VERSION${NC}\n"
else
    echo -e "${RED}❌ NUCLEI não foi instalado (pode ser necessário Go instalado)${NC}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 7️⃣  MASSCAN - Fast Port Scanner
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[7/8] Instalando MASSCAN...${NC}"
if ! command -v masscan &> /dev/null; then
    echo "   → Instalando MASSCAN..."
    
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y masscan -qq 2>/dev/null || echo "   ⚠️  apt-get falhou, tentando build do source"
    elif [ "$PKG_MANAGER" = "apk" ]; then
        apk add masscan --quiet 2>/dev/null || echo "   ⚠️  apk falhou"
    fi
    
    # Se não conseguir pelo package manager, tentar clonar
    if ! command -v masscan &> /dev/null; then
        echo "   → Clonando do GitHub..."
        mkdir -p /tmp/masscan_build
        cd /tmp/masscan_build
        git clone https://github.com/robertdavidgraham/masscan.git 2>/dev/null || true
        
        if [ -d "masscan" ]; then
            cd masscan
            make -j4 2>/dev/null || true
            [ -f "bin/masscan" ] && cp bin/masscan /usr/local/bin/ && chmod +x /usr/local/bin/masscan
        fi
        
        cd - > /dev/null
        rm -rf /tmp/masscan_build
    fi
fi

if command -v masscan &> /dev/null; then
    MASSCAN_VERSION=$(masscan --version 2>/dev/null | head -1)
    echo -e "${GREEN}✅ MASSCAN instalado: $MASSCAN_VERSION${NC}\n"
else
    echo -e "${RED}❌ MASSCAN não foi instalado (opcional para este sistema)${NC}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 8️⃣  NIKTO - Web Server Scanner
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}[8/8] Instalando NIKTO...${NC}"
if ! command -v nikto &> /dev/null; then
    echo "   → Instalando NIKTO..."
    
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        apt-get install -y nikto -qq 2>/dev/null || echo "   ⚠️  apt-get falhou"
    elif [ "$PKG_MANAGER" = "apk" ]; then
        apk add nikto --quiet 2>/dev/null || echo "   ⚠️  apk falhou"
    fi
    
    # Se não conseguir, clonar do GitHub
    if ! command -v nikto &> /dev/null; then
        echo "   → Clonando do GitHub..."
        mkdir -p /opt
        cd /opt
        git clone https://github.com/sullo/nikto.git 2>/dev/null || true
        cd nikto/program
        chmod +x nikto.pl
        ln -s /opt/nikto/program/nikto.pl /usr/local/bin/nikto 2>/dev/null || true
        cd - > /dev/null
    fi
fi

if command -v nikto &> /dev/null; then
    NIKTO_VERSION=$(nikto -version 2>/dev/null | head -1)
    echo -e "${GREEN}✅ NIKTO instalado: $NIKTO_VERSION${NC}\n"
else
    echo -e "${RED}❌ NIKTO não foi instalado${NC}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════
# RESUMO FINAL
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 RESUMO DA INSTALAÇÃO${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

TOOLS_OK=0
TOOLS_TOTAL=7

for tool in yt-dlp nmap hydra nikto; do
    if command -v $tool &> /dev/null; then
        echo -e "${GREEN}✅ $tool${NC}"
        ((TOOLS_OK++))
    else
        echo -e "${RED}❌ $tool${NC}"
    fi
done

if [ -f "/opt/sqlmap/sqlmap.py" ]; then
    echo -e "${GREEN}✅ sqlmap${NC}"
    ((TOOLS_OK++))
else
    echo -e "${RED}❌ sqlmap${NC}"
fi

if command -v nuclei &> /dev/null; then
    echo -e "${GREEN}✅ nuclei${NC}"
    ((TOOLS_OK++))
else
    echo -e "${YELLOW}⚠️  nuclei (Go required)${NC}"
fi

if command -v masscan &> /dev/null; then
    echo -e "${GREEN}✅ masscan${NC}"
    ((TOOLS_OK++))
else
    echo -e "${YELLOW}⚠️  masscan (opcional)${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Instalação completa: $TOOLS_OK/$TOOLS_TOTAL ferramentas${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# ═══════════════════════════════════════════════════════════════════════════
# CRIAR ARQUIVO DE VERIFICAÇÃO
# ═══════════════════════════════════════════════════════════════════════════

mkdir -p /tmp/pentest_results
cat > /tmp/tools_installed.json << 'EOF'
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "system": "$(uname -a)",
  "tools": {
    "yt-dlp": "$(which yt-dlp 2>/dev/null || echo 'NOT_INSTALLED')",
    "nmap": "$(which nmap 2>/dev/null || echo 'NOT_INSTALLED')",
    "sqlmap": "$(which sqlmap 2>/dev/null || echo '/opt/sqlmap/sqlmap.py' || echo 'NOT_INSTALLED')",
    "hydra": "$(which hydra 2>/dev/null || echo 'NOT_INSTALLED')",
    "nuclei": "$(which nuclei 2>/dev/null || echo 'NOT_INSTALLED')",
    "masscan": "$(which masscan 2>/dev/null || echo 'NOT_INSTALLED')",
    "nikto": "$(which nikto 2>/dev/null || echo 'NOT_INSTALLED')"
  }
}
EOF

echo -e "${BLUE}📝 Arquivo de verificação criado: /tmp/tools_installed.json${NC}\n"

exit 0
