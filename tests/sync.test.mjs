import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {select,relevant,render,run,pages,periodLabel} from '../scripts/sync-releases.mjs';
const project={enabled:true,repo:'public/demo',slug:'demo',displayName:'Demo'};
const post={raw:'',fm:{draft:'false',pubDate:'2026-06-22T15:00:00Z'}};
const pr={number:3,title:'fix: security dependency vulnerability',files:['src/demo.py'],merged_at:'2026-07-01T12:00:00Z',html_url:'https://github.com/public/demo/pull/3'};
const args={project,posts:[post],legacy:{},cutoff:'2026-09-30T12:00:00Z',releases:[],pulls:[]};
test('empty, relevant correction and noise',()=>{assert.equal(select(args).events.length,0);assert.equal(relevant(pr),true);assert.equal(relevant({...pr,title:'build(deps): bump x'}),false);assert.equal(relevant({...pr,title:'chore: daily maintenance'}),false);assert.equal(select({...args,pulls:[pr]}).events.length,1);});
test('release, boundaries, IDs and published deduplication',()=>{const p=select({...args,pulls:[pr],releases:[{id:9,name:'v1',published_at:pr.merged_at,html_url:'https://github.com/public/demo/releases/tag/v1'}]});assert.equal(p.events.length,2);assert.equal(select({...args,pulls:[{...pr,merged_at:post.fm.pubDate}]}).events.length,0);const raw=render(project,p);const published={raw,fm:{draft:'false',pubDate:p.cutoff,sourceUntil:p.cutoff}};assert.equal(select({...args,pulls:[pr],posts:[post,published]}).events.length,0);assert.equal(select({...args,pulls:[pr],posts:[{...post,raw:'<!-- source-id: public/demo:pr:3 -->'}]}).events.length,0);assert.match(raw,/draft: true/);assert.match(raw,/não confirma disponibilidade/);});
function fixture(){const root=mkdtempSync(join(tmpdir(),'news-test-'));mkdirSync(join(root,'.github'));writeFileSync(join(root,'.github/synced-releases.json'),' {"covered":{}}');mkdirSync(join(root,'src/content/posts/demo'),{recursive:true});writeFileSync(join(root,'src/content/posts/demo/first.md'),'---\ndraft: false\npubDate: 2026-06-22T15:00:00Z\n---\n');return root;}
const api=async path=>path.includes('/files?')?[{filename:'src/demo.py'}]:path.includes('/pulls?')?[pr]:path.includes('/releases?')?[]:{private:false};
test('safe integration, idempotence, pending and no state advance',async()=>{const root=fixture();assert.equal(await run({root,api,projects:[project]}),2);assert.equal(await run({root,api,projects:[project]}),0);assert.equal(readdirSync(join(root,'src/content/posts/demo')).length,2);assert.deepEqual(JSON.parse(readFileSync(join(root,'.github/synced-releases.json'))),{covered:{}});});
test('API failure, partial and private sources fail without content',async()=>{for(const fail of [async()=>{throw new Error('503');},async()=>({private:true}),async path=>path.includes('/pulls?')?Promise.reject(new Error('429')):api(path)]){const root=fixture();await assert.rejects(run({root,api:fail,projects:[project]}));assert.equal(readdirSync(join(root,'src/content/posts/demo')).length,1);assert.equal(JSON.parse(readFileSync(join(root,'.sync/report.json'))).lastSuccessfulCollection,null);}});
test('pagination rejects invalid response',async()=>{await assert.rejects(pages('x',async()=>({})));});
test('no sending capabilities; workflows draft and pending protection',()=>{const script=readFileSync(new URL('../scripts/sync-releases.mjs',import.meta.url),'utf8');assert.doesNotMatch(script,/resend\.com|send-newsletter|RESEND_API/);const workflow=readFileSync(new URL('../.github/workflows/sync-releases.yml',import.meta.url),'utf8');assert.match(workflow,/draft: true/);assert.match(workflow,/steps.pending.outputs.count/);assert.doesNotMatch(workflow,/RESEND|send-newsletter/);});
test('dry-run creates report only and short windows do not generate',async()=>{const root=fixture();assert.equal(await run({root,api,projects:[project],dry:true}),2);assert.equal(readdirSync(join(root,'src/content/posts/demo')).length,1);assert.equal(await run({root,api,projects:[project],now:new Date('2026-06-23T12:00:00Z')}),0);});
test('draft does not advance cutoff; rejected draft stays eligible',()=>{const draft={raw:'<!-- source-id: public/demo:pr:3 -->',fm:{draft:'true',sourceUntil:args.cutoff,pubDate:args.cutoff}};const plan=select({...args,pulls:[pr],posts:[post,draft]});assert.equal(plan.since,post.fm.pubDate);assert.equal(plan.pending,true);assert.equal(plan.events.length,1);assert.equal(select({...args,pulls:[pr],posts:[post]}).events.length,1);});
test('prerelease, draft release, unmerged and after cutoff omitted',()=>{assert.equal(select({...args,pulls:[{...pr,merged_at:null},{...pr,merged_at:'2026-10-01T00:00:00Z'}],releases:[{id:1,draft:true,published_at:pr.merged_at},{id:2,prerelease:true,published_at:pr.merged_at}]}).events.length,0);});
test('build guard distinguishes published content from exposed draft', async()=>{
  const {spawnSync}=await import('node:child_process');
  const root=fixture();
  const output=join(root,'dist/demo/first');mkdirSync(output,{recursive:true});writeFileSync(join(output,'index.html'),'published');
  const checker=new URL('../scripts/check-draft-build.mjs',import.meta.url).pathname;
  assert.equal(spawnSync(process.execPath,[checker],{cwd:root}).status,0);
  writeFileSync(join(root,'src/content/posts/demo/first.md'),'---\ndraft: true\n---\n');
  assert.equal(spawnSync(process.execPath,[checker],{cwd:root}).status,1);
});
test('strict relevance rejects generic, docs-only, routine deps and bots',()=>{
  for(const title of ['Atualiza README','Melhora documentação','docs: security notes','chore: daily maintenance','fix: README typo','fix(ci): pipeline','fix: bug']) {
    const files=title==='fix: bug'?['docs/readme.md','tests/test_demo.py']:['src/demo.py'];
    assert.equal(relevant({...pr,title,files}),false,title);
  }
  assert.equal(relevant({...pr,title:'feat: new provider',files:['src/provider.py']}),true);
  assert.equal(relevant({...pr,title:'fix: vulnerability dependency',files:['pyproject.toml']}),true);
  assert.equal(relevant({...pr,title:'fix(deps): update package',files:['package.json']}),false);
  assert.equal(relevant({...pr,title:'feat: new provider',user:{login:'dependabot[bot]'}}),false);
  assert.equal(relevant({...pr,title:'Atualiza README',labels:[{name:'news:include'}]}),true);
  assert.equal(relevant({...pr,labels:[{name:'news:include'},{name:'news:exclude'}]}),false);
  assert.equal(relevant({...pr,files:[]}),false);
});
test('title describes actual interval and prerelease does not mean stable release',()=>{
  assert.match(periodLabel({...project,displayName:'Demo'},{since:'2026-06-22T15:00:00Z',cutoff:'2026-09-30T16:36:00Z'}),/^Retrospectiva de 22\/06\/2026 a 30\/09\/2026/);
  assert.match(periodLabel({...project,displayName:'Demo'},{since:'2026-09-23T15:00:00Z',cutoff:'2026-09-30T15:00:00Z'}),/^Atualizações de/);
  const plan=select({...args,releases:[{id:7,tag_name:'v2-rc',prerelease:true,published_at:pr.merged_at}]});
  assert.equal(plan.events.length,0);assert.equal(plan.excludedPrereleases,1);
  const duplicate=select({...args,pulls:[pr,pr]});assert.equal(duplicate.events.length,1);
});
test('zero events after weekly interval never create post or advance sent state',async()=>{
  const root=fixture();const before=readdirSync(join(root,'src/content/posts/demo'));
  const noNews=async path=>path.includes('?')?[]:{private:false};
  assert.equal(await run({root,api:noNews,projects:[project],now:new Date('2026-10-15T12:00:00Z')}),0);
  assert.deepEqual(readdirSync(join(root,'src/content/posts/demo')),before);
  assert.deepEqual(JSON.parse(readFileSync(join(root,'.github/synced-releases.json'))),{covered:{}});
});

test('weekly cron may include a new correction less than seven days after last edition',async()=>{
  const root=fixture();
  const recent={...pr,merged_at:'2026-06-23T12:00:00Z'};
  const apiRecent=async path=>path.includes('/files?')?[{filename:'src/demo.py'}]:path.includes('/pulls?')?[recent]:path.includes('/releases?')?[]:{private:false};
  assert.equal(await run({root,api:apiRecent,projects:[project],now:new Date('2026-06-24T12:00:00Z')}),2);
});
