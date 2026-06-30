import { readSupabaseFunctionError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export type ChapaBank = {
  id: number;
  name: string;
  slug?: string;
};

export type BusinessPayoutAccount = {
  business_id: string;
  chapa_subaccount_id: string;
  bank_code: number;
  account_number: string;
  account_name: string;
  business_name: string | null;
  split_type: string;
  split_value: number;
  status: string;
  updated_at: string;
};

type BanksResponse = {
  banks?: ChapaBank[];
  error?: string;
};

type SubaccountResponse = {
  ok?: boolean;
  subaccount?: BusinessPayoutAccount;
  commission_rate?: number;
  error?: string;
};

export async function fetchChapaBanks(): Promise<ChapaBank[]> {
  const { data, error } = await supabase.functions.invoke<BanksResponse>("chapa-banks", {
    method: "POST",
    body: {},
  });

  if (error) {
    await readSupabaseFunctionError(data, error);
  }

  if (!data?.banks || data.banks.length === 0) {
    throw new Error(data?.error ?? "No Chapa banks are available right now.");
  }

  return data.banks;
}

export async function fetchBusinessPayoutAccount(
  businessId: string,
): Promise<BusinessPayoutAccount | null> {
  const { data, error } = await supabase
    .from("business_chapa_subaccounts")
    .select(
      "business_id, chapa_subaccount_id, bank_code, account_number, account_name, business_name, split_type, split_value, status, updated_at",
    )
    .eq("business_id", businessId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data as BusinessPayoutAccount | null;
}

export async function fetchBusinessCommissionRate(businessId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_business_commission_rate", {
    p_business_id: businessId,
  });

  if (error) throw error;
  return Number(data ?? 0);
}

export async function saveBusinessPayoutAccount(input: {
  businessId: string;
  bankCode: number;
  accountNumber: string;
  accountName: string;
}) {
  const { data, error } = await supabase.functions.invoke<SubaccountResponse>(
    "chapa-subaccount",
    { body: input },
  );

  if (error || !data?.ok || !data.subaccount) {
    await readSupabaseFunctionError(data, error);
  }

  return data!;
}

export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}

export function formatCommissionRate(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}
