/* ==========================================================
   CampusHub — Supabase client
   Project URL + anon (publishable) key are safe to expose
   client-side — they only grant what Row Level Security
   policies on the database allow.
   ========================================================== */

"use strict";

const SUPABASE_URL = "https://tiqubxxtthtbbivwfdvz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_owMigWTOBc4lR4c6nJSBlA_USCirao5";
// Paystack's public key is no longer used client-side at all — every
// payment is initialized server-side (init-ticket-payment /
// init-marketplace-payment) and resumed via an access_code, which
// doesn't require the public key on this end.

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- auth ---------- */
const sbSignUp = (email, password) => sb.auth.signUp({ email, password });
const sbSignIn = (email, password) => sb.auth.signInWithPassword({ email, password });
const sbSignOut = () => sb.auth.signOut();
const sbGetSession = async () => (await sb.auth.getSession()).data.session;

/* ---------- profiles + businesses ---------- */
const sbGetProfile = (userId) => sb.from("profiles").select().eq("id", userId).maybeSingle();
const sbInsertProfile = (row) => sb.from("profiles").insert(row);
const sbGetBusiness = (ownerId) => sb.from("businesses").select().eq("owner_id", ownerId).maybeSingle();
const sbInsertBusiness = (row) => sb.from("businesses").insert(row).select().single();

/* ---------- listings (marketplace) ---------- */
const sbGetListings = () =>
  sb.from("listings").select("*, seller:profiles!seller_id(name)").eq("status", "active").order("created_at", { ascending: false });
const sbInsertListing = (row) => sb.from("listings").insert(row).select().single();
const sbDeleteListingsByProduct = (productId) => sb.from("listings").delete().eq("product_id", productId);

/* ---------- products (vendor inventory) ---------- */
const sbGetProducts = (shopId) => sb.from("products").select().eq("shop_id", shopId).order("created_at", { ascending: false });
const sbInsertProduct = (row) => sb.from("products").insert(row).select().single();
const sbUpdateProduct = (id, patch) => sb.from("products").update(patch).eq("id", id);

/* ---------- shop reviews + follows ---------- */
const sbGetShopReviews = (shopId) =>
  sb.from("shop_reviews").select("*, reviewer:profiles!reviewer_id(name)").eq("shop_id", shopId).order("created_at", { ascending: false });
const sbGetFollowerCount = (shopId) =>
  sb.from("shop_follows").select("*", { count: "exact", head: true }).eq("shop_id", shopId);
const sbIsFollowing = (shopId, userId) =>
  sb.from("shop_follows").select().eq("shop_id", shopId).eq("follower_id", userId).maybeSingle();
const sbFollowShop = (shopId, userId) => sb.from("shop_follows").insert({ shop_id: shopId, follower_id: userId });
const sbUnfollowShop = (shopId, userId) =>
  sb.from("shop_follows").delete().eq("shop_id", shopId).eq("follower_id", userId);

/* ---------- orders + sales ---------- */
const sbGetShopOrders = (shopId) =>
  sb.from("orders").select("*, buyer:profiles!buyer_id(name)").eq("shop_id", shopId).order("created_at", { ascending: false });
const sbInsertOrder = (row) => sb.from("orders").insert(row);
const sbCompleteOrder = (orderId) => sb.from("orders").update({ status: "completed" }).eq("id", orderId);
const sbGetSales = (shopId) => sb.from("sales").select().eq("shop_id", shopId).order("created_at", { ascending: false });
const sbInsertSale = (row) => sb.from("sales").insert(row).select().single();
const sbGetPublicSalesCount = (shopId) => sb.rpc("get_shop_sales_count", { target_shop_id: shopId });

/* ---------- configurable platform fees ---------- */
const sbGetPlatformFees = () => sb.from("platform_fees").select();

/* ---------- events + tickets ---------- */
const sbGetEvents = () => sb.from("events").select("*, ticket_tiers(*)").order("starts_at", { ascending: true });
const sbInsertEvent = (row) => sb.from("events").insert(row).select().single();
const sbInsertTicketTiers = (rows) => sb.from("ticket_tiers").insert(rows).select();
const sbGetTierSoldCounts = () => sb.rpc("get_tier_sold_counts");
const sbGetMyTickets = (buyerId) =>
  sb.from("tickets").select("id, qty, total, code, used_at, ticket_tiers(name, price, events(title))").eq("buyer_id", buyerId).eq("status", "paid").order("created_at", { ascending: false });
const sbInsertTickets = (rows) => sb.from("tickets").insert(rows).select();
// reference is no longer accepted here — confirm-ticket reads the
// reference it stored itself at reservation time (see init-ticket-payment)
const sbConfirmTicket = (ticketIds) =>
  sb.functions.invoke("confirm-ticket", { body: { ticket_ids: ticketIds } });
const sbScanTicket = (code) => sb.functions.invoke("scan-ticket", { body: { code } });
const sbInitTicketPayment = (tierSelections) =>
  sb.functions.invoke("init-ticket-payment", { body: { tier_selections: tierSelections } });

/* ---------- payouts (vendors + event organizers) ---------- */
const sbGetPayoutAccount = (profileId) =>
  sb.from("payout_accounts").select().eq("profile_id", profileId).maybeSingle();
const sbListBanks = () => sb.functions.invoke("list-banks");
const sbCreatePayoutAccount = (payload) =>
  sb.functions.invoke("create-payout-account", { body: payload });

/* ---------- marketplace "Buy now" ---------- */
const sbInitMarketplacePayment = (listingId, qty) =>
  sb.functions.invoke("init-marketplace-payment", { body: { listing_id: listingId, qty } });
const sbConfirmMarketplacePayment = (orderId) =>
  sb.functions.invoke("confirm-marketplace-payment", { body: { order_id: orderId } });
