// Deletes or cancels an organizer's own event, depending on whether
// any tickets have actually been paid for:
// - Zero paid tickets: hard delete. Cascades to ticket_tiers and any
//   lingering pending/failed reservations via the existing FKs.
// - One or more paid tickets: refund every paid ticket via Paystack
//   (grouped by payment_reference, since one payment can cover several
//   ticket rows), mark them 'refunded', and stamp the event
//   cancelled_at instead of deleting it — the record has to survive
//   for buyers' purchase history and dispute evidence.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { event_id } = await req.json();
    if (!event_id) return json({ error: "event_id is required" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: event, error: eventErr } = await admin
      .from("events").select("id, organizer_id, cancelled_at").eq("id", event_id).maybeSingle();
    if (eventErr) return json({ error: eventErr.message }, 500);
    if (!event) return json({ error: "Event not found" }, 404);
    if (event.organizer_id !== user.id) return json({ error: "Not your event" }, 403);
    if (event.cancelled_at) return json({ error: "This event is already cancelled" }, 409);

    const { data: tiers, error: tiersErr } = await admin
      .from("ticket_tiers").select("id").eq("event_id", event_id);
    if (tiersErr) return json({ error: tiersErr.message }, 500);
    const tierIds = (tiers ?? []).map((t) => t.id);

    const { data: paidTickets, error: ticketsErr } = tierIds.length
      ? await admin.from("tickets").select("id, payment_reference").in("tier_id", tierIds).eq("status", "paid")
      : { data: [] as { id: string; payment_reference: string | null }[], error: null };
    if (ticketsErr) return json({ error: ticketsErr.message }, 500);

    // ---- nothing sold: hard delete ----
    if (!paidTickets || paidTickets.length === 0) {
      const { error: delErr } = await admin.from("events").delete().eq("id", event_id);
      if (delErr) return json({ error: delErr.message }, 500);
      return json({ action: "deleted" });
    }

    // ---- tickets sold: refund each, then cancel (never delete) ----
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack is not configured on the server" }, 500);

    const ticketIdsByReference = new Map<string, string[]>();
    for (const t of paidTickets) {
      if (!t.payment_reference) continue; // free ticket — nothing to refund via Paystack
      const list = ticketIdsByReference.get(t.payment_reference) ?? [];
      list.push(t.id);
      ticketIdsByReference.set(t.payment_reference, list);
    }

    const failedRefunds: string[] = [];
    for (const reference of ticketIdsByReference.keys()) {
      const refundRes = await fetch("https://api.paystack.co/refund", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: reference }),
      });
      const refundJson = await refundRes.json().catch(() => null);
      if (!refundJson?.status) failedRefunds.push(reference);
    }

    const allTicketIds = paidTickets.map((t) => t.id);
    const { error: updTicketsErr } = await admin.from("tickets").update({ status: "refunded" }).in("id", allTicketIds);
    if (updTicketsErr) return json({ error: updTicketsErr.message }, 500);

    const { error: updEventErr } = await admin.from("events").update({ cancelled_at: new Date().toISOString() }).eq("id", event_id);
    if (updEventErr) return json({ error: updEventErr.message }, 500);

    return json({
      action: "cancelled",
      refunded_count: allTicketIds.length,
      failed_refunds: failedRefunds,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
