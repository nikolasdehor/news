CREATE TABLE IF NOT EXISTS newsletter_confirmation_nonces (
  nonce_hash char(64) PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'processing', 'completed')),
  attempt_id uuid,
  lease_until timestamptz,
  completed_at timestamptz,
  CHECK (
    (state = 'processing' AND attempt_id IS NOT NULL AND lease_until IS NOT NULL)
    OR (state <> 'processing' AND attempt_id IS NULL AND lease_until IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS newsletter_confirmation_nonces_expires_at_idx
  ON newsletter_confirmation_nonces (expires_at);

CREATE TABLE IF NOT EXISTS newsletter_confirmation_contact_locks (
  contact_hash char(64) PRIMARY KEY,
  attempt_id uuid NOT NULL,
  lease_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_confirmation_contact_locks_lease_until_idx
  ON newsletter_confirmation_contact_locks (lease_until);
