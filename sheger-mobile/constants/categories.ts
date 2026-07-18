export type CategoryTheme = {
  bg: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
};

export const CATEGORY_THEMES: CategoryTheme[] = [
  { bg: "#e4f5e4", icon: "#1a7a1a", badgeBg: "#e4f5e4", badgeText: "#1a5c1a" },
  { bg: "#e1f5ee", icon: "#0d6e56", badgeBg: "#e1f5ee", badgeText: "#0d6e56" },
  { bg: "#fbeaf0", icon: "#993556", badgeBg: "#fbeaf0", badgeText: "#993556" },
  { bg: "#faeeda", icon: "#854f0b", badgeBg: "#faeeda", badgeText: "#854f0b" },
  { bg: "#e6f1fb", icon: "#185fa5", badgeBg: "#e6f1fb", badgeText: "#185fa5" },
  { bg: "#eeedfe", icon: "#534ab7", badgeBg: "#eeedfe", badgeText: "#534ab7" },
  { bg: "#faece7", icon: "#993c1d", badgeBg: "#faece7", badgeText: "#993c1d" },
  { bg: "#f1efe8", icon: "#5f5e5a", badgeBg: "#f1efe8", badgeText: "#5f5e5a" },
  { bg: "#fde8f3", icon: "#9d174d", badgeBg: "#fde8f3", badgeText: "#9d174d" },
  { bg: "#e8f4fd", icon: "#0369a1", badgeBg: "#e8f4fd", badgeText: "#0369a1" },
];

export const CATEGORY_ICONS: Record<string, string> = {
  barbershops: "✂️",
  "hair-salons": "💇",
  "nail-services": "💅",
  "makeup-artists": "💄",
  dentists: "🦷",
  clinics: "🏥",
  "massage-spa": "🧖",
  photographers: "📷",
  "wedding-planners": "💍",
  "gyms-trainers": "💪",
};

export function getCategoryIcon(slug?: string | null) {
  if (!slug) return "📍";
  return CATEGORY_ICONS[slug] ?? "📍";
}

export function getCategoryTheme(index: number): CategoryTheme {
  return CATEGORY_THEMES[index % CATEGORY_THEMES.length];
}
