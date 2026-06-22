#!/usr/bin/env node
/**
 * sync-releases.mjs
 *
 * Verifica releases novos nos projetos monitorados e gera rascunhos de post
 * para o blog dehor.news. Idempotente: tags ja no estado sao ignoradas.
 *
 * Uso:
 *   node scripts/sync-releases.mjs
 *
 * Variaveis de ambiente:
 *   GITHUB_TOKEN  - opcional, so para evitar rate limit da API publica
 *   DRY_RUN       - se "true", imprime o que faria sem escrever nada
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DRY_RUN = process.env.DRY_RUN === 'true';

// ---------------------------------------------------------------------------
// Config: lista de projetos monitorados
// Para adicionar um novo projeto, inclua uma entrada neste array.
// ---------------------------------------------------------------------------
const PROJECTS = [
  {
    /** Identificador do repositorio no GitHub (owner/repo) */
    repo: 'DeHor-Labs/mcp-fiscal-brasil',
    /** Slug usado no diretorio de posts e no campo `project` do frontmatter */
    slug: 'mcp-fiscal-brasil',
    /** Imagem OG padrao do projeto (relativa a /public) */
    ogImage: '/og/mcp-fiscal-brasil.png',
    /** Tags base que todo post deste projeto recebe */
    baseTags: ['mcp', 'python', 'fiscal', 'brasil', 'open-source'],
    /** Links de referencia do projeto */
    links: {
      repo: 'https://github.com/DeHor-Labs/mcp-fiscal-brasil',
      docs: 'https://dehor-labs.github.io/mcp-fiscal-brasil/',
      pypi: 'https://pypi.org/project/mcp-fiscal-brasil/',
    },
  },
  // Para adicionar mcp-juridico-brasil no futuro, descomente e ajuste:
  // {
  //   repo: 'DeHor-Labs/mcp-juridico-brasil',
  //   slug: 'mcp-juridico-brasil',
  //   ogImage: '/og/mcp-juridico-brasil.png',
  //   baseTags: ['mcp', 'python', 'juridico', 'brasil', 'open-source'],
  //   links: {
  //     repo: 'https://github.com/DeHor-Labs/mcp-juridico-brasil',
  //     docs: 'https://dehor-labs.github.io/mcp-juridico-brasil/',
  //     pypi: 'https://pypi.org/project/mcp-juridico-brasil/',
  //   },
  // },
];

// ---------------------------------------------------------------------------
// Caminhos
// ---------------------------------------------------------------------------
const STATE_FILE = join(REPO_ROOT, '.github', 'synced-releases.json');
const POSTS_DIR = join(REPO_ROOT, 'src', 'content', 'posts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`[sync-releases] ${msg}`);
}

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return { covered: {} };
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  if (DRY_RUN) {
    log('DRY_RUN: nao gravando estado atualizado.');
    return;
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
  log('Estado atualizado gravado em .github/synced-releases.json');
}

/**
 * Converte uma tag de release em slug de post sem colisao.
 * "v0.6.0"     -> "novidades-v0-6-0"
 * "v1.0.0-rc.1"-> "novidades-v1-0-0-rc-1"
 */
function tagToPostSlug(tag) {
  const normalized = tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `novidades-${normalized}`;
}

/**
 * Escapa aspas duplas para uso seguro em frontmatter YAML entre aspas duplas.
 */
