/** DB stores 0.10 for 10%; UI often uses whole percent. */
export function formatCommissionPercent(rate: number): string {
  const pct = Math.round(rate * 1000) / 10;
  return `${pct}%`;
}

export function parseCommissionPercentInput(value: string): number {
  const pct = Number(value);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error("Commission must be between 0 and 100 percent");
  }
  return Math.round(pct * 10) / 1000;
}

export function commissionRateToPercentInput(rate: number): string {
  return String(Math.round(rate * 1000) / 10);
}
