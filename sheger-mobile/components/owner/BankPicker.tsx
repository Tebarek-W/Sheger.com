import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius } from "@/constants/theme";
import type { ChapaBank } from "@/lib/api/payout";

type BankPickerProps = {
  banks: ChapaBank[];
  value: number | null;
  onChange: (bankCode: number) => void;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
};

export function BankPicker({
  banks,
  value,
  onChange,
  label,
  placeholder,
  searchPlaceholder,
  disabled = false,
}: BankPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => banks.find((bank) => bank.id === value) ?? null,
    [banks, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return banks;
    return banks.filter((bank) => bank.name.toLowerCase().includes(needle));
  }, [banks, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const pick = (bank: ChapaBank) => {
    onChange(bank.id);
    close();
  };

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled || banks.length === 0}
        style={[styles.field, disabled && styles.fieldDisabled]}
      >
        <Text style={[styles.fieldText, !selected && styles.placeholder]}>
          {selected?.name ?? placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTouch} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{label}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              style={styles.search}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.id === value;
                return (
                  <Pressable
                    onPress={() => pick(item)}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>No banks match your search.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  field: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldDisabled: { opacity: 0.6 },
  fieldText: { flex: 1, fontSize: 15, color: colors.text },
  placeholder: { color: colors.textMuted },
  chevron: { fontSize: 16, color: colors.textMuted, marginLeft: 8 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  backdropTouch: { flex: 1 },
  sheet: {
    maxHeight: "75%",
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primaryDarker,
    marginBottom: 12,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionActive: { backgroundColor: colors.primaryLight },
  optionText: { fontSize: 15, color: colors.text },
  optionTextActive: { color: colors.primaryDarker, fontWeight: "600" },
  empty: {
    textAlign: "center",
    color: colors.textMuted,
    paddingVertical: 24,
    fontSize: 14,
  },
});
