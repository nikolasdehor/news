#!/usr/bin/env node
/**
 * send-newsletter.mjs
 * Envia broadcasts Resend para posts publicados (draft:false) que ainda nao foram enviados.
 *
 * Uso:
 *   node scripts/send-newsletter.mjs           # modo normal
 *   DRY_RUN=true node scripts/send-newsletter.mjs  # dry-run: sem chamadas reais a API
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Configuracao
// ---------------------------------------------------------------------------

const DRY_RUN = process.env.DRY_RUN === 'true';

const RESEND_API_KEY =
  process.env.RESEND_DEHOR_API_KEY || process.env.RESEND_API_KEY;

if (!RESEND_API_KEY && !DRY_RUN) {
  console.error(
    '[send-newsletter] ERRO: variavel RESEND_DEHOR_API_KEY nao definida.'
  );
  process.exit(1);
}

/** Map project -> audience ID no Resend */
const AUDIENCE_MAP = {
  'mcp-fiscal-brasil': 'aa0cf115-92eb-43d3-9cb9-e44cfca93619',
  'mcp-juridico-brasil': '6ba82c07-2987-4bf7-a261-431eb2ae5a31',
};

const FROM = 'newsletter@dehor.com.br';
const BLOG_BASE = 'https://news.dehor.com.br';
const STATE_FILE = join(ROOT, '.github', 'sent-broadcasts.json');
const POSTS_DIR = join(ROOT, 'src', 'content', 'posts');

// ---------------------------------------------------------------------------
// Helpers de frontmatter
// ---------------------------------------------------------------------------

/**
 * Extrai frontmatter YAML simples (sem dependencias externas).
 * Suporta strings com aspas duplas, booleans e datas ISO.
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const block = match[1];
  const result = {};
  for (const line of block.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Remove aspas duplas
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    // Boolean
    if (value === 'true') result[key] = true;
    else if (value === 'false') result[key] = false;
    else result[key] = value;
  }
  return result;
}

/** Extrai o corpo do post (apos o segundo ---) */
function extractBody(raw) {
  const match = raw.match(/^---[\s\S]*?---\r?\n([\s\S]*)$/);
  return match ? match[1].trim() : '';
}

// ---------------------------------------------------------------------------
// Conversor Markdown -> HTML (minimalista, sem dependencias)
// ---------------------------------------------------------------------------

