# CampusHub — Pending / Deferred Work

Backlog compiled from Phases 1–4 of the Supabase/Paystack backend migration and the
original integration plan. Check items off as they get built — this file is a living
checklist, not a historical record.

## Launch blockers

- [ ] **Confirm Paystack subaccounts + transaction splits work in live mode.** No
      documentation found either confirming or denying support on a Starter Business
      account specifically — everything is fully verified in test mode, but this needs
      a real check once compliance review completes, before accepting real payments.
- [ ] **Turn email confirmation back on** (disabled in Phase 1 to keep the demo signup
      flow instant) and build a "check your email" screen for the signup wizard,
      paired with custom SMTP/Resend so confirmation emails don't rely on Supabase's
      low-volume shared sender.
- [ ] **Terms of Service + Privacy Policy pages.** The signup screen already links to
      "Terms of Service", "Privacy Policy", and "Cookie Use" — none of these pages
      exist yet.
- [ ] **Admin panel.** Accessible only to your account, enforced server-side (an
      `is_admin` flag or your user ID checked in RLS/RPCs — not just a hidden client
      route, which anyone could reach directly). Two sections:
      1. **Vendor verification queue** — pending `businesses` rows with Verify/Reject
         actions, replacing the current by-hand SQL Editor flow.
      2. **Message reports inbox** — `message_reports` rows newest-first, showing the
         reported message text, reporter, reported user, and timestamp, with at least
         a "mark reviewed" action.
      Must exist before real users are onboarded — reports filed via "Report message"
      currently land in a table nobody can see (no select policy is granted to any
      client role by design; today only you, via the SQL Editor, can read them at
      all).

## From the original plan — not yet started

The original plan numbered five phases: Auth, Marketplace, Events/Tickets, Chat, Study
hub. What actually shipped as "Phase 4" was marketplace/event payments via Paystack
subaccounts — an unplanned addition that came out of the marketplace/ticketing work.
The original **Phase 5 (Study hub)** is still fully pending. The original **Phase 4
(Chat)** has since shipped (see below) — only **Phase 5** remains here:

- [x] **Chat backend** — real `conversations`/`messages` tables with Realtime delivery
      (migration 0008), plus restricted user blocking and message reporting (migration
      0009) and image sharing (migration 0010). The old in-memory `state.chats` +
      `cannedReplies` simulation is kept only as the Lost & Found fallback, since
      reporters there aren't tied to real profiles yet (see below).
- [ ] **Study hub backend** — classroom announcements, timetable, exams, assignments,
      polls, attendance, and materials are all hardcoded demo data in `state`, with no
      hydrate function and no Supabase read/write at all.
  - [ ] Poll votes are a single global "voted" flag, not enforced per-user
  - [ ] Material ratings use a client-side sum/count/mine hack, not per-user rows
  - [ ] Assignment "submission" only reads the file's name — nothing is actually
        uploaded or stored
  - [ ] Attendance is read-only display with no write path — source of truth
        (self-reported vs. class-rep-marked) still undecided
- [ ] **GPA/CGPA calculator persistence** — the plan recommended `localStorage` (same
      mechanism as the dark-mode flag) rather than a full backend table, but this was
      never actually implemented. It's currently pure in-memory state and resets on
      every page reload.

## Deferred during Phase 1 (auth)

- [ ] Google OAuth — button is a "coming soon" stub (needs a Google Cloud OAuth client
      + enabling the provider in Supabase)
- [ ] Apple Sign-In — stub (needs a paid Apple Developer account)
- [ ] Phone/SMS OTP — stub (needs a paid SMS provider)
- [ ] Settings → "Switch account type" / vendor upgrade — only mutates local
      `state.user`, never writes the change to `profiles`/`businesses` in Supabase
- [ ] "Change password" — no-op toast only, no real password change
- [ ] "Forgot password" — static text, no real reset flow
- [ ] Notifications toggle — local UI-only flag; doesn't persist or control anything real

## Deferred during Phase 2 (marketplace)

- [ ] Shop reviews have no restriction requiring the reviewer to have a completed
      order first (flagged at the time, never implemented)
- [ ] There is no UI to actually *write* a shop review at all yet — reviews are
      currently read-only/display-only in the app (no submit form exists)

## Deferred during Phase 3 (events/tickets)

- [ ] Ticket/order confirmation emails — planned via Resend, not built yet

## Quality / UX

- [ ] **Campus feed + Lost & Found are still demo data.** Never part of any backend
      phase so far — posts, channel filtering, and lost/found reports all live in
      plain in-memory `state` with no Supabase table backing them. Needs its own
      backend pass (own migration + hydrate function), same treatment as the
      marketplace/events work.
- [ ] **Profile photo upload UI.** The `avatars` storage bucket has existed since
      migration 0001 (Phase 1) with public-read/own-folder-upload policies already in
      place — no screen anywhere actually uses it to upload or display a photo.

## Known accepted limitations

Deliberate tradeoffs made and accepted, not bugs to fix — listed here so they're
tracked outside the migration files they were decided in.

- [ ] **`chat-images` storage bucket RLS checks conversation participancy only, not
      block status** (migration 0010). The `messages` table's select policy (migration
      0009) hides a blocked sender's messages sent after the block, including any that
      reference an image — but the underlying storage object itself is still
      downloadable by any participant who has (or guesses) its exact path, blocked or
      not. In practice a blocker never learns a post-block image's path through the app
      UI, since the `messages` row pointing to it is already hidden from them. Revisit
      if stronger storage-level enforcement is ever needed.
- [ ] **User blocking is built server-side but not reachable from the UI.** The
      `blocks` table, `has_active_transaction()`/`block_user()` RPCs, and the
      block-aware `messages` select policy (all migration 0009) are fully intact and
      live-tested — but the chat header's block button and the Settings
      "Blocked users" list were removed, along with their `js/supabase.js` wrappers
      (`sbBlockUser`/`sbUnblockUser`/`sbGetMyBlocks`), in favor of shipping the
      Messages inbox first. "Report message" is unaffected and still fully wired up.
      To re-enable: re-add the wrappers and the two UI entry points — no DB changes
      needed.

## Product decisions still open

- [ ] App rename — "CampusHub" is already in use elsewhere; renaming has been
      deliberately deferred until later
