import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {frontmatter} from './sync-releases.mjs';
const posts='src/content/posts';
for (const project of readdirSync(posts)) {
  for (const file of readdirSync(join(posts,project)).filter(f=>/\.(md|mdx)$/.test(f))) {
    const data=frontmatter(readFileSync(join(posts,project,file),'utf8'));
    if (data.draft !== 'true') continue;
    const slug=file.replace(/\.(md|mdx)$/,'');
    if (existsSync(join('dist',project,slug,'index.html'))) {
      throw new Error(`Draft exposed in build: ${project}/${slug}`);
    }
  }
}
console.log('Drafts remain absent from public routes.');
