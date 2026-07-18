import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";

const SKYLINE = [28, 42, 36, 52, 38, 64, 48, 34, 56, 40, 30, 46];

export function WelcomeBackground() {
  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.gradientTop} />
      <View style={styles.gradientMid} />
      <View style={styles.sunGlow} />
      <View style={styles.horizonGlow} />

      <View style={styles.waveOne} />
      <View style={styles.waveTwo} />

      <View style={styles.skylineRow}>
        {SKYLINE.map((height, index) => (
          <View
            key={index}
            style={[
              styles.building,
              {
                height,
                opacity: 0.35 + (index % 3) * 0.12,
                marginTop: 64 - height,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brandDark,
    overflow: "hidden",
  },
  gradientTop: {
    position: "absolute",
    top: -80,
    left: -40,
    right: -40,
    height: "55%",
    backgroundColor: "#145214",
    opacity: 0.9,
    borderBottomLeftRadius: 180,
    borderBottomRightRadius: 180,
  },
  gradientMid: {
    position: "absolute",
    top: "30%",
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "#0a3d0a",
    opacity: 0.65,
  },
  sunGlow: {
    position: "absolute",
    bottom: 72,
    alignSelf: "center",
    width: 280,
    height: 140,
    borderRadius: 140,
    backgroundColor: "rgba(232, 184, 74, 0.28)",
  },
  horizonGlow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "rgba(212, 168, 83, 0.12)",
  },
  waveOne: {
    position: "absolute",
    top: "18%",
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  waveTwo: {
    position: "absolute",
    top: "42%",
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(110,232,110,0.06)",
  },
  skylineRow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  building: {
    flex: 1,
    marginHorizontal: 1,
    backgroundColor: "#062806",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});
