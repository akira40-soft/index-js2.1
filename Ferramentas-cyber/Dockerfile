# ═══════════════════════════════════════════════════════════════════════════
# FERRAMENTAS CYBER DOCKERFILE - RAILWAY READY
# ═══════════════════════════════════════════════════════════════════════════
# Servidor Docker independente com ferramentas de Cybersecurity
# Otimizado para Railway deployment
# ═══════════════════════════════════════════════════════════════════════════

FROM node:18-alpine

# ═══════════════════════════════════════════════════════════════════════════
# VARIÁVEIS DE AMBIENTE
# ═══════════════════════════════════════════════════════════════════════════
ENV NODE_ENV=production \
    PORT=3001 \
    NODE_OPTIONS="--dns-result-order=ipv4first --no-warnings"

# ═══════════════════════════════════════════════════════════════════════════
# INSTALAÇÃO DE FERRAMENTAS DE SEGURANÇA
# ═══════════════════════════════════════════════════════════════════════════

# Atualizar Alpine
RUN apk update && apk upgrade

# Instalar ferramentas de sistema e Python
RUN apk add --no-cache \
    git \
    curl \
    wget \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    ffmpeg \
    ca-certificates \
    openssl \
    openssl-dev \
    zlib-dev \
    bash \
    libffi-dev \
    sqlite-dev \
    postgresql-dev \
    whois \
    bind-tools \
    nmap \
    iputils \
    nikto \
    hydra \
    rust \
    cargo \
    musl-dev \
    perl-net-ssleay \
    perl-libwww \
    perl-json \
    perl-xml-writer \
    python3-dev \
    py3-pip \
    py3-setuptools \
    libxml2-dev \
    libxslt-dev \
    ruby-dev \
    ruby-full

# ═══════════════════════════════════════════════════════════════════════════
# INSTALAÇÃO DE FERRAMENTAS DE PENTESTING
# ═══════════════════════════════════════════════════════════════════════════

# SQLMap
RUN mkdir -p /opt && \
    cd /opt && \
    git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git || true && \
    ([ -f /opt/sqlmap/sqlmap.py ] && chmod +x /opt/sqlmap/sqlmap.py && ln -s /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap || true)

# Nuclei
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        NUCLEI_URL="https://github.com/projectdiscovery/nuclei/releases/download/v3.3.0/nuclei_3.3.0_linux_amd64.zip"; \
    elif [ "$ARCH" = "aarch64" ]; then \
        NUCLEI_URL="https://github.com/projectdiscovery/nuclei/releases/download/v3.3.0/nuclei_3.3.0_linux_arm64.zip"; \
    else \
        NUCLEI_URL="https://github.com/projectdiscovery/nuclei/releases/download/v3.3.0/nuclei_3.3.0_linux_amd64.zip"; \
    fi && \
    mkdir -p /tmp/nuclei_install && \
    cd /tmp/nuclei_install && \
    curl -L "$NUCLEI_URL" -o nuclei.zip && \
    unzip -q nuclei.zip && \
    mv nuclei /usr/local/bin/ && \
    chmod +x /usr/local/bin/nuclei && \
    cd - && \
    rm -rf /tmp/nuclei_install || true

# Masscan
RUN mkdir -p /tmp/masscan_build && \
    cd /tmp/masscan_build && \
    (git clone https://github.com/robertdavidgraham/masscan.git && \
    cd masscan && \
    make -j4 && \
    cp bin/masscan /usr/local/bin/ && \
    chmod +x /usr/local/bin/masscan || true) && \
    cd - && \
    rm -rf /tmp/masscan_build || true

# SearchSploit (ExploitDB)
RUN cd /opt && \
    git clone --depth 1 https://github.com/offensive-security/exploitdb.git exploitdb || true && \
    if [ -f /opt/exploitdb/searchsploit ]; then \
        chmod +x /opt/exploitdb/searchsploit && \
        ln -sf /opt/exploitdb/searchsploit /usr/local/bin/searchsploit; \
    fi || true

# Commix
RUN cd /opt && \
    git clone https://github.com/commixproject/commix.git commix || true && \
    ([ -f /opt/commix/commix.py ] && ln -s /opt/commix/commix.py /usr/local/bin/commix && chmod +x /opt/commix/commix.py || true)

# ═══════════════════════════════════════════════════════════════════════════
# INSTALAÇÃO DE FERRAMENTAS VIA PIP
# ═══════════════════════════════════════════════════════════════════════════

RUN pip3 install --no-cache-dir --break-system-packages \
    impacket \
    sherlock-project \
    holehe \
    theHarvester 2>/dev/null || true && \
    for tool in theHarvester sherlock holehe; do \
        which "$tool" >/dev/null 2>&1 && ln -sf $(which "$tool") /usr/local/bin/"$tool" 2>/dev/null || true; \
    done && \
    which impacket-psexec >/dev/null 2>&1 && ln -sf $(which impacket-psexec) /usr/local/bin/impacket-psexec || true

# NetExec (NXC)
RUN pip3 install --no-cache-dir --break-system-packages git+https://github.com/Pennyw0rth/NetExec && \
    ln -sf $(which nxc) /usr/local/bin/nxc || true

