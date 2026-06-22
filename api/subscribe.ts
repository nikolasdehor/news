import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mapa slug -> audienceId do Resend
const AUDIENCE_MAP: Record<string, string> = {
  'mcp-fiscal-brasil': 'aa0cf115-92eb-43d3-9cb9-e44cfca93619',
  'mcp-juridico-brasil': '6ba82c07-2987-4bf7-a261-431eb2ae5a31',
};

const VALID_SLUGS = new Set(Object.keys(AUDIENCE_MAP));

function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  // RFC 5322 simplificado - robusto o suficiente para validacao de formulario
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apenas POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  // CORS: permitir apenas same-origin (Vercel envia credenciais de origem automaticamente)
  const origin = req.headers['origin'];
  const host = req.headers['host'];
  if (origin && host && origin !== `https://${host}` && origin !== `http://${host}`) {
    // Em producao aceita apenas a origem do proprio site
    const allowedOrigins = [
      'https://news.dehor.com.br',
      'https://dehor-news.vercel.app',
    ];
    if (!allowedOrigins.some((o) => origin === o)) {
      return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
    }
  }

  const { email, projects, website } = req.body ?? {};

  // Honeypot anti-spam: campo "website" deve estar vazio
  // Responder 200 para nao revelar a existencia do honeypot
  if (website !== undefined && website !== '') {
    return res.status(200).json({ ok: true });
  }

  // Validar email
  if (!isValidEmail(email)) {
    return res.status(422).json({ ok: false, error: 'E-mail inválido.' });
  }

  // Validar projects
  if (!Array.isArray(projects) || projects.length === 0) {
    return res.status(422).json({ ok: false, error: 'Selecione ao menos um projeto.' });
  }

  const validProjects = (projects as unknown[])
    .filter((p): p is string => typeof p === 'string' && VALID_SLUGS.has(p));

  if (validProjects.length === 0) {
    return res.status(422).json({ ok: false, error: 'Nenhum projeto válido selecionado.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Nao expoe detalhes de configuracao
    return res.status(500).json({ ok: false, error: 'Erro interno. Tente novamente mais tarde.' });
  }

  // Inscreve em cada audience do Resend
  const errors: string[] = [];
  for (const slug of validProjects) {
    const audienceId = AUDIENCE_MAP[slug];
    try {
      const response = await fetch(
        `https://api.resend.com/audiences/${audienceId}/contacts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            unsubscribed: false,
          }),
        },
      );

      if (!response.ok) {
        const data: Record<string, unknown> = await response.json().catch(() => ({}));
        // Contato ja existente (409 ou mensagem especifica) -> tratar como sucesso
        const msg = typeof data.message === 'string' ? data.message : '';
        const isAlreadyExists =
          response.status === 409 ||
          msg.toLowerCase().includes('already');

        if (!isAlreadyExists) {
          errors.push(slug);
        }
        // Se ja existe, continua sem registrar erro
      }
    } catch {
      errors.push(slug);
    }
  }

  if (errors.length > 0) {
    return res.status(500).json({ ok: false, error: 'Erro ao salvar inscrição. Tente novamente.' });
  }

  return res.status(200).json({ ok: true });
}
