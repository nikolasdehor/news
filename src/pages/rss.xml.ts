import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);

  const sorted = posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: 'news.dehor.com.br - Nikolas de Hor',
    description: 'Novidades e diário de bordo dos projetos open source de Nikolas de Hor.',
    site: context.site!,
    items: sorted.map((post) => {
      const [project, ...restParts] = post.id.split('/');
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
