// 404 negociado compartilhado entre a Pages Function (functions/_middleware.ts) e a função da Vercel
// (api/not-found.js): markdown pra agentes, JSON pra clientes de API, HTML (de cada host) pra navegador.
import { preferredType } from './negotiate.js';

export const SITE = 'https://news.dehor.com.br';
export const DISCOVERY_LINK =
  '</sitemap.xml>; rel="sitemap"; type="application/xml", </index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"';
export const NOT_FOUND_HEADERS = {
  Vary: 'Accept',
  'Cache-Control': 'public, max-age=60, s-maxage=300',
  'X-Robots-Tag': 'noindex',
  Link: DISCOVERY_LINK,
};

const LINKS = {
  home: `${SITE}/`,
  markdown: `${SITE}/index.md`,
  llms: `${SITE}/llms.txt`,
  sitemap: `${SITE}/sitemap.xml`,
};
const NOT_FOUND_TYPES = ['text/markdown', 'application/json', 'application/problem+json', 'text/html'];

/**
 * Corpo do 404 conforme o Accept. Retorna null quando o cliente prefere HTML (cada host usa o seu).
 * Sem tipo aceitável, cai no markdown.
 * @param {string | null | undefined} accept
 * @returns {{ contentType: string, body: string } | null}
 */
export function negotiateNotFound(accept) {
  const type = preferredType(accept, NOT_FOUND_TYPES);
  if (type === 'text/html') return null;
  if (type === 'application/json' || type === 'application/problem+json') {
    return {
      contentType: 'application/problem+json; charset=utf-8',
      body: JSON.stringify({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Não existe recurso nesse caminho em news.dehor.com.br.',
        links: LINKS,
      }),
    };
  }
  return {
    contentType: 'text/markdown; charset=utf-8',
    body: [
      '# 404 - página não encontrada',
      '',
      'Não existe conteúdo nesse caminho em news.dehor.com.br.',
      '',
      `- [Página inicial](${LINKS.home})`,
      `- [Versão em markdown](${LINKS.markdown})`,
      `- [Mapa para agentes (llms.txt)](${LINKS.llms})`,
      `- [Sitemap](${LINKS.sitemap})`,
      '',
    ].join('\n'),
  };
}
