import { chapaCreateSubaccount } from "../_shared/chapa.ts";
import {
  adminClient,
  handleCors,
  jsonResponse,
  requireUser,
} from "../_shared/supabase.ts";

type SubaccountBody = {
  businessId?: string;
  bankCode?: number;
  accountNumber?: string;
  accountName?: string;
};

function cleanAccountNumber(value: string): string {
  return value.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { user } = await requireUser(req);
    const body = (await req.json()) as SubaccountBody;
    const businessId = body.businessId?.trim();
    const bankCode = Number(body.bankCode);
    const accountNumber = cleanAccountNumber(body.accountNumber?.trim() ?? "");
    const accountName = body.accountName?.trim() ?? "";

    if (!businessId) {
      return jsonResponse({ error: "businessId is required" }, 400);
    }
    if (!Number.isInteger(bankCode) || bankCode <= 0) {
      return jsonResponse({ error: "bankCode is required" }, 400);
    }
    if (!accountNumber || accountNumber.length < 5) {
      return jsonResponse({ error: "A valid account number is required" }, 400);
    }
    if (!accountName || accountName.length < 2) {
      return jsonResponse({ error: "accountName is required" }, 400);
    }

    const supabase = adminClient();

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, owner_id, name, status")
      .eq("id", businessId)
      .single();

    if (businessError) throw businessError;
    if (!business) return jsonResponse({ error: "Business not found" }, 404);
    if (business.owner_id !== user.id) {
      return jsonResponse({ error: "Not authorized for this business" }, 403);
    }
    if (business.status !== "approved") {
      return jsonResponse(
        { error: "Payout account can only be configured after business approval" },
        400,
      );
    }

    const { data: commissionRate, error: rateError } = await supabase.rpc(
      "get_business_commission_rate",
      { p_business_id: businessId },
    );
    if (rateError) throw rateError;

    const splitValue = Number(commissionRate);
    if (!Number.isFinite(splitValue) || splitValue < 0 || splitValue > 1) {
      return jsonResponse({ error: "Invalid commission rate for this business" }, 500);
    }

    const chapaResult = await chapaCreateSubaccount({
      account_name: accountName,
      bank_code: bankCode,
      account_number: accountNumber,
      business_name: business.name,
      split_type: "percentage",
      split_value: splitValue,
    });

    const { data: saved, error: upsertError } = await supabase
      .from("business_chapa_subaccounts")
      .upsert(
        {
          business_id: businessId,
          chapa_subaccount_id: chapaResult.id,
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: accountName,
          business_name: business.name,
          split_type: "percentage",
          split_value: splitValue,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" },
      )
      .select(
        "business_id, chapa_subaccount_id, bank_code, account_number, account_name, split_type, split_value, status, updated_at",
      )
      .single();

    if (upsertError) throw upsertError;

    return jsonResponse({
      ok: true,
      subaccount: saved,
      commission_rate: splitValue,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-subaccount:", message);
    return jsonResponse({ error: message }, 500);
  }
});
