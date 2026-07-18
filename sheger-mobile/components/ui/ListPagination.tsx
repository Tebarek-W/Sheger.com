import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";

type ListPaginationProps = {
  page: number;
  hasNext: boolean;
  loading?: boolean;
  previousLabel: string;
  nextLabel: string;
  pageLabel: string;
  onPrevious: () => void;
  onNext: () => void;
};

export function ListPagination({
  page,
  hasNext,
  loading = false,
  previousLabel,
  nextLabel,
  pageLabel,
  onPrevious,
  onNext,
}: ListPaginationProps) {
  const canPrevious = page > 1 && !loading;
  const canNext = hasNext && !loading;

  if (page === 1 && !hasNext) return null;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPrevious}
        disabled={!canPrevious}
        style={[styles.btn, !canPrevious && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canPrevious }}
      >
        <Text style={[styles.btnText, !canPrevious && styles.btnTextDisabled]}>{previousLabel}</Text>
      </Pressable>

      <Text style={styles.pageLabel}>{pageLabel}</Text>

      <Pressable
        onPress={onNext}
        disabled={!canNext}
        style={[styles.btn, !canNext && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canNext }}
      >
        <Text style={[styles.btnText, !canNext && styles.btnTextDisabled]}>{nextLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  btn: {
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  btnDisabled: {
    backgroundColor: colors.border,
  },
  btnText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 13,
  },
  btnTextDisabled: {
    color: colors.textTertiary,
  },
  pageLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
