type AffiliateHandler = {
  name: string;
  match: (url: URL) => boolean;
  normalize: (url: URL) => string;
};

function hasScheme(s: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
}

function extractFirstUrlCandidate(input: string): string | null {
  const text = String(input || "");

  // Prefer URLs completas
  const full = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (full?.[0]) return full[0];

  // Fallback: domínio com ou sem www e caminho opcional
  const domainish = text.match(/\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s"'<>]*)?/i);
  if (domainish?.[0]) return domainish[0];

  return null;
}

function toUrl(candidate: string): URL | null {
  const raw = String(candidate || "").trim();
  if (!raw) return null;
  try {
    return new URL(hasScheme(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

const esportivaHandler: AffiliateHandler = {
  name: "esportiva",
  match: (url) => {
    const h = url.hostname.toLowerCase();
    return h === "esportiva.bet.br" || h.endsWith(".esportiva.bet.br");
  },
  normalize: (url) => {
    // Regra: shareCode sempre vem do link original
    const shareCode = url.searchParams.get("shareCode");
    if (!shareCode) return url.toString();

    // Padrão EXATO pedido (URL + parâmetros fixos)
    const out = new URL("https://esportiva.bet.br/sports");
    out.searchParams.set("ref", "488824");
    out.searchParams.set("src", "mroieqvxtxlontushusjyfrvfj");
    out.searchParams.set("utm_source", "telegram");
    out.searchParams.set("utm_medium", "grupo");
    out.searchParams.set("utm_campaign", "dica");
    out.searchParams.set("lang", "pt-br");
    out.searchParams.set("shareCode", shareCode);
    out.searchParams.set("funnel_token", "F7K9X2B");
    return out.toString();
  },
};

// Deixe aqui novos handlers no futuro (lotogreen, bet365, etc.)
const HANDLERS: AffiliateHandler[] = [esportivaHandler];

/**
 * normalizeAffiliateLink(input)
 * - extrai a primeira URL do texto livre
 * - se for "esportiva.bet.br": gera URL final com parâmetros fixos + shareCode original
 * - se for outra casa: retorna a URL extraída sem modificar
 * - se não houver URL: retorna o input original (trim)
 */
export function normalizeAffiliateLink(input: string): string {
  const candidate = extractFirstUrlCandidate(input);
  if (!candidate) return String(input || "").trim();

  const url = toUrl(candidate);
  if (!url) return String(input || "").trim();

  const handler = HANDLERS.find((h) => h.match(url));
  if (!handler) return url.toString();

  return handler.normalize(url);
}

