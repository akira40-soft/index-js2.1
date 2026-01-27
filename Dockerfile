# Dockerfile — AKIRA BOT RAILWAY (Otimizado Janeiro 2026)
# ✅ Configurado especificamente para Railway
# ✅ Pino logging compatível com Railway
# ✅ Sem pino-pretty transport para evitar erros
# ✅ Configurações otimizadas para Railway

FROM node:20-alpine

# ═══════════════════════════════════════════════════════════════════
# VARIÁVEIS DE AMBIENTE PARA RAILWAY
# ═══════════════════════════════════════════════════════════════════
ENV NODE_ENV=production \
    RAILWAY_ENVIRONMENT=true \
    # Pino sem transport para evitar erros no Railway
    PINO_NO_PRETTY=true \
    # Configurações de rede
    NODE_OPTIONS="--dns-result-order=ipv4first --no-warnings" \
    UV_THREADPOOL_SIZE=128 \
    LANG=C.UTF-8

# ═══════════════════════════════════════════════════════════════════
# INSTALAR DEPENDÊNCIAS DO SISTEMA ESSENCIAIS PARA RAILWAY
# ═══════════════════════════════════════════════════════════════════

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
    yt-dlp \
    ca-certificates \
    openssl \
    openssl-dev \
    zlib-dev \
    bash \
    # Cybersecurity tools
    nmap \
    hydra \
    nikto \
    unzip \
    perl \
    go

# ═══════════════════════════════════════════════════════════════════
# INSTALAÇÃO DE FERRAMENTAS DE CYBERSECURITY
# ═══════════════════════════════════════════════════════════════════

# SQLMAP - SQL Injection Testing
RUN mkdir -p /opt && \
    cd /opt && \
    git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git && \
    chmod +x /opt/sqlmap/sqlmap.py && \
    ln -s /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap

# NUCLEI - Vulnerability Scanning (fallback para instalação via Go)
RUN go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest || \
    echo "Nuclei Go install failed, trying alternative method..." && \
    ARCH=$(uname -m) && \
    mkdir -p /tmp/nuclei_install && \
    cd /tmp/nuclei_install && \
    curl -s https://api.github.com/repos/projectdiscovery/nuclei/releases/latest | \
    grep "browser_download_url.*linux_amd64.tar.gz" | \
    cut -d '"' -f 4 | \
    xargs curl -L -o nuclei.tar.gz && \
    tar -xzf nuclei.tar.gz && \
    find . -name "nuclei" -type f -executable -exec mv {} /usr/local/bin/ \; && \
    chmod +x /usr/local/bin/nuclei && \
    cd - && \
    rm -rf /tmp/nuclei_install

# MASSCAN - Fast Port Scanner
RUN mkdir -p /tmp/masscan_build && \
    cd /tmp/masscan_build && \
    git clone https://github.com/robertdavidgraham/masscan.git && \
    cd masscan && \
    make -j4 && \
    cp bin/masscan /usr/local/bin/ && \
    chmod +x /usr/local/bin/masscan && \
    cd - && \
    rm -rf /tmp/masscan_build

# ═══════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO DE DIRETÓRIOS PARA RAILWAY
# ═══════════════════════════════════════════════════════════════════

RUN mkdir -p /app/data && \
    mkdir -p /app/data/auth_info_baileys && \
    mkdir -p /app/data/database && \
    mkdir -p /app/data/logs && \
    mkdir -p /app/data/temp && \
    chmod -R 755 /app/data

# ═══════════════════════════════════════════════════════════════════
# DIRETÓRIO DE TRABALHO
# ═══════════════════════════════════════════════════════════════════

WORKDIR /app

# ═══════════════════════════════════════════════════════════════════
# INSTALAÇÃO DE DEPENDÊNCIAS NODE.JS PARA RAILWAY
# ═══════════════════════════════════════════════════════════════════

COPY package*.json ./

# Instalação otimizada para Railway
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --omit=dev --no-audit --progress=false --fetch-retries=5 --legacy-peer-deps

# ═══════════════════════════════════════════════════════════════════
# COPIAR CÓDIGO DA APLICAÇÃO
# ═══════════════════════════════════════════════════════════════════

COPY . .

# ═══════════════════════════════════════════════════════════════════
# VERIFICAÇÃO FINAL PARA RAILWAY
# ═══════════════════════════════════════════════════════════════════

RUN echo "🔍 Verificando instalação para Railway..." && \
    node -v && \
    npm -v && \
    python3 --version && \
    ffmpeg -version | head -1 && \
    echo "🔧 Verificando ferramentas de cybersecurity..." && \
    nmap --version | head -1 && \
    hydra -h | head -1 && \
    nikto -version | head -1 && \
    python3 /opt/sqlmap/sqlmap.py --version | head -1 && \
    nuclei -version && \
    masscan --version | head -1 && \
    echo "✅ Todas as ferramentas instaladas com sucesso" && \
    echo "✅ Dockerfile construído com sucesso para Railway"

# Limpar cache para reduzir tamanho da imagem
RUN npm cache clean --force 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════════
# EXPOR PORTA PARA RAILWAY
# ═══════════════════════════════════════════════════════════════════
# Railway usa $PORT automaticamente
EXPOSE $PORT

# ═══════════════════════════════════════════════════════════════════
# HEALTHCHECK PARA RAILWAY
# ═══════════════════════════════════════════════════════════════════

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:$PORT/health 2>/dev/null || exit 1

# ═══════════════════════════════════════════════════════════════════
# COMANDO DE INICIALIZAÇÃO PARA RAILWAY
# ═══════════════════════════════════════════════════════════════════

CMD ["node", "index.js"]
