import { readFileSync } from 'node:fs';

/**
 * Projetos monitorados pelo sync-releases: itens públicos do catálogo
 * (src/data/projetos.json) que têm repositório. Privados nunca entram aqui;
 * eles só aparecem em alto nível no digest semanal gerado no Mac.
 */
export const CATALOGO = JSON.parse(readFileSync(new URL('../src/data/projetos.json', import.meta.url), 'utf8'));

export const PROJECTS = CATALOGO
  .filter(p => p.visibilidade === 'publico' && p.repo)
  .map(p => ({ enabled: true, repo: p.repo, slug: p.slug, displayName: p.nome }));
