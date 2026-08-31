import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

export const CONSENT_VERSION = '2026-08-31';
export const PROJECT_DELIVERY: Record<string, { segmentId: string; topicId: string }> = {
  'mcp-fiscal-brasil': {
    segmentId: 'aa0cf115-92eb-43d3-9cb9-e44cfca93619',
    topicId: '3d7e1b32-b5e5-4c4b-92bf-01bf2a47705c',
  },
  'mcp-juridico-brasil': {
    segmentId: '6ba82c07-2987-4bf7-a261-431eb2ae5a31',
    topicId: '46698b02-39b5-4dd1-864b-b7bc6d10eae0',
  },
};

export type ConfirmationPayload = {
  email: string;
  projects: string[];
  consentVersion: typeof CONSENT_VERSION;
  nonce: string;
  expiresAt: number;
};

export type ContactState = 'missing' | 'subscribed' | 'unsubscribed';

export function newsletterPublicBaseUrl(
  env: Record<string, string | undefined>,
): URL {
  const configured = env.NEWSLETTER_PUBLIC_URL?.trim();
  if (configured) {
    const target = new URL(configured);
    const local = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
    if (
      (target.protocol !== 'https:' && !(local && env.VERCEL_ENV !== 'production')) ||
      target.username ||
      target.password ||
      target.pathname !== '/' ||
      target.search ||
      target.hash
    ) {
      throw new Error('invalid newsletter public URL');
    }
    return target;
  }
  if (env.VERCEL_ENV === 'production') return new URL('https://news.dehor.com.br');
  const vercelHost = env.VERCEL_URL?.trim().toLowerCase();
  if (vercelHost && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.vercel\.app$/.test(vercelHost)) {
    return new URL(`https://${vercelHost}`);
  }
  throw new Error('newsletter public URL unavailable');
}

export function createConfirmationNonce(): string {
  return randomBytes(32).toString('base64url');
}

function encryptionKey(secret: string): Buffer {
  return createHash('sha256')
    .update(`dehor-news-confirmation:${secret}`, 'utf8')
    .digest();
}

