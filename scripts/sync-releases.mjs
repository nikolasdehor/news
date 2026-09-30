#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECTS } from './news-projects.mjs';
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export function frontmatter(raw) {
  const block = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
  return Object.fromEntries(block.split('\n').filter(x => x.includes(':')).map(x => { const i=x.indexOf(':'); return [x.slice(0,i).trim(), x.slice(i+1).trim().replace(/^"|"$/g,'')]; }));
}
export function relevant(pr) {
  const labels = new Set((pr.labels || []).map(x=>x.name));
  if (labels.has('news:exclude')) return false;
  if (labels.has('news:include')) return true;
  // Corrections, including dependency security fixes, take precedence over noise.
  if (/(?:^(fix|feat|perf|security)[(:]|vulnerab|seguran[cç]a|security)/i.test(pr.title)) return true;
  return !/^(?:(build|chore|ci|docs|test|style|refactor)[(:]|bump )/i.test(pr.title) && pr.user?.login !== 'dependabot[bot]';
}
export async function github(path, fetcher=fetch) {
  const headers = {'User-Agent':'dehor-news', Accept:'application/vnd.github+json'};
  if (process.env.GITHUB_TOKEN) headers.Authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
  const res=await fetcher(`https://api.github.com/${path}`, {headers, signal:AbortSignal.timeout(30000)});
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}; retry after ${res.headers.get('retry-after') || res.headers.get('x-ratelimit-reset') || 'checking Actions logs'}`);
  return res.json();
}
export async function pages(path, api=github) {
  const all=[];
  for(let page=1;page<=100;page++) { const batch=await api(`${path}${path.includes('?')?'&':'?'}per_page=100&page=${page}`); if(!Array.isArray(batch)) throw new Error('Invalid API list'); all.push(...batch); if(batch.length<100)return all; }
  throw new Error('Pagination limit; refusing incomplete collection');
}
export function select({project, releases, pulls, posts, legacy, cutoff}) {
  const published=posts.filter(p=>p.fm.draft==='false');
  const windows=published.map(p=>p.fm.sourceUntil || p.fm.pubDate).filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b));
  const since=windows.at(-1);
  if(!since || !Number.isFinite(Date.parse(since))) {
    throw new Error(`Missing published baseline: ${project.slug}`);
  }
  const covered=new Set(published.flatMap(p=>p.raw.match(/<!-- source-id: ([^ ]+) -->/g)?.map(x=>x.slice(16,-4).trim()) || []));
  const pending=posts.some(p=>p.fm.draft!=='false');
  const between=d=>Date.parse(d)>Date.parse(since)&&Date.parse(d)<=Date.parse(cutoff);
  const events=[...releases.filter(r=>!r.draft&&!r.prerelease&&r.published_at&&between(r.published_at)&&!(legacy[project.slug]||[]).includes(r.tag_name)).map(r=>({id:`${project.repo}:release:${r.id}`,title:r.name||r.tag_name,url:r.html_url,date:r.published_at,kind:'release'})), ...pulls.filter(p=>p.merged_at&&between(p.merged_at)&&relevant(p)).map(p=>({id:`${project.repo}:pr:${p.number}`,title:p.title,url:p.html_url,date:p.merged_at,kind:'merged'}))].filter(e=>!covered.has(e.id)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  return {since, cutoff, events, pending};
}
export function render(project, plan) {
  const fmt=d=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(d));
  const rows=kind=>plan.events.filter(e=>e.kind===kind).map(e=>`- [${e.title.replace(/[\]\r\n[]/g,' ')}](${e.url}) — ${fmt(e.date)}.\n<!-- source-id: ${e.id} -->`).join('\n');
  const title = JSON.stringify("Resumo semanal — " + project.displayName);
  return `---\ntitle: ${title}\ndescription: "Atualizações públicas desde a última edição: releases e mudanças mergeadas para revisão."\npubDate: ${plan.cutoff}\nsourceSince: ${plan.since}\nsourceUntil: ${plan.cutoff}\nproject: "${project.slug}"\ntags: ["open-source", "resumo-semanal"]\ndraft: true\n---\n\nEste resumo reúne registros públicos do [${project.displayName}](https://github.com/${project.repo}) no intervalo **${fmt(plan.since)} (exclusivo) a ${fmt(plan.cutoff)} (inclusivo)**, horário de São Paulo. A primeira coleta após uma pausa recupera o período desde a última edição publicada.\n\n## Releases públicas\n\n${rows('release') || 'Não houve uma nova release pública neste intervalo.'}\n\n## Mudanças mergeadas\n\nAs PRs abaixo foram integradas ao repositório. Isso não confirma disponibilidade em uma versão publicada; confira as notas de release antes de atualizar. Os títulos são registros das PRs, sem promessa adicional de resultado.\n\n${rows('merged') || 'Não foram identificadas mudanças mergeadas relevantes neste intervalo.'}\n\nManutenção rotineira e atualizações automáticas de dependências foram omitidas; correções de segurança permanecem na seleção.\n\nAbraço de Goiânia.\n\n— Nikolas de Hor\n`;
}
export async function run({root=ROOT, api=github, now=new Date(), dry=false, projects=PROJECTS}={}) {
  const report={attemptAt:now.toISOString(), lastSuccessfulCollection:null, status:'collecting', projects:[], errors:[]};
  const plans=[]; const legacy=JSON.parse(readFileSync(join(root,'.github/synced-releases.json'))).covered;
  const activeProjects = projects.filter(p => p.enabled);
  const results = await Promise.allSettled(activeProjects.map(project => collectProject({root, api, now, legacy, project})));
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const item = result.value;
      plans.push(item);
      report.projects.push({project:item.project.slug, ...item.plan});
    } else {
      report.errors.push({project:activeProjects[index].slug, error:result.reason.message});
    }
  });
  // Atomic collection: partial failure must never write content or advance a watermark.
  report.status=report.errors.length?'failed':'success';
  if(!report.errors.length) report.lastSuccessfulCollection=report.attemptAt;
  mkdirSync(join(root,'.sync'),{recursive:true}); writeFileSync(join(root,'.sync/report.json'),JSON.stringify(report,null,2)+'\n');
  if(report.errors.length)throw new Error(`Collection incomplete: ${report.errors.map(x=>x.project+': '+x.error).join('; ')}`);
  return writeDrafts(plans, dry) ? 2 : 0;
}
function writeDrafts(plans, dry) {
  let generated = 0;
  for (const {project, plan, dir} of plans) {
    if (plan.pending) {
      console.log(`Pending draft for ${project.slug}; preserving review content`);
      continue;
    }
    if (!plan.events.length || Date.parse(plan.cutoff)-Date.parse(plan.since)<7*86400000) continue;
    const file = join(dir, `resumo-${plan.cutoff.slice(0,10)}.md`);
    if (dry) { generated++; continue; }
    if (!existsSync(file)) { writeFileSync(file, render(project, plan)); generated++; }
  }
  return generated;
}
async function collectProject({root, api, now, legacy, project}) {
  const repo = await api(`repos/${project.repo}`);
  if (repo.private !== false) throw new Error('Public repository required');
  const [releases, pulls] = await Promise.all([
    pages(`repos/${project.repo}/releases`, api),
    pages(`repos/${project.repo}/pulls?state=closed&sort=updated&direction=desc`, api),
  ]);
  const dir = join(root, 'src/content/posts', project.slug);
  const posts = readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const raw = readFileSync(join(dir, f), 'utf8');
    return {raw, fm:frontmatter(raw)};
  });
  const plan = select({project, releases, pulls, posts, legacy, cutoff:now.toISOString()});
  return {project, plan, dir};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await run({dry:process.env.DRY_RUN === 'true'});
    console.log('GENERATED_SUMMARY=resumo semanal de projetos publicos');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
