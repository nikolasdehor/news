// Mapa slug -> audienceId do Resend
const AUDIENCE_MAP: Record<string, string> = {
  'mcp-fiscal-brasil': 'aa0cf115-92eb-43d3-9cb9-e44cfca93619',
  'mcp-juridico-brasil': '6ba82c07-2987-4bf7-a261-431eb2ae5a31',
};

const VALID_SLUGS = new Set(Object.keys(AUDIENCE_MAP));

// Rate limit in-memory por IP: janela fixa, sem dependencia nova.
// ponytail: estado por instancia de isolate (serverless multi-instancia
// enfraquece o limite, cada instancia conta separado). Aceitavel para
// este endpoint de baixo risco (inscricao de newsletter). Se precisar
// de limite global rigoroso, trocar por Upstash Redis (@upstash/ratelimit).
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitHits = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
  // CF-Connecting-IP e definido pelo edge da Cloudflare e nao pode ser
  // forjado pelo cliente (x-forwarded-for pode).
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

// ponytail: sweep de entradas expiradas para nao crescer sem limite
// numa instancia de isolate que fica quente por muito tempo.
const RATE_LIMIT_MAX_TRACKED_IPS = 5000;

function isRateLimited(ip: string): boolean {
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

function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  // RFC 5322 simplificado - robusto o suficiente para validacao de formulario
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

interface Env {
  RESEND_API_KEY?: string;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  // Apenas POST
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'Método não permitido.' }, { Allow: 'POST' });
  }

  // CORS: permitir apenas same-origin
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host && origin !== `https://${host}` && origin !== `http://${host}`) {
    const allowedOrigins = [
      'https://news.dehor.com.br',
    ];
    if (!allowedOrigins.some((o) => origin === o)) {
      return json(403, { ok: false, error: 'Origem não permitida.' });
    }
  }

  // Rate limit por IP
  if (isRateLimited(getClientIp(request))) {
    return json(429, { ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown> | null;
  const { email, projects, website } = body ?? {};

  // Honeypot anti-spam: campo "website" deve estar vazio
  // Responder 200 para nao revelar a existencia do honeypot
  if (website !== undefined && website !== '') {
    return json(200, { ok: true });
  }

  if (!isValidEmail(email)) {
    return json(422, { ok: false, error: 'E-mail inválido.' });
  }

  if (!Array.isArray(projects) || projects.length === 0) {
    return json(422, { ok: false, error: 'Selecione ao menos um projeto.' });
  }

  const validProjects = (projects as unknown[])
    .filter((p): p is string => typeof p === 'string' && VALID_SLUGS.has(p));

  if (validProjects.length === 0) {
    return json(422, { ok: false, error: 'Nenhum projeto válido selecionado.' });
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    // Nao expoe detalhes de configuracao
    return json(500, { ok: false, error: 'Erro interno. Tente novamente mais tarde.' });
  }

  // Inscreve em cada audience do Resend
  const errors: string[] = [];
  for (const slug of validProjects) {
    const audienceId = AUDIENCE_MAP[slug];
    try {
      const response = await fetch(
        `https://api.resend.com/audiences/${audienceId}/contacts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            unsubscribed: false,
          }),
        },
      );

      if (!response.ok) {
        const data: Record<string, unknown> = await response.json().catch(() => ({}));
        // Contato ja existente (409 ou mensagem especifica) -> tratar como sucesso
        const msg = typeof data.message === 'string' ? data.message : '';
        const isAlreadyExists =
          response.status === 409 ||
          msg.toLowerCase().includes('already');

        if (!isAlreadyExists) {
          errors.push(slug);
        }
        // Se ja existe, continua sem registrar erro
      }
    } catch {
      errors.push(slug);
    }
  }

  if (errors.length > 0) {
    return json(500, { ok: false, error: 'Erro ao salvar inscrição. Tente novamente.' });
  }

  return json(200, { ok: true });
};
