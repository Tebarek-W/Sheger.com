import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";

type ScreenProps = ViewProps & {
  scroll?: boolean;
  padded?: boolean;
  backgroundColor?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function Screen({
  children,
  scroll,
  padded = true,
  backgroundColor = colors.background,
  onRefresh,
  refreshing = false,
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
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            ) : undefined
          }
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
