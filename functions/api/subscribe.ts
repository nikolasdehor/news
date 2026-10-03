import { isAllowedOrigin, isRateLimited, subscribe } from '../_shared/subscribe.js';

const ALLOWED_ORIGINS = ['https://news.dehor.com.br'];

interface Env {
  RESEND_API_KEY?: string;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'Método não permitido.' }, { Allow: 'POST' });
  }

  if (!isAllowedOrigin(request.headers.get('origin'), request.headers.get('host'), ALLOWED_ORIGINS)) {
    return json(403, { ok: false, error: 'Origem não permitida.' });
  }

  // CF-Connecting-IP e definido pelo edge da Cloudflare e nao pode ser
  // forjado pelo cliente (x-forwarded-for pode).
  if (isRateLimited(request.headers.get('cf-connecting-ip') || 'unknown')) {
    return json(429, { ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' });
  }

  const body = await request.json().catch(() => null);
  const result = await subscribe(body, env.RESEND_API_KEY);
  return json(result.status, result.body);
};
