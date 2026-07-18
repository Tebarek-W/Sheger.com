import { spacing } from "@/constants/theme";

/** Shared spacing for owner screens — matches Screen padding (20). */
export const ownerLayout = {
  screenPadding: 20,
  blockGap: spacing.md,
  sectionGap: spacing.lg,
  sectionTitleBottom: 12,
  cardPadding: spacing.md,
  cardGap: 12,
  listGap: 12,
  bottomPadding: spacing.lg,
} as const;
