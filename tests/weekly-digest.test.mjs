import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isoWeek, scanSecrets, semTravessao, parseReview, sourcesFor, writerPrompt} from '../scripts/weekly-digest.mjs';

test('ISO week of the Sunday before a Monday run', () => {
  assert.deepEqual(isoWeek(new Date('2026-10-11T12:00:00Z')), {year: 2026, week: '41'});
  assert.deepEqual(isoWeek(new Date('2027-01-03T12:00:00Z')), {year: 2026, week: '53'});
  assert.deepEqual(isoWeek(new Date('2026-01-01T12:00:00Z')), {year: 2026, week: '01'});
});

test('secret scan flags tokens, PII and private repo names', () => {
  assert.deepEqual(scanSecrets('Semana tranquila, melhorias de estabilidade.', ['Org/privado']), []);
  for (const bad of ['sk-abcdefgh12345', 'ghp_abcdefghijklmnop', 'eyJhbGciOiJIUzI1NiJ9', '10.0.0.12', 'a@b.com', '123.456.789-09', '+55 62 99999-1234']) {
    assert.ok(scanSecrets(`texto ${bad} aqui`).length > 0, bad);
  }
  assert.match(scanSecrets('ver org/PRIVADO', ['Org/privado'])[0], /privado/);
});

test('dashes become comma or hyphen', () => {
  const d = String.fromCharCode(0x2014), n = String.fromCharCode(0x2013);
  assert.equal(semTravessao(`a ${d} b e 2020${n}2021`), 'a, b e 2020-2021');
});

test('review parsing fails closed', () => {
  assert.deepEqual(parseReview('```json\n{"ok": true, "problemas": []}\n```'), {ok: true, problemas: []});
  assert.equal(parseReview('sem json').ok, false);
  assert.equal(parseReview('{"ok": "true"}').ok, false);
  assert.equal(parseReview('{ok: true}').ok, false);
});

test('private items take repos only from the local map and prompt hides their links', () => {
  const cat = [{slug: 'pub', nome: 'Pub', visibilidade: 'publico', repo: 'o/pub'}, {slug: 'priv', nome: 'Priv', visibilidade: 'privado'}];
  const src = sourcesFor(cat, {priv: ['o/priv']});
  assert.deepEqual(src.map(s => s.repos), [['o/pub'], ['o/priv']]);
  assert.deepEqual(sourcesFor(cat, {})[1].repos, []);
  const prompt = writerPrompt([{...src[1], commits: ['fix x'], prs: [{number: 1, title: 'feat y', url: 'https://github.com/o/priv/pull/1'}]}], 'p');
  assert.doesNotMatch(prompt, /github\.com\/o\/priv/);
});
