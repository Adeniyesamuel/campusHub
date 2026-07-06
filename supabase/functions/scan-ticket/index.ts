// Organizer check-in: looks up a ticket by its scanned/typed code, verifies
// the caller organizes that ticket's event, and marks it used (one-time
// entry) if it's paid and not already used. tickets has no client update
// policy at all, so this — like confirm-ticket — is the only way used_at
// ever gets set.
//
// Deploy via the Supabase Dashboard (Edge Functions -> Create a new function
// -> paste this file) or `supabase functions deploy scan-ticket`. No new
// secrets needed beyond what's already set for confirm-ticket.

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
    const { code } = await req.json();
    if (!code || typeof code !== "string") return json({ error: "code is required" }, 400);

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
      .select(`
        id, qty, status, used_at, buyer_id,
        ticket_tiers ( name, event_id, events ( organizer_id, title ) ),
        buyer:profiles!buyer_id ( name )
      `)
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();

    if (ticketErr) return json({ error: ticketErr.message }, 500);
    if (!ticket) return json({ valid: false, reason: "not_found" });

    const tier = (ticket as any).ticket_tiers;
    const event = tier?.events;
    if (!event || event.organizer_id !== user.id) {
      return json({ error: "This ticket isn't for one of your events" }, 403);
    }

    const buyerName = (ticket as any).buyer?.name ?? "Buyer";
    const tierName = tier?.name ?? "Ticket";
    const eventTitle = event.title ?? "Event";

    if (ticket.status !== "paid") {
      return json({ valid: false, reason: "not_paid", buyer_name: buyerName, tier_name: tierName, event_title: eventTitle });
    }
    if (ticket.used_at) {
      return json({
        valid: false, reason: "already_used", used_at: ticket.used_at,
        buyer_name: buyerName, tier_name: tierName, event_title: eventTitle, qty: ticket.qty,
      });
    }

    const usedAt = new Date().toISOString();
    const { error: updErr } = await admin.from("tickets").update({ used_at: usedAt }).eq("id", ticket.id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({
      valid: true, used_at: usedAt,
      buyer_name: buyerName, tier_name: tierName, event_title: eventTitle, qty: ticket.qty,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
