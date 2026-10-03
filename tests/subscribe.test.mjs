import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedOrigin, pickProjects, subscribe} from '../functions/_shared/subscribe.js';

function fakeFetch(status = 201) {
  const calls = [];
  const impl = async (url) => {calls.push(url); return new Response('{}', {status});};
  return {calls, impl};
}

test('projetos repetidos chamam o Resend no máximo uma vez por projeto existente', async () => {
  const {calls, impl} = fakeFetch();
  const projects = [...Array(5000).fill('mcp-fiscal-brasil'), 'mcp-juridico-brasil', 'x', 7, null, 'mcp-juridico-brasil'];
  const result = await subscribe({email: 'a@b.com', projects}, 'key', impl);
  assert.deepEqual(result, {status: 200, body: {ok: true}});
  assert.equal(calls.length, 2);
  assert.equal(new Set(calls).size, 2);
});

test('pickProjects deduplica, ignora inválidos e herança do protótipo', () => {
  assert.deepEqual(pickProjects(['mcp-fiscal-brasil', 'mcp-fiscal-brasil', 'toString', '__proto__', 1]), ['mcp-fiscal-brasil']);
});

test('validações retornam 422 sem chamar o Resend', async () => {
  const {calls, impl} = fakeFetch();
  assert.equal((await subscribe({email: 'x', projects: ['mcp-fiscal-brasil']}, 'k', impl)).status, 422);
  assert.equal((await subscribe({email: 'a@b.com', projects: []}, 'k', impl)).status, 422);
  assert.equal((await subscribe({email: 'a@b.com', projects: ['nope']}, 'k', impl)).status, 422);
  assert.equal((await subscribe(null, 'k', impl)).status, 422);
  assert.equal(calls.length, 0);
});

test('honeypot responde 200 e sem chave responde 500, ambos sem chamar o Resend', async () => {
  const {calls, impl} = fakeFetch();
  assert.equal((await subscribe({website: 'bot', email: 'a@b.com', projects: ['mcp-fiscal-brasil']}, 'k', impl)).status, 200);
  assert.equal((await subscribe({email: 'a@b.com', projects: ['mcp-fiscal-brasil']}, undefined, impl)).status, 500);
  assert.equal(calls.length, 0);
});

test('409 do Resend conta como sucesso; outro erro vira 500', async () => {
  assert.equal((await subscribe({email: 'a@b.com', projects: ['mcp-fiscal-brasil']}, 'k', fakeFetch(409).impl)).status, 200);
  assert.equal((await subscribe({email: 'a@b.com', projects: ['mcp-fiscal-brasil']}, 'k', fakeFetch(500).impl)).status, 500);
});

test('origem: same-origin e lista liberam, outra origem bloqueia', () => {
  assert.equal(isAllowedOrigin('https://news.dehor.com.br', 'x.pages.dev', ['https://news.dehor.com.br']), true);
  assert.equal(isAllowedOrigin('https://a.dev', 'a.dev', []), true);
  assert.equal(isAllowedOrigin(null, 'a.dev', []), true);
  assert.equal(isAllowedOrigin('https://evil.com', 'a.dev', ['https://news.dehor.com.br']), false);
});
