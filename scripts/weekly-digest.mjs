#!/usr/bin/env node
/**
 * weekly-digest.mjs - diário da semana de TODOS os projetos do catálogo.
 *
 * Roda no Mac do Nikolas (launchd, segunda 09:00), não no Actions: precisa do
 * `gh` local para enxergar repositórios privados e do `claude -p` já
 * autenticado (OAuth, nunca chave de API).
 *
 * Uso:
 *   node scripts/weekly-digest.mjs --dry-run   # só imprime o markdown e a revisão
 *   node scripts/weekly-digest.mjs             # gera, revisa, abre PR e faz merge se ok
 *
 * Repositórios privados não ficam no catálogo público: o mapa slug -> repos
 * fica em .digest-sources.json (gitignored, só no Mac).
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86400000;
const CLAUDE_TIMEOUT = 10 * 60 * 1000;
const MAX_ITENS = 25; // por projeto, para manter o prompt curto
const DASHES = String.fromCharCode(0x2013, 0x2014); // meio-travessão e travessão
const TRAVESSOES = new RegExp(`[${DASHES}]`, 'g');
const TRAVESSAO_SOLTO = new RegExp(`\\s+[${DASHES}]\\s+`, 'g');

// ---------------------------------------------------------------------------
// Funções puras (testadas em tests/weekly-digest.test.mjs)
// ---------------------------------------------------------------------------

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
  return { year, week: String(week).padStart(2, '0') };
}

const SECRET_PATTERNS = [
  ['chave sk-', /\bsk-[A-Za-z0-9_-]{8,}/],
  ['token GitHub', /\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{10,}/],
  ['JWT (eyJ)', /\beyJ[A-Za-z0-9_-]{10,}/],
  ['endereço IP', /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
  ['e-mail', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ['CPF', /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/],
  ['telefone', /\+?55\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/],
];

/** Varredura determinística: padrões de segredo + nomes de repos privados. */
export function scanSecrets(text, forbidden = []) {
  const problems = SECRET_PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => `padrão suspeito: ${name}`);
  const lower = text.toLowerCase();
  for (const term of forbidden) {
    if (term && lower.includes(term.toLowerCase())) problems.push(`nome de repositório privado: ${term}`);
  }
  return problems;
}

/** Troca travessões por vírgula/hífen (regra editorial do site). */
export function semTravessao(text) {
  return text.replace(TRAVESSAO_SOLTO, ', ').replace(TRAVESSOES, '-');
}

/** Extrai o primeiro objeto JSON de uma resposta de texto. */
export function parseReview(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { ok: false, problemas: ['revisor não devolveu JSON'] };
  try {
    const data = JSON.parse(match[0]);
    return { ok: data.ok === true, problemas: Array.isArray(data.problemas) ? data.problemas : [] };
  } catch {
    return { ok: false, problemas: ['JSON do revisor inválido'] };
  }
}

const isBot = (login = '', msg = '') => /\[bot\]$/i.test(login) || /^(?:chore|build)\(deps/i.test(msg);

export function sourcesFor(catalogo, privados) {
  return catalogo.map(p => ({
    slug: p.slug,
    nome: p.nome,
    privado: p.visibilidade === 'privado',
    repos: p.visibilidade === 'publico' ? (p.repo ? [p.repo] : []) : (privados[p.slug] || []),
  }));
}

// ---------------------------------------------------------------------------
// Coleta via gh (privados inclusive)
// ---------------------------------------------------------------------------

function gh(args) {
  const res = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) throw new Error((res.stderr || '').trim().split('\n')[0] || `gh ${args[1]} falhou`);
  return res.stdout;
}

const jsonLines = out => out.split('\n').filter(Boolean).map(line => JSON.parse(line));

function collectRepo(repo, since) {
  const branch = gh(['api', `repos/${repo}`, '--jq', '.default_branch']).trim();
  let commits = [];
  try {
    commits = jsonLines(gh(['api', '--paginate', `repos/${repo}/commits?sha=${branch}&since=${since}&per_page=100`,
      '--jq', '.[] | {msg: (.commit.message | split("\n")[0]), login: (.author.login // "")}']));
  } catch (error) {
    if (!/409|empty/i.test(error.message)) throw error; // repositório vazio não é erro
  }
  // ponytail: só a primeira página de PRs fechadas por atualização (100); basta para 7 dias.
  const prs = jsonLines(gh(['api', `repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`,
    '--jq', `.[] | select(.merged_at != null and .merged_at >= "${since}") | {number, title, url: .html_url, login: .user.login}`]));
  return {
    commits: commits.filter(c => !isBot(c.login, c.msg)).map(c => c.msg),
    prs: prs.filter(p => !isBot(p.login, p.title)).map(({ number, title, url }) => ({ number, title, url })),
  };
}

