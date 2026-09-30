import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const repository=new URL('..',import.meta.url).pathname;
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'news-no-resend-'));
  mkdirSync(join(root,'scripts'));mkdirSync(join(root,'.github'));
  copyFileSync(join(repository,'scripts/send-newsletter.mjs'),join(root,'scripts/send-newsletter.mjs'));
  copyFileSync(join(repository,'.github/sent-broadcasts.json'),join(root,'.github/sent-broadcasts.json'));
  for(const project of ['mcp-fiscal-brasil','mcp-juridico-brasil']){
    const dir=join(root,'src/content/posts',project);mkdirSync(dir,{recursive:true});
    for(const file of ['edicao-1.md','resumo-2026-09-30.md'])copyFileSync(join(repository,'src/content/posts',project,file),join(dir,file));
  }
  writeFileSync(join(root,'block-fetch.mjs'),"globalThis.fetch=async()=>{throw new Error('NETWORK_CALL_BLOCKED');};\n");
  return root;
}
function invoke(root){return spawnSync(process.execPath,['--import',join(root,'block-fetch.mjs'),join(root,'scripts/send-newsletter.mjs')],{encoding:'utf8',env:{...process.env,DRY_RUN:'false',RESEND_DEHOR_API_KEY:'fixture-no-real-secret',RESEND_API_KEY:''}});}
test('real newsletter script selects zero broadcasts for corrected already-sent posts',()=>{
  const root=fixture();const before=readFileSync(join(root,'.github/sent-broadcasts.json'),'utf8');
  const result=invoke(root);assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Posts publicados encontrados: 4/);assert.match(result.stdout,/Nenhum post novo para enviar/);
  assert.equal((result.stdout.match(/\[skip\]/g)||[]).length,4);
  assert.doesNotMatch(result.stdout+result.stderr,/NETWORK_CALL_BLOCKED|\[novo\]|Broadcast criado/);
  assert.equal(readFileSync(join(root,'.github/sent-broadcasts.json'),'utf8'),before);
});
test('invalid sent state fails closed, never calls fetch or resets state',()=>{
  for(const state of ['invalid-json','{}','{"sent":[null]}']){
    const root=fixture();const path=join(root,'.github/sent-broadcasts.json');writeFileSync(path,state);
    const result=invoke(root);assert.equal(result.status,1);assert.match(result.stderr,/Estado sent/);
    assert.doesNotMatch(result.stdout+result.stderr,/NETWORK_CALL_BLOCKED|Broadcast criado/);
    assert.equal(readFileSync(path,'utf8'),state);
  }
});
