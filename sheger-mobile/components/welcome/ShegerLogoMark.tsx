import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";

export function ShegerLogoMark() {
  return (
    <View style={styles.ring}>
      <View style={styles.inner}>
        <Text style={styles.letter}>S</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  inner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  letter: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.primary,
    marginTop: -2,
  },
});
