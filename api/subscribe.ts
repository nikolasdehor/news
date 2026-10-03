import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAllowedOrigin, isRateLimited, subscribe } from '../functions/_shared/subscribe.js';

// Em producao aceita apenas a origem do proprio site
const ALLOWED_ORIGINS = ['https://news.dehor.com.br', 'https://dehor-news.vercel.app'];

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  const origin = req.headers['origin'];
  if (!isAllowedOrigin(origin, req.headers['host'], ALLOWED_ORIGINS)) {
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
  }

  if (isRateLimited(getClientIp(req))) {
    return res.status(429).json({ ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' });
  }

  const result = await subscribe(req.body, process.env.RESEND_API_KEY);
  return res.status(result.status).json(result.body);
}
