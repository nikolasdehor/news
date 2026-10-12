import type { CollectionEntry } from 'astro:content';
import { PROJETOS, CATEGORIAS, SEMANA, linksDoProjeto } from './projetos';

const SITE = 'https://news.dehor.com.br';

function projetosMarkdown() {
  return CATEGORIAS.map((cat) => {
    const itens = PROJETOS.filter((p) => p.categoria === cat.id);
    if (!itens.length) return '';
    const linhas = itens.map((p) => {
      const fontes = linksDoProjeto(p).map((l) => `[${l.rotulo}](${l.url})`).join(' · ');
      return `- [${p.nome}](${SITE}/${p.slug}/) (${p.status}${p.visibilidade === 'privado' ? ', privado' : ''})${fontes ? ' · ' + fontes : ''}\n  ${p.descricao}`;
    });
    return `### ${cat.nome}\n\n${linhas.join('\n')}`;
  }).filter(Boolean).join('\n\n');
}

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

Portfólio e publicações verificáveis sobre os projetos de Nikolas de Hor: open source, produtos, dados públicos, For6 Solutions e projetos acadêmicos. Mudanças mergeadas e versões lançadas são identificadas separadamente. Projetos privados aparecem só em alto nível, sem código nem detalhes internos.

## Projetos e fontes

${projetosMarkdown()}

## Diário da semana

- [${SEMANA.nome}](${SITE}/${SEMANA.slug}/): ${SEMANA.descricao}

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
