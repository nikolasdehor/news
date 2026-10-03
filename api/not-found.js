import { NOT_FOUND_HEADERS, negotiateNotFound } from "../functions/_shared/not-found.js";

const HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>404 | DeHor News</title><style>body{font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;margin:0;padding:3rem 1rem}main{max-width:40rem;margin:auto;border:1px solid #30363d;border-radius:6px;padding:2rem}h1{font-size:1.5rem;color:#f0f6fc}a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><main><h1>404 - Página não encontrada</h1><p>Não existe conteúdo nesse endereço.</p><ul><li><a href="/">Página inicial</a></li><li><a href="/sitemap.xml">Sitemap</a></li><li><a href="/llms.txt">llms.txt</a></li></ul></main></body></html>`;

export default function handler(req, res) {
  const negotiated = negotiateNotFound(String(req.headers.accept || ""));
  res.statusCode = 404;
  for (const [key, value] of Object.entries(NOT_FOUND_HEADERS)) res.setHeader(key, value);
  res.setHeader("Content-Type", negotiated ? negotiated.contentType : "text/html; charset=utf-8");
  res.end(negotiated ? negotiated.body : HTML);
}
