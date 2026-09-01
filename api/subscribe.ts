import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  CONSENT_VERSION,
  createConfirmationNonce,
  createConfirmationToken,
  fetchResend,
  newsletterPublicBaseUrl,
} from '../lib/newsletter-confirmation.ts';
import {
  saveConfirmationNonce,
} from '../lib/newsletter-confirmation-store.ts';

// Mapa slug -> segmento do Resend
const SEGMENT_MAP: Record<string, string> = {
  'mcp-fiscal-brasil': 'aa0cf115-92eb-43d3-9cb9-e44cfca93619',
  'mcp-juridico-brasil': '6ba82c07-2987-4bf7-a261-431eb2ae5a31',
};

const VALID_SLUGS = new Set(Object.keys(SEGMENT_MAP));

// Rate limit in-memory por IP: janela fixa, sem dependencia nova.
// ponytail: estado por instancia de lambda (serverless multi-instancia
// enfraquece o limite, cada instancia conta separado). Aceitavel para
// este endpoint de baixo risco (inscricao de newsletter). Se precisar
// de limite global rigoroso, trocar por Upstash Redis (@upstash/ratelimit).
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitHits = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: VercelRequest): string {
  // x-real-ip e definido pelo edge da Vercel e nao pode ser forjado pelo
  // cliente. x-forwarded-for pode ser manipulado por quem faz a requisicao
  // (bastaria mandar um IP diferente a cada chamada pra escapar do limite).
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) return realIp;

  const forwardedFor = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const ip = raw?.split(',')[0]?.trim();
  return ip || req.socket?.remoteAddress || 'unknown';
}

// ponytail: sweep de entradas expiradas para nao crescer sem limite
// numa instancia de lambda que fica quente por muito tempo.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  // CORS: permitir apenas same-origin (Vercel envia credenciais de origem automaticamente)
  const origin = req.headers['origin'];
  const host = req.headers['host'];
  if (origin && host && origin !== `https://${host}` && origin !== `http://${host}`) {
    // Em producao aceita apenas a origem do proprio site
    const allowedOrigins = [
      'https://news.dehor.com.br',
      'https://dehor-news.vercel.app',
    ];
    if (!allowedOrigins.some((o) => origin === o)) {
      return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
    }
  }

  // Rate limit por IP
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' });
  }

  const { email, projects, website } = req.body ?? {};

  // Honeypot anti-spam: campo "website" deve estar vazio
  // Responder 200 para nao revelar a existencia do honeypot
  if (website !== undefined && website !== '') {
    return res.status(200).json({ ok: true });
  }

  // Validar email
  if (!isValidEmail(email)) {
    return res.status(422).json({ ok: false, error: 'E-mail inválido.' });
  }

  // Validar projects
  if (!Array.isArray(projects) || projects.length === 0) {
    return res.status(422).json({ ok: false, error: 'Selecione ao menos um projeto.' });
  }

  if (!(projects as unknown[]).every((project) =>
    typeof project === 'string' && VALID_SLUGS.has(project))) {
    return res.status(422).json({ ok: false, error: 'Projeto inválido selecionado.' });
  }
  const validProjects = [...new Set(projects as string[])];
  if (validProjects.length !== projects.length || validProjects.length > VALID_SLUGS.size) {
    return res.status(422).json({ ok: false, error: 'Projetos duplicados ou em excesso.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const confirmationSecret = process.env.NEWSLETTER_CONFIRMATION_SECRET;
  const from = process.env.NEWSLETTER_FROM_EMAIL;
  if (!apiKey || !confirmationSecret || confirmationSecret.length < 32 || !from) {
    // Nao expoe detalhes de configuracao
    return res.status(500).json({ ok: false, error: 'Erro interno. Tente novamente mais tarde.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const expiresAt = Date.now() + 30 * 60 * 1000;
  const nonce = createConfirmationNonce();
  try {
    await saveConfirmationNonce(nonce, expiresAt);
    const token = createConfirmationToken({
      email: normalizedEmail,
      projects: validProjects,
      consentVersion: CONSENT_VERSION,
      nonce,
      expiresAt,
    }, confirmationSecret);
    const confirmationUrl = new URL('/api/confirm', newsletterPublicBaseUrl(process.env));
    confirmationUrl.searchParams.set('token', token);
    const response = await fetchResend('https://api.resend.com/emails', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        from,
        to: [normalizedEmail],
        subject: 'Confirme sua inscrição no DeHor News',
        text: `Confirme sua inscrição: ${confirmationUrl.toString()}\n\nO link expira em 30 minutos.`,
        html: `<p>Confirme sua inscrição no DeHor News:</p><p><a href="${confirmationUrl.toString()}">Confirmar inscrição</a></p><p>O link expira em 30 minutos.</p>`,
      }),
    });
    if (!response.ok) throw new Error('confirmation send failed');
  } catch {
    return res.status(500).json({ ok: false, error: 'Erro ao salvar inscrição. Tente novamente.' });
  }

  return res.status(200).json({ ok: true, confirmationRequired: true });
}
