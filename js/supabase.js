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

/* ---------- campus feed ---------- */
const sbGetFeed = () =>
  sb.from("feed_posts").select("*, author:profiles!author_id(name, role, vendor_type)").order("created_at", { ascending: false });
const sbInsertFeedPost = (row) => sb.from("feed_posts").insert(row);

/* ---------- lost & found ---------- */
const sbGetLostFound = () =>
  sb.from("lost_found_reports").select("*, reporter:profiles!reporter_id(name)").order("created_at", { ascending: false });
const sbInsertLostFound = (row) => sb.from("lost_found_reports").insert(row);

/* ---------- class info (announcements, timetable, exams) ---------- */
const sbGetAnnouncements = (level, dept) =>
  sb.from("announcements").select("*, author:profiles!author_id(name)").eq("level", level).eq("dept", dept).order("created_at", { ascending: false });
const sbInsertAnnouncement = (row) => sb.from("announcements").insert(row);

const sbGetTimetable = (level, dept) =>
  sb.from("timetable_entries").select().eq("level", level).eq("dept", dept).order("day");
const sbInsertTimetableEntry = (row) => sb.from("timetable_entries").insert(row);
const sbUpdateTimetableEntry = (id, patch) => sb.from("timetable_entries").update(patch).eq("id", id);
const sbDeleteTimetableEntry = (id) => sb.from("timetable_entries").delete().eq("id", id);

const sbGetExams = (level, dept) =>
  sb.from("exams").select().eq("level", level).eq("dept", dept).order("starts_at");
const sbInsertExam = (row) => sb.from("exams").insert(row);
const sbUpdateExam = (id, patch) => sb.from("exams").update(patch).eq("id", id);
const sbDeleteExam = (id) => sb.from("exams").delete().eq("id", id);

/* ---------- assignments + submissions ---------- */
const sbGetAssignments = (level, dept) =>
  sb.from("assignments").select().eq("level", level).eq("dept", dept).order("due_at");
const sbInsertAssignment = (row) => sb.from("assignments").insert(row);

const sbGetMySubmissions = (studentId) =>
  sb.from("assignment_submissions").select().eq("student_id", studentId);
// path convention: {student_id}/{assignment_id}-{uuid}.{ext} — the
// folder is the owner, matching avatars/chat-images
const sbUploadAssignmentFile = (studentId, assignmentId, file) => {
  const ext = (file.name.split(".").pop() || "dat").toLowerCase();
  const path = `${studentId}/${assignmentId}-${crypto.randomUUID()}.${ext}`;
  return sb.storage.from("assignment-files").upload(path, file).then(({ error }) => ({ path, error }));
};
const sbUpsertSubmission = (assignmentId, studentId, filePath) =>
  sb.from("assignment_submissions").upsert(
    { assignment_id: assignmentId, student_id: studentId, file_path: filePath, submitted_at: new Date().toISOString() },
    { onConflict: "assignment_id,student_id" }
  );

/* ---------- polls ---------- */
const sbGetPolls = (level, dept) =>
  sb.from("polls").select("*, poll_options(*)").eq("level", level).eq("dept", dept).order("created_at", { ascending: false });
const sbInsertPoll = (row) => sb.from("polls").insert(row).select().single();
const sbInsertPollOptions = (rows) => sb.from("poll_options").insert(rows);
const sbGetPollResults = (pollId) => sb.rpc("get_poll_results", { p_poll_id: pollId });
const sbGetMyVotes = (userId) => sb.from("poll_votes").select("poll_id, option_id").eq("user_id", userId);
const sbVote = (pollId, optionId, userId) =>
  sb.from("poll_votes").upsert(
    { poll_id: pollId, option_id: optionId, user_id: userId },
    { onConflict: "poll_id,user_id" }
  );

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

/* ---------- chat (real-time, conversations + messages) ---------- */
const sbGetOrCreateConversation = (otherUserId) =>
  sb.rpc("get_or_create_conversation", { other_user_id: otherUserId });
const sbGetMessages = (conversationId) =>
  sb.from("messages").select().eq("conversation_id", conversationId).order("created_at", { ascending: true });
const sbSendMessage = (row) => sb.from("messages").insert(row).select().single();
// caller owns the returned channel and must sb.removeChannel(channel) when
// the chat panel closes or switches conversations, or events keep piling up
const sbSubscribeToConversation = (conversationId, onInsert) =>
  sb.channel("messages-" + conversationId)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => onInsert(payload.new))
    .subscribe();

/* ---------- messages inbox ---------- */
const sbGetMyConversations = () => sb.rpc("get_my_conversations");
const sbMarkConversationRead = (conversationId, userId) =>
  sb.from("conversation_reads").upsert(
    { conversation_id: conversationId, user_id: userId, last_read_at: new Date().toISOString() },
    { onConflict: "conversation_id,user_id" }
  );
// unfiltered — RLS on messages already scopes delivery to conversations
// the caller participates in, so this is a live feed of "any new message
// anywhere that's mine to see," used to keep the inbox/badge up to date
// without a chat panel open
const sbSubscribeToMyMessages = (onInsert) =>
  sb.channel("my-messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => onInsert(payload.new))
    .subscribe();

/* ---------- message reports ----------
   (user blocking is deliberately not wired up client-side right now —
   see PENDING.md "Known accepted limitations"; the block_user() RPC and
   blocks table still exist server-side, untouched, for future use) */
// reporter_id / reported_user_id / message_text are filled in server-side
// by a trigger from the real message row — never trust the client for those
const sbReportMessage = (messageId, reason) =>
  sb.from("message_reports").insert({ message_id: messageId, reason: reason || null });

/* ---------- chat images (private bucket, participants only) ---------- */
// path convention: {conversationId}/{uuid}.jpg — the folder IS the
// conversation id, which is what the bucket's RLS policies key off
const sbUploadChatImage = (conversationId, blob) => {
  const path = `${conversationId}/${crypto.randomUUID()}.jpg`;
  return sb.storage.from("chat-images").upload(path, blob, { contentType: "image/jpeg" }).then(({ error }) => ({ path, error }));
};
const sbGetChatImageUrl = (path) => sb.storage.from("chat-images").createSignedUrl(path, 3600);
