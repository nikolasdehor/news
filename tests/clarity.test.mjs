import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CLARITY_PROJECT_ID, initClarity} from '../src/lib/clarity.js';

function fakeEnv(hostname) {
  const appended = [];
  const win = {location: {hostname}};
  const doc = {
    createElement: () => ({}),
    head: {appendChild: (el) => appended.push(el)},
  };
  return {win, doc, appended};
}

test('não carrega fora do domínio de produção', () => {
  for (const host of ['localhost', '127.0.0.1', 'news-git-feat-x.vercel.app', 'evil.com', 'news.dehor.com.br.evil.com']) {
    const {win, doc, appended} = fakeEnv(host);
    assert.equal(initClarity(win, doc), false, host);
    assert.equal(appended.length, 0, host);
    assert.equal(win.clarity, undefined, host);
  }
});

test('carrega no domínio de produção e no www', () => {
  for (const host of ['news.dehor.com.br', 'www.news.dehor.com.br']) {
    const {win, doc, appended} = fakeEnv(host);
    assert.equal(initClarity(win, doc), true, host);
    assert.equal(appended.length, 1);
    assert.equal(appended[0].src, `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`);
    assert.equal(appended[0].async, true);
  }
});

test('consent negado por padrão e enfileirado antes do tag', () => {
  const {win, doc} = fakeEnv('news.dehor.com.br');
  initClarity(win, doc);
  assert.equal(win.clarity.q.length, 1);
  assert.deepEqual([...win.clarity.q[0]], ['consentv2', {ad_Storage: 'denied', analytics_Storage: 'denied'}]);
});

test('segunda chamada não injeta o tag de novo', () => {
  const {win, doc, appended} = fakeEnv('news.dehor.com.br');
  initClarity(win, doc);
  assert.equal(initClarity(win, doc), false);
  assert.equal(appended.length, 1);
});
