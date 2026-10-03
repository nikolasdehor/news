// Núcleo da inscrição na newsletter, compartilhado entre a Pages Function (functions/api/subscribe.ts)
// e a função da Vercel (api/subscribe.ts). Cada adaptador cuida de método, origem, IP e resposta HTTP.

// Mapa slug -> audienceId do Resend
const AUDIENCE_MAP = {
  'mcp-fiscal-brasil': 'aa0cf115-92eb-43d3-9cb9-e44cfca93619',
  'mcp-juridico-brasil': '6ba82c07-2987-4bf7-a261-431eb2ae5a31',
};

// Rate limit in-memory por IP: janela fixa, sem dependencia nova.
// ponytail: estado por instancia (serverless multi-instancia enfraquece o
// limite, cada instancia conta separado). Aceitavel para este endpoint de
// baixo risco (inscricao de newsletter). Se precisar de limite global
// rigoroso, trocar por um store compartilhado (KV, Upstash Redis).
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const RATE_LIMIT_MAX_REQUESTS = 5;
// ponytail: sweep de entradas expiradas para nao crescer sem limite
// numa instancia que fica quente por muito tempo.
const RATE_LIMIT_MAX_TRACKED_IPS = 5000;
const rateLimitHits = new Map();

/**
 * @param {string} ip
 * @returns {boolean}
 */
export function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitHits.get(ip);

  if (!entry || now >= entry.resetAt) {
    if (rateLimitHits.size >= RATE_LIMIT_MAX_TRACKED_IPS) {
      for (const [key, value] of rateLimitHits) {
        if (now >= value.resetAt) rateLimitHits.delete(key);
      }
      // Sem entradas expiradas pra liberar (burst de IPs novos): descarta a
      // mais antiga (ordem de insercao do Map) pra nunca crescer sem limite.
      if (rateLimitHits.size >= RATE_LIMIT_MAX_TRACKED_IPS) {
        const oldestKey = rateLimitHits.keys().next().value;
        if (oldestKey !== undefined) rateLimitHits.delete(oldestKey);
      }
    }
    rateLimitHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Same-origin, ou origem da lista. Sem Origin/Host (ex.: curl), libera como antes.
 * @param {string | null | undefined} origin
 * @param {string | null | undefined} host
 * @param {string[]} allowedOrigins
 * @returns {boolean}
 */
export function isAllowedOrigin(origin, host, allowedOrigins) {
  if (!origin || !host || origin === `https://${host}` || origin === `http://${host}`) return true;
  return allowedOrigins.includes(origin);
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  // RFC 5322 simplificado - robusto o suficiente para validacao de formulario
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/**
 * Slugs válidos, sem repetição. O resultado nunca passa do número de projetos existentes,
 * então o loop do Resend faz no máximo uma chamada por projeto.
 * @param {unknown[]} projects
 * @returns {string[]}
 */
export function pickProjects(projects) {
  const valid = new Set();
  for (const p of projects) {
    if (typeof p === 'string' && Object.hasOwn(AUDIENCE_MAP, p)) valid.add(p);
  }
  return [...valid];
}

/**
 * Valida o corpo e inscreve o e-mail nas audiences do Resend.
 * @param {unknown} body corpo JSON já decodificado
 * @param {string | undefined} apiKey
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ status: number, body: { ok: boolean, error?: string } }>}
 */
export async function subscribe(body, apiKey, fetchImpl = fetch) {
  const { email, projects, website } = body && typeof body === 'object' ? body : {};

  // Honeypot anti-spam: campo "website" deve estar vazio
  // Responder 200 para nao revelar a existencia do honeypot
  if (website !== undefined && website !== '') return { status: 200, body: { ok: true } };

  if (!isValidEmail(email)) return { status: 422, body: { ok: false, error: 'E-mail inválido.' } };

  if (!Array.isArray(projects) || projects.length === 0) {
    return { status: 422, body: { ok: false, error: 'Selecione ao menos um projeto.' } };
  }

  const validProjects = pickProjects(projects);
  if (validProjects.length === 0) {
    return { status: 422, body: { ok: false, error: 'Nenhum projeto válido selecionado.' } };
  }

  // Nao expoe detalhes de configuracao
  if (!apiKey) return { status: 500, body: { ok: false, error: 'Erro interno. Tente novamente mais tarde.' } };

  const errors = [];
  for (const slug of validProjects) {
    try {
      const response = await fetchImpl(`https://api.resend.com/audiences/${AUDIENCE_MAP[slug]}/contacts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), unsubscribed: false }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // Contato ja existente (409 ou mensagem especifica) -> tratar como sucesso
        const msg = typeof data.message === 'string' ? data.message : '';
        if (response.status !== 409 && !msg.toLowerCase().includes('already')) errors.push(slug);
      }
    } catch {
      errors.push(slug);
    }
  }

  if (errors.length > 0) return { status: 500, body: { ok: false, error: 'Erro ao salvar inscrição. Tente novamente.' } };
  return { status: 200, body: { ok: true } };
}
