import type { CollectionEntry } from 'astro:content';

export function publicIndex(posts: CollectionEntry<'posts'>[]) {
  const published = posts.filter(post => !post.data.draft)
    .sort((a,b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const date = (value: Date) => new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo', dateStyle:'short'}).format(value);
  return `---
title: news.dehor.com.br
canonical: https://news.dehor.com.br/
lang: pt-BR
---

# news.dehor.com.br

Publicações verificáveis sobre projetos open source acompanhados por Nikolas de Hor. Mudanças mergeadas e versões lançadas são identificadas separadamente. A coleta é automática; a publicação tem revisão humana.

## Projetos e fontes

- [MCP Fiscal Brasil](https://news.dehor.com.br/mcp-fiscal-brasil/) · [GitHub](https://github.com/DeHor-Labs/mcp-fiscal-brasil) · [PyPI](https://pypi.org/project/mcp-fiscal-brasil/) · [Documentação](https://dehor-labs.github.io/mcp-fiscal-brasil/)
- [MCP Jurídico Brasil](https://news.dehor.com.br/mcp-juridico-brasil/) · [GitHub](https://github.com/DeHor-Labs/mcp-juridico-brasil) · [PyPI](https://pypi.org/project/mcp-juridico-brasil/)

## Publicações

${published.map(post => `- [${post.data.title.replace(/[\]\r\n[]/g,' ')}](https://news.dehor.com.br/${post.id}/) — ${date(post.data.pubDate)}\n  ${post.data.description}`).join('\n')}

## Acesso

- [RSS global](https://news.dehor.com.br/rss.xml)
- [Sitemap](https://news.dehor.com.br/sitemap-index.xml)
- [Sobre](https://news.dehor.com.br/sobre/) · [Contato](https://news.dehor.com.br/contato/) · [Privacidade](https://news.dehor.com.br/privacidade/)
- [GitHub de Nikolas de Hor](https://github.com/nikolasdehor)

Este índice vem dos posts publicados no build; rascunhos não são incluídos. As fontes dos projetos e os links de cada artigo prevalecem sobre este resumo. llms.txt é um índice experimental, sem promessa de posicionamento em buscadores ou respostas de IA.
`;
}
