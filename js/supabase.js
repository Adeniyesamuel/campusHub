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