function markdownToHtml(md) {
  let html = md;

  // Escapar caracteres especiais HTML (antes de tudo)
  // Nao escapar aqui pois o MD ja contem texto literal

  // Blocos de codigo (``` ... ```)
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre style="background:#F0F7F4;border:1px solid #D0E8DC;border-radius:4px;padding:14px 16px;margin:18px 0;overflow-x:auto;"><code style="font-family:'Courier New',monospace;font-size:13px;color:#1A7A4A;line-height:1.5;">${escaped}</code></pre>`;
  });

  // Tabelas Markdown simples
  html = html.replace(/((?:\|.+\|\n?)+)/g, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(Boolean);
    if (rows.length < 2) return tableBlock;
    let out =
      '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;margin:18px 0;">';
    rows.forEach((row, idx) => {
      // Linha separadora (|---|---|)
      if (/^\|[\s:-]+\|/.test(row)) return;
      const cells = row
        .split('|')
        .filter((_, i, arr) => i > 0 && i < arr.length - 1);
      const tag = idx === 0 ? 'th' : 'td';
      const style =
        idx === 0
          ? 'font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;color:#1A7A4A;letter-spacing:0.5px;padding:8px 10px;border-bottom:2px solid #1A7A4A;text-align:left;'
          : 'font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:13px;color:#333333;padding:8px 10px;border-bottom:1px solid #EBEBEB;vertical-align:top;';
      out += '<tr>';
      cells.forEach((c) => {
        out += `<${tag} style="${style}">${c.trim()}</${tag}>`;
      });
      out += '</tr>';
    });
    out += '</table>';
    return out;
  });

  // Separadores ---
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #EBEBEB;margin:28px 0;">');

  // Headings
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 style="margin:28px 0 12px 0;font-family:Georgia,\'Times New Roman\',serif;font-size:18px;font-weight:normal;color:#111111;line-height:1.4;">$1</h3>'
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 style="margin:32px 0 14px 0;font-family:Georgia,\'Times New Roman\',serif;font-size:22px;font-weight:normal;color:#111111;line-height:1.35;border-bottom:1px solid #EBEBEB;padding-bottom:8px;">$1</h2>'
  );
  html = html.replace(
    /^# (.+)$/gm,
    '<h1 style="margin:0 0 20px 0;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;font-weight:normal;color:#111111;line-height:1.35;">$1</h1>'
  );

  // Blockquote
  html = html.replace(
    /^> (.+)$/gm,
    '<blockquote style="margin:20px 0;border-left:3px solid #1A7A4A;padding:12px 16px;background:#F0F7F4;font-family:Georgia,\'Times New Roman\',serif;font-size:15px;color:#333333;font-style:italic;line-height:1.65;">$1</blockquote>'
  );

  // Listas com *
  html = html.replace(/^(\* .+\n?)+/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((l) => {
        const text = l.replace(/^\* /, '');
        return `<li style="margin-bottom:8px;">${text}</li>`;
      });
    return `<ul style="margin:14px 0 14px 24px;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#333333;line-height:1.65;">${items.join('')}</ul>`;
  });

  // Listas com -
  html = html.replace(/^(- .+\n?)+/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((l) => {
        const text = l.replace(/^- /, '');
        return `<li style="margin-bottom:8px;">${text}</li>`;
      });
    return `<ul style="margin:14px 0 14px 24px;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#333333;line-height:1.65;">${items.join('')}</ul>`;
  });

  // Negrito e italico
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="font-family:\'Courier New\',monospace;background:#F0F7F4;color:#1A7A4A;padding:2px 5px;border-radius:3px;font-size:13px;">$1</code>'
  );

  // Links
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" style="color:#1A7A4A;text-decoration:none;font-weight:500;">$1</a>'
  );

  // Paragrafos: linhas em branco separam paragrafos
  const paragraphs = html.split(/\n{2,}/);
  html = paragraphs
    .map((p) => {
      p = p.trim();
      if (!p) return '';
      // Nao embrulhar blocos ja convertidos
      if (
        p.startsWith('<h') ||
        p.startsWith('<ul') ||
        p.startsWith('<pre') ||
        p.startsWith('<table') ||
        p.startsWith('<hr') ||
        p.startsWith('<blockquote')
      ) {
        return p;
      }
      // Linha unica com \n dentro (item de lista ja processado)
      if (p.startsWith('<li')) return p;
      return `<p style="margin:0 0 18px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;color:#333333;line-height:1.7;">${p.replace(/\n/g, ' ')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return html;
}

// ---------------------------------------------------------------------------
// Gerador de HTML do e-mail
// ---------------------------------------------------------------------------

function buildEmailHtml({ title, description, project, slug, bodyHtml }) {
  const readUrl = `${BLOG_BASE}/${project}/${slug}`;
  const projectLabel = project
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Extrai numero da edicao do slug (ex: edicao-1 -> Edicao 1)
  const editionLabel = slug
    .replace('edicao-', 'Edicao ')
    .replace(/(\d)$/, '$1');

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; background-color: #F5F4F0; }
    a { color: #1A7A4A; }
    @media screen and (max-width: 600px) {
      .wrapper { width: 100% !important; }
      .header-title { font-size: 24px !important; }
      .intro-text { font-size: 16px !important; }
      .cta-button { padding: 14px 28px !important; font-size: 15px !important; }
      .content-padding { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F4F0; font-family: Georgia, 'Times New Roman', serif;">

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F5F4F0;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <table class="wrapper" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"
               style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">

          <!-- Barra verde superior -->
          <tr>
            <td style="background-color: #1A7A4A; padding: 0; line-height: 0; font-size: 0; height: 4px;">&nbsp;</td>
          </tr>

          <!-- Header: logo + projeto -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 28px 40px 20px 40px; border-bottom: 1px solid #EBEBEB;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: normal; color: #888888; letter-spacing: 2px; text-transform: uppercase;">
                      news.dehor.com.br
                    </p>
                    <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; color: #1A7A4A; letter-spacing: 0.5px;">
                      ${projectLabel}
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <span style="display: inline-block; background-color: #1A7A4A; color: #FFFFFF; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1px; padding: 4px 10px; border-radius: 2px; text-transform: uppercase;">
                      ${editionLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero: titulo + descricao -->
          <tr>
            <td class="content-padding" style="background-color: #FAFAF8; padding: 40px 40px 32px 40px; border-bottom: 1px solid #EBEBEB;">
              <h1 class="header-title" style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: normal; color: #111111; line-height: 1.35; letter-spacing: -0.3px;">
                ${title}
              </h1>
              <p class="intro-text" style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 17px; color: #444444; line-height: 1.7;">
                ${description}
              </p>
            </td>
          </tr>

          <!-- Corpo do post -->
          <tr>
            <td class="content-padding" style="padding: 32px 40px 28px 40px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Separador -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr><td style="border-top: 1px solid #EBEBEB; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 32px 40px 44px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #1A7A4A; border-radius: 3px;">
                    <a href="${readUrl}"
                       class="cta-button"
                       target="_blank"
                       style="display: inline-block; padding: 15px 36px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; letter-spacing: 0.3px; border-radius: 3px; mso-padding-alt: 15px 36px;">
                      Ler no blog
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F5F4F0; padding: 24px 40px; border-top: 1px solid #E0DED9;">
              <p style="margin: 0 0 8px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #888888; line-height: 1.6;">
                Voce recebe este e-mail porque assinou as novidades do <strong>${projectLabel}</strong> em
                <a href="${BLOG_BASE}" target="_blank" style="color: #1A7A4A; text-decoration: none;">news.dehor.com.br</a>.
              </p>
              <p style="margin: 0 0 16px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #AAAAAA; line-height: 1.6;">
                <a href="${BLOG_BASE}/unsubscribe" target="_blank" style="color: #AAAAAA; text-decoration: underline;">Descadastrar</a>
                &nbsp;&middot;&nbsp; Nikolas de Hor &nbsp;&middot;&nbsp; Goiânia, GO, Brasil
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #D0CEC9; padding-top: 16px;">
                    <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #BBBBBB;">
                      news.dehor.com.br &nbsp;&middot;&nbsp; Diario de bordo de projetos open source
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Barra verde inferior -->
          <tr>
            <td style="background-color: #1A7A4A; padding: 0; line-height: 0; font-size: 0; height: 4px;">&nbsp;</td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Resend API helpers
// ---------------------------------------------------------------------------

async function resendPost(path, body) {
  const res = await fetch(`https://api.resend.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Resend ${path} -> ${res.status}: ${JSON.stringify(json)}`
    );
  }
  return json;
}

async function createAndSendBroadcast({ audienceId, subject, htmlContent }) {
  // 1. Criar broadcast
  const created = await resendPost('/broadcasts', {
    audience_id: audienceId,
    from: FROM,
    subject,
    html: htmlContent,
  });
  const broadcastId = created.id;
  console.log(`  [resend] Broadcast criado: ${broadcastId}`);

  // 2. Enviar broadcast
  await resendPost(`/broadcasts/${broadcastId}/send`, {});
  console.log(`  [resend] Broadcast enviado: ${broadcastId}`);

  return broadcastId;
}

// ---------------------------------------------------------------------------
// Varredura de posts
// ---------------------------------------------------------------------------

function collectPosts() {
  const posts = [];
  for (const project of readdirSync(POSTS_DIR)) {
    const projectDir = join(POSTS_DIR, project);
    if (!statSync(projectDir).isDirectory()) continue;
    for (const file of readdirSync(projectDir)) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      const slug = file.replace(/\.(md|mdx)$/, '');
      const raw = readFileSync(join(projectDir, file), 'utf8');
      const fm = parseFrontmatter(raw);
      posts.push({ project, slug, fm, raw });
    }
  }
  return posts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[send-newsletter] Iniciando${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  // Carregar estado
  let state;
  try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    state = { sent: [], lastUpdated: new Date().toISOString() };
  }
  const sentSet = new Set(state.sent);

  // Coletar posts publicados
  const posts = collectPosts();
  const published = posts.filter((p) => p.fm.draft === false);

  console.log(
    `[send-newsletter] Posts publicados encontrados: ${published.length}`
  );

  let newCount = 0;
  const newSlugs = [];

  for (const { project, slug, fm, raw } of published) {
    const key = `${project}/${slug}`;

    if (sentSet.has(key)) {
      console.log(`  [skip] ${key} - ja enviado`);
      continue;
    }

    const audienceId = AUDIENCE_MAP[project];
    if (!audienceId) {
      console.warn(`  [aviso] Sem audience configurada para projeto: ${project}`);
      continue;
    }

    console.log(`  [novo] ${key} - preparando broadcast...`);

    const bodyMarkdown = extractBody(raw);
    const bodyHtml = markdownToHtml(bodyMarkdown);
    const htmlContent = buildEmailHtml({
      title: fm.title || slug,
      description: fm.description || '',
      project,
      slug,
      bodyHtml,
    });

    if (DRY_RUN) {
      console.log(`  [dry-run] Simularia broadcast para audience ${audienceId}`);
      console.log(`  [dry-run] Assunto: ${fm.title}`);
      console.log(`  [dry-run] HTML valido: ${htmlContent.includes('<!DOCTYPE html>') ? 'SIM' : 'NAO'}`);
      console.log(`  [dry-run] Tamanho HTML: ${htmlContent.length} chars`);
    } else {
      const broadcastId = await createAndSendBroadcast({
        audienceId,
        subject: fm.title || slug,
        htmlContent,
      });
      console.log(`  [ok] ${key} -> broadcast ${broadcastId}`);
    }

    newSlugs.push(key);
    newCount++;
  }

  if (newCount === 0) {
    console.log('[send-newsletter] Nenhum post novo para enviar.');
    return;
  }

  // Atualizar estado
  const updatedState = {
    sent: [...state.sent, ...newSlugs],
    lastUpdated: new Date().toISOString(),
  };

  if (DRY_RUN) {
    console.log(
      `[dry-run] Atualizaria estado com: ${JSON.stringify(newSlugs)}`
    );
  } else {
    writeFileSync(STATE_FILE, JSON.stringify(updatedState, null, 2) + '\n');
    console.log(
      `[send-newsletter] Estado atualizado com ${newSlugs.length} slug(s) novo(s).`
    );
  }

  console.log(
    `[send-newsletter] Concluido. ${newCount} broadcast(s) ${DRY_RUN ? 'simulado(s)' : 'enviado(s)'}.`
  );
}

main().catch((err) => {
  console.error('[send-newsletter] ERRO FATAL:', err);
  process.exit(1);
});
