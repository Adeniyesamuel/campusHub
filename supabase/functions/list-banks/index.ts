// Proxies Paystack's own bank list so the payout onboarding form always
// shows accurate, current bank codes — no hand-maintained/hardcoded list
// to go stale (fintech banks like Kuda/Opay/Moniepoint/PalmPay get added
// or renumbered more often than traditional banks).
//
// Public, read-only, no auth required — this is just reference data, not
// anything sensitive. Deploy via the Supabase Dashboard (Edge Functions
// -> Create a new function -> paste this file). Requires
// PAYSTACK_SECRET_KEY (already set) since Paystack's bank list endpoint
// needs an API key.

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
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack is not configured on the server" }, 500);

    const res = await fetch("https://api.paystack.co/bank?country=nigeria&currency=NGN", {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const resJson = await res.json();
    if (!resJson?.status) return json({ error: resJson?.message || "Couldn't load bank list" }, 502);

    const banks = (resJson.data || [])
      .map((b: any) => ({ name: b.name, code: b.code }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return json({ banks });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
