// Microsoft Clarity: gravação de sessão e mapa de calor, só em produção e sem cookies.
export const CLARITY_PROJECT_ID = 'zixgfg2umm';
export const PRODUCTION_HOSTNAMES = ['news.dehor.com.br', 'www.news.dehor.com.br'];

/**
 * Carrega o Clarity apenas no domínio de produção, com consent negado por padrão
 * (nenhum cookie _clck/_clsk). Retorna true se o tag foi injetado.
 * @param {Window & { clarity?: Function }} win
 * @param {Document} doc
 */
export function initClarity(win, doc) {
  if (!PRODUCTION_HOSTNAMES.includes(win.location.hostname)) return false;
  if (win.clarity) return false;

  // Stub oficial: enfileira chamadas até o tag carregar.
  win.clarity = function () {
    (win.clarity.q = win.clarity.q || []).push(arguments);
  };
  // O consent negado entra na fila antes do tag, então nada é gravado em cookie.
  win.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });

  const script = doc.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  doc.head.appendChild(script);
  return true;
}