function yamlStr(str) {
  if (!str) return '';
  return str.replace(/"/g, "'").replace(/\r?\n/g, ' ').trim();
}

/**
 * Busca releases publicos (nao-draft, nao-prerelease, com published_at) do GitHub.
 */
async function fetchReleases(repo) {
  const headers = { 'User-Agent': 'dehor-news/sync-releases' };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const releases = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} para ${repo}: ${await res.text()}`);
    }

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const r of batch) {
      if (r.draft || r.prerelease || !r.published_at) continue;
      releases.push(r);
    }

    if (batch.length < 100) break;
    page++;
  }

  return releases;
}

/**
 * Gera o conteudo completo do arquivo .md do rascunho de post.
 */
function generateDraft(release, project) {
  const tag = release.tag_name;
  const pubDateIso = release.published_at.slice(0, 10);

  const titleProject = project.slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const title = `Novidades na ${tag} - ${titleProject}`;
  const description = `O que mudou na versao ${tag.replace(/^v/, '')} do ${titleProject}: funcionalidades novas, correcoes e melhorias de infraestrutura.`;

  const tags = [...project.baseTags];

  const majorMinor = tag.match(/^v?(\d+)\.(\d+)/);
  if (majorMinor) {
    tags.push(`v${majorMinor[1]}`);
  }

  const releaseBody = (release.body || '_Sem notas detalhadas para esta versao._').trim();

  return `---
title: "${yamlStr(title)}"
description: "${yamlStr(description)}"
pubDate: ${pubDateIso}T12:00:00-03:00
project: "${project.slug}"
tags: [${tags.map((t) => `"${t}"`).join(', ')}]
ogImage: "${project.ogImage}"
draft: true
---

<!-- RASCUNHO AUTO-GERADO em ${new Date().toISOString().slice(0, 10)} a partir do release ${tag}. Revisar antes de publicar: ajustar tom, completar secoes, mudar draft para false e remover este comentario. -->

A versao **${tag}** do [${titleProject}](${project.links.repo}) foi publicada em ${pubDateIso}. Confira abaixo o que mudou.

---

## O que mudou na ${tag}

${releaseBody}

---

## Como instalar ou atualizar

\`\`\`bash
# Via uvx (sem instalacao permanente)
uvx ${project.slug}

# Via pip
pip install --upgrade ${project.slug}
\`\`\`

---

## Links

- **Repositorio**: ${project.links.repo}
${project.links.docs ? `- **Documentacao**: ${project.links.docs}\n` : ''}\
${project.links.pypi ? `- **PyPI**: ${project.links.pypi}\n` : ''}\
- **Release no GitHub**: ${release.html_url}
- **CHANGELOG completo**: ${project.links.repo}/blob/main/CHANGELOG.md

---

Abraco de Goiania.

- Nikolas de Hor
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(`Iniciando sincronizacao${DRY_RUN ? ' (DRY_RUN)' : ''}...`);

  const state = loadState();
  if (!state.covered) state.covered = {};

  /** @type {{ project: string, tag: string, filePath: string }[]} */
  const generated = [];

  for (const project of PROJECTS) {
    log(`Verificando ${project.repo}...`);

    const covered = new Set(state.covered[project.slug] ?? []);
    let releases;

    try {
      releases = await fetchReleases(project.repo);
    } catch (err) {
      log(`ERRO ao buscar releases de ${project.repo}: ${err.message}`);
      continue;
    }

    log(`  ${releases.length} release(s) publicado(s) encontrado(s).`);

    for (const release of releases) {
      const tag = release.tag_name;

      if (covered.has(tag)) {
        log(`  [ja coberto] ${tag}`);
        continue;
      }

      const postSlug = tagToPostSlug(tag);
      const postDir = join(POSTS_DIR, project.slug);
      const postFile = join(postDir, `${postSlug}.md`);

      // Idempotencia: se o arquivo ja existe, apenas registra no estado
      if (existsSync(postFile)) {
        log(`  [arquivo ja existe] ${tag} -> ${postSlug}.md - adicionando ao estado.`);
        covered.add(tag);
        continue;
      }

      log(`  [novo] ${tag} -> ${postSlug}.md`);

      if (!DRY_RUN) {
        mkdirSync(postDir, { recursive: true });
        writeFileSync(postFile, generateDraft(release, project), 'utf8');
      } else {
        log(`  DRY_RUN: geraria ${postFile}`);
      }

      covered.add(tag);
      generated.push({ project: project.slug, tag, filePath: postFile });
    }

    state.covered[project.slug] = [...covered].sort();
  }

  saveState(state);

  if (generated.length === 0) {
    log('Nenhum rascunho novo gerado. Tudo ja coberto.');
    // Exit 0: o workflow nao abre PR
    process.exit(0);
  }

  log(`${generated.length} rascunho(s) gerado(s):`);
  for (const g of generated) {
    log(`  ${g.project} ${g.tag} -> ${g.filePath}`);
  }

  const summary = generated.map((g) => `${g.project} ${g.tag}`).join(', ');
  // O workflow captura esta linha para montar o titulo do PR
  console.log(`GENERATED_SUMMARY=${summary}`);

  // Exit 2: o workflow abre PR com os rascunhos gerados
  process.exit(2);
}

main().catch((err) => {
  console.error('[sync-releases] Erro fatal:', err);
  process.exit(1);
});
