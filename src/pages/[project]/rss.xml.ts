import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function getStaticPaths() {
  const todos = await getCollection('posts', ({ data }) => !data.draft);
  const projetos = [...new Set(todos.map((p) => p.data.project))];
  return projetos.map((project) => ({ params: { project } }));
}

export async function GET(context: APIContext) {
  const project = context.params.project as string;
  const todos = await getCollection('posts', ({ data }) =>
    !data.draft && data.project === project
  );

  const sorted = todos.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  const nomesProjeto: Record<string, string> = {
    'mcp-fiscal-brasil': 'MCP Fiscal Brasil',
  };
  const nomeProjeto = nomesProjeto[project] ?? project;

  return rss({
    title: `${nomeProjeto} - news.dehor.com.br`,
    description: `Diário de bordo do projeto ${nomeProjeto}.`,
    site: context.site!,
    items: sorted.map((post) => {
      const [, ...restParts] = post.id.split('/');
      const slug = restParts.join('/');
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: `/${project}/${slug}/`,
      };
    }),
    customData: `<language>pt-BR</language>`,
  });
}
