/** Title-case category labels for display (e.g. "hair salon" → "Hair Salon"). */
export function formatCategoryDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
