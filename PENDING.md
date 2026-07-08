# CampusHub — Pending / Deferred Work

Backlog compiled from Phases 1–5 of the Supabase/Paystack backend migration and the
original integration plan — all five originally-planned phases are now shipped. Check
items off as they get built — this file is a living checklist, not a historical record.

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

## From the original plan — all five phases now shipped

The original plan numbered five phases: Auth, Marketplace, Events/Tickets, Chat, Study
hub. What actually shipped as "Phase 4" (in this repo's numbering) was marketplace/event
payments via Paystack subaccounts — an unplanned addition that came out of the
marketplace/ticketing work. All five phases from the original plan are now done:

- [x] **Chat backend** — real `conversations`/`messages` tables with Realtime delivery
      (migration 0008), plus restricted user blocking and message reporting (migration
      0009), image sharing (migration 0010), and a Messages inbox (migration 0011). The
      old in-memory `state.chats` + `cannedReplies` simulation is fully removed — Lost &
      Found now uses real reporters and real chat too (migration 0012), so there's no
      remaining demo-mode fallback anywhere in the app.
- [x] **Study hub backend** (Phase 5, built in 6 chunks — migrations 0012–0017):
      campus feed + lost & found (0012), class announcements/timetable/exams (0013),
      assignments with real per-student file submissions (0014), polls with real
      per-user votes and a change-vote UI (0015), self-reported attendance (0016), and
      study materials with real uploads and per-user ratings (0017). The three
      shared-mutable-state bugs from the original demo are all fixed by real per-user
      rows: poll votes, material ratings, and assignment submissions each now enforce
      one-per-user server-side instead of a flag/counter shared across the whole class.
- [x] **GPA/CGPA calculator persistence** — now saved to `localStorage` (key `ch-gpa`,
      same mechanism as the dark-mode flag) exactly as the original plan recommended,
      rather than a backend table, since it's single-user scratch data with no sharing
      component. Verified to survive a full page reload.

Two deliberate v1 scoping calls made during Study hub design, not yet built:

- [ ] **Course-rep-only announcement posting.** v1 lets any student in a class post an
      announcement (self-attested via `is_my_class()`); a verified "course rep" role
      with rep-only posting rights needs a rep system that doesn't exist yet.
- [ ] **Rep-marked attendance.** v1 attendance is fully self-reported and private
      (migration 0016) — a class rep marking attendance for the whole class needs the
      same rep system as above, plus a decision on whether rep-marked records should be
      visible to the students they're marked for (self-reported ones currently aren't
      visible to anyone but the student).

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
