const LEGACY_ONLINE_METHODS = new Set(["telebirr", "cbe_birr", "card"]);

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  const id = method.toLowerCase();
  if (id === "cash") return "Cash on arrival";
  if (id === "chapa" || LEGACY_ONLINE_METHODS.has(id)) return "Chapa";
  return method.replaceAll("_", " ");
}
