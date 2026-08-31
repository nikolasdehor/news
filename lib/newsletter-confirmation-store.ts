import { createHash, createHmac, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export type ConfirmationClaim =
  | { status: 'claimed'; attemptId: string }
  | { status: 'completed' }
  | { status: 'processing' }
  | { status: 'unavailable' };

export type ContactSyncClaim = { attemptId: string };

function client() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('confirmation store is not configured');
  return neon(databaseUrl);
}

function nonceHash(nonce: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(nonce)) throw new Error('invalid nonce');
  return createHash('sha256').update(nonce, 'utf8').digest('hex');
}

export async function saveConfirmationNonce(
  nonce: string,
  expiresAt: number,
): Promise<void> {
  const sql = client();
  const hash = nonceHash(nonce);
  await sql`
    DELETE FROM newsletter_confirmation_nonces
    WHERE expires_at <= NOW()
      AND (state <> 'processing' OR lease_until <= NOW())
  `;
  await sql`
    INSERT INTO newsletter_confirmation_nonces (nonce_hash, expires_at)
    VALUES (${hash}, ${new Date(expiresAt)})
  `;
}

export async function claimConfirmationNonce(
  nonce: string,
): Promise<ConfirmationClaim> {
  const sql = client();
  const hash = nonceHash(nonce);
  const attemptId = randomUUID();
  const rows = await sql`
    UPDATE newsletter_confirmation_nonces
    SET state = 'processing', attempt_id = ${attemptId},
        lease_until = NOW() + INTERVAL '2 minutes'
    WHERE nonce_hash = ${hash}
      AND expires_at > NOW()
      AND (
        state = 'pending'
        OR (state = 'processing' AND lease_until <= NOW())
      )
    RETURNING attempt_id
  `;
  if (rows.length === 1) return { status: 'claimed', attemptId };
  const current = await sql`
    SELECT state FROM newsletter_confirmation_nonces
    WHERE nonce_hash = ${hash} AND expires_at > NOW()
  `;
  if (current[0]?.state === 'completed') return { status: 'completed' };
  if (current[0]?.state === 'processing' || current[0]?.state === 'pending') {
    return { status: 'processing' };
  }
  return { status: 'unavailable' };
}

function contactHash(email: string, secret: string): string {
  if (secret.length < 32) throw new Error('invalid contact lock secret');
  return createHmac('sha256', secret)
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex');
}

export async function claimContactSync(
  email: string,
  secret: string,
): Promise<ContactSyncClaim | null> {
  const sql = client();
  const hash = contactHash(email, secret);
  const attemptId = randomUUID();
  await sql`
    DELETE FROM newsletter_confirmation_contact_locks
    WHERE lease_until <= NOW()
  `;
  const rows = await sql`
    INSERT INTO newsletter_confirmation_contact_locks (
      contact_hash, attempt_id, lease_until
    ) VALUES (
      ${hash}, ${attemptId}, NOW() + INTERVAL '5 minutes'
    )
    ON CONFLICT (contact_hash) DO UPDATE
    SET attempt_id = EXCLUDED.attempt_id,
        lease_until = EXCLUDED.lease_until
    WHERE newsletter_confirmation_contact_locks.lease_until <= NOW()
    RETURNING attempt_id
  `;
  return rows.length === 1 ? { attemptId } : null;
}

export async function releaseContactSync(
  email: string,
  secret: string,
  attemptId: string,
): Promise<void> {
  const sql = client();
  const hash = contactHash(email, secret);
  await sql`
    DELETE FROM newsletter_confirmation_contact_locks
    WHERE contact_hash = ${hash} AND attempt_id = ${attemptId}
  `;
}

export async function renewContactSync(
  email: string,
  secret: string,
  attemptId: string,
): Promise<void> {
  const sql = client();
  const hash = contactHash(email, secret);
  const rows = await sql`
    UPDATE newsletter_confirmation_contact_locks
    SET lease_until = NOW() + INTERVAL '5 minutes'
    WHERE contact_hash = ${hash}
      AND attempt_id = ${attemptId}
      AND lease_until > NOW()
    RETURNING contact_hash
  `;
  if (rows.length !== 1) throw new Error('contact sync claim was lost');
}

export async function completeConfirmationNonce(
  nonce: string,
  attemptId: string,
): Promise<void> {
  const sql = client();
  const hash = nonceHash(nonce);
  const rows = await sql`
    UPDATE newsletter_confirmation_nonces
    SET state = 'completed', completed_at = NOW(),
        attempt_id = NULL, lease_until = NULL
    WHERE nonce_hash = ${hash}
      AND state = 'processing'
      AND attempt_id = ${attemptId}
    RETURNING nonce_hash
  `;
  if (rows.length !== 1) throw new Error('confirmation claim was lost');
}

export async function renewConfirmationNonce(
  nonce: string,
  attemptId: string,
): Promise<void> {
  const sql = client();
  const hash = nonceHash(nonce);
  const rows = await sql`
    UPDATE newsletter_confirmation_nonces
    SET lease_until = NOW() + INTERVAL '2 minutes'
    WHERE nonce_hash = ${hash}
      AND state = 'processing'
      AND attempt_id = ${attemptId}
      AND lease_until > NOW()
    RETURNING nonce_hash
  `;
  if (rows.length !== 1) throw new Error('confirmation claim was lost');
}

export async function releaseConfirmationNonce(
  nonce: string,
  attemptId: string,
): Promise<void> {
  const sql = client();
  const hash = nonceHash(nonce);
  await sql`
    UPDATE newsletter_confirmation_nonces
    SET state = 'pending', attempt_id = NULL, lease_until = NULL
    WHERE nonce_hash = ${hash}
      AND state = 'processing'
      AND attempt_id = ${attemptId}
  `;
}

export async function discardConfirmationNonce(nonce: string): Promise<void> {
  const sql = client();
  const hash = nonceHash(nonce);
  await sql`
    DELETE FROM newsletter_confirmation_nonces WHERE nonce_hash = ${hash}
  `;
}
