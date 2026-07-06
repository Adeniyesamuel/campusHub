/* ==========================================================
   CampusHub — Supabase client
   Project URL + anon (publishable) key are safe to expose
   client-side — they only grant what Row Level Security
   policies on the database allow.
   ========================================================== */

"use strict";

const SUPABASE_URL = "https://tiqubxxtthtbbivwfdvz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_owMigWTOBc4lR4c6nJSBlA_USCirao5";

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
