// Starts a PAID ticket purchase (replaces the old direct client-side
// PaystackPop.setup call). Reserves 'pending' ticket row(s) with the
// Paystack reference already attached server-side, then initializes the
// transaction with the organizer's subaccount split — returning only an
// access_code for PaystackPop.resumeTransaction(access_code).
//
// Free tiers don't go through this function at all — the client still
// inserts a pending ticket directly and calls confirm-ticket with no
// reference, exactly as in Phase 3.
//
// Deploy via the Supabase Dashboard (Edge Functions -> Create a new
// function -> paste this file). Requires PAYSTACK_SECRET_KEY (already set).

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

// Paystack NG: 1.5% + ₦100, capped at ₦2,000, ₦100 waived under ₦2,500
// total. Solves for the total that fully covers its own Paystack fee.
function grossUpForPaystackFee(base: number): { total: number; paystackFeeEstimate: number } {
  let total = Math.ceil((base + 100) / 0.985);
  if (total < 2500) total = Math.ceil(base / 0.985);
  let fee = total - base;
  if (fee > 2000) { fee = 2000; total = base + fee; }
  return { total, paystackFeeEstimate: fee };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tier_selections } = await req.json();
    if (!Array.isArray(tier_selections) || !tier_selections.length) {
      return json({ error: "tier_selections is required" }, 400);
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

    const tierIds = tier_selections.map((t: any) => t.tier_id);
    const { data: tiers, error: tiersErr } = await admin
      .from("ticket_tiers")
      .select("id, price, event_id, events(organizer_id)")
      .in("id", tierIds);
    if (tiersErr) return json({ error: tiersErr.message }, 500);
    if (!tiers || tiers.length !== new Set(tierIds).size) {
      return json({ error: "One or more ticket tiers not found" }, 404);
    }

    // our checkout never mixes tiers from different events in one order
    const eventId = (tiers[0] as any).event_id;
    if (!tiers.every((t: any) => t.event_id === eventId)) {
      return json({ error: "Tiers must all belong to the same event" }, 400);
    }
    const organizerId = (tiers[0] as any).events?.organizer_id;

    const { data: payout, error: payoutErr } = await admin
      .from("payout_accounts").select("paystack_subaccount_code").eq("profile_id", organizerId).maybeSingle();
    if (payoutErr) return json({ error: payoutErr.message }, 500);
    if (!payout) return json({ error: "This organizer hasn't set up payouts yet" }, 409);

    const { data: feeRow, error: feeErr } = await admin
      .from("platform_fees").select("percent, min_fee").eq("key", "events").maybeSingle();
    if (feeErr || !feeRow) return json({ error: "Fee configuration missing" }, 500);

    const tierById = new Map((tiers as any[]).map((t) => [t.id, t]));
    let itemTotal = 0;
    const lines: { tier_id: string; qty: number; unitPrice: number }[] = [];
    for (const sel of tier_selections) {
      const tier = tierById.get(sel.tier_id);
      if (!tier || !(sel.qty > 0)) return json({ error: "Invalid tier selection" }, 400);
      itemTotal += tier.price * sel.qty;
      lines.push({ tier_id: tier.id, qty: sel.qty, unitPrice: tier.price });
    }
    if (itemTotal === 0) return json({ error: "Use the free ticket flow for ₦0 tiers" }, 400);

    const platformFee = Math.max(Math.round(itemTotal * (feeRow.percent / 100)), feeRow.min_fee);
    const base = itemTotal + platformFee;
    const { total, paystackFeeEstimate } = grossUpForPaystackFee(base);
    const transactionCharge = platformFee + paystackFeeEstimate;
    const grossUpRatio = total / base;

    const reference = "CH-TIX-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();

    // each line's proportional share of the grossed-up total — the last
    // line absorbs whatever rounding remainder is left so the lines
    // always sum EXACTLY to `total` (confirm-ticket checks that sum
    // against what Paystack actually charged, so it can't drift)
    const lineTotals = lines.map((l) => Math.round(l.unitPrice * l.qty * grossUpRatio));
    const roundedSoFar = lineTotals.slice(0, -1).reduce((s, v) => s + v, 0);
    lineTotals[lineTotals.length - 1] = total - roundedSoFar;

    const ticketRows = lines.map((l, i) => ({
      tier_id: l.tier_id, buyer_id: user.id, qty: l.qty,
      total: lineTotals[i],
      code: "CH-" + crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase(),
      status: "pending", payment_reference: reference,
    }));

    const { data: insertedTickets, error: insertErr } = await admin.from("tickets").insert(ticketRows).select();
    if (insertErr) return json({ error: insertErr.message }, 500);
    const ticketIds = insertedTickets.map((t: any) => t.id);

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email, amount: total * 100, reference,
        subaccount: payout.paystack_subaccount_code,
        transaction_charge: transactionCharge * 100,
        metadata: { ticket_ids: ticketIds, kind: "ticket_purchase" },
      }),
    });
    const initJson = await initRes.json();
    if (!initJson?.status) {
      await admin.from("tickets").update({ status: "failed" }).in("id", ticketIds);
      return json({ error: initJson?.message || "Couldn't start payment" }, 502);
    }

    return json({ ticket_ids: ticketIds, access_code: initJson.data.access_code, total });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
