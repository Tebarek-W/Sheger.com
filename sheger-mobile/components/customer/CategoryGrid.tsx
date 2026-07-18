import { Pressable, StyleSheet, Text, View } from "react-native";

import { getCategoryIcon, getCategoryTheme } from "@/constants/categories";
import { colors, radius, shadows } from "@/constants/theme";
import type { Category } from "@/lib/types/database";
import { formatCategoryDisplayName } from "@/lib/text/formatCategoryName";

type CategoryItem = Pick<Category, "id" | "name" | "slug">;

type CategoryGridProps = {
  categories: CategoryItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function CategoryGrid({ categories, selectedId, onSelect }: CategoryGridProps) {
  return (
    <View style={styles.grid}>
      {categories.map((cat, index) => {
        const theme = getCategoryTheme(index);
        const active = selectedId === cat.id;
        return (
          <Pressable
            key={cat.id}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => onSelect(active ? null : cat.id)}
          >
            <View
              style={[
                styles.icon,
                shadows.sm,
                { backgroundColor: theme.bg },
                active && styles.iconActive,
              ]}
            >
              <Text style={[styles.iconText, { color: theme.icon }]}>
                {getCategoryIcon(cat.slug)}
              </Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
              {formatCategoryDisplayName(cat.name)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
  },
  item: {
    width: "25%",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  itemPressed: {
    transform: [{ scale: 0.93 }],
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActive: {
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  iconText: { fontSize: 24 },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 14,
  },
  labelActive: { color: colors.primary, fontWeight: "600" },
});
