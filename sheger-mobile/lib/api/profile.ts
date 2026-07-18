import { supabase } from "@/lib/supabase";
import {
  isValidEmail,
  isValidEthiopianMobile,
  normalizeEmail,
  normalizeEthiopianMobile,
} from "@/lib/validation/contact";

export type UpdateCustomerProfileInput = {
  fullName: string;
  phone: string;
  email: string;
};

export type UpdateCustomerProfileResult = {
  emailConfirmationRequired: boolean;
};

export async function updateCustomerProfile(
  input: UpdateCustomerProfileInput,
): Promise<UpdateCustomerProfileResult> {
  const fullName = input.fullName.trim();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizeEthiopianMobile(input.phone);

  if (!fullName) {
    throw new Error("Enter your full name.");
  }

  if (!isValidEmail(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }

  if (input.phone.trim() && !isValidEthiopianMobile(input.phone)) {
    throw new Error(
      "Enter a valid Ethiopian mobile number like 09xxxxxxxx, 07xxxxxxxx, or +2519xxxxxxxx.",
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Not signed in.");

  let emailConfirmationRequired = false;

  if (normalizedEmail !== normalizeEmail(user.email)) {
    const { error: emailError } = await supabase.auth.updateUser({
      email: normalizedEmail,
    });
    if (emailError) throw emailError;
    emailConfirmationRequired = true;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: normalizedPhone || null,
    })
    .eq("id", user.id);

  if (profileError) throw profileError;

  return { emailConfirmationRequired };
}
