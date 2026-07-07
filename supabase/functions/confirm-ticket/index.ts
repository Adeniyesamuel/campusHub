// Confirms one or more 'pending' tickets after checkout.
// - Free tickets (no payment_reference at all) are confirmed immediately,
//   no Paystack call — the client still inserts these directly, unchanged
//   from Phase 3.
// - Paid tickets were reserved by init-ticket-payment, which already
//   stored the Paystack reference on the rows AND locked in the amount/
//   subaccount/split server-side before the buyer ever saw the popup.
//   This function takes only ticket_ids — the reference is read from the
//   rows themselves, never accepted from the client. (Phase 3 originally
//   trusted a client-supplied reference here, which meant one successful
//   payment could be replayed to confirm a different same-priced ticket
//   reservation. Moving the reference server-side closes that.)
//
// Stock is checked against quantity_total - SUM(paid qty) per tier:
//   - Free tickets: checked once, before doing anything else. Nothing was
//     ever charged, so a rejection here needs no refund.
//   - Paid tickets: checked once, right after Paystack verification
//     succeeds and right before marking 'paid'. Money is already captured
//     by that point (Paystack completes the charge before ever calling
//     back into our code), so a failure here always triggers an
//     automatic refund rather than ever leaving a paid-but-invalid
//     ticket. A paid buyer should never be turned away at the door.
//
// Deploy via the Supabase Dashboard (Edge Functions -> Create a new function
// -> paste this file) or `supabase functions deploy confirm-ticket`.
// Requires the PAYSTACK_SECRET_KEY secret to be set (see project docs).

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
    const { ticket_ids } = await req.json();
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return json({ error: "ticket_ids is required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: tickets, error: ticketsErr } = await admin
      .from("tickets")
      .select("id, qty, status, buyer_id, tier_id, total, payment_reference, ticket_tiers(quantity_total)")
      .in("id", ticket_ids);

    if (ticketsErr) return json({ error: ticketsErr.message }, 500);
    if (!tickets || tickets.length !== ticket_ids.length) {
      return json({ error: "One or more tickets not found" }, 404);
    }
    for (const t of tickets) {
      if (t.buyer_id !== user.id) return json({ error: "Not your ticket" }, 403);
      if (t.status !== "pending") return json({ error: "Ticket already processed" }, 409);
    }

    const requestedByTier = new Map<string, number>();
    const tierCapacity = new Map<string, number>();
    for (const t of tickets as any[]) {
      requestedByTier.set(t.tier_id, (requestedByTier.get(t.tier_id) ?? 0) + t.qty);
      tierCapacity.set(t.tier_id, t.ticket_tiers?.quantity_total ?? 0);
    }

    async function hasEnoughStock(): Promise<boolean> {
      const tierIds = [...requestedByTier.keys()];
      const { data: paidRows, error: paidErr } = await admin
        .from("tickets")
        .select("tier_id, qty")
        .in("tier_id", tierIds)
        .eq("status", "paid");
      if (paidErr) throw paidErr;
      const soldByTier = new Map<string, number>();
      for (const row of paidRows ?? []) {
        soldByTier.set(row.tier_id, (soldByTier.get(row.tier_id) ?? 0) + row.qty);
      }
      for (const [tierId, requestedQty] of requestedByTier) {
        const sold = soldByTier.get(tierId) ?? 0;
        if (sold + requestedQty > (tierCapacity.get(tierId) ?? 0)) return false;
      }
      return true;
    }

    const markFailed = (extra: Record<string, unknown> = {}) =>
      admin.from("tickets").update({ status: "failed", ...extra }).in("id", ticket_ids);

    // ---- free tickets: nothing was ever charged, so check + reject is safe ----
    const isFree = (tickets as any[]).every((t) => !t.payment_reference);
    if (isFree) {
      if (!(await hasEnoughStock())) {
        await markFailed();
        return json({ error: "Sorry, one of these ticket types just sold out." }, 409);
      }
      const { error: updErr } = await admin.from("tickets").update({ status: "paid" }).in("id", ticket_ids);
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ status: "paid", free: true });
    }

    // ---- paid tickets: all rows in one confirm call must share the same
    // reference — that's the one init-ticket-payment stored on them ----
    const references = new Set((tickets as any[]).map((t) => t.payment_reference));
    if (references.size !== 1) return json({ error: "Tickets in this batch don't share one payment" }, 400);
    const reference = [...references][0] as string;

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack is not configured on the server" }, 500);

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    );
    const verifyJson = await verifyRes.json();

    // defense in depth: confirm the split actually landed on the right
    // organizer's subaccount, not just that the total amount matches
    const { data: eventRow } = await admin
      .from("ticket_tiers")
      .select("events(organizer_id)")
      .eq("id", (tickets as any[])[0].tier_id)
      .maybeSingle();
    const organizerId = (eventRow as any)?.events?.organizer_id;
    const { data: payout } = organizerId
      ? await admin.from("payout_accounts").select("paystack_subaccount_code").eq("profile_id", organizerId).maybeSingle()
      : { data: null };

    const expectedTotal = (tickets as any[]).reduce((s, t) => s + (t.total ?? 0), 0);
    const isValid = verifyJson?.status === true
      && verifyJson?.data?.status === "success"
      && verifyJson?.data?.amount === expectedTotal * 100 // Paystack amounts are in kobo
      && (!payout || verifyJson?.data?.subaccount?.subaccount_code === payout.paystack_subaccount_code);

    if (!isValid) {
      // Paystack itself says no valid successful charge exists for this
      // reference — nothing to refund.
      await markFailed();
      return json({ error: "Payment verification failed", details: verifyJson?.data?.gateway_response }, 402);
    }

    // Money is confirmed captured. This is the only stock check a paid
    // ticket ever gets, and a failure here always means a refund.
    if (!(await hasEnoughStock())) {
      const refundRes = await fetch("https://api.paystack.co/refund", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: reference }),
      });
      const refundJson = await refundRes.json().catch(() => null);
      const refunded = refundJson?.status === true;
      await markFailed();
      return json({
        error: refunded
          ? "Sorry — this ticket type sold out just as your payment completed. Your payment has been refunded automatically."
          : "Sorry — this ticket type sold out just as your payment completed. We couldn't confirm an automatic refund — please contact support with your payment reference.",
        payment_reference: reference,
        refunded,
      }, 409);
    }

    const { error: updErr } = await admin.from("tickets").update({ status: "paid" }).in("id", ticket_ids);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ status: "paid", free: false });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
