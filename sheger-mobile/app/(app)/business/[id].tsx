import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { fetchBusinessById, fetchBusinessServices } from "@/lib/api/businesses";
import { promptLoginToBook, setBookingDraft } from "@/lib/auth-booking";

export default function BusinessProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const { data: business, isLoading } = useQuery({
    queryKey: ["business", id],
    queryFn: () => fetchBusinessById(id!),
    enabled: Boolean(id),
  });

  const { data: services } = useQuery({
    queryKey: ["services", id],
    queryFn: () => fetchBusinessServices(id!),
    enabled: Boolean(id),
  });

  const onBook = (serviceId: string) => {
    const service = services?.find((s) => s.id === serviceId);
    if (!business || !service) return;
    if (!session) {
      promptLoginToBook(business, service);
      return;
    }
    setBookingDraft(business, service);
    router.push("/(app)/book");
  };

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (!business) {
    return (
      <Screen>
        <Header title="Not found" showBack />
        <Text style={styles.muted}>This business is unavailable.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title={business.name} subtitle={business.description ?? "Book a service"} showBack />

      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>Verified on Sheger</Text>
        </View>
        <Text style={styles.address}>{business.address ?? business.city}</Text>
        {business.phone ? <Text style={styles.phone}>{business.phone}</Text> : null}
      </View>

      <Text style={styles.sectionTitle}>Services</Text>
      <View style={styles.list}>
        {services?.map((service) => (
          <View key={service.id} style={styles.serviceCard}>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceMeta}>
                {service.duration_minutes} min · {Number(service.price).toFixed(0)} ETB
              </Text>
              {service.description ? (
                <Text style={styles.serviceDesc}>{service.description}</Text>
              ) : null}
            </View>
            <Button title="Book" onPress={() => onBook(service.id)} />
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    marginBottom: 24,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroBadgeText: { color: colors.primaryDarker, fontWeight: "600", fontSize: 12 },
  address: { fontSize: 15, color: colors.textMuted },
  phone: { fontSize: 15, color: colors.primary, fontWeight: "600" },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.primaryDarker, marginBottom: 12 },
  list: { gap: 12 },
  serviceCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  serviceInfo: { gap: 4 },
  serviceName: { fontSize: 17, fontWeight: "700", color: colors.primaryDarker },
  serviceMeta: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  serviceDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  muted: { color: colors.textMuted },
});
