// Confirms one or more 'pending' tickets after checkout.
// - Free tickets (expected total = 0) are confirmed immediately, no Paystack call.
// - Paid tickets require a Paystack transaction `reference`, which is verified
//   server-side against the SECRET key before any ticket is marked 'paid'.
//
// The expected amount is recomputed here from ticket_tiers.price (trusted,
// since only an event's organizer can insert tiers) rather than trusting the
// `total` a client wrote when it reserved the ticket — a client could
// otherwise reserve a ticket with a lowballed `total` and only need to pay
// that much.
//
// Stock is checked against quantity_total - SUM(paid qty) per tier:
//   - Free tickets: checked once, before doing anything else. Nothing was
//     ever charged, so a rejection here needs no refund.
//   - Paid tickets: NOT checked until after Paystack verification succeeds.
//     This matters — Paystack's popup completes the charge on ITS side
//     before ever calling back into our code, so by the time this function
//     runs with a `reference` at all, the money is already captured
//     regardless of what we do next. Checking stock before verifying would
//     let a paid ticket get rejected with no refund attempted. So for paid
//     tickets there is exactly one check, placed right after verification
//     succeeds and right before marking 'paid' — and if it fails there,
//     we always call Paystack's refund API before marking the ticket
//     'failed'. A paid buyer should never end up with an invalid ticket.
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

const PLATFORM_FEE_RATE = 0.09;
const eventFee = (price: number) => (price > 0 ? Math.round(price * PLATFORM_FEE_RATE) : 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ticket_ids, reference } = await req.json();
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return json({ error: "ticket_ids is required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

    // identify the caller from their own JWT (forwarded by supabase-js)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    // service-role client bypasses RLS — this function IS the trusted writer
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: tickets, error: ticketsErr } = await admin
      .from("tickets")
      .select("id, qty, status, buyer_id, tier_id, ticket_tiers(price, quantity_total)")
      .in("id", ticket_ids);

    if (ticketsErr) return json({ error: ticketsErr.message }, 500);
    if (!tickets || tickets.length !== ticket_ids.length) {
      return json({ error: "One or more tickets not found" }, 404);
    }
    for (const t of tickets) {
      if (t.buyer_id !== user.id) return json({ error: "Not your ticket" }, 403);
      if (t.status !== "pending") return json({ error: "Ticket already processed" }, 409);
    }

    const expectedTotal = tickets.reduce((sum: number, t: any) => {
      const price = t.ticket_tiers?.price ?? 0;
      return sum + (price + eventFee(price)) * t.qty;
    }, 0);

    // requested qty + capacity per tier, for the stock check below
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
    if (expectedTotal === 0) {
      if (!(await hasEnoughStock())) {
        await markFailed();
        return json({ error: "Sorry, one of these ticket types just sold out." }, 409);
      }
      const { error: updErr } = await admin.from("tickets").update({ status: "paid" }).in("id", ticket_ids);
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ status: "paid", free: true });
    }

    // ---- paid tickets: verify with Paystack first — money is already
    // captured on Paystack's side by the time we're called with a
    // reference, regardless of what we find below ----
    if (!reference) return json({ error: "Payment reference required" }, 400);
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack is not configured on the server" }, 500);

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    );
    const verifyJson = await verifyRes.json();

    const isValid = verifyJson?.status === true
      && verifyJson?.data?.status === "success"
      && verifyJson?.data?.amount === expectedTotal * 100; // Paystack amounts are in kobo

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
      await markFailed({ payment_reference: reference });
      return json({
        error: refunded
          ? "Sorry — this ticket type sold out just as your payment completed. Your payment has been refunded automatically."
          : "Sorry — this ticket type sold out just as your payment completed. We couldn't confirm an automatic refund — please contact support with your payment reference.",
        payment_reference: reference,
        refunded,
      }, 409);
    }

    const { error: updErr } = await admin
      .from("tickets")
      .update({ status: "paid", payment_reference: reference })
      .in("id", ticket_ids);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ status: "paid", free: false });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
