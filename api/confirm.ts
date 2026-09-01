import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  newsletterPublicBaseUrl,
  readConfirmationToken,
  syncContactPreferences,
} from '../lib/newsletter-confirmation.ts';
import {
  claimContactSync,
  claimConfirmationNonce,
  completeConfirmationNonce,
  releaseContactSync,
  releaseConfirmationNonce,
  renewContactSync,
  renewConfirmationNonce,
} from '../lib/newsletter-confirmation-store.ts';

function redirect(res: VercelResponse, result: 'confirmada' | 'processando' | 'erro') {
  let publicBase: URL;
  try {
    publicBase = newsletterPublicBaseUrl(process.env);
  } catch {
    publicBase = new URL('https://news.dehor.com.br');
  }
  const location = new URL('/', publicBase);
  location.searchParams.set('inscricao', result);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', location.toString());
  return res.status(303).end();
}

function confirmationPage(token: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Confirmar inscrição — DeHor News</title></head>
<body><main><h1>Confirme sua inscrição</h1><p>O cadastro só será concluído quando você pressionar o botão abaixo.</p>
<form method="post" action="/api/confirm"><input type="hidden" name="token" value="${token}">
<button type="submit">Confirmar inscrição</button></form></main></body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }
  const tokenValue = req.method === 'GET' ? req.query.token : req.body?.token;
  const token = Array.isArray(tokenValue) ? null : tokenValue;
  const secret = process.env.NEWSLETTER_CONFIRMATION_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (typeof token !== 'string' || !secret || secret.length < 32 || !apiKey)
    return redirect(res, 'erro');
  const payload = readConfirmationToken(token, secret);
  if (!payload) return redirect(res, 'erro');
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'none'; form-action 'self'; style-src 'unsafe-inline'");
    return res.status(200).send(confirmationPage(token));
  }
  let claim = await claimConfirmationNonce(payload.nonce).catch(() => null);
  for (let attempt = 0; claim?.status === 'processing' && attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    claim = await claimConfirmationNonce(payload.nonce).catch(() => null);
  }
  if (!claim || claim.status === 'unavailable') return redirect(res, 'erro');
  if (claim.status === 'processing') return redirect(res, 'processando');
  if (claim.status === 'completed') return redirect(res, 'confirmada');
  let contactClaim = null;
  try {
    for (let attempt = 0; !contactClaim && attempt < 8; attempt += 1) {
      contactClaim = await claimContactSync(payload.email, secret);
      if (!contactClaim) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } catch {
    await releaseConfirmationNonce(payload.nonce, claim.attemptId).catch(() => undefined);
    return redirect(res, 'erro');
  }
  if (!contactClaim) {
    await releaseConfirmationNonce(payload.nonce, claim.attemptId).catch(() => undefined);
    return redirect(res, 'processando');
  }
  try {
    await syncContactPreferences(
      payload.email,
      payload.projects,
      apiKey,
      async () => {
        await renewConfirmationNonce(payload.nonce, claim.attemptId);
        await renewContactSync(payload.email, secret, contactClaim.attemptId);
      },
    );
    await completeConfirmationNonce(payload.nonce, claim.attemptId);
    return redirect(res, 'confirmada');
  } catch {
    await releaseConfirmationNonce(payload.nonce, claim.attemptId).catch(() => undefined);
    return redirect(res, 'erro');
  } finally {
    await releaseContactSync(
      payload.email,
      secret,
      contactClaim.attemptId,
    ).catch(() => undefined);
  }
}