export function createConfirmationToken(
  payload: ConfirmationPayload,
  secret: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

export function readConfirmationToken(
  token: string,
  secret: string,
): ConfirmationPayload | null {
  try {
    if (token.length === 0 || token.length > 4096) return null;
    const raw = Buffer.from(token, 'base64url');
    if (raw.toString('base64url') !== token) return null;
    if (raw.length < 29) return null;

    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(secret),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    const payload = JSON.parse(
      Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'),
    ) as Partial<ConfirmationPayload>;

    if (
      typeof payload.email !== 'string' ||
      !Array.isArray(payload.projects) ||
      payload.projects.length === 0 ||
      !payload.projects.every(
        (project): project is string =>
          typeof project === 'string' &&
          Object.prototype.hasOwnProperty.call(PROJECT_DELIVERY, project),
      ) ||
      payload.consentVersion !== CONSENT_VERSION ||
      typeof payload.nonce !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(payload.nonce) ||
      typeof payload.expiresAt !== 'number' ||
      Date.now() > payload.expiresAt
    ) {
      return null;
    }

    return {
      email: payload.email,
      projects: payload.projects,
      consentVersion: CONSENT_VERSION,
      nonce: payload.nonce,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function fetchResend(
  url: string,
  apiKey: string,
  init: Omit<RequestInit, 'signal' | 'headers'> & { body?: string },
): Promise<Response> {
  const target = new URL(url);
  if (target.origin !== 'https://api.resend.com' || target.username || target.password) {
    throw new Error('invalid Resend endpoint');
  }
  return fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function readContactState(
  email: string,
  apiKey: string,
): Promise<ContactState> {
  const contactPath = encodeURIComponent(email);
  const response = await fetchResend(
    `https://api.resend.com/contacts/${contactPath}`,
    apiKey,
    { method: 'GET' },
  );
  if (response.status === 404) return 'missing';
  if (!response.ok) throw new Error('contact lookup failed');
  const body = await response.json() as { unsubscribed?: unknown };
  if (typeof body.unsubscribed !== 'boolean') {
    throw new Error('invalid contact response');
  }
  return body.unsubscribed ? 'unsubscribed' : 'subscribed';
}

type ContactMemberships = {
  topicIds: string[];
  segmentIds: string[];
};

function membershipIds(body: unknown, kind: 'topics' | 'segments'): string[] {
  if (!body || typeof body !== 'object') throw new Error(`invalid contact ${kind}`);
  const candidate = body as { data?: unknown; has_more?: unknown };
  if (candidate.has_more !== false || !Array.isArray(candidate.data)) {
    throw new Error(`incomplete contact ${kind}`);
  }
  const ids = candidate.data.map((entry) => {
    if (!entry || typeof entry !== 'object' || typeof (entry as { id?: unknown }).id !== 'string') {
      throw new Error(`invalid contact ${kind}`);
    }
    return (entry as { id: string }).id;
  });
  return [...new Set(ids)];
}

export async function readContactMemberships(
  email: string,
  apiKey: string,
): Promise<ContactMemberships> {
  const contactPath = encodeURIComponent(email);
  const [topicsResponse, segmentsResponse] = await Promise.all([
    fetchResend(`https://api.resend.com/contacts/${contactPath}/topics`, apiKey, {
      method: 'GET',
    }),
    fetchResend(`https://api.resend.com/contacts/${contactPath}/segments`, apiKey, {
      method: 'GET',
    }),
  ]);
  if (!topicsResponse.ok) throw new Error('contact topics lookup failed');
  if (!segmentsResponse.ok) throw new Error('contact segments lookup failed');
  return {
    topicIds: membershipIds(await topicsResponse.json(), 'topics'),
    segmentIds: membershipIds(await segmentsResponse.json(), 'segments'),
  };
}

export async function syncContactPreferences(
  email: string,
  projects: string[],
  apiKey: string,
  keepLockAlive: () => Promise<void> = async () => undefined,
): Promise<void> {
  if (projects.length === 0 || projects.some(
    (project) => !Object.prototype.hasOwnProperty.call(PROJECT_DELIVERY, project),
  )) {
    throw new Error('invalid projects');
  }
  const deliveries = projects.map((project) => PROJECT_DELIVERY[project]);
  await keepLockAlive();
  let currentContactState = await readContactState(email, apiKey);
  await keepLockAlive();
  if (currentContactState === 'missing') {
    const createResponse = await fetchResend('https://api.resend.com/contacts', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        email,
        unsubscribed: false,
        segments: deliveries.map((delivery) => ({ id: delivery.segmentId })),
        topics: deliveries.map((delivery) => ({
          id: delivery.topicId,
          subscription: 'opt_in',
        })),
      }),
    });
    if (createResponse.ok) return;
    await keepLockAlive();
    currentContactState = await readContactState(email, apiKey);
    await keepLockAlive();
    if (currentContactState === 'missing') throw new Error('contact creation failed');
  }

  const contactPath = encodeURIComponent(email);
  const memberships = currentContactState === 'unsubscribed'
    ? await readContactMemberships(email, apiKey)
    : null;
  await keepLockAlive();
  const selectedTopicIds = new Set(deliveries.map((delivery) => delivery.topicId));
  const preferences = currentContactState === 'unsubscribed'
    ? [...new Set([...(memberships?.topicIds ?? []), ...selectedTopicIds])].map((topicId) => ({
        id: topicId,
        subscription: selectedTopicIds.has(topicId) ? 'opt_in' : 'opt_out',
      }))
    : deliveries.map((delivery) => ({
        id: delivery.topicId,
        subscription: 'opt_in',
      }));
  const topicsResponse = await fetchResend(`https://api.resend.com/contacts/${contactPath}/topics`, apiKey, {
    method: 'PATCH',
    body: JSON.stringify(preferences),
  });
  if (!topicsResponse.ok) throw new Error('topic update failed');
  await keepLockAlive();

  for (const delivery of deliveries) {
    const segmentResponse = await fetchResend(`https://api.resend.com/contacts/${contactPath}/segments/${delivery.segmentId}`, apiKey, {
      method: 'POST',
      body: '{}',
    });
    if (!segmentResponse.ok && segmentResponse.status !== 409) {
      throw new Error('segment update failed');
    }
    await keepLockAlive();
  }

  if (currentContactState === 'unsubscribed') {
    const selectedSegmentIds = new Set(deliveries.map((delivery) => delivery.segmentId));
    for (const segmentId of memberships?.segmentIds ?? []) {
      if (selectedSegmentIds.has(segmentId)) continue;
      const segmentResponse = await fetchResend(
        `https://api.resend.com/contacts/${contactPath}/segments/${segmentId}`,
        apiKey,
        { method: 'DELETE' },
      );
      if (!segmentResponse.ok && segmentResponse.status !== 404) {
        throw new Error('segment removal failed');
      }
      await keepLockAlive();
    }
  }

  // Reativar o contato por último evita que uma falha parcial volte a enviar
  // broadcasts antes de as preferências confirmadas terem sido aplicadas.
  if (currentContactState === 'unsubscribed') {
    await keepLockAlive();
    const contactResponse = await fetchResend(`https://api.resend.com/contacts/${contactPath}`, apiKey, {
      method: 'PATCH',
      body: JSON.stringify({ unsubscribed: false }),
    });
    if (!contactResponse.ok) throw new Error('contact update failed');
  }
}
