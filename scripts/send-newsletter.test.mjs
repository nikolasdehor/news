import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DRY_RUN = 'true';
const { buildBroadcastPayload, buildEmailHtml } = await import('./send-newsletter.mjs');

test('broadcast vincula segmento e topico de preferencia', () => {
  assert.deepEqual(
    buildBroadcastPayload({
      segmentId: 'segment-1',
      topicId: 'topic-1',
      subject: 'Edicao nova',
      htmlContent: '<p>Conteudo</p>',
    }),
    {
      segment_id: 'segment-1',
      topic_id: 'topic-1',
      from: 'newsletter@dehor.com.br',
      subject: 'Edicao nova',
      html: '<p>Conteudo</p>',
    },
  );
});

test('broadcast usa o link de descadastro individual do Resend', () => {
  const html = buildEmailHtml({
    title: 'Edição nova',
    description: 'Resumo',
    project: 'mcp-fiscal-brasil',
    slug: 'edicao-2',
    bodyHtml: '<p>Conteúdo</p>',
  });

  assert.match(html, /href="\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}"/);
  assert.doesNotMatch(html, /news\.dehor\.com\.br\/unsubscribe/);
});
