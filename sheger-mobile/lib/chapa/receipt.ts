/** Build Chapa hosted receipt URL after successful payment. */
export function buildChapaReceiptUrl(chapaReference: string): string {
  return `https://chapa.link/payment-receipt/${encodeURIComponent(chapaReference)}`;
}

export function parseChapaReferenceFromUrl(url: string): string | null {
  if (!url || url.trimStart().startsWith("<!")) return null;

  try {
    const normalized = url.includes("://") ? url : `sheger://${url.replace(/^\//, "")}`;
    const parsed = new URL(normalized);
    return parsed.searchParams.get("chapa_reference");
  } catch {
    const match = url.match(/[?&]chapa_reference=([^&]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }
}
