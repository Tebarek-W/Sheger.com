import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";

// Matches home tab header: padding + greeting row + search bar + padding.
const HOME_HEADER_ROW_HEIGHT = 36;
const HOME_HEADER_ROW_GAP = 16;
const HOME_HEADER_SEARCH_HEIGHT = 44;
const HOME_HEADER_PADDING_TOP = 8;
const HOME_HEADER_PADDING_BOTTOM = 24;

export const CUSTOMER_TAB_HEADER_MIN_HEIGHT =
  HOME_HEADER_PADDING_TOP +
  HOME_HEADER_PADDING_BOTTOM +
  HOME_HEADER_ROW_GAP +
  HOME_HEADER_ROW_HEIGHT +
  HOME_HEADER_SEARCH_HEIGHT;

export const customerTabHeaderContainerStyle = {
  backgroundColor: colors.brandDark,
  paddingHorizontal: 20,
  paddingTop: HOME_HEADER_PADDING_TOP,
  paddingBottom: HOME_HEADER_PADDING_BOTTOM,
  borderBottomLeftRadius: 28,
  borderBottomRightRadius: 28,
} as const;

type CustomerTabTitleHeaderProps = {
  title: string;
  subtitle?: string;
};

export function CustomerTabTitleHeader({ title, subtitle }: CustomerTabTitleHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.fill} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...customerTabHeaderContainerStyle,
    minHeight: CUSTOMER_TAB_HEADER_MIN_HEIGHT,
  },
  textBlock: { flexShrink: 0 },
  title: { fontSize: 22, fontWeight: "500", color: colors.white },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4, lineHeight: 18 },
  fill: { flex: 1, minHeight: 0 },
});
