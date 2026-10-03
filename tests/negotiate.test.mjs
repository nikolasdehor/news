import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preferredType} from '../functions/_shared/negotiate.js';
import {negotiateNotFound} from '../functions/_shared/not-found.js';

const ROOT = ['text/html', 'text/markdown'];
const browser = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const kind = (accept) => {const r = negotiateNotFound(accept); return r ? r.contentType.split(';')[0] : 'html';};

test('raiz: markdown só quando o cliente o prefere sobre HTML', () => {
  assert.equal(preferredType('text/markdown', ROOT), 'text/markdown');
  assert.equal(preferredType('text/markdown;q=0.9', ROOT), 'text/markdown');
  assert.equal(preferredType('text/markdown, text/html;q=0.5', ROOT), 'text/markdown');
  assert.equal(preferredType('text/html, text/markdown;q=0.5', ROOT), 'text/html');
  assert.equal(preferredType('text/markdown;q=0, text/html', ROOT), 'text/html');
  assert.equal(preferredType('text/markdown;q=0', ROOT), null);
  assert.equal(preferredType(browser, ROOT), 'text/html');
  assert.equal(preferredType('*/*', ROOT), 'text/html');
  assert.equal(preferredType('', ROOT), 'text/html');
  assert.equal(preferredType('text/*, text/markdown;q=0.2', ROOT), 'text/html');
});

test('parâmetros e caixa não atrapalham; q inválido descarta a faixa', () => {
  assert.equal(preferredType('TEXT/Markdown; charset=utf-8; q=0.7, text/html;q=0.6', ROOT), 'text/markdown');
  assert.equal(preferredType('text/markdown;q=abc, text/html;q=0.1', ROOT), 'text/html');
  assert.equal(preferredType('lixo, text/markdown', ROOT), 'text/markdown');
});

test('404: q=0 exclui e vence o maior q entre markdown, JSON e HTML', () => {
  assert.equal(kind('application/json'), 'application/problem+json');
  assert.equal(kind('application/problem+json'), 'application/problem+json');
  assert.equal(kind('application/json;q=0, text/html'), 'html');
  assert.equal(kind('application/json;q=0.4, text/markdown;q=0.8'), 'text/markdown');
  assert.equal(kind('text/markdown;q=0.3, application/json;q=0.9'), 'application/problem+json');
  assert.equal(kind(browser), 'html');
  assert.equal(kind('*/*'), 'text/markdown');
  assert.equal(kind(''), 'text/markdown');
  assert.equal(kind('image/png'), 'text/markdown');
});
