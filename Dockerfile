FROM node:20-alpine

# ==============================
# Sistema base
# ==============================
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

# ==============================
# Ferramentas adicionais
# ==============================

# sqlmap
RUN mkdir -p /opt && \
    cd /opt && \
    git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git && \
    chmod +x /opt/sqlmap/sqlmap.py && \
    ln -s /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap

# nuclei
RUN apk add --no-cache go && \
    go install github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest && \
    ln -s /root/go/bin/nuclei /usr/local/bin/nuclei

# masscan
RUN cd /tmp && \
    git clone https://github.com/robertdavidgraham/masscan.git && \
    cd masscan && \
    make -j4 && \
    cp bin/masscan /usr/local/bin/masscan && \
    chmod +x /usr/local/bin/masscan && \
    rm -rf /tmp/masscan

# ==============================
# App
# ==============================
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Persistência do WhatsApp
RUN mkdir -p /app/data/auth_info_baileys

ENV NODE_ENV=production
ENV PORT=3000
ENV AUTH_FOLDER=./data/auth_info_baileys

EXPOSE 3000

CMD ["node", "index.js"]
