// Negociação de conteúdo pelo header Accept (RFC 9110 §12.5.1): cada candidato recebe o q da faixa
// mais específica que casa com ele (tipo exato > tipo/* > */*); q=0 exclui. Vence o maior q; no
// empate, a faixa mais específica; persistindo, a ordem de `candidates`. Accept vazio = */*.

/**
 * @param {string} accept
 * @returns {{ type: string, subtype: string, q: number }[]}
 */
function parseAccept(accept) {
  return (accept || '*/*').split(',').flatMap((part) => {
    const [range, ...params] = part.trim().toLowerCase().split(';');
    const [type, subtype] = range.trim().split('/');
    if (!type || !subtype) return [];
    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const q = qParam === undefined ? 1 : Number(qParam.slice(2));
    return Number.isFinite(q) ? [{ type, subtype, q: Math.min(Math.max(q, 0), 1) }] : [];
  });
}

/**
 * @param {string} candidate tipo de mídia sem parâmetros, ex.: "text/markdown"
 * @param {{ type: string, subtype: string, q: number }[]} ranges
 * @returns {{ q: number, specificity: number }}
 */
function score(candidate, ranges) {
  const [type, subtype] = candidate.split('/');
  let best = { q: 0, specificity: -1 };
  for (const range of ranges) {
    const specificity =
      range.type === type && range.subtype === subtype ? 2
        : range.type === type && range.subtype === '*' ? 1
          : range.type === '*' && range.subtype === '*' ? 0
            : -1;
    if (specificity > best.specificity) best = { q: range.q, specificity };
  }
  return best;
}

/**
 * Escolhe o candidato preferido pelo cliente, ou null se nenhum é aceitável.
 * @param {string | null | undefined} accept
 * @param {string[]} candidates
 * @returns {string | null}
 */
export function preferredType(accept, candidates) {
  const ranges = parseAccept(accept ?? '');
  let winner = null;
  let best = { q: 0, specificity: -1 };
  for (const candidate of candidates) {
    const s = score(candidate, ranges);
    if (s.q > best.q || (s.q > 0 && s.q === best.q && s.specificity > best.specificity)) {
      winner = candidate;
      best = s;
    }
  }
  return winner;
}
