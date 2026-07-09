// Lets a ticket holder self-serve a refund for their own paid ticket
// after the organizer reschedules the event, within a 72-hour window of
// the reschedule notification. Unlike cancel-event (which refunds every
// ticket on the event), this refunds exactly one ticket row: a partial
// Paystack refund for just that row's amount, so it doesn't disturb
// other rows that might share the same payment_reference (a buyer who
// checked out multiple tiers/tickets in one purchase).
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

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ticket_id } = await req.json();
    if (!ticket_id) return json({ error: "ticket_id is required" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: ticket, error: ticketErr } = await admin
      .from("tickets")
      .select("id, buyer_id, status, total, payment_reference, tier_id, ticket_tiers(event_id, events(rescheduled_at, cancelled_at))")
      .eq("id", ticket_id)
      .maybeSingle();
    if (ticketErr) return json({ error: ticketErr.message }, 500);
    if (!ticket) return json({ error: "Ticket not found" }, 404);
    if (ticket.buyer_id !== user.id) return json({ error: "Not your ticket" }, 403);
    if (ticket.status !== "paid") return json({ error: "Only paid tickets can be refunded" }, 409);

    const event = (ticket as any).ticket_tiers?.events;
    if (!event) return json({ error: "Event not found" }, 404);
    if (event.cancelled_at) return json({ error: "This event was cancelled — it's already been refunded" }, 409);
    if (!event.rescheduled_at) return json({ error: "This event hasn't been rescheduled" }, 409);

    const rescheduledAtMs = new Date(event.rescheduled_at).getTime();
    if (Date.now() - rescheduledAtMs > SEVENTY_TWO_HOURS_MS) {
      return json({ error: "The 72-hour refund window for this reschedule has passed" }, 409);
    }

    if (ticket.payment_reference && ticket.total > 0) {
      const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack is not configured on the server" }, 500);
      const refundRes = await fetch("https://api.paystack.co/refund", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: ticket.payment_reference, amount: ticket.total * 100 }),
      });
      const refundJson = await refundRes.json().catch(() => null);
      if (!refundJson?.status) return json({ error: refundJson?.message || "Refund failed" }, 502);
    }

    const { error: updErr } = await admin.from("tickets").update({ status: "refunded" }).eq("id", ticket_id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ action: "refunded" });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
