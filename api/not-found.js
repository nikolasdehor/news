const SITE = "https://news.dehor.com.br";

const LINKS = {
  home: `${SITE}/`,
  markdown: `${SITE}/index.md`,
  llms: `${SITE}/llms.txt`,
  sitemap: `${SITE}/sitemap.xml`,
};

export default function handler(req, res) {
  const accept = String(req.headers.accept || "");
  res.statusCode = 404;
  res.setHeader("Vary", "Accept");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader(
    "Link",
    `</sitemap.xml>; rel="sitemap"; type="application/xml", </index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"`,
  );

  if (accept.includes("application/json") || accept.includes("application/problem+json")) {
    res.setHeader("Content-Type", "application/problem+json; charset=utf-8");
    res.end(
      JSON.stringify({
        type: "about:blank",
        title: "Not Found",
        status: 404,
        detail: "Não existe recurso nesse caminho em news.dehor.com.br.",
        links: LINKS,
      }),
    );
    return;
  }

  if (accept.includes("text/html")) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>404 | DeHor News</title><style>body{font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;margin:0;padding:3rem 1rem}main{max-width:40rem;margin:auto;border:1px solid #30363d;border-radius:6px;padding:2rem}h1{font-size:1.5rem;color:#f0f6fc}a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><main><h1>404 - Página não encontrada</h1><p>Não existe conteúdo nesse endereço.</p><ul><li><a href="/">Página inicial</a></li><li><a href="/sitemap.xml">Sitemap</a></li><li><a href="/llms.txt">llms.txt</a></li></ul></main></body></html>`,
    );
    return;
  }

  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.end(
    [
      "# 404 - página não encontrada",
      "",
      "Não existe conteúdo nesse caminho em news.dehor.com.br.",
      "",
      `- [Página inicial](${LINKS.home})`,
      `- [Versão em markdown](${LINKS.markdown})`,
      `- [Mapa para agentes (llms.txt)](${LINKS.llms})`,
      `- [Sitemap](${LINKS.sitemap})`,
      "",
    ].join("\n"),
  );
}
