# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CampusHub is a standalone, no-build, no-framework HTML/CSS/JS demo of a campus super-app for University of Lagos (UNILAG) students and vendors. There is no package.json, no bundler, and no test suite — the entire app is three files:

- `index.html` — a single static shell (sidebar, mobile header, bottom nav, and three empty mount points: `#content`, `#modalRoot`, `#chatRoot`). All screens are injected into `#content` at runtime.
- `css/styles.css` — all styles, plain CSS with custom properties, no preprocessor.
- `js/app.js` — all app logic and demo data (~2500 lines, single file, no modules/imports).

## Running it

There is no build step. Open `index.html` directly in a browser, or serve the directory with any static file server (e.g. `npx serve .` or the VS Code Live Server extension) — a server is only needed to avoid `file://` quirks, not because of any build tooling.

There are no lint, test, or build commands configured in this repo.

## Architecture (js/app.js)

The whole app is one big client-side state machine with string-template rendering — no virtual DOM, no component framework:

1. **`state`** (top of the file) is a single mutable object holding everything: current user/auth progress, active tab, and all demo data (listings, events, feed posts, shops, products, chats, study hub data, etc.). All of this is in-memory only — a page refresh resets everything. There is no backend; comments in the file note where a real API/database would replace it.
2. **Screen functions** (`roleScreen`, `homeScreen`, `marketScreen`, `eventsScreen`, `shopScreen`, `studyScreen`, etc.) each return an HTML string built from `state` via template literals. `render()` picks the right screen based on `state.user` (logged in or not) and `state.tab`, and replaces `#content.innerHTML` wholesale.
3. **Event binding is manual and re-run after every render.** Because `innerHTML` is fully replaced each time, there are no persistent listeners on screen content — `bindAuthEvents()` (logged-out flow) or `bindScreenEvents()` (logged-in tabs) is called right after each render to re-attach `addEventListener` calls to the new DOM. Buttons/elements are targeted via `data-*` attributes (`data-act`, `data-tab`, `data-role`, `data-cat`, `data-item`, `data-goto`, etc.) rather than IDs, so a new handler set is wired up from scratch every time.
4. **The render loop is always: mutate `state` → call `render()` → rebind events.** Any new interactive feature should follow this pattern rather than trying to update the DOM in place.
5. **Modals and chat are separate mini-render-loops** with their own mount points and lifecycle: `openModal()/closeModal()` write into `#modalRoot`, and `openChat()/closeChat()/renderChat()` manage `#chatRoot` and `state.chats`/`state.chatWith`. Live chat replies are simulated client-side via a canned-reply array (`cannedReplies`) and a fake typing delay — there's no real backend or websocket.
6. **Auth is a multi-stage state machine**, not a single form: `state.authRole` → (`vtype` → `vverify` for vendors) → `profile` (students / student vendors) → `authScreen` (signup/login with a separate password step). `state.authStage` and `state.authStep` track position in this flow, and `completeAuth()` is the single place that assembles the final `state.user` object and logs the user in.
7. **Role/level gating happens in `render()`**: the vendor-only "My Shop" tab and the student-only "Study" tab are shown/hidden based on `state.user.role` and `state.user.level`, and `state.tab` is redirected back to `home` if the current tab isn't valid for the logged-in user's role.
8. Small helpers at the top (`$`, `naira`, `timeNow`, `esc`, `img`) are used throughout — `esc()` is the HTML-escaping helper and should wrap any user-entered or demo string interpolated into a template literal to avoid breaking markup/XSS.
9. UNILAG-specific reference data (`LEVELS`, `DEPARTMENTS` grouped by faculty) lives near the top of the file and drives the level/department pickers in both the profile-setup flow and settings.

## Styling conventions (css/styles.css)

- Theme colors are CSS custom properties on `:root` (indigo/orange brand palette — `--indigo-*`, `--orange-*`, plus `--ink`/`--muted`/`--bg`/`--card`/`--line`).
- Dark mode is a `body.dark` class toggle (set via settings, persisted to `localStorage` under key `ch-theme`, applied on load in `applyTheme()`/the bottom of app.js) — dark-mode overrides are appended as `body.dark .selector { ... }` rules rather than using a parallel custom-property set.
- Layout is mobile-first app-shell: a hidden-on-mobile `.sidebar` for desktop nav and a `.bottom-nav` for mobile, both driven by the same `data-tab` buttons.
- `prefers-reduced-motion` is respected globally (transitions/animations disabled).
