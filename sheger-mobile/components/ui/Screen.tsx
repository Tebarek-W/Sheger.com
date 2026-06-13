import { ScrollView, StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";

type ScreenProps = ViewProps & {
  scroll?: boolean;
  padded?: boolean;
  backgroundColor?: string;
};

export function Screen({
  children,
  scroll,
  padded = true,
  backgroundColor = colors.background,
  style,
  ...props
}: ScreenProps) {
  const content = (
    <View style={[padded && styles.padded, style]} {...props}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  padded: { flex: 1, padding: 20 },
});
