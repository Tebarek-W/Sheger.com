const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && SIMPLE_EMAIL_RE.test(normalized);
}

export function normalizeEthiopianMobile(phone: string | null | undefined): string {
  const raw = (phone ?? "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("251")) {
    const local = `0${digits.slice(3)}`;
    return /^0[79]\d{8}$/.test(local) ? local : "";
  }

  if (digits.length === 10 && /^0[79]\d{8}$/.test(digits)) {
    return digits;
  }

  return "";
}

export function isValidEthiopianMobile(phone: string | null | undefined): boolean {
  return normalizeEthiopianMobile(phone).length > 0;
}
