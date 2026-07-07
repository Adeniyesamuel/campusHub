// Starts a "Buy now" marketplace purchase. Computes the split
// server-side from trusted DB data (never the client), reserves a
// 'pending' order row with the reference already attached, and
// initializes the transaction with Paystack — returning only an
// access_code. The client calls PaystackPop.resumeTransaction(access_code)
// so it never sees or sets amount/subaccount/transaction_charge itself.
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
    const { listing_id, qty } = await req.json();
    if (!listing_id || !(qty > 0)) return json({ error: "listing_id and a valid qty are required" }, 400);

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

    const { data: listing, error: listingErr } = await admin
      .from("listings").select("id, seller_id, product_id").eq("id", listing_id).maybeSingle();
    if (listingErr) return json({ error: listingErr.message }, 500);
    if (!listing || !listing.product_id) return json({ error: "This listing can't be bought directly" }, 400);
    if (listing.seller_id === user.id) return json({ error: "You can't buy your own listing" }, 400);

    const { data: product, error: productErr } = await admin
      .from("products").select("id, shop_id, price, stock").eq("id", listing.product_id).maybeSingle();
    if (productErr || !product) return json({ error: "Product not found" }, 404);
    if (product.stock < qty) return json({ error: "Not enough stock available" }, 409);

    const { data: payout, error: payoutErr } = await admin
      .from("payout_accounts").select("paystack_subaccount_code").eq("profile_id", listing.seller_id).maybeSingle();
    if (payoutErr) return json({ error: payoutErr.message }, 500);
    if (!payout) return json({ error: "This vendor hasn't set up payouts yet" }, 409);

    const { data: feeRow, error: feeErr } = await admin
      .from("platform_fees").select("percent, min_fee").eq("key", "marketplace").maybeSingle();
    if (feeErr || !feeRow) return json({ error: "Fee configuration missing" }, 500);

    const unitPrice = product.price;
    const itemTotal = unitPrice * qty;
    const platformFee = Math.max(Math.round(itemTotal * (feeRow.percent / 100)), feeRow.min_fee);
    const base = itemTotal + platformFee;
    const { total, paystackFeeEstimate } = grossUpForPaystackFee(base);
    const transactionCharge = platformFee + paystackFeeEstimate;

    const reference = "CH-MKT-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        shop_id: product.shop_id, product_id: product.id, buyer_id: user.id, qty,
        payment_status: "pending", unit_price: unitPrice, platform_fee: platformFee,
        total, payment_reference: reference,
      })
      .select()
      .single();
    if (orderErr) return json({ error: orderErr.message }, 500);

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email, amount: total * 100, reference,
        subaccount: payout.paystack_subaccount_code,
        transaction_charge: transactionCharge * 100,
        metadata: { order_id: order.id, kind: "marketplace_order" },
      }),
    });
    const initJson = await initRes.json();
    if (!initJson?.status) {
      await admin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      return json({ error: initJson?.message || "Couldn't start payment" }, 502);
    }

    return json({ order_id: order.id, access_code: initJson.data.access_code, total });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
