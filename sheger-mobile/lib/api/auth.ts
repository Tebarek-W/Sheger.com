import * as Linking from "expo-linking";

import { supabase } from "@/lib/supabase";
import { isValidEmail, normalizeEmail } from "@/lib/validation/contact";

/** Deep link target for password recovery emails. */
export function getPasswordResetRedirectUrl(): string {
  return Linking.createURL("reset-password");
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    throw new Error("INVALID_EMAIL");
  }

  const redirectTo = getPasswordResetRedirectUrl();
  if (__DEV__) {
    console.log(
      "[ABORA] Password reset redirectTo (add this exact URL in Supabase → Auth → Redirect URLs):",
      redirectTo,
    );
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const trimmed = password.trim();
  if (trimmed.length < 6) {
    throw new Error("PASSWORD_TOO_SHORT");
  }

  const { error } = await supabase.auth.updateUser({ password: trimmed });
  if (error) throw error;
}

/**
 * Creates a Supabase session from an auth redirect URL (recovery / magic link).
 * Supports PKCE `code` and implicit `access_token` + `refresh_token` params.
 */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const params = extractAuthParams(url);
  if (!params) return false;

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return true;
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return true;
  }

  return false;
}

export function isPasswordRecoveryUrl(url: string): boolean {
  const params = extractAuthParams(url);
  if (!params) return false;
  if (params.type === "recovery") return true;
  if (params.code || (params.access_token && params.refresh_token)) {
    return url.includes("reset-password");
  }
  return false;
}

function extractAuthParams(url: string): {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  type?: string;
} | null {
  if (!url) return null;

  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");

  const chunks: string[] = [];
  if (queryIndex >= 0) {
    const end = hashIndex > queryIndex ? hashIndex : url.length;
    chunks.push(url.slice(queryIndex + 1, end));
  }
  if (hashIndex >= 0) {
    chunks.push(url.slice(hashIndex + 1));
  }

  if (!chunks.length) return null;

  const params = new URLSearchParams(chunks.join("&"));
  return {
    code: params.get("code") ?? undefined,
    access_token: params.get("access_token") ?? undefined,
    refresh_token: params.get("refresh_token") ?? undefined,
    type: params.get("type") ?? undefined,
  };
}
