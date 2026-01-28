/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OSINT FRAMEWORK - REAL APIS ONLY - CLEAN IMPLEMENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ Google Dorking / Google Doxing - REAL
 * ✅ Email reconnaissance - HaveIBeenPwned API ONLY
 * ✅ Phone lookup - Numverify API ONLY
 * ✅ Username search - GitHub API ONLY
 * ✅ Domain enumeration - crt.sh ONLY
 * ✅ Breach database search - HaveIBeenPwned ONLY
 * ✅ Dark web monitoring - SIMULATED (no real access)
 *
 * ❌ REMOVED: All Math.random() fake probabilities
 * ❌ REMOVED: Simulated results
 * ❌ REMOVED: Fake data generation
 * ═══════════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class OSINTFramework {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.cacheExpiry = 3600000; // 1 hora

    // APIs reais apenas
    this.apis = {
      haveibeenpwned: 'https://haveibeenpwned.com/api/v3',
      numverify: 'http://numverify.com/',
      github: 'https://api.github.com',
      crtsh: 'https://crt.sh/',
    };

    // User agents para evitar blocks
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ];

    console.log('✅ OSINTFramework REAL - Apenas APIs reais implementadas');
  }

  /**
   * ═════════════════════════════════════════════════════════════════════
   * 🔍 GOOGLE DORKING - REAL SEARCH ONLY
   * ═════════════════════════════════════════════════════════════════════
   */
  async googleDorking(alvo, tipoSearch = 'geral') {
    try {
      const dorkingQueries = this._gerarDorkingQueries(alvo, tipoSearch);
      const resultados = {
        sucesso: true,
        tipo: 'google_dorking',
        alvo,
        tipoSearch,
        queries: dorkingQueries,
        resultados: [],
        risco: 'MÉDIO',
        timestamp: new Date().toISOString(),
        aviso: 'Resultados limitados devido a restrições do Google'
      };

      // Executa apenas 2 queries para evitar blocks
      for (const query of dorkingQueries.slice(0, 2)) {
        try {
          const results = await this._executarGoogleDorking(query);
          if (results.length > 0) {
            resultados.resultados.push({
              query,
              resultados: results
            });
          }
        } catch (e) {
          console.warn(`Google dorking falhou para: ${query}`);
        }
      }

      this.cache.set(`dorking_${alvo}`, resultados);
      return resultados;
    } catch (e) {
      console.error('Erro em googleDorking:', e);
      return { sucesso: false, erro: e.message };
    }
  }

  _gerarDorkingQueries(alvo, tipo = 'geral') {
    const queries = [];

    if (tipo === 'email') {
      queries.push(`"${alvo}" site:linkedin.com`);
      queries.push(`"${alvo}" filetype:pdf`);
    } else if (tipo === 'dominio') {
      queries.push(`site:${alvo}`);
      queries.push(`inurl:${alvo} intitle:admin`);
    } else if (tipo === 'pessoa') {
      queries.push(`"${alvo}" site:linkedin.com`);
      queries.push(`"${alvo}" site:facebook.com`);
    } else {
      queries.push(`"${alvo}"`);
      queries.push(`${alvo} inurl:admin`);
    }

    return queries;
  }

  async _executarGoogleDorking(query) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.google.com/search?q=${encodedQuery}`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': this._randomUserAgent()
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const resultados = [];

      $('div.g').each((i, elem) => {
        if (i < 3) { // Apenas 3 resultados por query
          const title = $(elem).find('h3').text();
          const linkElem = $(elem).find('a').first();
          let url = linkElem.attr('href');

          // Clean URL
          if (url && url.includes('/url?q=')) {
            const parts = url.split('/url?q=');
            if (parts.length > 1) {
              url = parts[1].split('&')[0];
            }
          }

          const snippet = $(elem).find('.VwiC3b').text() || $(elem).find('.st').text();

          if (title && url) {
            resultados.push({ title, url, snippet });
          }
        }
      });

      return resultados;
    } catch (e) {
      console.warn('Google dorking requisição falhou:', e.message);
      return [];
    }
  }

  /**
   * ═════════════════════════════════════════════════════════════════════
   * 📧 EMAIL RECONNAISSANCE - HAVEIBEENPWNED ONLY
   * ═════════════════════════════════════════════════════════════════════
   */
  async emailReconnaissance(email) {
    try {
      if (!this._isValidEmail(email)) {
        return { sucesso: false, erro: 'Email inválido' };
      }

      const cacheKey = `email_${email}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // 1. Verifica vazamento em HaveIBeenPwned (REAL API)
      const breachResult = await this._checkHaveIBeenPwned(email);

      // 2. Extrai nome e domínio
      const [nome, dominio] = email.split('@');

      // 3. Busca informações do domínio (crt.sh REAL)
      const dominioInfo = await this._getDominioInfoReal(dominio);

      const resultado = {
        sucesso: true,
        tipo: 'email_recon',
        email: email,
        nome: nome,
        dominio: dominio,
        descobertas: {
          vazamentosEncontrados: breachResult.encontrados,
          breaches: breachResult.breaches,
          tipoEmail: this._classifyEmail(email),
          dominioLegitimo: dominioInfo.legítimo,
          anoFundacao: dominioInfo.anoFundacao,
          pais: dominioInfo.pais,
          certificadosEncontrados: dominioInfo.certificadosEncontrados
        },
        ameacas: breachResult.encontrados > 0 ? [
          '⚠️ Email encontrado em vazamentos',
          '🔐 Recomenda-se mudar senha',
          '✅ Ativar 2FA',
          '📧 Monitorar atividade'
        ] : [],
        timestamp: new Date().toISOString()
      };

      this.cache.set(cacheKey, resultado);
      setTimeout(() => this.cache.delete(cacheKey), this.cacheExpiry);

      return resultado;
    } catch (e) {
      console.error('Erro em emailReconnaissance:', e);
      return { sucesso: false, erro: e.message };
    }
  }

  /**
   * Verifica vazamentos reais no HaveIBeenPwned
   */
  async _checkHaveIBeenPwned(email) {
    try {
      const response = await axios.get(`${this.apis.haveibeenpwned}/breachedaccount/${email}`, {
        headers: {
          'User-Agent': 'AkiraBot-OSINT/1.0',
          'hibp-api-key': process.env.HIBP_API_KEY || ''
        },
        timeout: 10000
      });

      const breaches = response.data.map(breach => ({
        nome: breach.Name,
        dominio: breach.Domain,
        dataVazamento: breach.BreachDate,
        dadosExpostos: breach.DataClasses,
        severidade: breach.IsVerified ? 'VERIFICADO' : 'NÃO VERIFICADO'
      }));

      return {
        encontrados: breaches.length,
        breaches: breaches
      };
    } catch (e) {
      if (e.response?.status === 404) {
        return { encontrados: 0, breaches: [] };
      }
      console.warn('Erro ao consultar HaveIBeenPwned:', e.message);
      return { encontrados: 0, breaches: [], erro: 'API indisponível' };
    }
  }

  /**
   * Busca informações reais do domínio via crt.sh
   */
  async _getDominioInfoReal(dominio) {
    try {
      const response = await axios.get(`${this.apis.crtsh}/?q=${encodeURIComponent(dominio)}&output=json`, {
        timeout: 10000
      });

      if (response.data && Array.isArray(response.data)) {
        const certificados = response.data;
        const primeiroCert = certificados[0];

        return {
          legítimo: certificados.length > 0,
          anoFundacao: primeiroCert?.not_before ? new Date(primeiroCert.not_before).getFullYear() : null,
          pais: primeiroCert?.issuer_country || 'Desconhecido',
          certificadosEncontrados: certificados.length
        };
      }

      return {
        legítimo: false,
        anoFundacao: null,
        pais: 'Desconhecido',
        certificadosEncontrados: 0
      };
    } catch (e) {
      console.warn('Erro ao consultar crt.sh:', e.message);
      return {
        legítimo: false,
        anoFundacao: null,
        pais: 'Erro na consulta',
        certificadosEncontrados: 0
      };
    }
  }

  /**
   * ═════════════════════════════════════════════════════════════════════
   * 📱 PHONE NUMBER LOOKUP - NUMVERIFY ONLY
   * ═════════════════════════════════════════════════════════════════════
   */
  async phoneNumberLookup(numero) {
    try {
      const numberClean = numero.replace(/\D/g, '');

      if (numberClean.length < 7) {
        return { sucesso: false, erro: 'Número de telefone inválido' };
      }

      // Tenta Numverify API (única API real implementada)
      const result = await this._tryNumverifyAPI(numberClean);

      if (result) {
        return result;
      }

      return {
        sucesso: false,
        erro: 'Não foi possível consultar o número',
        numero: numero,
        numeroLimpo: numberClean,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('Erro em phoneNumberLookup:', e);
      return { sucesso: false, erro: e.message };
    }
  }

  /**
   * Consulta Numverify API (única API real implementada)
   */
  async _tryNumverifyAPI(numero) {
    try {
      const apiKey = process.env.NUMVERIFY_API_KEY;
      if (!apiKey) {
        return null;
      }

      const response = await axios.get(`${this.apis.numverify}/`, {
        params: {
          access_key: apiKey,
          number: numero
        },
        timeout: 10000
      });

      if (response.data && response.data.valid) {
        return {
          sucesso: true,
          tipo: 'phone_lookup',
          numero: response.data.number,
          numeroInternacional: response.data.international_format,
          codigoPais: response.data.country_code,
          pais: response.data.country_name,
          local: response.data.location,
          operadora: response.data.carrier,
          tipoLinha: response.data.line_type,
          timestamp: new Date().toISOString()
        };
      }

      return null;
    } catch (e) {
      console.warn('Erro ao consultar Numverify:', e.message);
      return null;
    }
  }

  /**
   * ═════════════════════════════════════════════════════════════════════
   * 👤 USERNAME SEARCH - GITHUB API ONLY
   * ═════════════════════════════════════════════════════════════════════
   */
  async usernameSearch(username) {
    try {
      if (username.length < 3) {
        return { sucesso: false, erro: 'Username muito curto (mín 3 caracteres)' };
      }

      // Apenas GitHub API (única API real implementada)
      const result = await this._checkUsernameOnGitHub(username);

      return {
        sucesso: true,
        tipo: 'username_search',
        username,
        plataforma: 'GitHub',
        encontrado: result.encontrado,
        perfil: result.perfil,
        risco: result.encontrado ? 'BAIXO' : 'NENHUM',
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('Erro em usernameSearch:', e);
      return { sucesso: false, erro: e.message };
    }
  }

  /**
   * Verifica username no GitHub (única plataforma real implementada)
   */
  async _checkUsernameOnGitHub(username) {
    try {
      const response = await axios.get(`${this.apis.github}/users/${username}`, {
        headers: {
          'User-Agent': this._randomUserAgent(),
          'Authorization': process.env.GITHUB_TOKEN ? `token ${process.env.GITHUB_TOKEN}` : undefined
        },
        timeout: 10000
      });

      if (response.data && response.data.login) {
        return {
          encontrado: true,
          perfil: {
            nome: response.data.name || response.data.login,
            login: response.data.login,
            url: response.data.html_url,
            bio: response.data.bio,
            seguidores: response.data.followers,
            seguindo: response.data.following,
            repositorios: response.data.public_repos,
            criadoEm: response.data.created_at,
            atualizadoEm: response.data.updated_at
          }
        };
      }

      return { encontrado: false };
    } catch (e) {
      if (e.response?.status === 404) {
        return { encontrado: false };
      }
      console.warn('Erro ao consultar GitHub:', e.message);
      return { encontrado: false, erro: e.message };
    }
  }

  /**
   * ═════════════════════════════════════════════════════════════════════
   * 🌐 DOMAIN SUBDOMAIN ENUMERATION - CRT.SH ONLY
   * ═════════════════════════════════════════════════════════════════════
   */
  async subdomainEnumeration(dominio) {
    try {
      if (!this._isDomain(dominio)) {
        return { sucesso: false, erro: 'Domínio inválido' };
      }

      // Busca certificados via crt.sh (única fonte real implementada)
      const response = await axios.get(`${this.apis.crtsh}/?q=${encodeURIComponent(dominio)}&output=json`, {
        timeout: 15000
      });

      const subdomains = new Set();

      if (response.data && Array.isArray(response.data)) {
        response.data.forEach(cert => {
          if (cert.name_value) {
            // Extrai subdomínios
            const names = cert.name_value.split('\n');
            names.forEach(name => {
              const cleanName = name.trim().toLowerCase();
              if (cleanName.includes(dominio) && cleanName !== dominio) {
                subdomains.add(cleanName);
              }
            });
          }
        });
      }

      const subdomainList = Array.from(subdomains).slice(0, 20); // Máximo 20

      return {
        sucesso: true,
        tipo: 'subdomain_enumeration',
        dominio,
        descobertos: subdomainList.length,
        subdomains: subdomainList,
        fonte: 'crt.sh (Certificate Transparency)',
        risco: subdomainList.length > 10 ? 'ALTO' : subdomainList.length > 5 ? 'MÉDIO' : 'BAIXO',
        recomendacoes: [
          '🛡️ Revisar subdomínios obsoletos',
          '🔐 Verificar certificados SSL',
          '📊 Monitorar continuamente'
        ],
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('Erro em subdomainEnumeration:', e);
      return { sucesso: false, erro: e.message };
    }
  }

  /**
   * ═════════════════════════════════════════════════════════════════════
   * 🚨 BREACH DATABASE SEARCH - HAVEIBEENPWNED ONLY
   * ═════════════════════════════════════════════════════════════════════
   */
  async breachSearch(alvo) {
    try {
      if (!this._isValidEmail(alvo)) {
        return { sucesso: false, erro: 'Apenas emails são suportados para busca de vazamentos' };
      }

      // Apenas HaveIBeenPwned (única fonte real implementada)
      const breachResult = await this._checkHaveIBeenPwned(alvo);

      return {
        sucesso: true,
        tipo: 'breach_search',
        alvo,
        tipoAlvo: 'email',
        vazamentosEncontrados: breachResult.encontrados,
        breaches: breachResult.breaches,
        fonte: 'HaveIBeenPwned',
        risco: breachResult.encontrados > 0 ? 'CRÍTICO' : 'NENHUM',
        acoes: breachResult.encontrados > 0 ? [
          '🔴 CRÍTICO: Sua informação foi vazada',
          '🔐 Mude sua senha IMEDIATAMENTE',
          '✅ Ative 2FA em todas as contas',
          '📧 Fique atento a emails de phishing',
          '💳 Monitore sua atividade financeira',
          '🛡️ Considere credit monitoring'
        ] : ['✅ Nenhum vazamento encontrado'],
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('Erro em breachSearch:', e);
      return { sucesso: false, erro: e.message };
    }
  }

  /**
   * ═════════════════════════════════════════════════════════════════════
   * 🌍 DARK WEB MONITORING - SIMULATED (NO REAL ACCESS)
   * ═════════════════════════════════════════════════════════════════════
   */
  async darkWebMonitoring(alvo) {
    try {
      return {
        sucesso: true,
        tipo: 'darkweb_monitoring',
        alvo,
        ameacasDetectadas: 0,
        ameacas: [],
        status: 'Não disponível',
        aviso: '⚠️ Monitoramento real da dark web não é possível sem infraestrutura especializada (TOR + credenciais)',
        recomendacoes: [
          '🔍 Use serviços especializados como Dark Web ID',
          '📧 Monitore vazamentos regularmente',
          '🛡️ Considere serviços de monitoramento profissional'
        ],
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('Erro em darkWebMonitoring:', e);
      return { sucesso: false, erro: e.message };
    }
  }

  /**
   * ═════════════════════════════════════════════════════════════════════
   * FUNÇÕES AUXILIARES
   * ═════════════════════════════════════════════════════════════════════
   */

  _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  _isDomain(str) {
    return /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(str);
  }

  _classifyEmail(email) {
    if (email.includes('+')) return 'Alias';
    if (email.endsWith('.edu')) return 'Educacional';
    if (email.endsWith('.gov')) return 'Governo';
    return 'Comercial';
  }

  _randomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }
}

module.exports = OSINTFramework;
