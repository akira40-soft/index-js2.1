# Dockerfile — AKIRA BOT RAILWAY (Dezembro 2025)
# ✅ Com suporte completo para ferramentas de pentesting REAIS
FROM node:20-alpine

# Variáveis de ambiente
ENV NODE_ENV=production \
    PORT=7860 \
    TOOLS_INSTALLED=true

# ═══════════════════════════════════════════════════════════════════
# INSTALAR DEPENDÊNCIAS DO SISTEMA + FERRAMENTAS DE PENTESTING
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
    nmap \
    hydra \
    nikto \
    perl \
    ca-certificates \
    openssl \
    openssl-dev \
    zlib-dev \
    bash

# ═══════════════════════════════════════════════════════════════════
# INSTALAR FERRAMENTAS ADICIONAIS DO GITHUB
# ═══════════════════════════════════════════════════════════════════

# 1. SQLMAP
RUN mkdir -p /opt && \
    cd /opt && \
    git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git 2>/dev/null || true && \
    chmod +x /opt/sqlmap/sqlmap.py && \
    ln -s /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap 2>/dev/null || true

# 2. NUCLEI (com Go)
RUN apk add --no-cache go && \
    go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest 2>/dev/null || true && \
    export PATH=$PATH:$(go env GOPATH)/bin && \
    ln -s $(go env GOPATH)/bin/nuclei /usr/local/bin/nuclei 2>/dev/null || true

# 3. MASSCAN (compilar do source)
RUN cd /tmp && \
    git clone https://github.com/robertdavidgraham/masscan.git 2>/dev/null || true && \
    cd masscan && \
    make -j4 2>/dev/null || true && \
    [ -f bin/masscan ] && cp bin/masscan /usr/local/bin/ && chmod +x /usr/local/bin/masscan || true && \
    cd /tmp && rm -rf masscan

# ═══════════════════════════════════════════════════════════════════
# CRIAR DIRETÓRIOS NECESSÁRIOS
# ═══════════════════════════════════════════════════════════════════

RUN mkdir -p /tmp/pentest_results && \
    chmod 777 /tmp/pentest_results

# ═══════════════════════════════════════════════════════════════════
# COPIAR SCRIPTS DE VERIFICAÇÃO E INSTALAÇÃO
# ═══════════════════════════════════════════════════════════════════

COPY install-tools.sh /tmp/
COPY verify-tools.sh /tmp/

RUN chmod +x /tmp/install-tools.sh /tmp/verify-tools.sh && \
    /tmp/verify-tools.sh || true

# Define o diretório de trabalho
WORKDIR /app

# Copia código da aplicação
COPY . ./

# Instala dependências do Node.js
RUN npm install --production

# ═══════════════════════════════════════════════════════════════════
# ESTRUTURA MODULAR: Renomear 'classes' para 'modules' (HF Compatibility)
# ═══════════════════════════════════════════════════════════════════

RUN if [ -d ./classes ]; then mv ./classes ./modules; echo "✅ Módulos configurados (classes → modules)"; fi

# ═══════════════════════════════════════════════════════════════════
# CRIAR USUÁRIO NÃO-ROOT
# ═══════════════════════════════════════════════════════════════════

RUN addgroup -g 1001 -S app && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G app -g app app

# Ajusta permissões
RUN chown -R app:app /app && \
    mkdir -p /app/auth_info_baileys /app/temp /app/database/data /app/database/datauser /app/database/subscriptions && \
    chown -R app:app /app/auth_info_baileys /app/temp /app/database && \
    chmod 777 /tmp/pentest_results

# ═══════════════════════════════════════════════════════════════════
# VERIFICAÇÃO FINAL DE FERRAMENTAS
# ═══════════════════════════════════════════════════════════════════

RUN echo "🔍 Verificando ferramentas de pentesting..." && \
    yt-dlp --version 2>&1 || echo "⚠️  yt-dlp" && \
    nmap --version 2>&1 | head -1 || echo "⚠️  nmap" && \
    python3 /opt/sqlmap/sqlmap.py --version 2>&1 | head -1 || echo "⚠️  sqlmap" && \
    hydra -h 2>&1 | head -1 || echo "⚠️  hydra" && \
    nikto -version 2>&1 | head -1 || echo "⚠️  nikto" && \
    command -v nuclei 2>&1 || echo "⚠️  nuclei" && \
    command -v masscan 2>&1 || echo "⚠️  masscan" && \
    echo "✅ Verificação de ferramentas concluída"

# ═══════════════════════════════════════════════════════════════════
# USUÁRIO NÃO-ROOT E EXPÕE PORTA
# ═══════════════════════════════════════════════════════════════════

# Muda para usuário não-root
USER app

# Expõe porta
EXPOSE 7860

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const p=process.env.PORT||7860; require('http').get(\`http://localhost:\${p}/health\`, (r) => process.exit(r.statusCode===200?0:1))"

# Comando de inicialização
CMD ["node", "index.js"]


