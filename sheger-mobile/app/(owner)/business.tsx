import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { LocationPicker } from "@/components/owner/LocationPicker";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { fetchCategories } from "@/lib/api/categories";
import { updateBusiness } from "@/lib/api/owner";
import { getErrorMessage } from "@/lib/errors";
import { isWithinEthiopia, type Coordinates } from "@/lib/location";
import { goBackSafely } from "@/lib/routing";

export default function EditBusinessScreen() {
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Addis Ababa");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coordinates | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  useEffect(() => {
    if (!business) return;
    setName(business.name);
    setDescription(business.description ?? "");
    setAddress(business.address ?? "");
    setCity(business.city ?? "Addis Ababa");
    setPhone(business.phone ?? "");
    setEmail(business.email ?? "");
    setCategoryId(business.category_id);
    if (business.latitude != null && business.longitude != null) {
      setCoords({ latitude: business.latitude, longitude: business.longitude });
    }
  }, [business]);

  const mutation = useMutation({
    mutationFn: () =>
      updateBusiness(business!.id, {
        categoryId: categoryId!,
        name,
        description,
        address,
        city,
        phone,
        email,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-businesses"] });
      Alert.alert("Saved", "Business profile updated.", [
        { text: "OK", onPress: () => goBackSafely("/(owner)/dashboard") },
      ]);
    },
    onError: (error) => Alert.alert("Error", getErrorMessage(error)),
  });

  const onSave = () => {
    if (!isWithinEthiopia(coords)) {
      Alert.alert(
        "Location required",
        "Set your business location so customers can find you in Nearby search.",
      );
      return;
    }
    mutation.mutate();
  };

  if (!business) {
    return (
      <Screen>
        <Header title="Business profile" showBack />
        <Text style={styles.muted}>Register a business first.</Text>
        <Button title="Register" onPress={() => router.push("/(owner)/register")} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title="Business profile" subtitle="Update your public listing" showBack />
      <View style={styles.form}>
        <Input label="Business name" value={name} onChangeText={setName} />
        <Input label="Description" value={description} onChangeText={setDescription} multiline />
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
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.locationSection}>
          <Text style={styles.label}>Business location</Text>
          <Text style={styles.sectionHint}>
            Required. Keep this accurate so you rank correctly in Nearby search.
          </Text>
          <LocationPicker
            value={coords}
            onChange={setCoords}
            onResolveAddress={(resolved) => {
              if (!address.trim()) setAddress(resolved);
            }}
          />
        </View>

        <Input label="Address (area / street)" value={address} onChangeText={setAddress} />
        <Input label="City" value={city} onChangeText={setCity} />
        <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <Button title="Save changes" onPress={onSave} loading={mutation.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: "600", color: colors.primaryDarker },
  sectionHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 16, marginTop: -8 },
  locationSection: { gap: 8 },
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
  muted: { color: colors.textMuted, marginBottom: 16 },
});
