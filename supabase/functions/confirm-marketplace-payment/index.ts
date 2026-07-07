// Confirms a 'pending' marketplace order after checkout. Takes only
// order_id — the payment reference is read from the row itself (stored
// server-side at init time by init-marketplace-payment), never accepted
// from the client, so a successful payment can't be replayed to confirm
// a different order at the same price.
//
// Stock is decremented and the sales ledger entry is recorded HERE, at
// payment time, not at "Complete" — otherwise two buyers could both pay
// for the last unit before either completes. If the stock re-check
// fails after Paystack has already captured the money, this refunds
// automatically rather than ever leaving a paid-but-unfulfillable order.
// "Complete" remains a pure fulfillment acknowledgment for paid orders.
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
    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id is required" }, 400);

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

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, buyer_id, product_id, shop_id, qty, payment_status, payment_reference, total, unit_price")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr) return json({ error: orderErr.message }, 500);
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.buyer_id !== user.id) return json({ error: "Not your order" }, 403);
    if (order.payment_status !== "pending") return json({ error: "Order already processed" }, 409);
    if (!order.payment_reference) return json({ error: "No payment was started for this order" }, 400);

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(order.payment_reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    );
    const verifyJson = await verifyRes.json();

    // defense in depth: confirm the split actually landed on the right
    // vendor's subaccount, not just that the total amount matches
    const { data: business } = await admin
      .from("businesses").select("owner_id").eq("id", order.shop_id).maybeSingle();
    const { data: payout } = business
      ? await admin.from("payout_accounts").select("paystack_subaccount_code").eq("profile_id", business.owner_id).maybeSingle()
      : { data: null };

    const isValid = verifyJson?.status === true
      && verifyJson?.data?.status === "success"
      && verifyJson?.data?.amount === order.total * 100
      && (!payout || verifyJson?.data?.subaccount?.subaccount_code === payout.paystack_subaccount_code);

    if (!isValid) {
      await admin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      return json({ error: "Payment verification failed", details: verifyJson?.data?.gateway_response }, 402);
    }

    // Money is now confirmed captured. Re-check stock right before
    // decrementing — if this fails, refund automatically.
    const { data: product, error: productErr } = await admin
      .from("products").select("id, name, cost, stock").eq("id", order.product_id).maybeSingle();
    if (productErr || !product) return json({ error: "Product no longer exists" }, 500);

    if (product.stock < order.qty) {
      const refundRes = await fetch("https://api.paystack.co/refund", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: order.payment_reference }),
      });
      const refundJson = await refundRes.json().catch(() => null);
      const refunded = refundJson?.status === true;
      await admin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      return json({
        error: refunded
          ? "Sorry — this item just sold out. Your payment has been refunded automatically."
          : "Sorry — this item just sold out. We couldn't confirm an automatic refund — please contact support with your payment reference.",
        payment_reference: order.payment_reference,
        refunded,
      }, 409);
    }

    const newStock = product.stock - order.qty;
    const { error: stockErr } = await admin.from("products").update({ stock: newStock }).eq("id", product.id);
    if (stockErr) return json({ error: stockErr.message }, 500);

    const unitCost = product.cost ?? 0;
    const saleTotal = order.unit_price * order.qty;
    const saleProfit = (order.unit_price - unitCost) * order.qty;
    await admin.from("sales").insert({
      shop_id: order.shop_id, product_id: product.id, qty: order.qty,
      unit_price: order.unit_price, unit_cost: unitCost, total: saleTotal, profit: saleProfit,
    });

    const { error: updErr } = await admin
      .from("orders")
      .update({ payment_status: "paid", payment_reference: order.payment_reference })
      .eq("id", order.id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ status: "paid" });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