function collectAll(projetos, since) {
  const ativos = [];
  const falhas = [];
  for (const p of projetos) {
    const acc = { commits: [], prs: [] };
    for (const repo of p.repos) {
      try {
        const r = collectRepo(repo, since);
        acc.commits.push(...r.commits);
        acc.prs.push(...r.prs);
      } catch (error) {
        falhas.push(`${p.slug}: ${error.message}`);
      }
    }
    if (acc.commits.length || acc.prs.length) ativos.push({ ...p, ...acc });
  }
  return { ativos, falhas };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export function writerPrompt(ativos, periodo) {
  const dados = ativos.map(p => ({
    projeto: p.nome,
    visibilidade: p.privado ? 'PRIVADO' : 'público',
    commits: p.commits.length,
    prs_mergeados: p.prs.length,
    ...(p.privado
      ? { assuntos_para_resumir_em_alto_nivel: [...p.prs.map(x => x.title), ...p.commits].slice(0, MAX_ITENS) }
      : { prs: p.prs.slice(0, MAX_ITENS), commits_recentes: p.commits.slice(0, MAX_ITENS) }),
  }));
  return `Você escreve o "Diário da semana" do blog news.dehor.com.br, de Nikolas de Hor.
Período coberto: ${periodo}.

Escreva em português do Brasil, com acentuação correta, tom de diário de bordo (primeira pessoa, direto, sem marketing, sem exagero).
NUNCA use travessão longo nem meio-travessão; use hífen comum ou vírgula.

Formato (Markdown, SEM frontmatter, SEM título H1):
- Um parágrafo curto de abertura sobre a semana.
- Uma seção "## <nome do projeto>" para cada projeto da lista, na ordem dada. Não invente projetos nem atividade.
- Termine com a linha "Abraço," e, em parágrafo separado, "Nikolas de Hor".

Projetos públicos: pode citar mudanças concretas e linkar PRs no formato [título](url), usando só as URLs fornecidas.

Projetos PRIVADOS: no máximo 1 ou 2 frases de alto nível sobre o tipo de avanço (ex.: "melhorias de estabilidade e na experiência de cadastro"). É PROIBIDO citar: nomes de arquivos, caminhos, funções, tabelas, endpoints, URLs, nomes de repositório, clientes, pessoas, valores em dinheiro, preços, métricas internas, dados de saúde, IPs, domínios internos, chaves, tokens, provedores de infraestrutura. Na dúvida, generalize.

Responda apenas com o Markdown do corpo do post.

Dados da semana (JSON):
${JSON.stringify(dados, null, 2)}`;
}

export function reviewerPrompt(markdown, privados) {
  return `Você é revisor de privacidade de um post público. Projetos PRIVADOS neste post: ${privados.join(', ') || 'nenhum'}.

Reprove (ok=false) se o texto contiver, sobre qualquer projeto: segredos, chaves ou tokens; IPs, domínios internos ou infraestrutura; nomes de pessoas físicas ou de clientes; dados de saúde; valores em dinheiro ou métricas de negócio. E, nos projetos PRIVADOS, também: nomes de arquivos, caminhos, funções, tabelas, endpoints, URLs, nomes de repositório ou qualquer detalhe técnico além de 1-2 frases de alto nível.
O nome "Nikolas de Hor" (autor) é permitido. Links para PRs de projetos públicos são permitidos.

Responda SOMENTE com JSON válido, sem texto em volta: {"ok": true|false, "problemas": ["descrição curta de cada problema"]}

Post:
<<<
${markdown}
>>>`;
}

// ---------------------------------------------------------------------------
// claude -p (OAuth do Mac; remove chaves de API do ambiente)
// ---------------------------------------------------------------------------

function claude(prompt) {
  const env = { ...process.env };
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']) delete env[key];
  // --safe-mode: sem CLAUDE.md, memória, hooks e MCPs; --tools "": sem ferramentas.
  const res = spawnSync('claude', ['-p', '--safe-mode', '--tools', '', '--no-session-persistence'], {
    input: prompt, encoding: 'utf8', env, cwd: tmpdir(), timeout: CLAUDE_TIMEOUT, maxBuffer: 16 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`claude -p falhou: ${(res.stderr || res.stdout || '').trim().slice(0, 300)}`);
  return res.stdout.trim();
}

// ---------------------------------------------------------------------------
// Post e publicação
// ---------------------------------------------------------------------------

function postFile({ year, week }, periodo, body, now) {
  return `---
title: "Semana ${week} de ${year}: diário de bordo"
description: "O que andou nos projetos de Nikolas de Hor entre ${periodo}."
pubDate: ${now.toISOString()}
project: "semana"
tags: ["diario-de-bordo", "semana"]
draft: false
---

${body}
`;
}

function git(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args[0]} falhou: ${(res.stderr || '').trim()}`);
  return res.stdout.trim();
}

function mergePr(pr, cwd) {
  const auto = spawnSync('gh', ['pr', 'merge', pr, '--squash', '--auto', '--delete-branch'], { cwd, encoding: 'utf8' });
  if (auto.status === 0) return;
  // Repo sem auto-merge nem checks obrigatórios: merge direto.
  const direct = spawnSync('gh', ['pr', 'merge', pr, '--squash', '--delete-branch'], { cwd, encoding: 'utf8' });
  if (direct.status !== 0) throw new Error(`merge falhou: ${direct.stderr.trim()}`);
}

/** Publica num worktree temporário a partir de origin/main (não toca no checkout local). */
function publish({ rel, content, branch, title, ok, problemas }) {
  git(ROOT, ['fetch', 'origin', 'main']);
  if (spawnSync('git', ['cat-file', '-e', `origin/main:${rel}`], { cwd: ROOT }).status === 0) {
    console.log(`[digest] ${rel} já existe na main; nada a fazer.`);
    return 0;
  }
  const base = mkdtempSync(join(tmpdir(), 'news-digest-'));
  const dir = join(base, 'wt');
  git(ROOT, ['worktree', 'add', '-B', branch, dir, 'origin/main']);
  try {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
    git(dir, ['add', rel]);
    git(dir, ['commit', '-m', `docs: ${title.toLowerCase()}`]);
    git(dir, ['push', '-u', '--force', 'origin', branch]);
    const body = ok
      ? 'Diário da semana gerado pelo scripts/weekly-digest.mjs. Revisão de privacidade (LLM + varredura de padrões) aprovada.'
      : `Diário da semana gerado pelo scripts/weekly-digest.mjs. **Revisão de privacidade reprovou**, não fazer merge sem corrigir:\n\n${problemas.map(p => `- ${p}`).join('\n')}`;
    const created = spawnSync('gh', ['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body', body], { cwd: dir, encoding: 'utf8' });
    if (created.status !== 0) throw new Error(`gh pr create falhou: ${created.stderr.trim()}`);
    const pr = created.stdout.trim();
    console.log(`[digest] PR: ${pr}`);
    if (!ok) return 3;
    mergePr(pr, dir);
    console.log('[digest] merge feito/agendado.');
    return 0;
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: ROOT });
    rmSync(base, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function loadPrivados() {
  const file = join(ROOT, '.digest-sources.json');
  if (!existsSync(file)) {
    console.warn('[digest] aviso: .digest-sources.json ausente; só projetos públicos serão cobertos.');
    return {};
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * Catálogo da origin/main (o checkout local pode estar em outra branch).
 * Sem catálogo na main = portfólio ainda não publicado: só o dry-run usa o local.
 */
function loadCatalogo(dry) {
  spawnSync('git', ['fetch', '-q', 'origin', 'main'], { cwd: ROOT });
  const res = spawnSync('git', ['show', 'origin/main:src/data/projetos.json'], { cwd: ROOT, encoding: 'utf8' });
  if (res.status === 0) return JSON.parse(res.stdout);
  if (!dry) return null;
  return JSON.parse(readFileSync(join(ROOT, 'src/data/projetos.json'), 'utf8'));
}

export async function main({ dry = false, now = new Date() } = {}) {
  const catalogo = loadCatalogo(dry);
  if (!catalogo) {
    console.log('[digest] src/data/projetos.json ainda não está na main; nada publicado.');
    return 0;
  }
  const projetos = sourcesFor(catalogo, loadPrivados());
  const since = new Date(now - 7 * DAY);
  const fmt = d => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(d);
  const periodo = `${fmt(since)} e ${fmt(now)}`;

  const { ativos, falhas } = collectAll(projetos, since.toISOString().replace(/\.\d+Z$/, 'Z'));
  falhas.forEach(f => console.warn(`[digest] falha na coleta: ${f}`));
  if (!ativos.length) {
    console.log('[digest] Semana sem atividade: nenhum post gerado.');
    return falhas.length ? 1 : 0;
  }
  console.log(`[digest] Projetos com atividade: ${ativos.map(p => p.slug).join(', ')}`);

  const body = semTravessao(claude(writerPrompt(ativos, periodo)));
  const week = isoWeek(new Date(now - DAY)); // segunda cobre a semana ISO que terminou no domingo
  const content = postFile(week, periodo, body, now);

  const forbidden = projetos.filter(p => p.privado).flatMap(p => p.repos);
  const review = parseReview(claude(reviewerPrompt(body, ativos.filter(p => p.privado).map(p => p.nome))));
  const problemas = [...review.problemas, ...scanSecrets(body, forbidden)];
  const ok = review.ok && problemas.length === 0;

  const rel = `src/content/posts/semana/${week.year}-semana-${week.week}.md`;
  if (dry) {
    console.log(`\n===== ${rel} (dry-run) =====\n`);
    console.log(content);
    console.log(`===== revisão: ${ok ? 'OK' : 'REPROVADA'} =====`);
    problemas.forEach(p => console.log(`- ${p}`));
    return 0;
  }
  const title = `Diário da semana ${week.week} de ${week.year}`;
  const code = publish({ rel, content, branch: `auto/semana-${week.week}`, title, ok, problemas });
  problemas.forEach(p => console.error(`[digest] problema: ${p}`));
  return code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`[digest] ${new Date().toISOString()} início${process.argv.includes('--dry-run') ? ' (dry-run)' : ''}`);
  try {
    process.exitCode = await main({ dry: process.argv.includes('--dry-run') });
  } catch (error) {
    console.error(`[digest] ERRO: ${error.message}`);
    process.exitCode = 1;
  }
}
