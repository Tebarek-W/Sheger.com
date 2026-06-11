import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchCategories } from "@/lib/api/categories";
import { getSupabaseDiagnostics, isSupabaseConfigured } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";

export default function WelcomeScreen() {
  const diagnostics = getSupabaseDiagnostics();
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    retry: false,
  });

  const isConfigured = isSupabaseConfigured();
  const errorMessage = getErrorMessage(error);
  const isMissingTable =
    errorMessage.includes("relation") ||
    errorMessage.includes("does not exist") ||
    errorMessage.includes("PGRST205");
  const isHttpError = errorMessage.includes("Supabase HTTP");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.brand}>Sheger</Text>
      <Text style={styles.tagline}>
        Book salons, spas, clinics, and more in Ethiopia
      </Text>

      {!isConfigured ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Setup required</Text>
          <Text style={styles.cardText}>
            Copy .env.example to .env and add your Supabase URL and key.
          </Text>
          <Text style={styles.errorDetail}>
            Config source: {diagnostics.source}
          </Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator size="large" color="#0f766e" />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isMissingTable
              ? "Database not ready"
              : isHttpError
                ? "Supabase rejected the request"
                : "Could not reach Supabase"}
          </Text>
          <Text style={styles.cardText}>
            {isMissingTable
              ? "Run the SQL migration and seed.sql in your Supabase SQL Editor."
              : isHttpError
                ? "Check your API key in .env — the URL is reachable but auth failed."
                : diagnostics.source === "placeholder/missing"
                  ? "Your .env still has placeholder values. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then run npm run start:clear."
                  : `Supabase is reachable if your browser shows {"error":"requested path is invalid"} at https://${diagnostics.urlHost}`}
          </Text>
          {__DEV__ && (
            <>
              <Text style={styles.errorDetail}>{errorMessage}</Text>
              <Text style={styles.errorDetail}>
                Host: {diagnostics.urlHost}
              </Text>
              <Text style={styles.errorDetail}>
                Key: {diagnostics.keyPrefix} ({diagnostics.source})
              </Text>
            </>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connected</Text>
          <Text style={styles.cardText}>
            {categories?.length ?? 0} service categories loaded from Supabase.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  brand: {
    fontSize: 42,
    fontWeight: "700",
    color: "#0f766e",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: "#334155",
    textAlign: "center",
    marginBottom: 32,
    maxWidth: 300,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#ccfbf1",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  errorDetail: {
    marginTop: 12,
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 16,
  },
});