# Evil-WinRM
RUN gem install evil-winrm && \
    ln -sf $(which evil-winrm) /usr/local/bin/evil-winrm || true

# ═══════════════════════════════════════════════════════════════════════════
# INSTALAÇÃO DE FERRAMENTAS DE PHISHING
# ═══════════════════════════════════════════════════════════════════════════

# SocialFish
RUN cd /opt && \
    git clone https://github.com/UndeadSec/SocialFish.git socialfish || true && \
    if [ -f /opt/socialfish/SocialFish.py ]; then \
        chmod +x /opt/socialfish/SocialFish.py && \
        ln -sf /opt/socialfish/SocialFish.py /usr/local/bin/socialfish; \
    elif [ -f /opt/socialfish/socialfish.py ]; then \
        chmod +x /opt/socialfish/socialfish.py && \
        ln -sf /opt/socialfish/socialfish.py /usr/local/bin/socialfish; \
    fi || true

# BlackEye
RUN cd /opt && \
    git clone https://github.com/thelinuxchoice/blackeye.git || true && \
    if [ -f /opt/blackeye/blackeye.sh ]; then \
        chmod +x /opt/blackeye/blackeye.sh && \
        ln -sf /opt/blackeye/blackeye.sh /usr/local/bin/blackeye; \
    elif [ -f /opt/blackeye/blackeye.py ]; then \
        chmod +x /opt/blackeye/blackeye.py && \
        ln -sf /opt/blackeye/blackeye.py /usr/local/bin/blackeye; \
    fi || true

# ZPhisher
RUN cd /opt && \
    git clone https://github.com/htr-tech/zphisher.git || true && \
    ([ -f /opt/zphisher/zphisher.sh ] && ln -sf /opt/zphisher/zphisher.sh /usr/local/bin/zphisher && chmod +x /opt/zphisher/zphisher.sh || true)

# ═══════════════════════════════════════════════════════════════════════════
# NIKTO (versão GitHub)
# ═══════════════════════════════════════════════════════════════════════════
RUN cd /opt && \
    git clone https://github.com/sullo/nikto.git || true && \
    ([ -f /opt/nikto/program/nikto.pl ] && ln -sf /opt/nikto/program/nikto.pl /usr/local/bin/nikto && chmod +x /opt/nikto/program/nikto.pl || true)

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO DO APP NODE.JS
# ═══════════════════════════════════════════════════════════════════════════

WORKDIR /app

# Copiar package.json
COPY package.json ./

# Instalar dependências Node.js
RUN npm install --production --no-audit --no-fund

# Copiar código fonte
COPY . .

# ═══════════════════════════════════════════════════════════════════════════
# VERIFICAÇÃO FINAL
# ═══════════════════════════════════════════════════════════════════════════

RUN echo "🔍 Verificando ferramentas de cybersecurity..." && \
    echo "  ✅ Node.js: $(node -v)" && \
    echo "  ✅ Python: $(python3 --version)" && \
    echo "  ✅ FFmpeg: $(ffmpeg -version | head -1)" && \
    echo "  ✅ Nmap: $(nmap --version | head -1)" && \
    (which sqlmap >/dev/null 2>&1 && echo "  ✅ SQLMap instalado" || echo "  ⚠️ SQLMap") && \
    (which nuclei >/dev/null 2>&1 && echo "  ✅ Nuclei instalado" || echo "  ⚠️ Nuclei") && \
    (which masscan >/dev/null 2>&1 && echo "  ✅ Masscan instalado" || echo "  ⚠️ Masscan") && \
    (which commix >/dev/null 2>&1 && echo "  ✅ Commix instalado" || echo "  ⚠️ Commix") && \
    (which searchsploit >/dev/null 2>&1 && echo "  ✅ SearchSploit instalado" || echo "  ⚠️ SearchSploit") && \
    (which sherlock >/dev/null 2>&1 && echo "  ✅ Sherlock instalado" || echo "  ⚠️ Sherlock") && \
    (which holehe >/dev/null 2>&1 && echo "  ✅ Holehe instalado" || echo "  ⚠️ Holehe") && \
    (which theHarvester >/dev/null 2>&1 && echo "  ✅ TheHarvester instalado" || echo "  ⚠️ TheHarvester") && \
    (which nxc >/dev/null 2>&1 && echo "  ✅ NetExec instalado" || echo "  ⚠️ NetExec") && \
    (which evil-winrm >/dev/null 2>&1 && echo "  ✅ Evil-WinRM instalado" || echo "  ⚠️ Evil-WinRM") && \
    (which socialfish >/dev/null 2>&1 && echo "  ✅ SocialFish instalado" || echo "  ⚠️ SocialFish") && \
    (which blackeye >/dev/null 2>&1 && echo "  ✅ BlackEye instalado" || echo "  ⚠️ BlackEye") && \
    (which zphisher >/dev/null 2>&1 && echo "  ✅ ZPhisher instalado" || echo "  ⚠️ ZPhisher") && \
    (which nikto >/dev/null 2>&1 && echo "  ✅ Nikto instalado" || echo "  ⚠️ Nikto") && \
    echo "✅ Verificação concluída!"

# Expor porta
EXPOSE 3001

# Comando inicial
CMD ["node", "server.js"]
