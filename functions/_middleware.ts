// Porta o vercel.json: negociação de markdown em "/" e 404 negociado (markdown/JSON/HTML).
const SITE = 'https://news.dehor.com.br';
const LINK = '</sitemap.xml>; rel="sitemap"; type="application/xml", </index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"';
const WANTS_MARKDOWN = /^(?=.*text\/markdown)(?!.*text\/markdown;q=0).*$/;

function notFound(accept: string, html: Response): Response {
  const headers = {
    Vary: 'Accept',
    'Cache-Control': 'public, max-age=60, s-maxage=300',
    'X-Robots-Tag': 'noindex',
    Link: LINK,
  };
  if (accept.includes('application/json') || accept.includes('application/problem+json')) {
    return new Response(
      JSON.stringify({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Não existe recurso nesse caminho em news.dehor.com.br.',
        links: { home: `${SITE}/`, markdown: `${SITE}/index.md`, llms: `${SITE}/llms.txt`, sitemap: `${SITE}/sitemap.xml` },
      }),
      { status: 404, headers: { ...headers, 'Content-Type': 'application/problem+json; charset=utf-8' } },
    );
  }
  if (accept.includes('text/html')) {
    return new Response(html.body, { status: 404, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response(
    [
      '# 404 - página não encontrada',
      '',
      'Não existe conteúdo nesse caminho em news.dehor.com.br.',
      '',
      `- [Página inicial](${SITE}/)`,
      `- [Versão em markdown](${SITE}/index.md)`,
      `- [Mapa para agentes (llms.txt)](${SITE}/llms.txt)`,
      `- [Sitemap](${SITE}/sitemap.xml)`,
      '',
    ].join('\n'),
    { status: 404, headers: { ...headers, 'Content-Type': 'text/markdown; charset=utf-8' } },
  );
}

export const onRequest: PagesFunction = async ({ request, next, env }) => {
  const url = new URL(request.url);
  const accept = request.headers.get('accept') || '';

  if (url.pathname === '/' && WANTS_MARKDOWN.test(accept)) {
    const md = await (env as { ASSETS: Fetcher }).ASSETS.fetch(new URL('/index.md', url));
    return new Response(md.body, {
      status: md.status,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept', Link: `<${SITE}/>; rel="canonical"; type="text/html"` },
    });
  }

  const res = await next();
  return res.status === 404 && !url.pathname.startsWith('/api/') ? notFound(accept, res) : res;
};
