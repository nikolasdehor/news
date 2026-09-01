import assert from 'node:assert/strict';
import test from 'node:test';
import { CONSENT_VERSION, PROJECT_DELIVERY, createConfirmationToken, fetchResend,
  newsletterPublicBaseUrl, readConfirmationToken, syncContactPreferences,
  type ConfirmationPayload,
} from './newsletter-confirmation.ts';

const testKeyMaterial = ['segredo-de-teste', 'com-entropia-suficiente'].join('-');

function validPayload(expiresAt = Date.now() + 60_000): ConfirmationPayload {
  return { email: 'pessoa@example.com', projects: ['mcp-fiscal-brasil'],
    consentVersion: CONSENT_VERSION, nonce: 'A'.repeat(43), expiresAt };
}

test('recupera payload válido sem expor o e-mail no token', () => {
  const payload = validPayload();
  const confirmation = createConfirmationToken(payload, testKeyMaterial);
  assert.equal(confirmation.includes('pessoa'), false);
  assert.deepEqual(readConfirmationToken(confirmation, testKeyMaterial), payload);
});

test('rejeita adulteração e segredo incorreto', () => {
  const confirmation = createConfirmationToken(validPayload(), testKeyMaterial);
  assert.equal(readConfirmationToken(`${confirmation}x`, testKeyMaterial), null);
  assert.equal(readConfirmationToken(confirmation, 'outro-segredo'), null);
});

test('rejeita token expirado e projeto desconhecido', () => {
  const expired = createConfirmationToken(validPayload(Date.now() - 1), testKeyMaterial);
  const unknown = createConfirmationToken(
    { ...validPayload(), projects: ['projeto-inexistente'] },
    testKeyMaterial,
  );
  assert.equal(readConfirmationToken(expired, testKeyMaterial), null);
  assert.equal(readConfirmationToken(unknown, testKeyMaterial), null);
});

test('rejeita payload misto e propriedades herdadas', () => {
  for (const projects of [['mcp-fiscal-brasil', 'projeto-inexistente'], ['constructor']]) {
    const confirmation = createConfirmationToken({ ...validPayload(), projects }, testKeyMaterial);
    assert.equal(readConfirmationToken(confirmation, testKeyMaterial), null);
  }
});

test('contato globalmente removido reativa somente os projetos confirmados', async (t) => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (
    url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
  ) => {
    requests.push({ url: String(url), init });
    const target = String(url);
    if (requests.length === 1) {
      return new Response(JSON.stringify({ unsubscribed: true }), { status: 200 });
    }
    if (init?.method === 'GET' && target.endsWith('/topics')) {
      return new Response(JSON.stringify({
        object: 'list', has_more: false, data: [
          { id: PROJECT_DELIVERY['mcp-fiscal-brasil'].topicId },
          { id: 'topico-externo' },
        ],
      }), { status: 200 });
    }
    if (init?.method === 'GET' && target.endsWith('/segments')) {
      return new Response(JSON.stringify({
        object: 'list', has_more: false, data: [
          { id: PROJECT_DELIVERY['mcp-fiscal-brasil'].segmentId },
          { id: 'segmento-externo' },
        ],
      }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  await syncContactPreferences(
    'pessoa@example.com', ['mcp-fiscal-brasil'], 'api-key',
  );
  const topicUpdate = requests.find(({ url, init }) =>
    url.endsWith('/topics') && init?.method === 'PATCH');
  assert.equal(topicUpdate?.init?.body, JSON.stringify([
    { id: PROJECT_DELIVERY['mcp-fiscal-brasil'].topicId, subscription: 'opt_in' },
    { id: 'topico-externo', subscription: 'opt_out' },
  ]));
  const omittedSegmentRequest = requests.find(({ url }) =>
    url.includes('segmento-externo'));
  assert.equal(omittedSegmentRequest?.init?.method, 'DELETE');
  assert.equal(requests.at(-1)?.url, 'https://api.resend.com/contacts/pessoa%40example.com');
  assert.equal(requests.at(-1)?.init?.body, JSON.stringify({ unsubscribed: false }));
});

test('contato removido não reativa com inventário incompleto', async (t) => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (
    url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
  ) => {
    requests.push({ url: String(url), init });
    if (requests.length === 1) {
      return new Response(JSON.stringify({ unsubscribed: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ object: 'list', has_more: true, data: [] }), {
      status: 200,
    });
  });
  await assert.rejects(
    syncContactPreferences('pessoa@example.com', ['mcp-fiscal-brasil'], 'api-key'),
    /incomplete contact/,
  );
  assert.equal(requests.some(({ init }) =>
    init?.body === JSON.stringify({ unsubscribed: false })), false);
});

test('contato ativo mantém sincronização aditiva', async (t) => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (
    url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
  ) => {
    requests.push({ url: String(url), init });
    return new Response(
      requests.length === 1 ? JSON.stringify({ unsubscribed: false }) : '{}',
      { status: 200 },
    );
  });
  await syncContactPreferences(
    'pessoa@example.com', ['mcp-fiscal-brasil'], 'api-key',
  );
  assert.equal(requests[1]?.init?.body, JSON.stringify([
    { id: PROJECT_DELIVERY['mcp-fiscal-brasil'].topicId, subscription: 'opt_in' },
  ]));
  assert.equal(requests.some(({ init }) => init?.method === 'DELETE'), false);
  assert.equal(requests.some(({ init }) => init?.body === JSON.stringify({ unsubscribed: false })), false);
});

