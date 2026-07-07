// Vendor/organizer payout onboarding: validates the bank account with
// Paystack (catches typos before any money is at risk), creates a
// Paystack subaccount, and upserts the payout_accounts row — all in one
// step, so a row only ever exists once it's fully usable.
//
// Re-submitting (e.g. to change bank details) creates a NEW Paystack
// subaccount and replaces the stored code; the old subaccount is simply
// left unused on Paystack's side (harmless — no ongoing cost).
//
// Deploy via the Supabase Dashboard (Edge Functions -> Create a new
// function -> paste this file). Requires the PAYSTACK_SECRET_KEY secret
// (already set from Phase 3) — no new secrets needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { business_name, bank_code, bank_name, account_number } = await req.json();
    if (!business_name || !bank_code || !bank_name || !account_number) {
      return json({ error: "business_name, bank_code, bank_name, and account_number are required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack is not configured on the server" }, 500);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // resolve the account first — confirms it's real and gets the
    // account holder's name back, so the UI can show "Is this you?"
    // before anything is created
    const resolveRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(bank_code)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    );
    const resolveJson = await resolveRes.json();
    if (!resolveJson?.status || !resolveJson?.data?.account_name) {
      return json({ error: resolveJson?.message || "Couldn't verify that bank account. Check the details and try again." }, 400);
    }
    const accountName = resolveJson.data.account_name;

    // percentage_charge is Paystack's fallback split if a transaction
    // ever omits transaction_charge — we always pass transaction_charge
    // explicitly, so this is only a safety net. Set to 100 (subaccount
    // keeps everything) so a bug here would cost us our fee once rather
    // than ever shortchange a vendor's payout.
    const subRes = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        business_name, settlement_bank: bank_code, account_number, percentage_charge: 100,
      }),
    });
    const subJson = await subRes.json();
    if (!subJson?.status || !subJson?.data?.subaccount_code) {
      return json({ error: subJson?.message || "Couldn't create your payout account with Paystack." }, 502);
    }

    const { data: row, error: upsertErr } = await admin
      .from("payout_accounts")
      .upsert({
        profile_id: user.id,
        business_name, bank_code, bank_name, account_number,
        account_name: accountName,
        paystack_subaccount_code: subJson.data.subaccount_code,
        updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id" })
      .select()
      .single();
    if (upsertErr) return json({ error: upsertErr.message }, 500);

    return json({
      business_name: row.business_name, bank_name: row.bank_name,
      account_number: row.account_number, account_name: row.account_name,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
