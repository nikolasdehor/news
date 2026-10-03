// Porta o vercel.json: negociação de markdown em "/", rewrite /sitemap.xml -> /sitemap-index.xml
// (_redirects não vale com Function na raiz) e 404 negociado (markdown/JSON/HTML).
// _headers só vale pra asset estático; toda resposta que passa por aqui (inclusive /api/*) recebe
// SECURITY_HEADERS. Assets estáticos não invocam a Function (ver public/_routes.json).
import { preferredType } from './_shared/negotiate.js';
import { DISCOVERY_LINK, NOT_FOUND_HEADERS, SITE, negotiateNotFound } from './_shared/not-found.js';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; base-uri 'self'; object-src 'none'",
  Link: DISCOVERY_LINK,
};

function withSecurityHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(key)) out.headers.set(key, value);
  }
  return out;
}

function notFound(accept: string, html: Response): Response {
  const negotiated = negotiateNotFound(accept);
  return new Response(negotiated ? negotiated.body : html.body, {
    status: 404,
    headers: { ...NOT_FOUND_HEADERS, 'Content-Type': negotiated ? negotiated.contentType : 'text/html; charset=utf-8' },
  });
}

const route: PagesFunction<{ ASSETS: Fetcher }> = async ({ request, next, env }) => {
  const url = new URL(request.url);
  const accept = request.headers.get('accept') || '';

  if (url.pathname === '/' && preferredType(accept, ['text/html', 'text/markdown']) === 'text/markdown') {
    const md = await env.ASSETS.fetch(new URL('/index.md', url));
    return new Response(md.body, {
      status: md.status,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept', Link: `<${SITE}/>; rel="canonical"; type="text/html"` },
    });
  }

  if (url.pathname === '/sitemap.xml') {
    return env.ASSETS.fetch(new URL('/sitemap-index.xml', url));
  }

  const res = await next();
  return res.status === 404 && !url.pathname.startsWith('/api/') ? notFound(accept, res) : res;
};

export const onRequest: PagesFunction<{ ASSETS: Fetcher }> = async (context) => withSecurityHeaders(await route(context));
