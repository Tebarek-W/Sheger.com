import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { fetchCategories } from "@/lib/api/categories";
import { createBusiness } from "@/lib/api/owner";
import { getErrorMessage } from "@/lib/errors";

export default function RegisterBusinessScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Addis Ababa");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createBusiness({
        ownerId: user!.id,
        categoryId: categoryId!,
        name,
        description,
        address,
        city,
        phone,
        email,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-businesses"] });
      Alert.alert(
        "Business submitted",
        "Your business is pending admin approval. You can set up services and hours now.",
        [{ text: "OK", onPress: () => router.replace("/(owner)/dashboard") }],
      );
    },
    onError: (error) => {
      Alert.alert("Could not register", getErrorMessage(error));
    },
  });

  const onSubmit = () => {
    if (!name || !categoryId) {
      Alert.alert("Missing fields", "Enter a business name and select a category.");
      return;
    }
    mutation.mutate();
  };

  return (
    <Screen scroll>
      <Header
        title="Register business"
        subtitle="Submit your business for admin approval"
        showBack
      />

      <View style={styles.form}>
        <Input label="Business name" value={name} onChangeText={setName} placeholder="e.g. Bole Premium Barbers" />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What do you offer?"
          multiline
        />
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {categories?.map((cat) => {
            const active = categoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategoryId(cat.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Input label="Address" value={address} onChangeText={setAddress} placeholder="Street, area" />
        <Input label="City" value={city} onChangeText={setCity} />
        <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+251..." keyboardType="phone-pad" />
        <Input
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button title="Submit for approval" onPress={onSubmit} loading={mutation.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: "600", color: colors.primaryDarker },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.primaryDarker, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.white },
});