test('contato ausente é criado uma única vez com as preferências escolhidas', async (t) => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (
    url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
  ) => {
    requests.push({ url: String(url), init });
    return requests.length === 1
      ? new Response('{}', { status: 404 })
      : new Response('{}', { status: 200 });
  });
  await syncContactPreferences(
    'pessoa@example.com', ['mcp-fiscal-brasil'], 'api-key',
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[1]?.url, 'https://api.resend.com/contacts');
  assert.match(String(requests[1]?.init?.body), /"unsubscribed":false/);
});

test('falha de tópico não reativa contato', async (t) => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (
    url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
  ) => {
    const target = String(url);
    requests.push({ url: target, init });
    if (requests.length === 1) {
      return new Response(JSON.stringify({ unsubscribed: true }), { status: 200 });
    }
    if (init?.method === 'GET' && (target.endsWith('/topics') || target.endsWith('/segments'))) {
      return new Response(JSON.stringify({ object: 'list', has_more: false, data: [] }), {
        status: 200,
      });
    }
    return new Response('{}', { status: 500 });
  });
  await assert.rejects(
    syncContactPreferences(
      'pessoa@example.com', ['mcp-fiscal-brasil'], 'api-key',
    ),
    /topic update failed/,
  );
  assert.equal(requests.some(({ init }) => init?.body === JSON.stringify({ unsubscribed: false })), false);
});

test('retry após falha de segmento converge e reativa somente no sucesso', async (t) => {
  let attempt = 0;
  const requests: Array<{ url: string; init?: RequestInit; attempt: number }> = [];
  t.mock.method(globalThis, 'fetch', async (
    url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
  ) => {
    const target = String(url);
    requests.push({ url: target, init, attempt });
    if (init?.method === 'GET') {
      if (target.endsWith('/topics') || target.endsWith('/segments')) {
        return new Response(JSON.stringify({ object: 'list', has_more: false, data: [] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ unsubscribed: true }), { status: 200 });
    }
    if (target.includes('/segments/') && attempt === 0) {
      return new Response('{}', { status: 500 });
    }
    return new Response('{}', { status: 200 });
  });
  await assert.rejects(
    syncContactPreferences(
      'pessoa@example.com', ['mcp-fiscal-brasil'], 'api-key',
    ),
    /segment update failed/,
  );
  assert.equal(requests.some(({ init, attempt: requestAttempt }) =>
    requestAttempt === 0 && init?.body === JSON.stringify({ unsubscribed: false })), false);
  attempt = 1;
  await syncContactPreferences(
    'pessoa@example.com', ['mcp-fiscal-brasil'], 'api-key',
  );
  assert.equal(requests.at(-1)?.init?.body, JSON.stringify({ unsubscribed: false }));
});

test('corrida de criação converge para sincronização do contato existente', async (t) => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (
    url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
  ) => {
    requests.push({ url: String(url), init });
    if (requests.length === 1) return new Response('{}', { status: 404 });
    if (requests.length === 2) return new Response('{}', { status: 409 });
    if (requests.length === 3) {
      return new Response(JSON.stringify({ unsubscribed: false }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  await syncContactPreferences('pessoa@example.com', ['mcp-fiscal-brasil'], 'api-key');
  assert.equal(requests[2]?.init?.method, 'GET');
  assert.equal(requests.some(({ url }) => url.includes('/segments/')), true);
});

test('origem pública acompanha preview e exige configuração local explícita', () => {
  assert.equal(newsletterPublicBaseUrl({
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'news-git-ajuste.vercel.app',
  }).origin, 'https://news-git-ajuste.vercel.app');
  assert.equal(newsletterPublicBaseUrl({
    VERCEL_ENV: 'development',
    NEWSLETTER_PUBLIC_URL: 'http://localhost:3000',
  }).origin, 'http://localhost:3000');
  assert.throws(() => newsletterPublicBaseUrl({ VERCEL_ENV: 'development' }));
});

test('não envia credencial para host externo', async () => {
  await assert.rejects(
    fetchResend('https://example.com/contacts', 'api-key', { method: 'POST', body: '{}' }),
    /invalid Resend endpoint/,
  );
});
