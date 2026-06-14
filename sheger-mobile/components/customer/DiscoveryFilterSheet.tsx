import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import {
  DISTANCE_OPTIONS,
  PRICE_RANGES,
  RATING_OPTIONS,
  SORT_OPTIONS,
  type DiscoveryFilters,
  type SortKey,
} from "@/lib/business/discovery";
import type { Category } from "@/lib/types/database";

type CategoryOption = Pick<Category, "id" | "name" | "slug">;

type DiscoveryFilterSheetProps = {
  visible: boolean;
  filters: DiscoveryFilters;
  categories: CategoryOption[];
  hasLocation: boolean;
  resultCount: number;
  onChange: (next: DiscoveryFilters) => void;
  onReset: () => void;
  onClose: () => void;
};

type ChipProps = {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function Chip({ label, active, disabled, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        active && styles.chipActive,
        disabled && styles.chipDisabled,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
          disabled && styles.chipTextDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function DiscoveryFilterSheet({
  visible,
  filters,
  categories,
  hasLocation,
  resultCount,
  onChange,
  onReset,
  onClose,
}: DiscoveryFilterSheetProps) {
  const set = (patch: Partial<DiscoveryFilters>) => onChange({ ...filters, ...patch });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Filters</Text>
            <Pressable onPress={onReset} hitSlop={8}>
              <Text style={styles.reset}>Reset all</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <Text style={styles.label}>Service type</Text>
            <View style={styles.chipWrap}>
              <Chip
                label="All"
                active={filters.categoryId == null}
                onPress={() => set({ categoryId: null })}
              />
              {categories.map((cat) => (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  active={filters.categoryId === cat.id}
                  onPress={() =>
                    set({ categoryId: filters.categoryId === cat.id ? null : cat.id })
                  }
                />
              ))}
            </View>

            <Text style={styles.label}>Price range (ETB)</Text>
            <View style={styles.chipWrap}>
              {PRICE_RANGES.map((range) => (
                <Chip
                  key={range.id}
                  label={range.label}
                  active={filters.priceRangeId === range.id}
                  onPress={() => set({ priceRangeId: range.id })}
                />
              ))}
            </View>

            <Text style={styles.label}>Minimum rating</Text>
            <View style={styles.chipWrap}>
              {RATING_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.value == null ? option.label : `★ ${option.label}`}
                  active={filters.minRating === option.value}
                  onPress={() => set({ minRating: option.value })}
                />
              ))}
            </View>

            <Text style={styles.label}>Distance</Text>
            {!hasLocation ? (
              <Text style={styles.hint}>Set a location above to filter by distance.</Text>
            ) : null}
            <View style={styles.chipWrap}>
              {DISTANCE_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  active={filters.radiusKm === option.value}
                  disabled={!hasLocation && option.value != null}
                  onPress={() => set({ radiusKm: option.value })}
                />
              ))}
            </View>

            <Text style={styles.label}>Sort by</Text>
            <View style={styles.chipWrap}>
              {SORT_OPTIONS.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  active={filters.sort === option.key}
                  disabled={option.needsLocation && !hasLocation}
                  onPress={() => set({ sort: option.key as SortKey })}
                />
              ))}
            </View>
          </ScrollView>

          <Pressable style={styles.applyBtn} onPress={onClose}>
            <Text style={styles.applyText}>
              Show {resultCount} {resultCount === 1 ? "result" : "results"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "600", color: colors.text },
  reset: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  scroll: { paddingVertical: 8, gap: 4 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 14,
    marginBottom: 8,
  },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 13, fontWeight: "500", color: colors.text },
  chipTextActive: { color: colors.white },
  chipTextDisabled: { color: colors.textMuted },
  applyBtn: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { color: colors.white, fontSize: 15, fontWeight: "600" },
});
