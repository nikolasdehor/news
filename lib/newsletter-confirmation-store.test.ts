import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import {
  claimContactSync,
  claimConfirmationNonce,
  completeConfirmationNonce,
  discardConfirmationNonce,
  releaseConfirmationNonce,
  releaseContactSync,
  renewContactSync,
  renewConfirmationNonce,
  saveConfirmationNonce,
} from './newsletter-confirmation-store.ts';

test('claim possui exclusão mútua, retry e conclusão idempotente', {
  skip: process.env.DATABASE_URL ? false : 'DATABASE_URL não configurada',
}, async () => {
  const nonce = randomBytes(32).toString('base64url');
  await saveConfirmationNonce(nonce, Date.now() + 60_000);
  try {
    const claims = await Promise.all([
      claimConfirmationNonce(nonce),
      claimConfirmationNonce(nonce),
    ]);
    const claimed = claims.find((claim) => claim.status === 'claimed');
    assert.equal(claims.filter((claim) => claim.status === 'claimed').length, 1);
    assert.equal(claims.filter((claim) => claim.status === 'processing').length, 1);
    assert.ok(claimed?.status === 'claimed');
    await renewConfirmationNonce(nonce, claimed.attemptId);
    await releaseConfirmationNonce(nonce, claimed.attemptId);

    const retry = await claimConfirmationNonce(nonce);
    assert.equal(retry.status, 'claimed');
    assert.ok(retry.status === 'claimed');
    await assert.rejects(
      renewConfirmationNonce(nonce, claimed.attemptId),
      /confirmation claim was lost/,
    );
    await renewConfirmationNonce(nonce, retry.attemptId);
    await completeConfirmationNonce(nonce, retry.attemptId);
    assert.deepEqual(await claimConfirmationNonce(nonce), { status: 'completed' });
  } finally {
    await discardConfirmationNonce(nonce);
  }
});

test('lock por contato serializa confirmações disjuntas do mesmo e-mail', {
  skip: process.env.DATABASE_URL ? false : 'DATABASE_URL não configurada',
}, async () => {
  const email = `concorrencia-${randomBytes(8).toString('hex')}@example.com`;
  const secret = randomBytes(32).toString('hex');
  const [first, second] = await Promise.all([
    claimContactSync(email, secret),
    claimContactSync(email, secret),
  ]);
  const claimed = first ?? second;
  assert.ok(claimed);
  assert.equal([first, second].filter(Boolean).length, 1);
  await releaseContactSync(email, secret, claimed.attemptId);
  const retry = await claimContactSync(email, secret);
  assert.ok(retry);
  await assert.rejects(
    renewContactSync(email, secret, claimed.attemptId),
    /contact sync claim was lost/,
  );
  await renewContactSync(email, secret, retry.attemptId);
  await releaseContactSync(email, secret, retry.attemptId);
});

test('limpeza preserva claim expirado com lease ativa', {
  skip: process.env.DATABASE_URL ? false : 'DATABASE_URL não configurada',
}, async () => {
  const claimedNonce = randomBytes(32).toString('base64url');
  const cleanupNonce = randomBytes(32).toString('base64url');
  await saveConfirmationNonce(claimedNonce, Date.now() + 5_000);
  try {
    const claim = await claimConfirmationNonce(claimedNonce);
    assert.ok(claim.status === 'claimed');
    await new Promise((resolve) => setTimeout(resolve, 5_100));
    await saveConfirmationNonce(cleanupNonce, Date.now() + 60_000);
    await completeConfirmationNonce(claimedNonce, claim.attemptId);
    assert.deepEqual(await claimConfirmationNonce(claimedNonce), { status: 'unavailable' });
  } finally {
    await discardConfirmationNonce(claimedNonce);
    await discardConfirmationNonce(cleanupNonce);
  }
});
