import { Pressable, StyleSheet, Text, View } from "react-native";

import { getCategoryIcon, getCategoryTheme } from "@/constants/categories";
import { colors, radius } from "@/constants/theme";
import type { Category } from "@/lib/types/database";

type CategoryItem = Pick<Category, "id" | "name" | "slug">;

type CategoryGridProps = {
  categories: CategoryItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function CategoryGrid({ categories, selectedId, onSelect }: CategoryGridProps) {
  const items = categories.slice(0, 8);

  return (
    <View style={styles.grid}>
      {items.map((cat, index) => {
        const theme = getCategoryTheme(index);
        const active = selectedId === cat.id;
        return (
          <Pressable
            key={cat.id}
            style={styles.item}
            onPress={() => onSelect(active ? null : cat.id)}
          >
            <View
              style={[
                styles.icon,
                { backgroundColor: theme.bg },
                active && styles.iconActive,
              ]}
            >
              <Text style={[styles.iconText, { color: theme.icon }]}>
                {getCategoryIcon(cat.slug)}
              </Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
              {cat.name}
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
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  iconText: { fontSize: 22 },
  label: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 13,
  },
  labelActive: { color: colors.primary, fontWeight: "600" },
});
