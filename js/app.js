/* ==========================================================
   CampusHub — app.js
   All app logic: state, screens, navigation, modals.
   Data lives in memory for this demo. In the real build,
   this is replaced by a backend API + database.
   ========================================================== */

"use strict";

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const naira = (n) => "₦" + Number(n).toLocaleString("en-NG");
const timeNow = () =>
  new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const img = (id) =>
  `https://images.unsplash.com/${id}?w=800&q=60&auto=format&fit=crop`;

/* ---------- state (demo data) ---------- */
const state = {
  user: null,          // { role, via, vendorType, level, dept }
  authRole: null,      // role picked on the first auth step
  authStage: null,     // null (role) | "vtype" | "profile" | "auth"
  authMode: "signup",  // "signup" | "login"
  authStep: "start",   // "start" | "password"
  authId: "",          // the email / phone the person entered
  vendorType: null,    // "student" | "external"
  profile: { name: "", matric: "", level: "", dept: "" },
  business: { name: "", cat: "Food & Snacks", desc: "", phone: "", loc: "", social: "", cac: "", agreed: false },
  // optional payout draft collected during vendor signup — the actual
  // create-payout-account call happens post-signup (see completeAuth),
  // since it needs an authenticated session; `pending` marks whether the
  // vendor filled this in or clicked "Skip for now"
  payout: { pending: false, business_name: "", bank_code: "", bank_name: "", account_number: "" },
  feedFilter: "All",
  tab: "home",
  cat: "All",
  query: "",
  listings: [], // loaded from Supabase after login — see hydrateMarketplace()
  cats: ["All", "Electronics", "Books", "Hostel Items", "Fashion & Beauty", "Food", "Services"],
  events: [], // loaded from Supabase after login — see hydrateEvents()
  tickets: [], // the logged-in user's own paid tickets — see hydrateEvents()
  feed: [], // loaded from Supabase after login — see hydrateFeed()
  lost: [],  // loaded from Supabase after login — see hydrateLostFound()
  products: [], // vendor's own inventory — loaded from Supabase, see hydrateMarketplace()
  sales: [],    // vendor's own sale ledger — loaded from Supabase
  realChatWith: null, // { id, name, conversationId } once a chat panel is open
  chatMessages: [],   // messages for the currently open conversation
  conversations: [],  // Messages inbox — loaded by hydrateConversations()
  unreadTotal: 0,     // sum of unread counts across all conversations
  adminBusinesses: [], // admin-only — loaded by hydrateAdmin()
  adminReports: [],    // admin-only — loaded by hydrateAdmin()

  /* ---- The logged-in vendor's own shop ---- */
  myShop: { followers: 0, reviews: [], orders: [] },
  payoutAccount: null, // { business_name, bank_name, account_number, account_name } once set up
  // sane defaults matching platform_fees seed data — overwritten by
  // hydrateFees() as soon as we can reach the database
  fees: { events: { percent: 5, min_fee: 0 }, marketplace: { percent: 2.5, min_fee: 100 } },
  // sane defaults matching verification_requirements seed data —
  // overwritten by hydrateVerificationRequirements()
  verificationRequirements: { minSales: 5, minAvgRating: 4.0, minRatingCount: 3 },

  /* ---- Study hub ---- */
  studyTab: "class",  // class | materials | cgpa
  eventsTab: "browse", // browse | myEvents
  myEvents: [], // events I organize, past + future — see hydrateEvents()
  pollChangingIds: [], // poll ids currently showing options again to re-vote
  classroom: {
    announcements: [], // loaded from Supabase after login — see hydrateClassInfo()
    timetable: [],     // loaded from Supabase after login — see hydrateClassInfo()
    exams: [],         // loaded from Supabase after login — see hydrateClassInfo()
    assignments: [], // loaded from Supabase after login — see hydrateClassInfo()
    polls: [], // loaded from Supabase after login — see hydrateClassInfo()
    attendance: [], // loaded from Supabase after login — see hydrateClassInfo()
  },
  materials: [], // loaded from Supabase after login — see hydrateMaterials()
  matFilter: "All",
  gpaRows: [
    { course: "CSC 201", units: 3, grade: "A" },
    { course: "MTH 201", units: 3, grade: "B" },
    { course: "GST 201", units: 2, grade: "A" },
  ],
  semesters: [
    { name: "100L — 1st Semester", gpa: 4.2, units: 21 },
    { name: "100L — 2nd Semester", gpa: 4.5, units: 19 },
  ],
};

let toastTimer = null;

/* ---------- UNILAG academic data ---------- */
const LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "600 Level", "Postgraduate"];
const DEPARTMENTS = {
  "Arts": ["Creative Arts", "English", "French", "Russian", "History & Strategic Studies", "Linguistics, African & Asian Studies", "Philosophy", "Christian Religious Studies", "Islamic Religious Studies"],
  "Basic Medical Sciences": ["Anatomy", "Medical Laboratory Science", "Physiology"],
  "Clinical Sciences": ["Medicine & Surgery", "Nursing Science", "Physiotherapy", "Radiography"],
  "Dental Sciences": ["Dentistry"],
  "Education": ["Adult Education", "Arts & Social Sciences Education", "Educational Administration", "Educational Foundations", "Health Education", "Human Kinetics Education", "Science & Technology Education"],
  "Engineering": ["Biomedical Engineering", "Chemical & Petroleum Engineering", "Civil & Environmental Engineering", "Computer Engineering", "Electrical & Electronics Engineering", "Mechanical Engineering", "Metallurgical & Materials Engineering", "Systems Engineering", "Surveying & Geoinformatics"],
  "Environmental Sciences": ["Architecture", "Building", "Estate Management", "Quantity Surveying", "Urban & Regional Planning"],
  "Law": ["Law"],
  "Management Sciences": ["Accounting", "Actuarial Science & Insurance", "Banking & Finance", "Business Administration", "Employee Relations & HRM", "Marketing"],
  "Pharmacy": ["Pharmacy"],
  "Science": ["Biochemistry", "Botany", "Cell Biology & Genetics", "Chemistry", "Computer Science", "Geology", "Geophysics", "Marine Sciences", "Mathematics", "Microbiology", "Physics", "Statistics", "Zoology"],
  "Social Sciences": ["Economics", "Geography", "Mass Communication", "Political Science", "Psychology", "Social Work", "Sociology"],
};
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
}

/* ==========================================================
   RENDERING
   ========================================================== */

function render() {
  // ----- logged out: show the auth flow -----
  if (!state.user) {
    document.body.classList.add("unauthed");
    let screen;
    if (state.authStage === "vtype") screen = vtypeScreen();
    else if (state.authStage === "vverify") screen = vverifyScreen();
    else if (state.authStage === "payout") screen = payoutSetupScreen();
    else if (state.authStage === "profile") screen = profileScreen();
    else if (state.authStage === "auth") screen = authScreen();
    else if (state.authStage === "checkEmail") screen = checkEmailScreen();
    else screen = roleScreen();
    $("#content").innerHTML = screen;
    bindAuthEvents();
    return;
  }
  document.body.classList.remove("unauthed");

  // students don't see the vendor tab; non-students don't see Study;
  // the Admin tab is client-hidden for everyone but is_admin — the real
  // enforcement is server-side (RLS/RPCs all gate on is_admin() too),
  // this is just so non-admins don't see a dead-end nav item
  document.querySelectorAll('[data-tab="shop"]').forEach((b) =>
    b.classList.toggle("hidden", state.user.role !== "vendor"));
  document.querySelectorAll('[data-tab="study"]').forEach((b) =>
    b.classList.toggle("hidden", !state.user.level));
  document.querySelectorAll('[data-tab="admin"]').forEach((b) =>
    b.classList.toggle("hidden", !state.user.isAdmin));
  if (state.user.role !== "vendor" && state.tab === "shop") state.tab = "home";
  if (!state.user.level && state.tab === "study") state.tab = "home";
  if (!state.user.isAdmin && state.tab === "admin") state.tab = "home";

  // nav highlighting (both navs)
  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === state.tab));
  renderMessageBadge();

  const screens = { home: homeScreen, market: marketScreen, events: eventsScreen, messages: messagesScreen, shop: shopScreen, study: studyScreen, admin: adminScreen };
  $("#content").innerHTML = screens[state.tab]();
  bindScreenEvents();
}

/* ==========================================================
   AUTH SCREENS
   ========================================================== */

/* Step 1 — pick your role */
function roleScreen() {
  return `
    <div class="auth-page">
      <div class="auth-box">
        <div class="auth-brand">
          <div class="wordmark">Campus<span>Hub.</span></div>
          <div class="uni-label">University of Lagos</div>
        </div>
        <div class="auth-title">How will you use CampusHub?</div>
        <div class="role-grid">
          <button class="role-card" data-role="student">
            <span class="role-emoji">🎓</span>
            <div class="role-name">I'm a Student</div>
            <div class="role-desc">Buy from the market, get event tickets, follow campus updates and lost &amp; found.</div>
          </button>
          <button class="role-card" data-role="vendor">
            <span class="role-emoji">🛍️</span>
            <div class="role-name">I'm a Vendor</div>
            <div class="role-desc">Everything students get, plus your own shop — list products, track stock, sales and daily profit.</div>
          </button>
        </div>
        <p class="auth-terms">You can switch or upgrade to a vendor account any time.</p>
        <p class="auth-switch">
          Already have an account?
          <button data-act="goto-login">Log in</button>
        </p>
      </div>
    </div>`;
}

function checkEmailScreen() {
  return `
    <div class="auth-page">
      <div class="auth-box">
        <div class="auth-brand">
          <div class="wordmark">Campus<span>Hub.</span></div>
          <div class="uni-label">University of Lagos</div>
        </div>
        <div class="auth-title">Check your email 📬</div>
        <p class="auth-sub">We sent a confirmation link to <b>${esc(state.authId)}</b>. Click it to activate your account, then come back and log in.</p>
        <button class="btn btn-ghost btn-block" id="resendEmailBtn" style="margin-top:16px">Resend email</button>
        <p class="auth-switch" style="margin-top:14px">
          <button data-act="check-email-back">← Back to login</button>
        </p>
      </div>
    </div>`;
}

/* Step 1b — vendor type (student vendor vs external vendor) */
function vtypeScreen() {
  return `
    <div class="auth-page">
      <div class="auth-box">
        <button class="auth-back" data-act="auth-back">← Back</button>
        <div class="auth-brand">
          <div class="wordmark">Campus<span>Hub.</span></div>
        </div>
        <div class="auth-title">What kind of vendor are you?</div>
        <div class="role-grid">
          <button class="role-card" data-vtype="student">
            <span class="role-emoji">🎓🛍️</span>
            <div class="role-name">Student Vendor</div>
            <div class="role-desc">I'm a UNILAG student and I also run a business — I'll pick my level and department next.</div>
          </button>
          <button class="role-card" data-vtype="external">
            <span class="role-emoji">🏪</span>
            <div class="role-name">Campus Vendor</div>
            <div class="role-desc">I'm not a student — I sell products or services to students in and around the campus.</div>
          </button>
        </div>
      </div>
    </div>`;
}

/* Step 1b(ii) — vendor business verification (both vendor types) */
function vverifyScreen() {
  const b = state.business;
  const cats = ["Food & Snacks", "Fashion & Beauty", "Electronics & Gadgets", "Hair & Grooming", "Printing & Stationery", "Laundry & Cleaning", "Tutoring & Services", "Other"];
  return `
    <div class="auth-page">
      <div class="auth-box">
        <button class="auth-back" data-act="vv-back">← Back</button>
        <div class="auth-brand">
          <div class="wordmark">Campus<span>Hub.</span></div>
        </div>
        <div class="auth-title">Verify your business</div>
        <p class="auth-sub">We ask every vendor these questions to protect students from scams. Verified vendors get a trust badge and sell more. 🛡️</p>

        <input id="vvName" class="auth-input" placeholder="Business name *" value="${esc(b.name)}" />
        <select id="vvCat" class="auth-input auth-select">
          ${cats.map((c) => `<option ${b.cat === c ? "selected" : ""}>${c}</option>`).join("")}
        </select>
        <textarea id="vvDesc" class="auth-input" rows="2" placeholder="What exactly do you sell or offer? *">${esc(b.desc)}</textarea>
        <input id="vvPhone" class="auth-input" type="tel" placeholder="Business phone / WhatsApp number *" value="${esc(b.phone)}" />
        <input id="vvLoc" class="auth-input" placeholder="Where do you operate? (e.g. Moremi Hall, online, campus gate) *" value="${esc(b.loc)}" />
        <input id="vvSocial" class="auth-input" placeholder="Instagram / TikTok handle (optional, builds trust)" value="${esc(b.social)}" />
        <input id="vvCac" class="auth-input" placeholder="CAC registration number (optional)" value="${esc(b.cac)}" />

        <label class="vv-agree">
          <input type="checkbox" id="vvAgree" ${b.agreed ? "checked" : ""} />
          <span>I confirm this information is true. I understand that fake details, fraud, or scamming students leads to a permanent ban and may be reported to school authorities and the police.</span>
        </label>

        <button class="continue-btn" id="vvContinue" disabled>Continue</button>
      </div>
    </div>`;
}

/* Step 1b(iii) — optional payout setup (both vendor types). The actual
   Paystack call happens after signUp() completes (see completeAuth) —
   this screen only collects the draft, so filling it in never touches
   Paystack until an authenticated session exists. */
function payoutSetupScreen() {
  const p = state.payout;
  return `
    <div class="auth-page">
      <div class="auth-box">
        <button class="auth-back" data-act="payout-back">← Back</button>
        <div class="auth-brand">
          <div class="wordmark">Campus<span>Hub.</span></div>
        </div>
        <div class="auth-title">Set up payouts</div>
        <p class="auth-sub">Get paid automatically for sales and ticket revenue, straight to your bank. You can always do this later in Settings.</p>

        <input id="poSuBusinessName" class="auth-input" placeholder="Business / payout name" value="${esc(p.business_name)}" />
        <select id="poSuBank" class="auth-input auth-select"><option value="">Loading banks…</option></select>
        <input id="poSuAccountNumber" class="auth-input" inputmode="numeric" placeholder="10-digit account number" value="${esc(p.account_number)}" />

        <button class="continue-btn" id="poSuContinue" disabled>Continue</button>
        <p class="auth-switch">
          <button data-act="payout-skip">Skip for now</button>
        </p>
      </div>
    </div>`;
}

/* Step 1c — student identity + level & department (students and student vendors) */
function profileScreen() {
  const levelChips = LEVELS.map((l) =>
    `<button class="level-chip ${state.profile.level === l ? "active" : ""}" data-level="${esc(l)}">${esc(l)}</button>`).join("");

  const deptOptions = Object.entries(DEPARTMENTS).map(([fac, depts]) => `
    <optgroup label="Faculty of ${esc(fac)}">
      ${depts.map((d) => `<option ${state.profile.dept === d ? "selected" : ""}>${esc(d)}</option>`).join("")}
    </optgroup>`).join("");

  return `
    <div class="auth-page">
      <div class="auth-box">
        <button class="auth-back" data-act="profile-back">← Back</button>
        <div class="auth-brand">
          <div class="wordmark">Campus<span>Hub.</span></div>
        </div>
        <div class="auth-title">Your student identity</div>
        <p class="auth-sub">Your name and matric number help us verify that only real UNILAG students join — it keeps everyone safer.</p>

        <input id="pfName" class="auth-input" placeholder="Full name (as on your student ID) *" value="${esc(state.profile.name)}" />
        <input id="pfMatric" class="auth-input" placeholder="Matric number (e.g. 210404021) *" value="${esc(state.profile.matric)}" />

        <div class="pf-label">Your level</div>
        <div class="level-grid">${levelChips}</div>

        <div class="pf-label">Your department</div>
        <select id="pfDept" class="auth-input auth-select">
          <option value="" ${!state.profile.dept ? "selected" : ""} disabled>Select your department…</option>
          ${deptOptions}
        </select>

        <button class="continue-btn" id="pfContinue" disabled>Continue</button>
        <p class="auth-terms">Level and department can be changed later in settings. Matric numbers are verified against school records in the full version.</p>
      </div>
    </div>`;
}



/* real brand icons (inline SVG) */
const ICON_PHONE = `<svg class="pill-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.02l-2.2 2.2z"/></svg>`;
const ICON_GOOGLE = `<svg class="pill-svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
const ICON_APPLE = `<svg class="pill-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`;

function authScreen() {
  const signup = state.authMode === "signup";
  const roleLabel = state.authRole === "vendor" ? "Vendor" : "Student";

  /* ---- password step (shared by signup & login) ---- */
  if (state.authStep === "password") {
    return `
      <div class="auth-page">
        <div class="auth-box">
          <button class="auth-back" data-act="pw-back">← Back</button>
          <div class="auth-brand">
            <div class="wordmark">Campus<span>Hub.</span></div>
          </div>
          <div class="auth-title">${signup ? "Create a password" : "Enter your password"}</div>
          <p class="auth-sub">${signup ? "Secure your account" : "Logging in"} — <b style="color:#fff">${esc(state.authId)}</b></p>

          <input id="authPw" class="auth-input" type="password"
            placeholder="${signup ? "Create a password (min. 6 characters)" : "Password"}"
            autocomplete="${signup ? "new-password" : "current-password"}" />
          ${signup ? `<input id="authPw2" class="auth-input" type="password" placeholder="Confirm password" autocomplete="new-password" />` : ""}

          <button class="continue-btn" id="pwContinue" disabled>${signup ? "Create account" : "Log in"}</button>

          ${signup
            ? `<p class="auth-terms">By continuing, you agree to our <button class="legal-link" data-legal="terms">Terms of Service</button>, <button class="legal-link" data-legal="privacy">Privacy Policy</button> and <button class="legal-link" data-legal="cookies">Cookie Use</button>.</p>`
            : `<p class="auth-terms"><b>Forgot password?</b> Reset comes in the real build.</p>`}
        </div>
      </div>`;
  }

  /* ---- start step ---- */
  if (signup) {
    return `
      <div class="auth-page">
        <div class="auth-box">
          <button class="auth-back" data-act="auth-back">← Back</button>
          <div class="auth-brand">
            <div class="wordmark">Campus<span>Hub.</span></div>
          </div>
          <div class="auth-title">Create your ${roleLabel} account</div>
          <p class="auth-sub">Join your campus in seconds.</p>

          <button class="pill-btn" data-auth="phone">${ICON_PHONE} Continue with phone</button>
          <button class="pill-btn" data-auth="google">${ICON_GOOGLE} Continue with Google</button>
          <button class="pill-btn" data-auth="apple">${ICON_APPLE} Continue with Apple</button>

          <div class="divider">or</div>

          <input id="authId" class="auth-input" placeholder="Email or phone number" autocomplete="username" />
          <button class="continue-btn" id="authContinue" disabled>Continue</button>

          <p class="auth-terms">By continuing, you agree to our <button class="legal-link" data-legal="terms">Terms of Service</button>, <button class="legal-link" data-legal="privacy">Privacy Policy</button> and <button class="legal-link" data-legal="cookies">Cookie Use</button>.</p>

          <p class="auth-switch">
            Already have an account?
            <button data-act="auth-toggle">Log in</button>
          </p>
        </div>
      </div>`;
  }

  /* login start: email/phone only — no social buttons */
  return `
    <div class="auth-page">
      <div class="auth-box">
        <button class="auth-back" data-act="auth-back">← Back</button>
        <div class="auth-brand">
          <div class="wordmark">Campus<span>Hub.</span></div>
        </div>
        <div class="auth-title">Welcome back</div>
        <p class="auth-sub">Log in to CampusHub.</p>

        <input id="authId" class="auth-input" placeholder="Email or phone number" autocomplete="username" />
        <button class="continue-btn" id="authContinue" disabled>Continue</button>

        <p class="auth-switch">
          Don't have an account?
          <button data-act="auth-toggle">Sign up</button>
        </p>
      </div>
    </div>`;
}

/* turns a DB profiles row (+ optional businesses row) into state.user and
   resets the post-login UI — shared by signup, login, and session restore */
function hydrateUser(profileRow, businessRow, via) {
  state.user = {
    id: profileRow.id,
    role: profileRow.role,
    via,
    vendorType: profileRow.vendor_type,
    name: profileRow.name,
    matric: profileRow.matric,
    level: profileRow.level,
    dept: profileRow.dept,
    isAdmin: !!profileRow.is_admin,
    business: businessRow ? {
      id: businessRow.id,
      name: businessRow.name,
      cat: businessRow.category,
      desc: businessRow.description,
      phone: businessRow.phone,
      loc: businessRow.location,
      social: businessRow.social_handle,
      cac: businessRow.cac_number,
      verified: businessRow.verified,
      rejectedAt: businessRow.rejected_at,
      verificationRequestedAt: businessRow.verification_requested_at,
    } : null,
  };
  // avatar shows the user's initial
  document.querySelectorAll(".avatar").forEach((a) => {
    a.textContent = (state.user.name || "S").trim()[0].toUpperCase();
  });
  state.tab = "home";
  state.feedFilter = "All";
  state.authStep = "start";
  state.authStage = null;
  state.authId = "";
}

const fmtRowTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();

// "Sat, 15 Aug · 7:00 PM" — shared by anything with a starts_at
// timestamptz (events, exams/tests)
const fmtEventDateTime = (iso) => {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
  const timePart = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  return `${datePart} · ${timePart}`;
};

// supabase-js only puts a generic "Edge Function returned a non-2xx status
// code" on the error object for non-2xx responses — the actual message we
// wrote (e.g. "Ticket not found", "your payment has been refunded") is in
// the response body, which has to be parsed from error.context ourselves.
async function edgeErrorMessage(error, fallback) {
  if (!error) return fallback;
  try {
    const body = await error.context.json();
    if (body && body.error) return body.error;
  } catch (e) { /* fall back below */ }
  return error.message || fallback;
}

const mapListingRow = (row) => ({
  id: row.id,
  title: row.title,
  price: row.price,
  cat: row.category,
  loc: row.location,
  desc: row.description,
  img: row.image_url,
  seller: row.seller?.name || "CampusHub Vendor",
  sellerId: row.seller_id,
  productId: row.product_id,
});

const mapProductRow = (row) => ({
  id: row.id, name: row.name, price: row.price, cost: row.cost,
  stock: row.stock, img: row.image_url, listed: row.listed,
});

const mapOrderRow = (row) => ({
  id: row.id, pid: row.product_id, buyer: row.buyer?.name || "Buyer", buyerId: row.buyer_id,
  qty: row.qty, status: row.status, paymentStatus: row.payment_status,
  time: fmtRowTime(row.created_at),
});

const mapSaleRow = (row) => {
  const p = state.products.find((x) => x.id === row.product_id);
  return { id: row.id, name: p ? p.name : "Product", qty: row.qty, total: row.total, profit: row.profit, time: fmtRowTime(row.created_at) };
};

// audience_type/audience_value (RLS-enforced) -> the single "aud" string
// the rendering/filter code already works with ("General", a level, or a
// department) — General/level/department map 1:1 onto myChannels()
const mapFeedRow = (row) => ({
  id: row.id,
  who: row.author?.name || "Someone",
  tag: row.author?.role === "vendor" && row.author?.vendor_type !== "student" ? "Vendor" : "Student",
  aud: row.audience_type === "general" ? "General" : row.audience_value,
  time: fmtRowTime(row.created_at),
  text: row.text,
});

const mapLostFoundRow = (row) => ({
  id: row.id,
  reporterId: row.reporter_id,
  type: row.type,
  item: row.item,
  where: row.location,
  who: row.reporter?.name || "Someone",
  time: fmtRowTime(row.created_at),
});

async function hydrateFeed() {
  const { data } = await sbGetFeed();
  state.feed = (data || []).map(mapFeedRow);
}

async function hydrateLostFound() {
  const { data } = await sbGetLostFound();
  state.lost = (data || []).map(mapLostFoundRow);
}

/* loads announcements/timetable/exams for the logged-in user's exact
   (level, dept) class — skipped for accounts with no academic profile
   (external vendors), same gating as the Study tab itself */
async function hydrateClassInfo() {
  if (!state.user.level) return;
  const { level, dept } = state.user;

  const { data: annRows } = await sbGetAnnouncements(level, dept);
  state.classroom.announcements = (annRows || []).map((r) => ({
    id: r.id, who: r.author?.name || "Classmate", text: r.text, time: fmtRowTime(r.created_at),
  }));

  const { data: ttRows } = await sbGetTimetable(level, dept);
  state.classroom.timetable = (ttRows || []).map((r) => ({
    id: r.id, day: r.day, course: r.course, time: r.time_label, venue: r.venue,
  }));

  const { data: examRows } = await sbGetExams(level, dept);
  state.classroom.exams = (examRows || []).map((r) => ({
    id: r.id, course: r.course, type: r.exam_type, startsAt: r.starts_at, venue: r.venue,
  }));

  const { data: assignRows } = await sbGetAssignments(level, dept);
  const { data: subRows } = await sbGetMySubmissions(state.user.id);
  const subByAssignment = new Map((subRows || []).map((s) => [s.assignment_id, s]));
  state.classroom.assignments = (assignRows || []).map((r) => {
    const sub = subByAssignment.get(r.id);
    return {
      id: r.id, course: r.course, title: r.title, due: fmtEventDateTime(r.due_at),
      submitted: !!sub, file: sub ? sub.file_path.split("/").pop() : null,
    };
  });

  const { data: pollRows } = await sbGetPolls(level, dept);
  const { data: myVoteRows } = await sbGetMyVotes(state.user.id);
  const myVoteByPoll = new Map((myVoteRows || []).map((v) => [v.poll_id, v.option_id]));
  state.classroom.polls = await Promise.all((pollRows || []).map(async (p) => {
    const { data: results } = await sbGetPollResults(p.id);
    const countByOption = new Map((results || []).map((r) => [r.option_id, Number(r.votes)]));
    const options = (p.poll_options || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({ id: o.id, label: o.label, votes: countByOption.get(o.id) || 0 }));
    return { id: p.id, q: p.question, options, voted: myVoteByPoll.get(p.id) || null };
  }));

  const { data: attRows } = await sbGetAttendance(state.user.id);
  const attByCourse = new Map();
  (attRows || []).forEach((r) => {
    const agg = attByCourse.get(r.course) || { course: r.course, present: 0, total: 0 };
    agg.total++;
    if (r.status === "present") agg.present++;
    attByCourse.set(r.course, agg);
  });
  state.classroom.attendance = [...attByCourse.values()];
}

/* loads study materials (campus-wide, not cohort-scoped) with aggregate
   ratings from get_material_ratings() and the caller's own rating */
async function hydrateMaterials() {
  if (!state.user.level) return;
  const { data: matRows } = await sbGetMaterials();
  const { data: ratingRows } = await sbGetMaterialRatings();
  const aggByMaterial = new Map((ratingRows || []).map((r) => [r.material_id, { avg: Number(r.avg_stars), count: Number(r.rating_count) }]));
  const { data: myRatingRows } = await sbGetMyRatings(state.user.id);
  const myRatingByMaterial = new Map((myRatingRows || []).map((r) => [r.material_id, r.stars]));

  state.materials = (matRows || []).map((r) => {
    const agg = aggByMaterial.get(r.id) || { avg: 0, count: 0 };
    return {
      id: r.id, title: r.title, course: r.course, type: r.material_type,
      by: r.uploader?.name || "Someone", filePath: r.file_path,
      avg: agg.avg, count: agg.count, mine: myRatingByMaterial.get(r.id) || 0,
    };
  });
}

/* admin-only — skipped for everyone else. Real enforcement is
   server-side (is_admin() in RLS/RPCs); this guard just avoids a
   pointless fetch for the other 99% of users */
async function hydrateAdmin() {
  if (!state.user.isAdmin) return;

  const { data: bizRows } = await sbGetAllBusinesses();
  state.adminBusinesses = (bizRows || []).map((r) => ({
    id: r.id, ownerId: r.owner_id, name: r.name, category: r.category, ownerName: r.owner?.name || "Unknown",
    verified: r.verified, rejectedAt: r.rejected_at, verificationRequestedAt: r.verification_requested_at,
    createdAt: fmtRowTime(r.created_at),
  }));

  const { data: reportRows } = await sbGetMessageReports();
  state.adminReports = (reportRows || []).map((r) => ({
    id: r.id, messageText: r.message_text, reason: r.reason,
    reporterName: r.reporter?.name || "Unknown", reportedName: r.reported?.name || "Unknown",
    createdAt: fmtRowTime(r.created_at), reviewed: !!r.reviewed_at,
  }));
}

/* loads the public marketplace feed for everyone, plus the vendor's own
   inventory/orders/sales/shop stats if the logged-in user is a vendor */
async function hydrateMarketplace() {
  const { data: listingRows } = await sbGetListings();
  state.listings = (listingRows || []).map(mapListingRow);

  if (state.user.role === "vendor" && state.user.business && state.user.business.id) {
    const shopId = state.user.business.id;

    const { data: productRows } = await sbGetProducts(shopId);
    state.products = (productRows || []).map(mapProductRow);

    const { data: saleRows } = await sbGetSales(shopId);
    state.sales = (saleRows || []).map(mapSaleRow);

    const { data: orderRows } = await sbGetShopOrders(shopId);
    state.myShop.orders = (orderRows || []).map(mapOrderRow);

    const { data: reviewRows } = await sbGetShopReviews(shopId);
    state.myShop.reviews = (reviewRows || []).map((r) => ({
      who: r.reviewer?.name || "Buyer", stars: r.stars, text: r.text, time: fmtRowTime(r.created_at),
    }));

    const { count } = await sbGetFollowerCount(shopId);
    state.myShop.followers = count || 0;
  } else {
    state.products = [];
    state.sales = [];
    state.myShop = { followers: 0, reviews: [], orders: [] };
  }
  render();
}

/* loads the public events feed (with computed tier availability) for
   everyone, plus the logged-in user's own paid tickets */
async function hydrateEvents() {
  // public browsing hides events more than 8 hours past their start —
  // a grace window, not an instant cutoff, so an event still likely in
  // progress doesn't vanish from browsing right as it begins
  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  const { data: eventRows } = await sbGetEvents(cutoff);
  const { data: myEventRows } = await sbGetMyEvents(state.user.id);
  const { data: soldRows } = await sbGetTierSoldCounts();
  const soldByTier = new Map((soldRows || []).map((r) => [r.tier_id, Number(r.sold)]));

  const mapEvent = (ev) => ({
    id: ev.id,
    title: ev.title,
    startsAt: ev.starts_at,
    venue: ev.venue,
    tag: ev.tag,
    img: ev.image_url,
    organizer: ev.organizer_name,
    organizerId: ev.organizer_id,
    cancelledAt: ev.cancelled_at,
    rescheduledAt: ev.rescheduled_at,
    rescheduledFromStartsAt: ev.rescheduled_from_starts_at,
    rescheduledFromVenue: ev.rescheduled_from_venue,
    rescheduleReason: ev.reschedule_reason,
    tiers: (ev.ticket_tiers || []).map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      desc: t.description,
      quantityTotal: t.quantity_total,
      left: Math.max(0, t.quantity_total - (soldByTier.get(t.id) || 0)),
    })),
  });

  state.events = (eventRows || []).map(mapEvent);
  // organizers see every event they've ever hosted, past or future —
  // unaffected by the public-browsing grace window above
  state.myEvents = (myEventRows || []).map(mapEvent);

  const { data: ticketRows } = await sbGetMyTickets(state.user.id);
  state.tickets = (ticketRows || []).map((t) => ({
    id: t.id,
    event: t.ticket_tiers?.events?.title || "Event",
    tier: t.ticket_tiers?.name || "Ticket",
    qty: t.qty,
    total: t.total,
    code: t.code,
    usedAt: t.used_at,
    status: t.status,
    refunded: t.status === "refunded",
    cancelledAt: t.ticket_tiers?.events?.cancelled_at,
    rescheduledAt: t.ticket_tiers?.events?.rescheduled_at,
    rescheduleReason: t.ticket_tiers?.events?.reschedule_reason,
    rescheduledFromStartsAt: t.ticket_tiers?.events?.rescheduled_from_starts_at,
    rescheduledFromVenue: t.ticket_tiers?.events?.rescheduled_from_venue,
  }));

  render();
}

/* loads the configurable platform fee rates — public data, but no need
   to fetch it before someone's actually logged in and looking at prices */
async function hydrateFees() {
  const { data } = await sbGetPlatformFees();
  (data || []).forEach((row) => {
    if (state.fees[row.key]) state.fees[row.key] = { percent: Number(row.percent), min_fee: row.min_fee };
  });
}

async function hydrateVerificationRequirements() {
  const { data } = await sbGetVerificationRequirements();
  if (data) {
    state.verificationRequirements = {
      minSales: data.min_completed_sales,
      minAvgRating: Number(data.min_avg_rating),
      minRatingCount: data.min_rating_count,
    };
  }
}

/* loads the logged-in user's payout account status (vendor or event
   organizer — same payout destination for both), if they've set one up */
async function hydratePayoutAccount() {
  const { data } = await sbGetPayoutAccount(state.user.id);
  state.payoutAccount = data
    ? { business_name: data.business_name, bank_name: data.bank_name, account_number: data.account_number, account_name: data.account_name }
    : null;
}

/* loads the Messages inbox — every conversation with at least one
   message, newest first, with a preview and an unread count */
async function hydrateConversations() {
  const { data } = await sbGetMyConversations();
  state.conversations = (data || []).map((r) => ({
    conversationId: r.conversation_id,
    otherUserId: r.other_user_id,
    otherUserName: r.other_user_name || "Unknown",
    lastMessageText: r.last_message_text,
    lastMessageImage: r.last_message_image,
    lastMessageAt: r.last_message_at,
    lastSenderId: r.last_sender_id,
    unreadCount: Number(r.unread_count) || 0,
  }));
  state.unreadTotal = state.conversations.reduce((s, c) => s + c.unreadCount, 0);
  renderMessageBadge();
}

function renderMessageBadge() {
  document.querySelectorAll('[data-badge="messages"]').forEach((el) => {
    if (state.unreadTotal > 0) {
      el.textContent = state.unreadTotal > 99 ? "99+" : String(state.unreadTotal);
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });
}

// a single global, unfiltered subscription (independent of any open chat
// panel) that keeps the inbox list and nav badge live — started once
// right after login/session-restore and left running for the session
let myMessagesChannel = null;
function startMyMessagesWatch() {
  if (myMessagesChannel) return;
  myMessagesChannel = sbSubscribeToMyMessages(async (row) => {
    if (state.realChatWith && state.realChatWith.conversationId === row.conversation_id && row.sender_id !== state.user.id) {
      await sbMarkConversationRead(row.conversation_id, state.user.id);
    }
    await hydrateConversations();
    if (state.tab === "messages") render();
  });
}

async function completeAuth(via) {
  const email = state.authId;
  const password = $("#authPw") ? $("#authPw").value : "";
  const pwGo = $("#pwContinue");
  const busy = (label) => { if (pwGo) { pwGo.disabled = true; pwGo.textContent = label; } };
  const failed = (label, message) => { if (pwGo) { pwGo.disabled = false; pwGo.textContent = label; } toast(message); };

  let payoutOutcome = null; // "created" | "failed" | null (skipped or n/a)

  if (state.authMode === "signup") {
    busy("Creating account…");
    const academic = state.authRole === "student" || state.vendorType === "student";
    const metadata = {
      role: state.authRole,
      vendor_type: state.authRole === "vendor" ? (state.vendorType || "external") : null,
      name: state.profile.name || (state.authRole === "vendor" && state.vendorType === "external" ? state.business.name : "") || "CampusHub User",
      matric: academic ? (state.profile.matric || null) : null,
      level: academic ? (state.profile.level || null) : null,
      dept: academic ? (state.profile.dept || null) : null,
    };
    if (state.authRole === "vendor") {
      const b = state.business;
      metadata.business = {
        name: b.name, category: b.cat, description: b.desc,
        phone: b.phone, location: b.loc, social_handle: b.social, cac_number: b.cac,
      };
    }

    // handle_new_user() (migration 0020) creates the profiles/businesses
    // rows server-side from this metadata — the client never inserts
    // them directly, which is what makes this safe regardless of
    // whether email confirmation ends up required below
    const { data, error } = await sbSignUp(email, password, metadata);
    if (error) return failed("Create account", error.message);

    if (!data.session) {
      // email confirmation is required — the account + profile already
      // exist (the trigger ran regardless), but there's no session to
      // do anything further with yet. Payout setup needs a live
      // Edge Function call, not just a DB row, so it can't happen until
      // a real session exists — defer it to the first post-confirmation
      // login (see completeDeferredPayoutIfAny()).
      if (state.authRole === "vendor" && state.payout.pending) {
        try {
          localStorage.setItem("ch-pending-payout", JSON.stringify({
            business_name: state.payout.business_name, bank_code: state.payout.bank_code,
            bank_name: state.payout.bank_name, account_number: state.payout.account_number,
          }));
        } catch (e) { /* private mode — they can still set it up manually later */ }
      }
      state.payout = { pending: false, business_name: "", bank_code: "", bank_name: "", account_number: "" };
      state.authStage = "checkEmail";
      render();
      return;
    }

    // confirmation is off (or already satisfied) — proceed immediately,
    // fetching what the trigger just created rather than reconstructing
    // it from wizard state, same pattern as the login branch below
    const userId = data.user.id;
    const { data: profileRow, error: profileErr } = await sbGetProfile(userId);
    if (profileErr || !profileRow) return failed("Create account", "Account created, but we couldn't load your profile — please log in.");

    let businessRow = null;
    if (profileRow.role === "vendor") {
      const { data: biz } = await sbGetBusiness(userId);
      businessRow = biz;

      // optional payout setup — best-effort, never a blocker. Any
      // failure here — bad bank details, Paystack hiccup, whatever —
      // just means they finish it later in Settings.
      if (state.payout.pending) {
        busy("Setting up payouts…");
        const { data: payoutData, error: payoutErr } = await sbCreatePayoutAccount({
          business_name: state.payout.business_name,
          bank_code: state.payout.bank_code,
          bank_name: state.payout.bank_name,
          account_number: state.payout.account_number,
        });
        payoutOutcome = (payoutErr || payoutData?.error) ? "failed" : "created";
      }
    }
    state.payout = { pending: false, business_name: "", bank_code: "", bank_name: "", account_number: "" };
    hydrateUser(profileRow, businessRow, via);
  } else {
    busy("Logging in…");
    const { data, error } = await sbSignIn(email, password);
    if (error) return failed("Log in", error.message);

    const userId = data.user.id;
    const { data: profileRow, error: profileErr } = await sbGetProfile(userId);
    if (profileErr || !profileRow) return failed("Log in", "We couldn't find your profile — please contact support.");

    let businessRow = null;
    if (profileRow.role === "vendor") {
      const { data: biz } = await sbGetBusiness(userId);
      businessRow = biz;
    }
    hydrateUser(profileRow, businessRow, via);
  }

  render();
  const who = state.user.role === "vendor"
    ? (state.user.vendorType === "student" ? "a student vendor" : "a campus vendor")
    : "a student";
  let msg = (state.authMode === "signup" ? "Account created" : "Logged in") + " as " + who;
  if (payoutOutcome === "failed") msg += " — payout setup didn't go through, add it later in Settings";
  toast(msg);
  await hydrateFeed();
  await hydrateLostFound();
  await hydrateClassInfo();
  await hydrateMaterials();
  await hydrateAdmin();
  await hydrateMarketplace();
  await hydrateEvents();
  await hydratePayoutAccount();
  await hydrateFees();
  await hydrateVerificationRequirements();
  await hydrateConversations();
  startMyMessagesWatch();
  await completeDeferredPayoutIfAny();
}

/* runs at most once per deferred signup — set aside during signup when
   email confirmation blocked payout setup from completing right away
   (see completeAuth()'s signup branch), consumed on the first login
   after confirming. Cleared immediately regardless of outcome, same
   "never strand a signup" tolerance as the inline path. */
async function completeDeferredPayoutIfAny() {
  if (!state.user || state.user.role !== "vendor") return;
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem("ch-pending-payout") || "null"); } catch (e) { /* ignore */ }
  if (!pending) return;
  try { localStorage.removeItem("ch-pending-payout"); } catch (e) { /* ignore */ }

  const { data, error } = await sbCreatePayoutAccount(pending);
  if (error || data?.error) {
    toast("Signed in — payout setup didn't go through, add it later in Settings");
  } else {
    toast("Payouts are now set up 🏦");
    await hydratePayoutAccount();
    render();
  }
}

function bindAuthEvents() {
  // role cards → students set up profile, vendors pick vendor type first
  document.querySelectorAll("[data-role]").forEach((b) =>
    b.addEventListener("click", () => {
      state.authRole = b.dataset.role;
      state.authStage = b.dataset.role === "vendor" ? "vtype" : "profile";
      render();
    }));

  // vendor type → both vendor types must verify their business first
  document.querySelectorAll("[data-vtype]").forEach((b) =>
    b.addEventListener("click", () => {
      state.vendorType = b.dataset.vtype;
      state.authStage = "vverify";
      render();
    }));

  // business verification form
  const vvGo = $("#vvContinue");
  if (vvGo) {
    const req = ["#vvName", "#vvDesc", "#vvPhone", "#vvLoc"];
    const check = () => {
      const filled = req.every((s) => $(s).value.trim().length >= 3);
      vvGo.disabled = !(filled && $("#vvAgree").checked);
    };
    [...req, "#vvSocial", "#vvCac"].forEach((s) => $(s) && $(s).addEventListener("input", check));
    $("#vvCat").addEventListener("change", check);
    $("#vvAgree").addEventListener("change", check);
    check();
    vvGo.addEventListener("click", () => {
      if (vvGo.disabled) return;
      state.business = {
        name: $("#vvName").value.trim(),
        cat: $("#vvCat").value,
        desc: $("#vvDesc").value.trim(),
        phone: $("#vvPhone").value.trim(),
        loc: $("#vvLoc").value.trim(),
        social: $("#vvSocial").value.trim(),
        cac: $("#vvCac").value.trim(),
        agreed: true,
      };
      // both vendor types get the option to set up payouts next
      state.authStage = "payout";
      render();
    });
  }
  const vvBack = document.querySelector('[data-act="vv-back"]');
  if (vvBack) vvBack.addEventListener("click", () => { state.authStage = "vtype"; render(); });

  // optional payout setup — collects a draft only; the actual Paystack
  // call happens post-signup in completeAuth(), once authenticated
  const poSuGo = $("#poSuContinue");
  if (poSuGo) {
    const bankSelect = $("#poSuBank");
    (async () => {
      const { data: bankData, error: bankErr } = await sbListBanks();
      if (bankErr || !bankData?.banks) {
        bankSelect.innerHTML = `<option value="">Couldn't load banks — you can add this later in Settings</option>`;
      } else {
        bankSelect.innerHTML = `<option value="">Choose your bank</option>` +
          bankData.banks.map((b) => `<option value="${esc(b.code)}">${esc(b.name)}</option>`).join("");
      }
    })();

    const check = () => {
      const ok = $("#poSuBusinessName").value.trim() && bankSelect.value && $("#poSuAccountNumber").value.trim().length >= 10;
      poSuGo.disabled = !ok;
    };
    ["#poSuBusinessName", "#poSuAccountNumber"].forEach((s) => $(s).addEventListener("input", check));
    bankSelect.addEventListener("change", check);
    check();

    const nextStage = () => {
      state.authStage = state.vendorType === "student" ? "profile" : "auth";
      render();
    };
    poSuGo.addEventListener("click", () => {
      if (poSuGo.disabled) return;
      state.payout = {
        pending: true,
        business_name: $("#poSuBusinessName").value.trim(),
        bank_code: bankSelect.value,
        bank_name: bankSelect.options[bankSelect.selectedIndex].text,
        account_number: $("#poSuAccountNumber").value.trim(),
      };
      nextStage();
    });
    const skipBtn = document.querySelector('[data-act="payout-skip"]');
    if (skipBtn) skipBtn.addEventListener("click", () => { state.payout.pending = false; nextStage(); });
    const payoutBack = document.querySelector('[data-act="payout-back"]');
    if (payoutBack) payoutBack.addEventListener("click", () => { state.authStage = "vverify"; render(); });
  }

  // role picker's "Log in" link jumps straight to the login screen —
  // no role/business/profile questions, since that's looked up from the account
  const gotoLogin = document.querySelector('[data-act="goto-login"]');
  if (gotoLogin) gotoLogin.addEventListener("click", () => {
    state.authMode = "login";
    state.authStage = "auth";
    state.authStep = "start";
    render();
  });

  // "check your email" screen
  const resendBtn = document.querySelector("#resendEmailBtn");
  if (resendBtn) resendBtn.addEventListener("click", async () => {
    resendBtn.disabled = true; resendBtn.textContent = "Sending…";
    const { error } = await sbResendConfirmation(state.authId);
    resendBtn.disabled = false; resendBtn.textContent = "Resend email";
    toast(error ? "Couldn't resend: " + error.message : "Confirmation email sent again");
  });
  const checkEmailBack = document.querySelector('[data-act="check-email-back"]');
  if (checkEmailBack) checkEmailBack.addEventListener("click", () => {
    state.authRole = null; state.authStage = null; state.vendorType = null;
    state.authStep = "start"; state.authId = "";
    render();
  });

  // back to role picker (from vendor type or auth screens)
  const back = document.querySelector('[data-act="auth-back"]');
  if (back) back.addEventListener("click", () => {
    state.authRole = null; state.authStage = null; state.vendorType = null;
    state.authStep = "start"; state.authId = "";
    render();
  });

  // back from profile → payout setup (student vendors) or role picker (students)
  const pfBack = document.querySelector('[data-act="profile-back"]');
  if (pfBack) pfBack.addEventListener("click", () => {
    if (state.authRole === "vendor") { state.authStage = "payout"; }
    else { state.authRole = null; state.authStage = null; }
    render();
  });

  // profile screen: identity fields + level chips + department select
  const pfCheck = () => {
    const go = $("#pfContinue");
    if (!go) return;
    const nameOk = $("#pfName") && $("#pfName").value.trim().length >= 3;
    const matOk = $("#pfMatric") && $("#pfMatric").value.trim().length >= 6;
    go.disabled = !(nameOk && matOk && state.profile.level && state.profile.dept);
  };
  ["#pfName", "#pfMatric"].forEach((s) => {
    const el = $(s);
    if (el) el.addEventListener("input", () => {
      if (s === "#pfName") state.profile.name = el.value;
      else state.profile.matric = el.value;
      pfCheck();
    });
  });
  document.querySelectorAll("[data-level]").forEach((b) =>
    b.addEventListener("click", () => {
      state.profile.level = b.dataset.level;
      document.querySelectorAll("[data-level]").forEach((x) =>
        x.classList.toggle("active", x === b));
      pfCheck();
    }));
  const pfDept = $("#pfDept");
  if (pfDept) pfDept.addEventListener("change", () => {
    state.profile.dept = pfDept.value;
    pfCheck();
  });
  pfCheck();
  const pfGo = $("#pfContinue");
  if (pfGo) pfGo.addEventListener("click", () => {
    if (pfGo.disabled) {
      if ($("#pfMatric").value.trim().length < 6) return toast("Enter a valid matric number");
      return;
    }
    state.authStage = "auth";
    render();
  });

  // back from password step to the start step
  const pwBack = document.querySelector('[data-act="pw-back"]');
  if (pwBack) pwBack.addEventListener("click", () => { state.authStep = "start"; render(); });

  // signup <-> login toggle
  const toggle = document.querySelector('[data-act="auth-toggle"]');
  if (toggle) toggle.addEventListener("click", () => {
    state.authMode = state.authMode === "signup" ? "login" : "signup";
    state.authStep = "start"; state.authId = "";
    render();
  });

  // social / phone buttons — not wired up yet, coming in a later pass
  document.querySelectorAll("[data-auth]").forEach((b) =>
    b.addEventListener("click", () => toast("Coming soon — use email for now")));

  document.querySelectorAll("[data-legal]").forEach((b) =>
    b.addEventListener("click", (e) => { e.preventDefault(); showLegalDoc(b.dataset.legal); }));

  // email / phone → password step
  const idInput = $("#authId");
  const cont = $("#authContinue");
  if (idInput && cont) {
    const goPw = () => {
      if (cont.disabled) return;
      state.authId = idInput.value.trim();
      state.authStep = "password";
      render();
    };
    idInput.addEventListener("input", () => {
      cont.disabled = idInput.value.trim().length < 3;
    });
    cont.addEventListener("click", goPw);
    idInput.addEventListener("keydown", (e) => { if (e.key === "Enter") goPw(); });
    idInput.focus();
  }

  // password step
  const pw = $("#authPw");
  const pw2 = $("#authPw2"); // only exists on signup
  const pwGo = $("#pwContinue");
  if (pw && pwGo) {
    const valid = () => {
      const okLen = pw.value.length >= 6;
      const okMatch = !pw2 || pw2.value === pw.value;
      pwGo.disabled = !(okLen && okMatch);
    };
    pw.addEventListener("input", valid);
    if (pw2) pw2.addEventListener("input", valid);
    const submit = () => {
      if (pwGo.disabled) {
        if (pw.value.length < 6) return toast("Password must be at least 6 characters");
        if (pw2 && pw2.value !== pw.value) return toast("Passwords don't match");
        return;
      }
      completeAuth("email");
    };
    pwGo.addEventListener("click", submit);
    [pw, pw2].forEach((el) => el && el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    }));
    pw.focus();
  }
}

/* ---------- image block with fallback (gradient shows if image fails) ---------- */
const imgBlock = (src, cls) =>
  `<div class="${cls}"><img src="${esc(src)}" alt="" loading="lazy" onerror="this.style.display='none'"></div>`;

/* ---------- HOME (feed + lost & found) ---------- */
function myChannels() {
  // channels this user belongs to: General + their level + their department
  const ch = ["General"];
  if (state.user.level) ch.push(state.user.level);
  if (state.user.dept) ch.push(state.user.dept);
  return ch;
}

function homeScreen() {
  const channels = myChannels();

  /* ---- For You ---- */
  const firstName = (state.user.name || "there").split(" ")[0];
  const topMat = [...state.materials].sort((a, b) => b.avg - a.avg)[0];
  const hostelCount = state.listings.filter((l) => l.cat === "Hostel Items").length;
  const academic = !!state.user.level;
  const forYou = `
    <div class="fy-hero">
      <div class="fy-hi">👋 Welcome back, ${esc(firstName)}</div>
      <div class="fy-sub">Here's what's new on campus today</div>
    </div>
    <div class="fy-grid">
      <button class="fy-tile fy-hot" data-goto="${academic ? "study-materials" : "market"}">
        <div class="fy-ico">🔥</div>
        <div class="fy-label">Trending today</div>
        <div class="fy-value fy-small">${esc(academic && topMat ? topMat.title : "Portrait photoshoot sessions")}</div>
      </button>
      <button class="fy-tile" data-goto="events">
        <div class="fy-ico">🎉</div>
        <div class="fy-value">${state.events.length}</div>
        <div class="fy-label">Events this week</div>
      </button>
      <button class="fy-tile" data-goto="market">
        <div class="fy-ico">🛒</div>
        <div class="fy-value">${state.listings.length}</div>
        <div class="fy-label">New marketplace listings</div>
      </button>
      <button class="fy-tile" data-goto="market-hostel">
        <div class="fy-ico">🏠</div>
        <div class="fy-value">${hostelCount}</div>
        <div class="fy-label">Hostel listings</div>
      </button>
      ${academic ? `
      <button class="fy-tile" data-goto="study-materials">
        <div class="fy-ico">📚</div>
        <div class="fy-value">${state.materials.length}</div>
        <div class="fy-label">Study resources</div>
      </button>` : ""}
    </div>`;

  // channel chips: All + each of the user's channels
  const chips = ["All", ...channels].map((c) =>
    `<button class="chip ${state.feedFilter === c ? "active" : ""}" data-feed="${esc(c)}">${esc(c)}</button>`).join("");

  // show posts for the selected channel; "All" = everything relevant to this user
  const visible = state.feed.filter((f) =>
    state.feedFilter === "All" ? channels.includes(f.aud) : f.aud === state.feedFilter);

  const posts = visible.length ? visible.map((f) => `
    <div class="card">
      <div class="post-head">
        <div class="post-avatar">${esc(f.who[0])}</div>
        <div>
          <div class="post-who">${esc(f.who)}</div>
          <div class="post-time">${esc(f.time)} · <b>${esc(f.aud)}</b></div>
        </div>
        <span class="badge ${f.tag === "Official" ? "official" : "plain"}">${esc(f.tag)}</span>
      </div>
      <p class="post-body">${esc(f.text)}</p>
    </div>`).join("")
    : `<div class="empty">No posts in this channel yet — be the first!</div>`;

  const audOptions = channels.map((c) =>
    `<option>${esc(c)}</option>`).join("");

  const lf = state.lost.map((l) => `
    <div class="card lf-item">
      <div class="lf-ico ${l.type}">${l.type === "lost" ? "❓" : "✅"}</div>
      <div style="flex:1">
        <div class="lf-title"><span class="lf-type ${l.type}">${l.type}</span>${esc(l.item)}</div>
        <div class="lf-meta">📍 ${esc(l.where)}</div>
        <div class="lf-sub">${esc(l.who)} · ${esc(l.time)}</div>
      </div>
      ${l.reporterId === state.user.id ? "" : `<button class="lf-contact" data-act="lf-contact" data-reporter-id="${l.reporterId}" data-reporter-name="${esc(l.who)}">Contact</button>`}
    </div>`).join("");

  return `
    ${forYou}
    <div class="section-head">
      <div>
        <div class="eyebrow">Campus feed</div>
        <h1 class="h1">What's happening on campus</h1>
      </div>
    </div>
    <div class="two-col">
      <div>
        <div class="chips" style="padding-bottom:10px">${chips}</div>
        <div class="composer">
          <input id="postInput" class="input" placeholder="Share an update with campus…" />
          ${channels.length > 1 ? `<select id="postAud" class="input aud-select" title="Who should see this?">${audOptions}</select>` : ""}
          <button class="btn btn-primary" data-act="post">Post</button>
        </div>
        ${posts}
      </div>
      <div>
        <div class="section-head" style="padding-top:6px">
          <div>
            <div class="eyebrow">Lost &amp; found</div>
            <h3 class="h3">Missing something?</h3>
          </div>
          <button class="btn btn-ghost btn-sm" data-act="open-lf">＋ Report</button>
        </div>
        ${lf}
      </div>
    </div>`;
}

/* ---------- MARKET ---------- */
function marketScreen() {
  const chips = state.cats.map((c) =>
    `<button class="chip ${state.cat === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");

  const items = state.listings.filter((l) =>
    (state.cat === "All" || l.cat === state.cat) &&
    l.title.toLowerCase().includes(state.query.toLowerCase()));

  const cards = items.map((l) => `
    <button class="listing" data-item="${l.id}">
      ${imgBlock(l.img, "thumb")}
      <div class="listing-body">
        <div class="listing-title">${esc(l.title)}</div>
        <div class="price">${naira(l.price)}</div>
        <div class="loc">📍 ${esc(l.loc)}</div>
      </div>
    </button>`).join("");

  return `
    <div class="section-head">
      <div>
        <div class="eyebrow">Marketplace</div>
        <h1 class="h1">Buy &amp; sell on campus</h1>
      </div>
      ${state.user.role === "vendor" ? `<button class="btn btn-accent btn-sm" data-act="open-sell">＋ Sell</button>` : ""}
    </div>
    <div class="market-tools">
      <div class="search-wrap">
        <span class="search-ico">🔍</span>
        <input id="searchInput" class="input" placeholder="Search the market…" value="${esc(state.query)}" />
      </div>
      <div class="chips">${chips}</div>
    </div>
    ${items.length
      ? `<div class="grid">${cards}</div>`
      : `<div class="empty">Nothing here yet — try another category, or be the first to sell.</div>`}
  `;
}

/* ---------- EVENTS ---------- */
// platform fee rates are configurable (platform_fees table) — these read
// the value hydrateFees() loaded, falling back to the seeded defaults in
// state.fees until that's had a chance to run
const eventFee = (price) =>
  price > 0 ? Math.max(Math.round(price * (state.fees.events.percent / 100)), state.fees.events.min_fee) : 0;
const marketplaceFee = (itemTotal) =>
  Math.max(Math.round(itemTotal * (state.fees.marketplace.percent / 100)), state.fees.marketplace.min_fee);

// mirrors the Paystack-fee gross-up math in the init-*-payment Edge
// Functions, for a client-side estimate shown before checkout — the
// authoritative total is always whatever the Edge Function returns
const estimateGrossUpTotal = (base) => {
  let total = Math.ceil((base + 100) / 0.985);
  if (total < 2500) total = Math.ceil(base / 0.985);
  const fee = total - base;
  return fee > 2000 ? base + 2000 : total;
};

/* small QR code as an inline SVG string, for ticket codes */
const qrSvg = (text) => {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag(4, 4);
};

function eventsScreen() {
  const segHTML = `
    <div class="study-seg">
      <button class="study-seg-btn ${state.eventsTab === "browse" ? "active" : ""}" data-events-tab="browse">🎉 Browse</button>
      <button class="study-seg-btn ${state.eventsTab === "myEvents" ? "active" : ""}" data-events-tab="myEvents">🎟️ My Events</button>
    </div>`;

  const head = `
    <div class="section-head">
      <div>
        <div class="eyebrow">Events &amp; tickets</div>
        <h1 class="h1">Don't miss out</h1>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" data-act="open-scan">🔍 Scan tickets</button>
        <button class="btn btn-accent btn-sm" data-act="open-host">＋ Host event</button>
      </div>
    </div>
    ${segHTML}`;

  if (state.eventsTab === "myEvents") return head + myEventsTabHTML();
  return head + browseEventsTabHTML();
}

function myEventsTabHTML() {
  const rows = state.myEvents.length ? state.myEvents.map((ev) => {
    const past = new Date(ev.startsAt) < new Date();
    const tierRows = ev.tiers.map((t) => `
      <div class="row-item" style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div class="row-main">
          <div class="row-title" style="font-size:13px">${esc(t.name)}</div>
          <div class="row-sub">${t.left} left of ${t.quantityTotal} · ${naira(t.price)}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" data-edit-tier="${t.id}">Rename</button>
          ${t.left <= 0 ? `<button class="btn btn-accent btn-sm" data-restock-tier="${t.id}">Restock</button>` : ""}
        </div>
      </div>`).join("");
    return `
    <div class="card">
      <div class="row-title">
        ${esc(ev.title)}
        ${ev.cancelledAt ? '<span class="stock-pill stock-low" style="margin-left:6px">Cancelled</span>' : past ? '<span class="stock-pill stock-low" style="margin-left:6px">Past</span>' : ""}
      </div>
      <div class="row-sub">${esc(fmtEventDateTime(ev.startsAt))} · 📍 ${esc(ev.venue)}</div>
      ${ev.rescheduledAt ? `<div class="row-sub" style="margin-top:6px;color:var(--rose-600)">Rescheduled from ${esc(fmtEventDateTime(ev.rescheduledFromStartsAt))} at ${esc(ev.rescheduledFromVenue)} — ${esc(ev.rescheduleReason)}</div>` : ""}
      <div style="margin-top:10px">${tierRows || '<div class="row-sub">No ticket tiers</div>'}</div>
      ${ev.cancelledAt ? "" : `
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-add-tier="${ev.id}">＋ Add ticket type</button>
        ${ev.rescheduledAt ? "" : `<button class="btn btn-ghost btn-sm" data-reschedule-event="${ev.id}">📅 Reschedule</button>`}
        <button class="btn btn-ghost btn-sm" data-cancel-event="${ev.id}" style="color:var(--rose-600)">Delete / Cancel event</button>
      </div>`}
    </div>`;
  }).join("") : `<div class="empty">You haven't hosted any events yet</div>`;
  return `<div class="events-grid" style="display:grid;gap:12px">${rows}</div>`;
}

function findMyTier(tierId) {
  for (const ev of state.myEvents) {
    const t = ev.tiers.find((x) => x.id === tierId);
    if (t) return t;
  }
  return null;
}

function showTierRenameForm(tierId, name, desc) {
  openModal(`
    ${modalHead("Rename ticket type")}
    <input id="tierName" class="input" placeholder="Name" value="${esc(name)}" />
    <textarea id="tierDesc" class="input" rows="2" placeholder="Description (optional)">${esc(desc || "")}</textarea>
    <button class="btn btn-primary btn-block" id="tierRenameGo">Save</button>
  `);
  $("#tierRenameGo").addEventListener("click", async () => {
    const newName = $("#tierName").value.trim();
    if (!newName) return toast("Give it a name");
    const btn = $("#tierRenameGo");
    btn.disabled = true; btn.textContent = "Saving…";
    const { error } = await sbUpdateTicketTier(tierId, { name: newName, description: $("#tierDesc").value.trim() || null });
    if (error) { btn.disabled = false; btn.textContent = "Save"; return toast("Couldn't save: " + error.message); }
    await hydrateEvents();
    closeModal(); toast("Ticket type updated");
  });
}

function showRestockForm(tierId, currentTotal) {
  openModal(`
    ${modalHead("Restock ticket type")}
    <p class="row-sub" style="margin-bottom:10px">Currently ${currentTotal} total spots. How many more do you want to add?</p>
    <input id="restockQty" class="input" type="number" min="1" placeholder="e.g. 20" />
    <button class="btn btn-primary btn-block" id="restockGo">Add spots</button>
  `);
  $("#restockGo").addEventListener("click", async () => {
    const addQty = Number($("#restockQty").value);
    if (!addQty || addQty < 1) return toast("Enter how many more spots to add");
    const btn = $("#restockGo");
    btn.disabled = true; btn.textContent = "Saving…";
    const { error } = await sbUpdateTicketTier(tierId, { quantity_total: currentTotal + addQty });
    if (error) { btn.disabled = false; btn.textContent = "Add spots"; return toast("Couldn't restock: " + error.message); }
    await hydrateEvents();
    closeModal(); toast(`Added ${addQty} more spots 🎟️`);
  });
}

function showAddTierForm(eventId) {
  openModal(`
    ${modalHead("Add a ticket type")}
    <input id="newTierName" class="input" placeholder="Name (e.g. VIP)" />
    <div class="phone-row">
      <input id="newTierPrice" class="input" type="number" min="0" placeholder="Price ₦ (0 = free)" />
      <input id="newTierQty" class="input" type="number" min="1" placeholder="Quantity available" />
    </div>
    <button class="btn btn-primary btn-block" id="newTierGo">Add ticket type</button>
  `);
  $("#newTierGo").addEventListener("click", async () => {
    const name = $("#newTierName").value.trim();
    const price = Number($("#newTierPrice").value);
    const qty = Number($("#newTierQty").value);
    if (!name || qty < 1) return toast("Give it a name and a quantity");
    const btn = $("#newTierGo");
    btn.disabled = true; btn.textContent = "Adding…";
    const { error } = await sbInsertTicketTiers([{ event_id: eventId, name, price: price || 0, quantity_total: qty }]);
    if (error) { btn.disabled = false; btn.textContent = "Add ticket type"; return toast("Couldn't add: " + error.message); }
    await hydrateEvents();
    closeModal(); toast("Ticket type added");
  });
}

/* sold count is computed from already-loaded tier data (quantityTotal -
   left), no extra query needed — just a preview though, the server
   decides for real which path (delete vs refund-and-cancel) applies */
function showCancelEventConfirm(event) {
  const sold = event.tiers.reduce((s, t) => s + (t.quantityTotal - t.left), 0);
  const willDelete = sold === 0;
  openModal(`
    ${modalHead(willDelete ? "Delete this event?" : "Cancel this event?")}
    <p class="row-sub" style="margin-bottom:14px">
      ${willDelete
        ? "No tickets have been sold yet, so this event can be permanently deleted. This cannot be undone."
        : `${sold} ticket${sold === 1 ? " has" : "s have"} already been sold. Cancelling will automatically refund every ticket holder via Paystack and mark the event cancelled — it will stay visible in your My Events and to ticket holders, but disappear from public browsing. This cannot be undone.`}
    </p>
    <button class="btn btn-primary btn-block" id="cancelEventGo" style="background:var(--rose-600)">${willDelete ? "Delete event" : "Cancel event & refund everyone"}</button>
    <button class="btn btn-ghost btn-block" data-close style="margin-top:8px">Never mind</button>
  `);
  $("#cancelEventGo").addEventListener("click", async () => {
    const btn = $("#cancelEventGo");
    btn.disabled = true; btn.textContent = "Working…";
    const { data, error } = await sbCancelEvent(event.id);
    if (error || data?.error) {
      const msg = (data && data.error) || await edgeErrorMessage(error, "Couldn't process that");
      btn.disabled = false; btn.textContent = willDelete ? "Delete event" : "Cancel event & refund everyone";
      return toast(msg);
    }
    await hydrateEvents();
    closeModal();
    toast(data.action === "deleted" ? "Event deleted" : `Event cancelled — ${data.refunded_count} ticket(s) refunded`);
  });
}

/* one reschedule per event ever (enforced server-side too) — title is
   never editable here, only date/time/venue, and a reason is required
   since it's stored permanently and shown on the event's public card */
function showRescheduleForm(event) {
  const d = new Date(event.startsAt);
  const pad = (n) => String(n).padStart(2, "0");
  const curDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const curTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  openModal(`
    ${modalHead("Reschedule event")}
    <p class="row-sub" style="margin-bottom:14px">Only use this for genuine emergencies (venue issues, safety, etc). You can only reschedule an event once. Every ticket holder is notified the moment you save this, and can request a full refund within 72 hours.</p>
    <div class="field-label"><span class="req">*</span>New date &amp; time</div>
    <div class="phone-row">
      <input id="rsDate" class="input" type="date" value="${curDate}" />
      <input id="rsTime" class="input" type="time" value="${curTime}" />
    </div>
    <div class="field-label"><span class="req">*</span>New venue</div>
    <input id="rsVenue" class="input" placeholder="e.g. Multipurpose Hall" value="${esc(event.venue)}" />
    <div class="field-label"><span class="req">*</span>Reason (shown publicly on the event)</div>
    <textarea id="rsReason" class="input" rows="3" placeholder="e.g. Original venue flooded, moving to a new hall"></textarea>
    <button class="btn btn-primary btn-block" id="rsGo" style="background:var(--rose-600)">Reschedule &amp; notify ticket holders</button>
    <button class="btn btn-ghost btn-block" data-close style="margin-top:8px">Never mind</button>
  `);
  $("#rsGo").addEventListener("click", async () => {
    const date = $("#rsDate").value.trim();
    const time = $("#rsTime").value.trim();
    const venue = $("#rsVenue").value.trim();
    const reason = $("#rsReason").value.trim();
    if (!date || !time || !venue) return toast("Fill in the new date, time and venue");
    if (!reason) return toast("A reason is required");
    const newStartsAt = new Date(`${date}T${time}`).toISOString();
    const btn = $("#rsGo");
    btn.disabled = true; btn.textContent = "Rescheduling…";
    const { error } = await sbRescheduleEvent(event.id, newStartsAt, venue, reason);
    if (error) { btn.disabled = false; btn.textContent = "Reschedule & notify ticket holders"; return toast("Couldn't reschedule: " + error.message); }
    await hydrateEvents();
    closeModal(); toast("Event rescheduled — ticket holders notified");
  });
}

/* preview only shows what the server already decided is true (a
   72-hour window from rescheduled_at); reschedule-refund re-checks the
   window itself server-side, this is just so the button doesn't appear
   to work when it's already expired */
function showRequestRescheduleRefundConfirm(ticket) {
  openModal(`
    ${modalHead("Request a refund?")}
    <p class="row-sub" style="margin-bottom:14px">This event was rescheduled. Since the new date/venue may not work for you, you can request a full refund for this ticket. This cannot be undone.</p>
    <button class="btn btn-primary btn-block" id="rescheduleRefundGo" style="background:var(--rose-600)">Request refund</button>
    <button class="btn btn-ghost btn-block" data-close style="margin-top:8px">Never mind</button>
  `);
  $("#rescheduleRefundGo").addEventListener("click", async () => {
    const btn = $("#rescheduleRefundGo");
    btn.disabled = true; btn.textContent = "Working…";
    const { data, error } = await sbRequestRescheduleRefund(ticket.id);
    if (error || data?.error) {
      const msg = (data && data.error) || await edgeErrorMessage(error, "Couldn't process that");
      btn.disabled = false; btn.textContent = "Request refund";
      return toast(msg);
    }
    await hydrateEvents();
    closeModal();
    toast("Refund requested — you'll be refunded shortly");
  });
}

/* shown on a paid, non-refunded ticket whose event was rescheduled —
   the 72h window is only a display hint here (reschedule-refund
   re-checks it server-side), so the button never appears once the
   client-side clock says it's expired */
function rescheduleNoticeHTML(t) {
  const withinWindow = Date.now() - new Date(t.rescheduledAt).getTime() <= 72 * 60 * 60 * 1000;
  return `
    <div class="row-sub" style="margin-top:12px;color:var(--rose-600)">
      Rescheduled from ${esc(fmtEventDateTime(t.rescheduledFromStartsAt))} at ${esc(t.rescheduledFromVenue)} — ${esc(t.rescheduleReason)}
    </div>
    ${withinWindow
      ? `<button class="btn btn-ghost btn-sm" data-request-reschedule-refund="${t.id}" style="margin-top:8px">Request refund (event rescheduled)</button>`
      : `<div class="row-sub" style="margin-top:6px">The 72-hour refund window for this reschedule has closed.</div>`}`;
}

function browseEventsTabHTML() {
  const cards = state.events.map((ev) => {
    const open = ev.tiers.filter((t) => t.left > 0);
    const minPrice = open.length ? Math.min(...open.map((t) => t.price)) : null;
    const totalLeft = ev.tiers.reduce((s, t) => s + t.left, 0);
    const priceLabel = totalLeft === 0 ? "Sold out"
      : minPrice === 0 ? "Free"
      : "From " + naira(minPrice);
    return `
    <div class="event-card">
      ${imgBlock(ev.img, "event-thumb")}
      <div class="event-body">
        <div class="event-top">
          <div>
            <span class="tag">${esc(ev.tag)}</span>
            <div class="event-title">${esc(ev.title)}</div>
            <div class="event-meta">${esc(fmtEventDateTime(ev.startsAt))}</div>
            <div class="event-meta">📍 ${esc(ev.venue)}</div>
            <div class="event-meta">By ${esc(ev.organizer)}</div>
            ${ev.rescheduledAt ? `<div class="event-meta" style="color:var(--rose-600)">Rescheduled from ${esc(fmtEventDateTime(ev.rescheduledFromStartsAt))} at ${esc(ev.rescheduledFromVenue)} — ${esc(ev.rescheduleReason)}</div>` : ""}
          </div>
          <div>
            <div class="event-price">${priceLabel}</div>
            <div class="event-left">${totalLeft} left</div>
          </div>
        </div>
        <button class="btn btn-primary btn-block mt-16" data-buy="${ev.id}" ${totalLeft === 0 ? "disabled" : ""}>
          🎟️ ${totalLeft === 0 ? "Sold out" : "Get tickets"}
        </button>
      </div>
    </div>`;
  }).join("");

  const myTickets = state.tickets.length
    ? `<div class="section-head" style="padding-top:24px"><div class="eyebrow">My tickets</div></div>
       <div class="events-grid">
       ${state.tickets.map((t) => `
        <div class="ticket">
          <div class="ticket-label">CampusHub Ticket
            ${t.refunded ? '<span class="stock-pill stock-low" style="margin-left:8px">Refunded</span>'
              : t.usedAt ? '<span class="stock-pill stock-ok" style="margin-left:8px">Used ✅</span>' : ""}
          </div>
          <div class="ticket-event">${esc(t.event)}</div>
          <div class="ticket-meta">${t.qty} × ${esc(t.tier)} · ${t.total === 0 ? "Free" : naira(t.total)}</div>
          ${t.refunded
            ? `<div class="row-sub" style="margin:12px 0">${t.cancelledAt ? "This event was cancelled — your ticket was refunded." : "This event was rescheduled and your ticket was refunded at your request."}</div>`
            : `<div class="ticket-qr">${qrSvg(t.code)}</div><div class="ticket-code">${esc(t.code)}</div>
               ${t.rescheduledAt ? rescheduleNoticeHTML(t) : ""}`}
        </div>`).join("")}
       </div>`
    : "";

  return `
    <div class="events-grid">${cards}</div>
    ${myTickets}`;
}

/* ---------- MESSAGES (inbox) ---------- */
function messagesScreen() {
  const rows = [...state.conversations]
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
    .map((c) => {
      const unread = c.unreadCount > 0;
      const mine = c.lastSenderId === state.user.id ? "You: " : "";
      const preview = c.lastMessageImage ? "📷 Photo" : (c.lastMessageText || "");
      return `
      <button class="card row-item" data-open-conv="${c.otherUserId}" data-open-conv-name="${esc(c.otherUserName)}" style="width:100%;text-align:left">
        <div class="row-ico">${esc((c.otherUserName || "?")[0])}</div>
        <div class="row-main">
          <div class="row-title">${esc(c.otherUserName)}${unread ? `<span class="msg-unread-dot"></span>` : ""}</div>
          <div class="row-sub">${esc(mine + preview)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div class="row-sub">${esc(fmtRowTime(c.lastMessageAt))}</div>
          ${unread ? `<span class="stock-pill stock-low">${c.unreadCount}</span>` : ""}
        </div>
      </button>`;
    }).join("");

  return `
    <div class="section-head">
      <div>
        <div class="eyebrow">Chats</div>
        <h1 class="h1">Messages</h1>
      </div>
    </div>
    ${rows || `<div class="empty" style="padding:40px 20px;text-align:center">No conversations yet — message a seller or organizer to get started 💬</div>`}`;
}

/* ---------- SHOP (vendor dashboard) ---------- */
function shopScreen() {
  const revenue = state.sales.reduce((s, x) => s + x.total, 0);
  const profit = state.sales.reduce((s, x) => s + x.profit, 0);
  const low = state.products.filter((p) => p.stock <= 5).length;
  const ms = state.myShop;
  const avg = ms.reviews.length ? ms.reviews.reduce((s, r) => s + r.stars, 0) / ms.reviews.length : 0;
  const newOrders = ms.orders.filter((o) => o.status === "new");

  const inventory = state.products.map((p) => `
    <div class="card row-item">
      ${p.img
        ? `<div class="row-thumb"><img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.style.display='none'"></div>`
        : `<div class="row-ico">🏷️</div>`}
      <div class="row-main">
        <div class="row-title">${esc(p.name)}</div>
        <div class="row-sub">${naira(p.price)} · cost ${naira(p.cost)} · margin ${naira(p.price - p.cost)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="stock-pill ${p.stock <= 5 ? "stock-low" : "stock-ok"}">${p.stock} left</span>
        ${p.listed
          ? `<button class="btn btn-ghost btn-sm" data-unlist-product="${p.id}">✅ Listed</button>`
          : `<button class="btn btn-accent btn-sm" data-list-product="${p.id}">📢 List</button>`}
      </div>
    </div>`).join("");

  const salesRows = state.sales.map((s) => `
    <div class="card row-item">
      <div class="row-ico">📈</div>
      <div class="row-main">
        <div class="row-title">${s.qty} × ${esc(s.name)}</div>
        <div class="row-sub">${esc(s.time)}</div>
      </div>
      <div>
        <div class="sale-total">${naira(s.total)}</div>
        <div class="sale-profit">+${naira(s.profit)} profit</div>
      </div>
    </div>`).join("");

  const orderRows = ms.orders.map((o) => {
    const p = state.products.find((x) => x.id === o.pid);
    if (!p) return "";
    return `
      <div class="card row-item">
        <div class="row-ico">${o.status === "new" ? "🛎️" : "✅"}</div>
        <div class="row-main">
          <div class="row-title">${o.qty} × ${esc(p.name)} ${o.paymentStatus === "paid" ? '<span class="stock-pill stock-ok" style="margin-left:6px">Paid</span>' : ""}</div>
          <div class="row-sub">from ${esc(o.buyer)} · ${esc(o.time)} · ${naira(p.price * o.qty)}</div>
        </div>
        ${o.status === "new"
          ? `<div style="display:flex;gap:6px">
               <button class="btn btn-ghost btn-sm" data-chat-buyer="${o.buyerId}" data-chat-buyer-name="${esc(o.buyer)}">💬</button>
               <button class="btn btn-accent btn-sm" data-complete="${o.id}">Complete</button>
             </div>`
          : `<span class="stock-pill stock-ok">Completed</span>`}
      </div>`;
  }).join("");

  const reviewRows = ms.reviews.map((r) => `
    <div class="card">
      <div class="post-head" style="margin-bottom:4px">
        <div class="post-avatar">${esc(r.who[0])}</div>
        <div style="flex:1">
          <div class="post-who">${esc(r.who)}</div>
          <div class="post-time">${esc(r.time)}</div>
        </div>
        <span class="mat-stars">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</span>
      </div>
      <p class="post-body">${esc(r.text)}</p>
    </div>`).join("");

  const payoutBanner = state.payoutAccount ? "" : `
    <div class="card" style="border-color:var(--orange-400);display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <div style="font-size:22px">🏦</div>
      <div style="flex:1">
        <div class="row-title">Set up payouts to get paid</div>
        <div class="row-sub">Add your bank details so sales and ticket revenue reach you automatically.</div>
      </div>
      <button class="btn btn-accent btn-sm" id="shopSetPayout">Set up</button>
    </div>`;

  // selling stays open to everyone regardless of verification status —
  // this only ever gates the trust badge, never the ability to sell
  const biz = state.user.business;
  const vr = state.verificationRequirements;
  const meetsVerificationBar = state.sales.length >= vr.minSales
    && ms.reviews.length >= vr.minRatingCount
    && avg >= vr.minAvgRating;
  const verificationBanner = !biz || biz.verified ? "" : biz.verificationRequestedAt ? `
    <div class="card" style="border-color:var(--indigo-400);display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <div style="font-size:22px">🛡️</div>
      <div style="flex:1">
        <div class="row-title">Verification requested</div>
        <div class="row-sub">An admin will review your shop soon.</div>
      </div>
    </div>` : `
    <div class="card" style="border-color:var(--orange-400);margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:22px">🛡️</div>
        <div style="flex:1">
          <div class="row-title">Get the verified badge</div>
          <div class="row-sub">${state.sales.length}/${vr.minSales} completed sales · ${avg.toFixed(1)}★ avg (${ms.reviews.length}/${vr.minRatingCount} ratings, need ${vr.minAvgRating.toFixed(1)}+)</div>
        </div>
        ${meetsVerificationBar ? `<button class="btn btn-accent btn-sm" id="requestVerificationBtn">Request Verification</button>` : ""}
      </div>
      ${meetsVerificationBar ? "" : `<div class="row-sub" style="margin-top:8px">Keep selling and building your rating — you'll be able to request verification once you qualify.</div>`}
    </div>`;

  return `
    <div class="section-head">
      <div>
        <div class="eyebrow">My shop · ${esc(biz && biz.name ? biz.name : "Your Business")} ${biz && biz.verified ? '<span class="verified-badge">🛡️ Verified</span>' : ""}</div>
        <h1 class="h1">Vendor dashboard</h1>
      </div>
    </div>
    ${payoutBanner}
    ${verificationBanner}

    <div class="trust-strip">
      <div class="trust-stat"><b>👥 ${ms.followers}</b><span>followers</span></div>
      <div class="trust-stat"><b>⭐ ${avg.toFixed(1)}</b><span>${ms.reviews.length} reviews</span></div>
      <div class="trust-stat"><b>✅ ${state.sales.length}</b><span>completed sales</span></div>
      <div class="trust-stat"><b>🛎️ ${newOrders.length}</b><span>new orders</span></div>
    </div>

    <div class="shop-grid">
      <div class="profit-card">
        <div class="profit-label">Today so far</div>
        <div class="profit-value">${naira(profit)}</div>
        <div class="profit-sub">profit · ${naira(revenue)} in sales · ${state.sales.length} sale${state.sales.length !== 1 ? "s" : ""}</div>
      </div>
      <button class="action-tile tile-dark" data-act="open-sale">
        <span class="t-ico">💰</span>
        <div class="t-title">Record a sale</div>
        <div class="t-sub">Stock updates itself</div>
      </button>
      <button class="action-tile tile-light" data-act="open-product">
        <span class="t-ico">📦</span>
        <div class="t-title">Add product</div>
        <div class="t-sub">${low > 0 ? `${low} item${low > 1 ? "s" : ""} low on stock` : "Stock looks healthy"}</div>
      </button>
    </div>

    <div class="section-head"><div><div class="eyebrow">Incoming</div><h3 class="h3">Orders</h3></div></div>
    ${orderRows || `<div class="empty">No orders yet — share your shop link!</div>`}

    <div class="shop-two">
      <div>
        <div class="section-head"><div class="eyebrow">Inventory</div><span class="row-sub">${state.products.length} products</span></div>
        ${inventory}
      </div>
      <div>
        <div class="section-head"><div class="eyebrow">Sales today</div></div>
        ${salesRows}
        <div class="section-head"><div class="eyebrow">What buyers say</div><span class="mat-stars">${stars(avg)}</span></div>
        ${reviewRows}
      </div>
    </div>`;
}

/* ==========================================================
   STUDY HUB  (My Class · Materials · CGPA)
   ========================================================== */

const GRADE_POINTS = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const CLASS_TARGETS = [
  { label: "First Class (4.50)", gpa: 4.5 },
  { label: "Second Class Upper (3.50)", gpa: 3.5 },
  { label: "Second Class Lower (2.40)", gpa: 2.4 },
  { label: "Third Class (1.50)", gpa: 1.5 },
];

const stars = (avg) => {
  const full = Math.round(avg);
  return "★".repeat(full) + "☆".repeat(5 - full);
};

function studyScreen() {
  const seg = ["class", "materials", "cgpa"];
  const segLabels = { class: "🎓 My Class", materials: "📁 Materials", cgpa: "🧮 CGPA" };
  const segHTML = `<div class="study-seg">${seg.map((s) =>
    `<button class="study-seg-btn ${state.studyTab === s ? "active" : ""}" data-study="${s}">${segLabels[s]}</button>`).join("")}</div>`;

  const head = `
    <div class="section-head">
      <div>
        <div class="eyebrow">${esc(state.user.dept)} · ${esc(state.user.level)}</div>
        <h1 class="h1">Study</h1>
      </div>
    </div>
    ${segHTML}`;

  if (state.studyTab === "class") return head + classTabHTML();
  if (state.studyTab === "materials") return head + materialsTabHTML();
  return head + cgpaTabHTML();
}

/* ---------- MY CLASS ---------- */
function classTabHTML() {
  const cr = state.classroom;

  const annComposer = `
    <div class="composer">
      <input id="annInput" class="input" placeholder="Post an announcement to your class…" />
      <button class="btn btn-primary" data-act="post-announcement">Post</button>
    </div>`;

  const anns = cr.announcements.length ? cr.announcements.map((a) => `
    <div class="card">
      <div class="post-head">
        <div class="post-avatar">📣</div>
        <div><div class="post-who">${esc(a.who)}</div><div class="post-time">${esc(a.time)}</div></div>
      </div>
      <p class="post-body">${esc(a.text)}</p>
    </div>`).join("") : `<div class="empty">No announcements yet</div>`;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const tt = days.map((d) => {
    const rows = cr.timetable.filter((t) => t.day === d);
    if (!rows.length) return "";
    return `<div class="tt-day">${d}</div>` + rows.map((t) => `
      <button class="tt-row" data-edit-tt="${t.id}">
        <b>${esc(t.course)}</b><span>${esc(t.time)}</span><span>📍 ${esc(t.venue)}</span>
      </button>`).join("");
  }).join("") || `<div class="empty">No classes added yet</div>`;

  const exams = cr.exams.length ? cr.exams.map((e) => `
    <button class="card row-item" data-edit-exam="${e.id}" style="width:100%;text-align:left">
      <div class="row-ico">${e.type === "Exam" ? "📝" : "🧪"}</div>
      <div class="row-main">
        <div class="row-title">${esc(e.course)} — ${esc(e.type)}</div>
        <div class="row-sub">${esc(fmtEventDateTime(e.startsAt))} · ${esc(e.venue)}</div>
      </div>
    </button>`).join("") : `<div class="empty">No exams or tests added yet</div>`;

  const assigns = cr.assignments.length ? cr.assignments.map((a) => `
    <div class="card row-item">
      <div class="row-ico">${a.submitted ? "✅" : "📄"}</div>
      <div class="row-main">
        <div class="row-title">${esc(a.course)}: ${esc(a.title)}</div>
        <div class="row-sub">Due ${esc(a.due)}${a.submitted ? " · submitted: " + esc(a.file) : ""}</div>
      </div>
      ${a.submitted
        ? `<span class="stock-pill stock-ok">Submitted</span>`
        : `<button class="btn btn-accent btn-sm" data-submit="${a.id}">Submit</button>`}
    </div>`).join("") : `<div class="empty">No assignments yet</div>`;

  const polls = cr.polls.length ? cr.polls.map((p) => {
    const total = p.options.reduce((s, o) => s + o.votes, 0) || 1;
    const showOptions = p.voted === null || state.pollChangingIds.includes(p.id);
    const opts = p.options.map((o) => {
      const pct = Math.round((o.votes / total) * 100);
      if (showOptions) {
        return `<button class="poll-opt" data-poll="${p.id}" data-opt="${o.id}">${esc(o.label)}</button>`;
      }
      return `
        <div class="poll-result ${p.voted === o.id ? "mine" : ""}">
          <div class="poll-bar" style="width:${pct}%"></div>
          <span>${esc(o.label)}${p.voted === o.id ? " ✓" : ""}</span><b>${pct}%</b>
        </div>`;
    }).join("");
    return `
      <div class="card">
        <div class="row-title">🗳️ ${esc(p.q)}</div>
        <div class="poll-opts">${opts}</div>
        <div class="row-sub" style="margin-top:8px">
          ${total} vote${total !== 1 ? "s" : ""}${p.voted !== null ? " · you voted" : ""}
          ${p.voted !== null && !showOptions ? `<button class="poll-change" data-change-vote="${p.id}">Change vote</button>` : ""}
        </div>
      </div>`;
  }).join("") : `<div class="empty">No polls yet</div>`;

  const att = cr.attendance.length ? cr.attendance.map((a) => {
    const pct = Math.round((a.present / a.total) * 100);
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="row-title">${esc(a.course)}</div>
          <b style="color:${pct >= 75 ? "var(--indigo-700)" : "var(--rose-600)"}">${a.present}/${a.total} · ${pct}%</b>
        </div>
        <div class="att-track"><div class="att-fill ${pct >= 75 ? "" : "low"}" style="width:${pct}%"></div></div>
        ${pct < 75 ? `<div class="row-sub" style="color:var(--rose-600)">⚠️ Below 75% — you may not qualify to write this exam</div>` : ""}
      </div>`;
  }).join("") : `<div class="empty">No attendance marked yet</div>`;

  return `
    <div class="two-col">
      <div>
        <div class="section-head"><div><div class="eyebrow">From your classmates</div><h3 class="h3">Class announcements</h3></div></div>
        ${annComposer}
        ${anns}
        <div class="section-head">
          <div><div class="eyebrow">This week</div><h3 class="h3">Timetable</h3></div>
          <button class="btn btn-ghost btn-sm" data-act="add-timetable">＋ Add</button>
        </div>
        <div class="card">${tt}</div>
        <div class="section-head">
          <div><div class="eyebrow">Coming up</div><h3 class="h3">Tests &amp; exam dates</h3></div>
          <button class="btn btn-ghost btn-sm" data-act="add-exam">＋ Add</button>
        </div>
        ${exams}
      </div>
      <div>
        <div class="section-head">
          <div><div class="eyebrow">Don't carry over 😅</div><h3 class="h3">Assignments</h3></div>
          <button class="btn btn-ghost btn-sm" data-act="add-assignment">＋ Add</button>
        </div>
        ${assigns}
        <div class="section-head">
          <div><div class="eyebrow">Class decisions</div><h3 class="h3">Polls</h3></div>
          <button class="btn btn-ghost btn-sm" data-act="add-poll">＋ Add</button>
        </div>
        ${polls}
        <div class="section-head">
          <div><div class="eyebrow">Your attendance</div><h3 class="h3">Attendance</h3></div>
          <button class="btn btn-ghost btn-sm" data-act="mark-attendance">＋ Mark</button>
        </div>
        ${att}
        <div class="card" style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1" data-mat-jump="Past Questions">📑 Past questions</button>
          <button class="btn btn-ghost" style="flex:1" data-mat-jump="All">📒 Lecture notes</button>
        </div>
      </div>
    </div>`;
}

/* ---------- MATERIALS ---------- */
function materialsTabHTML() {
  const types = ["All", "PDF", "Handwritten Notes", "Recorded Tutorial", "Slides", "Past Questions"];
  const chips = types.map((t) =>
    `<button class="chip ${state.matFilter === t ? "active" : ""}" data-mat="${esc(t)}">${esc(t)}</button>`).join("");

  const list = state.materials
    .filter((m) => state.matFilter === "All" || m.type === state.matFilter)
    .sort((a, b) => b.avg - a.avg);

  const cards = list.length ? list.map((m) => {
    const rateRow = Array.from({ length: 5 }, (_, i) =>
      `<button class="rate-star ${m.mine > i ? "on" : ""}" data-rate="${m.id}" data-val="${i + 1}">★</button>`).join("");
    return `
      <div class="card">
        <div style="display:flex;gap:12px;align-items:flex-start">
          <div class="row-ico">${{ "PDF": "📕", "Handwritten Notes": "✍️", "Recorded Tutorial": "🎥", "Slides": "📊", "Past Questions": "📑" }[m.type] || "📁"}</div>
          <div style="flex:1">
            <div class="row-title">${esc(m.title)}</div>
            <div class="row-sub">${esc(m.course)} · ${esc(m.type)} · by ${esc(m.by)}</div>
            <div class="mat-rating">
              <span class="mat-stars">${stars(m.avg)}</span>
              <b>${m.avg.toFixed(1)}</b><span class="row-sub">(${m.count} rating${m.count !== 1 ? "s" : ""})</span>
            </div>
            <div class="mat-rate">Rate it: ${rateRow}</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-download="${m.id}">Download</button>
        </div>
      </div>`;
  }).join("") : `<div class="empty">Nothing here yet — upload the first one and be a legend 🙌</div>`;

  return `
    <div class="section-head" style="padding-top:6px">
      <div><div class="eyebrow">Best rated first</div><h3 class="h3">Study materials</h3></div>
      <button class="btn btn-accent btn-sm" data-act="open-upload">＋ Upload</button>
    </div>
    <div class="chips">${chips}</div>
    ${cards}`;
}

/* ---------- CGPA ---------- */
function cgpaTabHTML() {
  // GPA calculator
  const gradeOpts = (sel) => Object.keys(GRADE_POINTS).map((g) =>
    `<option ${sel === g ? "selected" : ""}>${g}</option>`).join("");
  const rows = state.gpaRows.map((r, i) => `
    <div class="gpa-row">
      <input class="input g-course" data-i="${i}" placeholder="Course" value="${esc(r.course)}" />
      <input class="input g-units" data-i="${i}" type="number" min="1" max="6" placeholder="Units" value="${esc(r.units)}" />
      <select class="input g-grade" data-i="${i}">${gradeOpts(r.grade)}</select>
      <button class="gpa-del" data-del="${i}">✕</button>
    </div>`).join("");

  let tUnits = 0, tPoints = 0;
  state.gpaRows.forEach((r) => {
    const u = Number(r.units) || 0;
    tUnits += u; tPoints += u * (GRADE_POINTS[r.grade] ?? 0);
  });
  const gpa = tUnits ? (tPoints / tUnits) : 0;

  // CGPA tracker
  const semRows = state.semesters.map((s, i) => `
    <div class="gpa-row sem">
      <input class="input s-name" data-i="${i}" placeholder="Semester" value="${esc(s.name)}" />
      <input class="input s-gpa" data-i="${i}" type="number" step="0.01" min="0" max="5" placeholder="GPA" value="${esc(s.gpa)}" />
      <input class="input s-units" data-i="${i}" type="number" min="1" placeholder="Units" value="${esc(s.units)}" />
      <button class="gpa-del" data-sdel="${i}">✕</button>
    </div>`).join("");

  let cUnits = 0, cPoints = 0;
  state.semesters.forEach((s) => {
    const u = Number(s.units) || 0;
    cUnits += u; cPoints += u * (Number(s.gpa) || 0);
  });
  const cgpa = cUnits ? (cPoints / cUnits) : 0;

  const targetOpts = CLASS_TARGETS.map((t, i) =>
    `<option value="${t.gpa}" ${i === 0 ? "selected" : ""}>${t.label}</option>`).join("");

  return `
    <div class="two-col">
      <div>
        <div class="card">
          <div class="section-head" style="padding-top:0"><div><div class="eyebrow">This semester</div><h3 class="h3">GPA calculator</h3></div></div>
          <div class="gpa-head"><span>Course</span><span>Units</span><span>Grade</span><span></span></div>
          ${rows}
          <button class="add-tier" data-act="gpa-add">＋ Add course</button>
          <div class="gpa-result">
            <span>GPA (${tUnits} units)</span>
            <b class="${gpa >= 4.5 ? "gpa-first" : ""}">${gpa.toFixed(2)}</b>
          </div>
          <div class="row-sub">Scale: A=5 · B=4 · C=3 · D=2 · E=1 · F=0</div>
        </div>
      </div>
      <div>
        <div class="card">
          <div class="section-head" style="padding-top:0"><div><div class="eyebrow">All semesters</div><h3 class="h3">CGPA tracker</h3></div></div>
          ${semRows}
          <button class="add-tier" data-act="sem-add">＋ Add semester</button>
          <div class="gpa-result">
            <span>CGPA (${cUnits} units)</span>
            <b class="${cgpa >= 4.5 ? "gpa-first" : ""}">${cgpa.toFixed(2)}</b>
          </div>
        </div>
        <div class="card">
          <div class="section-head" style="padding-top:0"><div><div class="eyebrow">The dream 🎯</div><h3 class="h3">What do I need to graduate with…</h3></div></div>
          <select id="tgClass" class="input">${targetOpts}</select>
          <div class="field-label">Units remaining till graduation</div>
          <input id="tgRem" class="input" type="number" min="1" placeholder="e.g. 60" value="60" />
          <div class="gpa-result" id="tgResult"></div>
          <div class="row-sub" id="tgNote"></div>
        </div>
      </div>
    </div>`;
}

/* timetable is a shared, mutable resource — any classmate can add, edit,
   or remove any entry (no ownership check, matches the RLS policy) */
function showTimetableForm(existing) {
  const isEdit = !!existing;
  openModal(`
    ${modalHead(isEdit ? "Edit class" : "Add a class")}
    <div class="field-label">Day</div>
    <select id="ttDay" class="input">
      ${["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) =>
        `<option value="${d}" ${existing?.day === d ? "selected" : ""}>${d}</option>`).join("")}
    </select>
    <input id="ttCourse" class="input" placeholder="Course (e.g. CSC 201)" value="${esc(existing?.course || "")}" />
    <input id="ttTime" class="input" placeholder="Time (e.g. 10:00 – 12:00)" value="${esc(existing?.time || "")}" />
    <input id="ttVenue" class="input" placeholder="Venue" value="${esc(existing?.venue || "")}" />
    <button class="btn btn-primary btn-block" id="ttGo">${isEdit ? "Save changes" : "Add to timetable"}</button>
    ${isEdit ? `<button class="btn btn-ghost btn-block" id="ttDel" style="margin-top:8px;color:var(--rose-600)">Remove</button>` : ""}
  `);
  $("#ttGo").addEventListener("click", async () => {
    const course = $("#ttCourse").value.trim();
    const time_label = $("#ttTime").value.trim();
    const venue = $("#ttVenue").value.trim();
    if (!course || !time_label || !venue) return toast("Fill in course, time, and venue");
    const btn = $("#ttGo");
    btn.disabled = true; btn.textContent = "Saving…";
    const row = { level: state.user.level, dept: state.user.dept, day: $("#ttDay").value, course, time_label, venue, updated_by: state.user.id };
    const { error } = isEdit ? await sbUpdateTimetableEntry(existing.id, row) : await sbInsertTimetableEntry(row);
    if (error) { btn.disabled = false; btn.textContent = isEdit ? "Save changes" : "Add to timetable"; return toast("Couldn't save: " + error.message); }
    await hydrateClassInfo();
    closeModal(); render(); toast(isEdit ? "Timetable updated" : "Added to timetable");
  });
  const delBtn = $("#ttDel");
  if (delBtn) delBtn.addEventListener("click", async () => {
    delBtn.disabled = true; delBtn.textContent = "Removing…";
    const { error } = await sbDeleteTimetableEntry(existing.id);
    if (error) { delBtn.disabled = false; delBtn.textContent = "Remove"; return toast("Couldn't remove: " + error.message); }
    await hydrateClassInfo();
    closeModal(); render(); toast("Removed from timetable");
  });
}

/* exams share the timetable's collaborative-editing policy — any
   classmate can add/edit/remove */
function showExamForm(existing) {
  const isEdit = !!existing;
  const d = existing ? new Date(existing.startsAt) : null;
  const pad = (n) => String(n).padStart(2, "0");
  const dateVal = d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
  const timeVal = d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
  openModal(`
    ${modalHead(isEdit ? "Edit exam/test" : "Add an exam or test")}
    <input id="exCourse" class="input" placeholder="Course (e.g. CSC 201)" value="${esc(existing?.course || "")}" />
    <select id="exType" class="input">
      <option value="Test" ${existing?.type === "Test" ? "selected" : ""}>Test</option>
      <option value="Exam" ${existing?.type === "Exam" ? "selected" : ""}>Exam</option>
    </select>
    <input id="exDate" class="input" type="date" value="${dateVal}" />
    <input id="exTime" class="input" type="time" value="${timeVal}" />
    <input id="exVenue" class="input" placeholder="Venue" value="${esc(existing?.venue || "")}" />
    <button class="btn btn-primary btn-block" id="exGo">${isEdit ? "Save changes" : "Add"}</button>
    ${isEdit ? `<button class="btn btn-ghost btn-block" id="exDel" style="margin-top:8px;color:var(--rose-600)">Remove</button>` : ""}
  `);
  $("#exGo").addEventListener("click", async () => {
    const course = $("#exCourse").value.trim();
    const date = $("#exDate").value;
    const time = $("#exTime").value;
    const venue = $("#exVenue").value.trim();
    if (!course || !date || !time || !venue) return toast("Fill in every field");
    const btn = $("#exGo");
    btn.disabled = true; btn.textContent = "Saving…";
    const row = {
      level: state.user.level, dept: state.user.dept, course,
      exam_type: $("#exType").value, starts_at: new Date(date + "T" + time).toISOString(), venue,
    };
    if (!isEdit) row.created_by = state.user.id;
    const { error } = isEdit ? await sbUpdateExam(existing.id, row) : await sbInsertExam(row);
    if (error) { btn.disabled = false; btn.textContent = isEdit ? "Save changes" : "Add"; return toast("Couldn't save: " + error.message); }
    await hydrateClassInfo();
    closeModal(); render(); toast(isEdit ? "Exam updated" : "Added");
  });
  const delBtn = $("#exDel");
  if (delBtn) delBtn.addEventListener("click", async () => {
    delBtn.disabled = true; delBtn.textContent = "Removing…";
    const { error } = await sbDeleteExam(existing.id);
    if (error) { delBtn.disabled = false; delBtn.textContent = "Remove"; return toast("Couldn't remove: " + error.message); }
    await hydrateClassInfo();
    closeModal(); render(); toast("Removed");
  });
}

/* ---------- ADMIN (vendor verification + message reports) ---------- */
function adminScreen() {
  // only vendors who've both met the thresholds and asked show up here —
  // NOT every never-reviewed vendor, unlike before this chunk
  const pending = state.adminBusinesses.filter((b) => !b.verified && !b.rejectedAt && b.verificationRequestedAt);
  const decided = state.adminBusinesses.filter((b) => b.verified || b.rejectedAt);

  const pendingRows = pending.length ? pending.map((b) => `
    <div class="card row-item">
      <div class="row-ico">🏪</div>
      <div class="row-main">
        <button class="row-title" data-open-shop="${b.ownerId}" style="background:none;border:none;padding:0;text-align:left;text-decoration:underline;cursor:pointer">${esc(b.name)}</button>
        <div class="row-sub">${esc(b.category || "—")} · owner: ${esc(b.ownerName)} · ${esc(b.createdAt)}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-accent btn-sm" data-verify-biz="${b.id}">Verify</button>
        <button class="btn btn-ghost btn-sm" data-reject-biz="${b.id}" style="color:var(--rose-600)">Reject</button>
      </div>
    </div>`).join("") : `<div class="empty">No pending vendors — all caught up 🎉</div>`;

  const decidedRows = decided.map((b) => `
    <div class="card row-item">
      <div class="row-ico">${b.verified ? "✅" : "🚫"}</div>
      <div class="row-main">
        <button class="row-title" data-open-shop="${b.ownerId}" style="background:none;border:none;padding:0;text-align:left;text-decoration:underline;cursor:pointer">${esc(b.name)}</button>
        <div class="row-sub">${esc(b.category || "—")} · owner: ${esc(b.ownerName)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="stock-pill ${b.verified ? "stock-ok" : "stock-low"}">${b.verified ? "Verified" : "Rejected"}</span>
        <button class="btn btn-ghost btn-sm" data-undo-biz="${b.id}">Undo</button>
      </div>
    </div>`).join("");

  const reportRows = state.adminReports.length ? state.adminReports.map((r) => `
    <div class="card">
      <div class="row-sub">${esc(r.createdAt)} · reported ${esc(r.reportedName)} · by ${esc(r.reporterName)}</div>
      <p class="post-body">${esc(r.messageText)}</p>
      ${r.reason ? `<div class="row-sub">Reason: ${esc(r.reason)}</div>` : ""}
      <div style="margin-top:8px">
        ${r.reviewed
          ? `<span class="stock-pill stock-ok">Reviewed</span>`
          : `<button class="btn btn-accent btn-sm" data-review-report="${r.id}">Mark reviewed</button>`}
      </div>
    </div>`).join("") : `<div class="empty">No reports yet</div>`;

  return `
    <div class="section-head">
      <div><div class="eyebrow">Admin</div><h1 class="h1">Launch controls</h1></div>
    </div>

    <div class="section-head" style="padding-top:6px">
      <div><div class="eyebrow">Vendor verification</div><h3 class="h3">Pending queue</h3></div>
    </div>
    ${pendingRows}
    ${decided.length ? `
    <div class="section-head" style="padding-top:20px">
      <div><div class="eyebrow">Already reviewed</div><h3 class="h3">Verified &amp; rejected</h3></div>
    </div>
    ${decidedRows}` : ""}

    <div class="section-head" style="padding-top:24px">
      <div><div class="eyebrow">Report moderation</div><h3 class="h3">Message reports</h3></div>
    </div>
    ${reportRows}`;
}

function bindAdminEvents() {
  document.querySelectorAll("[data-verify-biz]").forEach((b) =>
    b.addEventListener("click", async () => {
      b.disabled = true; b.textContent = "…";
      const { error } = await sbAdminSetBusinessVerification(b.dataset.verifyBiz, "verified");
      if (error) { b.disabled = false; b.textContent = "Verify"; return toast("Couldn't verify: " + error.message); }
      await hydrateAdmin();
      render(); toast("Vendor verified ✅");
    }));
  document.querySelectorAll("[data-reject-biz]").forEach((b) =>
    b.addEventListener("click", async () => {
      b.disabled = true; b.textContent = "…";
      const { error } = await sbAdminSetBusinessVerification(b.dataset.rejectBiz, "rejected");
      if (error) { b.disabled = false; b.textContent = "Reject"; return toast("Couldn't reject: " + error.message); }
      await hydrateAdmin();
      render(); toast("Vendor rejected");
    }));
  document.querySelectorAll("[data-review-report]").forEach((b) =>
    b.addEventListener("click", async () => {
      b.disabled = true; b.textContent = "…";
      const { error } = await sbMarkReportReviewed(b.dataset.reviewReport);
      if (error) { b.disabled = false; b.textContent = "Mark reviewed"; return toast("Couldn't update: " + error.message); }
      await hydrateAdmin();
      render(); toast("Marked reviewed");
    }));
  document.querySelectorAll("[data-undo-biz]").forEach((b) =>
    b.addEventListener("click", async () => {
      b.disabled = true; b.textContent = "…";
      const { error } = await sbAdminSetBusinessVerification(b.dataset.undoBiz, "pending");
      if (error) { b.disabled = false; b.textContent = "Undo"; return toast("Couldn't undo: " + error.message); }
      await hydrateAdmin();
      render(); toast("Moved back to pending");
    }));
  document.querySelectorAll("[data-open-shop]").forEach((b) =>
    b.addEventListener("click", () => openShop(b.dataset.openShop)));
}

function bindStudyEvents() {
  document.querySelectorAll("[data-study]").forEach((b) =>
    b.addEventListener("click", () => { state.studyTab = b.dataset.study; render(); }));

  /* my class */
  const annBtn = document.querySelector('[data-act="post-announcement"]');
  if (annBtn) annBtn.addEventListener("click", async () => {
    const inp = $("#annInput");
    const text = inp.value.trim();
    if (!text) return;
    inp.value = "";
    const { error } = await sbInsertAnnouncement({ author_id: state.user.id, level: state.user.level, dept: state.user.dept, text });
    if (error) return toast("Couldn't post: " + error.message);
    await hydrateClassInfo();
    render(); toast("Posted to your class");
  });

  const addTtBtn = document.querySelector('[data-act="add-timetable"]');
  if (addTtBtn) addTtBtn.addEventListener("click", () => showTimetableForm(null));
  document.querySelectorAll("[data-edit-tt]").forEach((b) =>
    b.addEventListener("click", () => showTimetableForm(state.classroom.timetable.find((t) => t.id === b.dataset.editTt))));

  const addExamBtn = document.querySelector('[data-act="add-exam"]');
  if (addExamBtn) addExamBtn.addEventListener("click", () => showExamForm(null));
  document.querySelectorAll("[data-edit-exam]").forEach((b) =>
    b.addEventListener("click", () => showExamForm(state.classroom.exams.find((e) => e.id === b.dataset.editExam))));

  document.querySelectorAll("[data-submit]").forEach((b) =>
    b.addEventListener("click", () => showAssignmentSubmit(b.dataset.submit)));

  const addAssignBtn = document.querySelector('[data-act="add-assignment"]');
  if (addAssignBtn) addAssignBtn.addEventListener("click", showAssignmentForm);

  const addPollBtn = document.querySelector('[data-act="add-poll"]');
  if (addPollBtn) addPollBtn.addEventListener("click", showPollForm);
  document.querySelectorAll("[data-poll]").forEach((b) =>
    b.addEventListener("click", async () => {
      const pollId = b.dataset.poll, optionId = b.dataset.opt;
      const { error } = await sbVote(pollId, optionId, state.user.id);
      if (error) return toast("Couldn't record vote: " + error.message);
      state.pollChangingIds = state.pollChangingIds.filter((id) => id !== pollId);
      await hydrateClassInfo();
      render(); toast("Vote recorded 🗳️");
    }));
  document.querySelectorAll("[data-change-vote]").forEach((b) =>
    b.addEventListener("click", () => {
      state.pollChangingIds.push(b.dataset.changeVote);
      render();
    }));

  const markAttBtn = document.querySelector('[data-act="mark-attendance"]');
  if (markAttBtn) markAttBtn.addEventListener("click", showAttendanceForm);
  document.querySelectorAll("[data-mat-jump]").forEach((b) =>
    b.addEventListener("click", () => {
      state.studyTab = "materials"; state.matFilter = b.dataset.matJump; render();
    }));

  /* materials */
  document.querySelectorAll("[data-mat]").forEach((b) =>
    b.addEventListener("click", () => { state.matFilter = b.dataset.mat; render(); }));
  document.querySelectorAll("[data-rate]").forEach((b) =>
    b.addEventListener("click", async () => {
      const materialId = b.dataset.rate;
      const val = Number(b.dataset.val);
      const { error } = await sbRateMaterial(materialId, state.user.id, val);
      if (error) return toast("Couldn't save rating: " + error.message);
      await hydrateMaterials();
      render(); toast("Thanks for rating ⭐");
    }));
  document.querySelectorAll("[data-download]").forEach((b) =>
    b.addEventListener("click", () => {
      const m = state.materials.find((x) => x.id === b.dataset.download);
      if (m) window.open(sbGetMaterialFileUrl(m.filePath), "_blank");
    }));
  const upBtn = document.querySelector('[data-act="open-upload"]');
  if (upBtn) upBtn.addEventListener("click", showMaterialUpload);

  /* cgpa: recompute by re-render on change, keeping it simple —
     persisted to localStorage (same mechanism as the dark-mode flag),
     no backend table since this is single-user scratch data */
  const rerender = () => { saveGpaState(); render(); };
  document.querySelectorAll(".g-course, .g-units, .g-grade").forEach((el) => {
    el.addEventListener("change", () => {
      const i = Number(el.dataset.i);
      if (el.classList.contains("g-course")) state.gpaRows[i].course = el.value;
      if (el.classList.contains("g-units")) state.gpaRows[i].units = el.value;
      if (el.classList.contains("g-grade")) state.gpaRows[i].grade = el.value;
      rerender();
    });
  });
  document.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => { state.gpaRows.splice(Number(b.dataset.del), 1); rerender(); }));
  const gAdd = document.querySelector('[data-act="gpa-add"]');
  if (gAdd) gAdd.addEventListener("click", () => {
    state.gpaRows.push({ course: "", units: "", grade: "A" }); rerender();
  });

  document.querySelectorAll(".s-name, .s-gpa, .s-units").forEach((el) => {
    el.addEventListener("change", () => {
      const i = Number(el.dataset.i);
      if (el.classList.contains("s-name")) state.semesters[i].name = el.value;
      if (el.classList.contains("s-gpa")) state.semesters[i].gpa = el.value;
      if (el.classList.contains("s-units")) state.semesters[i].units = el.value;
      rerender();
    });
  });
  document.querySelectorAll("[data-sdel]").forEach((b) =>
    b.addEventListener("click", () => { state.semesters.splice(Number(b.dataset.sdel), 1); rerender(); }));
  const sAdd = document.querySelector('[data-act="sem-add"]');
  if (sAdd) sAdd.addEventListener("click", () => {
    state.semesters.push({ name: "", gpa: "", units: "" }); rerender();
  });

  /* target class projection */
  const tgClass = $("#tgClass"), tgRem = $("#tgRem");
  if (tgClass && tgRem) {
    const calc = () => {
      let cUnits = 0, cPoints = 0;
      state.semesters.forEach((s) => {
        const u = Number(s.units) || 0;
        cUnits += u; cPoints += u * (Number(s.gpa) || 0);
      });
      const cgpa = cUnits ? cPoints / cUnits : 0;
      const target = Number(tgClass.value);
      const rem = Number(tgRem.value) || 0;
      const res = $("#tgResult"), note = $("#tgNote");
      if (!rem || !cUnits) { res.innerHTML = "<span>Fill your semesters and remaining units</span>"; note.textContent = ""; return; }
      const needed = (target * (cUnits + rem) - cPoints) / rem;
      res.innerHTML = `<span>You need an average GPA of</span><b class="${needed <= 5 ? "" : "gpa-bad"}">${Math.max(0, needed).toFixed(2)}</b>`;
      note.textContent =
        needed <= 0 ? "You've already secured it — just don't fail anything 😄" :
        needed <= 5 ? `on your remaining ${rem} units (current CGPA: ${cgpa.toFixed(2)}).` :
        `That's above the 5.0 maximum — this class isn't reachable on ${rem} remaining units. Aim for the next one!`;
    };
    tgClass.addEventListener("change", calc);
    tgRem.addEventListener("input", calc);
    calc();
  }
}

/* --- post a new assignment (immutable once posted, same as announcements) --- */
function showAssignmentForm() {
  openModal(`
    ${modalHead("Post an assignment")}
    <input id="asgCourse" class="input" placeholder="Course (e.g. CSC 201)" />
    <input id="asgTitle" class="input" placeholder="Assignment title" />
    <textarea id="asgDesc" class="input" rows="2" placeholder="Details (optional)"></textarea>
    <div class="field-label">Due</div>
    <input id="asgDate" class="input" type="date" />
    <input id="asgTime" class="input" type="time" />
    <button class="btn btn-primary btn-block" id="asgGo">Post assignment</button>
  `);
  $("#asgGo").addEventListener("click", async () => {
    const course = $("#asgCourse").value.trim();
    const title = $("#asgTitle").value.trim();
    const date = $("#asgDate").value;
    const time = $("#asgTime").value;
    if (!course || !title || !date || !time) return toast("Fill in course, title, and due date/time");
    const btn = $("#asgGo");
    btn.disabled = true; btn.textContent = "Posting…";
    const { error } = await sbInsertAssignment({
      author_id: state.user.id, level: state.user.level, dept: state.user.dept,
      course, title, description: $("#asgDesc").value.trim() || null,
      due_at: new Date(date + "T" + time).toISOString(),
    });
    if (error) { btn.disabled = false; btn.textContent = "Post assignment"; return toast("Couldn't post: " + error.message); }
    await hydrateClassInfo();
    closeModal(); render(); toast("Assignment posted");
  });
}

/* --- assignment submission modal: real file upload to the private
   assignment-files bucket, then a per-student submission row --- */
function showAssignmentSubmit(id) {
  const a = state.classroom.assignments.find((x) => x.id === id);
  if (!a) return;
  let file = null;
  openModal(`
    ${modalHead("Submit assignment")}
    <div class="row-title">${esc(a.course)}: ${esc(a.title)}</div>
    <div class="row-sub" style="margin-bottom:14px">Due ${esc(a.due)}</div>
    <div class="upload-box" id="subBox">
      <input type="file" id="subFile" accept=".pdf,.doc,.docx,image/*" />
      <div class="up-ico">📎</div>
      <div class="up-text">Attach your work</div>
      <div class="up-hint">PDF, Word document, or a photo of your work</div>
    </div>
    <button class="btn btn-primary btn-block" id="subGo" disabled>Submit</button>
  `);
  const box = $("#subBox"), fileInput = $("#subFile"), go = $("#subGo");
  box.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    file = fileInput.files && fileInput.files[0];
    if (!file) return;
    box.querySelector(".up-text").textContent = "📄 " + file.name;
    box.querySelector(".up-hint").textContent = "Tap to change file";
    go.disabled = false;
  });
  go.addEventListener("click", async () => {
    if (!file) return;
    go.disabled = true; go.textContent = "Uploading…";
    const { path, error: upErr } = await sbUploadAssignmentFile(state.user.id, a.id, file);
    if (upErr) { go.disabled = false; go.textContent = "Submit"; return toast("Couldn't upload: " + upErr.message); }
    const { error } = await sbUpsertSubmission(a.id, state.user.id, path);
    if (error) { go.disabled = false; go.textContent = "Submit"; return toast("Couldn't submit: " + error.message); }
    await hydrateClassInfo();
    closeModal(); render(); toast("Assignment submitted ✅");
  });
}

/* --- create a poll (question + options), immutable once posted --- */
function showPollForm() {
  let optionCount = 2;
  const renderOptions = () => Array.from({ length: optionCount }, (_, i) =>
    `<input class="input poll-opt-input" placeholder="Option ${i + 1}" />`).join("");
  openModal(`
    ${modalHead("Create a poll")}
    <input id="pollQ" class="input" placeholder="Ask your class something…" />
    <div id="pollOptsWrap">${renderOptions()}</div>
    <button class="btn btn-ghost btn-sm" id="pollAddOpt" style="margin-bottom:10px">＋ Add option</button>
    <button class="btn btn-primary btn-block" id="pollGo">Post poll</button>
  `);
  $("#pollAddOpt").addEventListener("click", () => {
    const existing = [...document.querySelectorAll(".poll-opt-input")].map((i) => i.value);
    optionCount++;
    $("#pollOptsWrap").innerHTML = renderOptions();
    [...document.querySelectorAll(".poll-opt-input")].forEach((inp, i) => { inp.value = existing[i] || ""; });
  });
  $("#pollGo").addEventListener("click", async () => {
    const question = $("#pollQ").value.trim();
    const labels = [...document.querySelectorAll(".poll-opt-input")].map((i) => i.value.trim()).filter(Boolean);
    if (!question || labels.length < 2) return toast("Add a question and at least 2 options");
    const btn = $("#pollGo");
    btn.disabled = true; btn.textContent = "Posting…";
    const { data: poll, error } = await sbInsertPoll({ level: state.user.level, dept: state.user.dept, question, created_by: state.user.id });
    if (error) { btn.disabled = false; btn.textContent = "Post poll"; return toast("Couldn't post: " + error.message); }
    const { error: optErr } = await sbInsertPollOptions(labels.map((label, i) => ({ poll_id: poll.id, label, sort_order: i })));
    if (optErr) { btn.disabled = false; btn.textContent = "Post poll"; return toast("Couldn't add options: " + optErr.message); }
    await hydrateClassInfo();
    closeModal(); render(); toast("Poll posted");
  });
}

/* --- mark attendance for a course/date — private, self-reported;
   marking the same course/date again is an update, not a duplicate --- */
function showAttendanceForm() {
  const todayISO = new Date().toISOString().slice(0, 10);
  let status = "present";
  openModal(`
    ${modalHead("Mark attendance")}
    <input id="attCourse" class="input" placeholder="Course (e.g. CSC 201)" />
    <input id="attDate" class="input" type="date" value="${todayISO}" />
    <div class="seg">
      <button class="seg-btn active" data-status="present">Present</button>
      <button class="seg-btn" data-status="absent">Absent</button>
    </div>
    <button class="btn btn-primary btn-block" id="attGo" style="margin-top:12px">Save</button>
  `);
  document.querySelectorAll("[data-status]").forEach((b) =>
    b.addEventListener("click", () => {
      status = b.dataset.status;
      document.querySelectorAll("[data-status]").forEach((x) => x.classList.toggle("active", x === b));
    }));
  $("#attGo").addEventListener("click", async () => {
    const course = $("#attCourse").value.trim();
    const date = $("#attDate").value;
    if (!course || !date) return toast("Fill in course and date");
    const btn = $("#attGo");
    btn.disabled = true; btn.textContent = "Saving…";
    const { error } = await sbMarkAttendance(state.user.id, course, date, status);
    if (error) { btn.disabled = false; btn.textContent = "Save"; return toast("Couldn't save: " + error.message); }
    await hydrateClassInfo();
    closeModal(); render(); toast("Attendance saved");
  });
}

/* --- upload study material modal --- */
function showMaterialUpload() {
  let file = null;
  const types = ["PDF", "Handwritten Notes", "Recorded Tutorial", "Slides", "Past Questions"];
  openModal(`
    ${modalHead("Upload study material")}
    <div class="upload-box" id="matBox">
      <input type="file" id="matFile" accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,video/*,audio/*" />
      <div class="up-ico">📎</div>
      <div class="up-text">Choose your file</div>
      <div class="up-hint">PDF, slides, photos of handwritten notes, or a recorded tutorial</div>
    </div>
    <input id="matTitle" class="input" placeholder="Title (e.g. CSC 201 Past Questions 2019–2024)" />
    <input id="matCourse" class="input" placeholder="Course code (e.g. CSC 201)" />
    <select id="matType" class="input">${types.map((t) => `<option>${t}</option>`).join("")}</select>
    <p class="form-hint">Good materials get rated up and shown first — put your name on the map 🌟</p>
    <button class="btn btn-primary btn-block" id="matGo">Upload</button>
  `);
  const box = $("#matBox"), fileInput = $("#matFile");
  box.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    file = fileInput.files && fileInput.files[0];
    if (!file) return;
    box.querySelector(".up-text").textContent = "📄 " + file.name;
    box.querySelector(".up-hint").textContent = "Tap to change file";
  });
  $("#matGo").addEventListener("click", async () => {
    const title = $("#matTitle").value.trim();
    if (!title) return toast("Give your material a title");
    if (!file) return toast("Attach a file first");
    const btn = $("#matGo");
    btn.disabled = true; btn.textContent = "Uploading…";
    const { path, error: upErr } = await sbUploadMaterialFile(state.user.id, file);
    if (upErr) { btn.disabled = false; btn.textContent = "Upload"; return toast("Couldn't upload: " + upErr.message); }
    const { error } = await sbInsertMaterial({
      uploader_id: state.user.id, title,
      course: $("#matCourse").value.trim() || "General",
      material_type: $("#matType").value,
      file_path: path,
    });
    if (error) { btn.disabled = false; btn.textContent = "Upload"; return toast("Couldn't post: " + error.message); }
    await hydrateMaterials();
    closeModal(); render(); toast("Material uploaded — thank you! 🙌");
  });
}

/* ==========================================================
   SETTINGS
   ========================================================== */

function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  try { localStorage.setItem("ch-theme", dark ? "dark" : "light"); } catch (e) { /* private mode */ }
}

/* GPA/CGPA calculator is single-user scratch data with no sharing
   component, so it's localStorage-only (same as the dark-mode flag),
   never a Supabase table — see loadGpaState() at boot for the read side */
function saveGpaState() {
  try { localStorage.setItem("ch-gpa", JSON.stringify({ gpaRows: state.gpaRows, semesters: state.semesters })); } catch (e) { /* private mode */ }
}

function showSettings() {
  const u = state.user;
  const academic = !!u.level;
  const isDark = document.body.classList.contains("dark");

  const levelOpts = LEVELS.map((l) => `<option ${u.level === l ? "selected" : ""}>${l}</option>`).join("");
  const deptOpts = Object.entries(DEPARTMENTS).map(([fac, ds]) => `
    <optgroup label="Faculty of ${esc(fac)}">
      ${ds.map((d) => `<option ${u.dept === d ? "selected" : ""}>${esc(d)}</option>`).join("")}
    </optgroup>`).join("");

  const accountLabel = u.role === "vendor"
    ? (u.vendorType === "student" ? "Student Vendor" : "Campus Vendor")
    : "Student";

  openModal(`
    ${modalHead("Settings")}

    <div class="set-group">Appearance</div>
    <div class="card row-item">
      <div class="row-ico">${isDark ? "🌙" : "☀️"}</div>
      <div class="row-main"><div class="row-title">Dark mode</div><div class="row-sub">Easier on the eyes at night</div></div>
      <button class="switch ${isDark ? "on" : ""}" id="setDark"><span></span></button>
    </div>

    <div class="set-group">Account type <span class="set-current">· currently ${accountLabel}</span></div>
    <div class="card">
      <p class="row-sub" style="margin-bottom:10px">Switch any time — for example when you start a business, or when you graduate and only want to sell.</p>
      <div style="display:grid;gap:8px">
        ${u.role !== "student" ? `<button class="btn btn-ghost" data-switch="student">🎓 Switch to Student</button>` : ""}
        ${!(u.role === "vendor" && u.vendorType === "student") ? `<button class="btn btn-ghost" data-switch="svendor">🎓🛍️ Become a Student Vendor</button>` : ""}
        ${!(u.role === "vendor" && u.vendorType === "external") ? `<button class="btn btn-ghost" data-switch="cvendor">🏪 Become a Campus Vendor</button>` : ""}
      </div>
    </div>

    ${academic ? `
    <div class="set-group">Academic profile</div>
    <div class="card">
      <div class="field-label">Level</div>
      <select id="setLevel" class="input">${levelOpts}</select>
      <div class="field-label">Department</div>
      <select id="setDept" class="input">${deptOpts}</select>
      <button class="btn btn-primary btn-block" id="setSaveAcad">Save changes</button>
    </div>` : ""}

    <div class="set-group">Payouts</div>
    <div class="card">
      ${state.payoutAccount ? `
        <div class="row-sub" style="margin-bottom:10px">Sales and ticket money are sent automatically to:</div>
        <div class="trust-card" style="margin:0 0 10px">
          <div class="trust-name">${esc(state.payoutAccount.business_name)}</div>
          <div class="trust-meta">${esc(state.payoutAccount.bank_name)} · ${esc(state.payoutAccount.account_number)} · ${esc(state.payoutAccount.account_name)}</div>
        </div>
        <button class="btn btn-ghost btn-block" id="setPayout">Update payout details</button>
      ` : `
        <p class="row-sub" style="margin-bottom:10px">Set up a payout account to sell on the marketplace or host paid events — your share is sent to your bank automatically after every sale.</p>
        <button class="btn btn-accent btn-block" id="setPayout">🏦 Set up payouts</button>
      `}
    </div>

    <div class="set-group">Account</div>
    <div class="card" style="display:grid;gap:8px">
      <button class="btn btn-ghost" id="setPw">🔒 Change password</button>
      <button class="btn btn-ghost" id="setNotif">🔔 Notifications: <b id="notifState">On</b></button>
      <button class="btn btn-ghost" id="setLogout" style="color:var(--rose-600)">🚪 Log out</button>
    </div>
    <p class="form-hint" style="text-align:center">CampusHub demo · University of Lagos</p>
  `);

  $("#setDark").addEventListener("click", () => {
    const nowDark = !document.body.classList.contains("dark");
    applyTheme(nowDark);
    $("#setDark").classList.toggle("on", nowDark);
    const ico = document.querySelector(".modal .row-ico");
    if (ico) ico.textContent = nowDark ? "🌙" : "☀️";
  });

  document.querySelectorAll("[data-switch]").forEach((b) =>
    b.addEventListener("click", () => {
      const to = b.dataset.switch;
      if (to === "student") {
        u.role = "student"; u.vendorType = null; u.business = null;
        if (!u.level) { u.level = "100 Level"; u.dept = "Computer Science"; }
        closeModal(); render();
        toast("Switched to a student account 🎓");
        return;
      }
      // switching TO any vendor type requires business verification first
      closeModal();
      state.vendorType = to === "svendor" ? "student" : "external";
      showVendorUpgrade(u, to);
    }));

  const saveAcad = $("#setSaveAcad");
  if (saveAcad) saveAcad.addEventListener("click", () => {
    u.level = $("#setLevel").value;
    u.dept = $("#setDept").value;
    state.feedFilter = "All";
    closeModal(); render();
    toast("Profile updated — feed and class info now follow " + u.dept);
  });

  const payoutBtn = $("#setPayout");
  if (payoutBtn) payoutBtn.addEventListener("click", () => { closeModal(); showPayoutForm(); });

  $("#setPw").addEventListener("click", () => toast("Password change comes with the real accounts system"));
  let notif = true;
  $("#setNotif").addEventListener("click", () => {
    notif = !notif;
    $("#notifState").textContent = notif ? "On" : "Off";
  });
  $("#setLogout").addEventListener("click", async () => {
    closeModal();
    await sbSignOut();
    state.user = null; state.authRole = null; state.authMode = "signup";
    state.authStage = null; state.vendorType = null;
    state.profile = { name: "", matric: "", level: "", dept: "" }; state.feedFilter = "All";
    render();
  });
}

/* --- payout onboarding: bank details -> resolved + a Paystack subaccount --- */
async function showPayoutForm() {
  openModal(`
    ${modalHead("Set up payouts")}
    <p class="row-sub" style="margin-bottom:12px">We verify your account name with your bank before saving anything.</p>
    <input id="poBusinessName" class="input" placeholder="Business / payout name" value="${esc(state.payoutAccount?.business_name || "")}" />
    <select id="poBank" class="input"><option value="">Loading banks…</option></select>
    <input id="poAccountNumber" class="input" inputmode="numeric" placeholder="10-digit account number" value="${esc(state.payoutAccount?.account_number || "")}" />
    <button class="btn btn-primary btn-block" id="poGo" disabled>Verify &amp; save</button>
  `);

  const bankSelect = $("#poBank");
  const { data: bankData, error: bankErr } = await sbListBanks();
  if (bankErr || !bankData?.banks) {
    bankSelect.innerHTML = `<option value="">Couldn't load banks</option>`;
    toast(await edgeErrorMessage(bankErr, "Couldn't load the bank list"));
  } else {
    bankSelect.innerHTML = `<option value="">Choose your bank</option>` +
      bankData.banks.map((b) => `<option value="${esc(b.code)}">${esc(b.name)}</option>`).join("");
  }

  const check = () => {
    const ok = $("#poBusinessName").value.trim() && bankSelect.value && $("#poAccountNumber").value.trim().length >= 10;
    $("#poGo").disabled = !ok;
  };
  ["#poBusinessName", "#poAccountNumber"].forEach((s) => $(s).addEventListener("input", check));
  bankSelect.addEventListener("change", check);
  check();

  $("#poGo").addEventListener("click", async () => {
    const goBtn = $("#poGo");
    goBtn.disabled = true; goBtn.textContent = "Verifying…";
    const { data, error } = await sbCreatePayoutAccount({
      business_name: $("#poBusinessName").value.trim(),
      bank_code: bankSelect.value,
      bank_name: bankSelect.options[bankSelect.selectedIndex].text,
      account_number: $("#poAccountNumber").value.trim(),
    });
    if (error || data?.error) {
      goBtn.disabled = false; goBtn.textContent = "Verify & save";
      return toast((data && data.error) || await edgeErrorMessage(error, "Couldn't set up payouts"));
    }
    state.payoutAccount = data;
    closeModal();
    toast("Payout account saved — you're ready to get paid 🎉");
  });
}

/* --- vendor upgrade from settings: must verify the business first --- */
function showVendorUpgrade(u, to) {
  const cats = ["Food & Snacks", "Fashion & Beauty", "Electronics & Gadgets", "Hair & Grooming", "Printing & Stationery", "Laundry & Cleaning", "Tutoring & Services", "Other"];
  openModal(`
    ${modalHead("Verify your business")}
    <p class="row-sub" style="margin-bottom:12px">Every vendor answers these questions before selling — it protects students from scams. 🛡️</p>
    <input id="ubName" class="input" placeholder="Business name *" />
    <select id="ubCat" class="input">${cats.map((c) => `<option>${c}</option>`).join("")}</select>
    <textarea id="ubDesc" class="input" rows="2" placeholder="What exactly do you sell or offer? *"></textarea>
    <input id="ubPhone" class="input" type="tel" placeholder="Business phone / WhatsApp *" />
    <input id="ubLoc" class="input" placeholder="Where do you operate? *" />
    <label class="vv-agree dark-text">
      <input type="checkbox" id="ubAgree" />
      <span>I confirm this information is true. Fraud or scamming students leads to a permanent ban and may be reported to authorities.</span>
    </label>
    <button class="btn btn-primary btn-block" id="ubGo" disabled>Verify &amp; switch account</button>
  `);
  const req = ["#ubName", "#ubDesc", "#ubPhone", "#ubLoc"];
  const go = $("#ubGo");
  const check = () => {
    go.disabled = !(req.every((s) => $(s).value.trim().length >= 3) && $("#ubAgree").checked);
  };
  req.forEach((s) => $(s).addEventListener("input", check));
  $("#ubAgree").addEventListener("change", check);
  go.addEventListener("click", () => {
    if (go.disabled) return;
    u.business = {
      name: $("#ubName").value.trim(), cat: $("#ubCat").value,
      desc: $("#ubDesc").value.trim(), phone: $("#ubPhone").value.trim(),
      loc: $("#ubLoc").value.trim(), social: "", cac: "", agreed: true,
    };
    if (to === "svendor") {
      u.role = "vendor"; u.vendorType = "student";
      if (!u.level) { u.level = "100 Level"; u.dept = "Computer Science"; }
    } else {
      u.role = "vendor"; u.vendorType = "external"; u.level = null; u.dept = null; u.matric = null;
    }
    closeModal(); render();
    toast("Business verified — welcome, " + u.business.name + " 🎉");
  });
}

/* ==========================================================
   MODALS
   ========================================================== */

function openModal(html, wide = false) {
  $("#modalRoot").innerHTML = `
    <div class="modal-overlay" id="overlay">
      <div class="modal${wide ? " wide" : ""}">${html}</div>
    </div>`;
  $("#overlay").addEventListener("click", (e) => {
    if (e.target.id === "overlay") closeModal();
  });
  $("#modalRoot").querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", closeModal));
}
function closeModal() { $("#modalRoot").innerHTML = ""; }

/* ==========================================================
   LIVE CHAT
   Real, persisted + real-time chat, keyed by the real counterparty
   profile id (marketplace, storefronts, vendor orders, lost & found).
   ========================================================== */

let activeChatChannel = null;

const stopChatRealtime = () => {
  if (activeChatChannel) { sb.removeChannel(activeChatChannel); activeChatChannel = null; }
};

const mapMessageRow = (row) => ({
  id: row.id,
  senderId: row.sender_id,
  from: row.sender_id === state.user.id ? "me" : "them",
  text: row.text,
  imagePath: row.image_path,
  time: fmtRowTime(row.created_at),
});

// signed URLs for the private chat-images bucket, cached by path since
// they're valid for an hour and re-fetching on every render is wasteful
const chatImageUrlCache = new Map();
function resolveChatImageUrl(path, onReady) {
  if (chatImageUrlCache.has(path)) return chatImageUrlCache.get(path);
  sbGetChatImageUrl(path).then(({ data, error }) => {
    if (error || !data) return;
    chatImageUrlCache.set(path, data.signedUrl);
    onReady();
  });
  return null;
}

// resizes to at most maxDim on the longest side and re-encodes as JPEG,
// so chat images don't upload at full camera resolution
function compressImageToBlob(file, maxDim = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(img.src);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))), "image/jpeg", quality);
    };
    img.onerror = () => reject(new Error("Couldn't read that image"));
    img.src = URL.createObjectURL(file);
  });
}

function openImageLightbox(url) {
  openModal(`
    <div style="text-align:right;margin-bottom:8px"><button class="btn btn-ghost btn-sm" data-close>✕ Close</button></div>
    <img src="${esc(url)}" style="max-width:100%;border-radius:12px;display:block;margin:0 auto" alt="Full size image" />
  `, true);
}

async function openChat(otherId, otherName) {
  stopChatRealtime();
  closeModal();

  state.realChatWith = { id: otherId, name: otherName || "Chat", conversationId: null };
  state.chatMessages = [];
  renderRealChat(); // show the panel immediately with an empty/loading body

  const { data: conversationId, error: convErr } = await sbGetOrCreateConversation(otherId);
  if (convErr) { closeChat(); return toast("Couldn't open chat: " + convErr.message); }
  if (!state.realChatWith || state.realChatWith.id !== otherId) return; // closed/switched while awaiting
  state.realChatWith.conversationId = conversationId;

  const { data: msgs, error: msgsErr } = await sbGetMessages(conversationId);
  if (!msgsErr) state.chatMessages = (msgs || []).map(mapMessageRow);
  renderRealChat();

  sbMarkConversationRead(conversationId, state.user.id).then(hydrateConversations);

  activeChatChannel = sbSubscribeToConversation(conversationId, (row) => {
    if (state.chatMessages.some((m) => m.id === row.id)) return; // our own optimistic push
    state.chatMessages.push(mapMessageRow(row));
    if (state.realChatWith && state.realChatWith.conversationId === conversationId) renderRealChat();
  });
}

function closeChat() {
  stopChatRealtime();
  state.realChatWith = null;
  state.chatMessages = [];
  $("#chatRoot").innerHTML = "";
}

function renderRealChat() {
  const chat = state.realChatWith;
  if (!chat) return;

  const bubbles = state.chatMessages.map((m) => {
    const reportBtn = m.from === "them" ? `<button class="bubble-report" data-report-msg="${m.id}" title="Report this message">⚑ Report</button>` : "";
    let body;
    if (m.imagePath) {
      const url = resolveChatImageUrl(m.imagePath, () => {
        if (state.realChatWith && state.realChatWith.conversationId === chat.conversationId) renderRealChat();
      });
      body = url
        ? `<img src="${esc(url)}" class="bubble-img" data-lightbox="${esc(url)}" alt="Shared image" />`
        : `<div class="bubble-img-loading">Loading image…</div>`;
    } else {
      body = esc(m.text);
    }
    return `
    <div class="bubble ${m.from}">
      ${body}
      <div class="bubble-time">
        ${esc(m.time)}
        ${reportBtn}
      </div>
    </div>`;
  }).join("");

  $("#chatRoot").innerHTML = `
    <div class="chat-panel">
      <div class="chat-head">
        <div class="chat-avatar">${esc(chat.name[0])}</div>
        <div><div class="chat-name">${esc(chat.name)}</div></div>
        <button class="chat-close" id="chatClose">✕</button>
      </div>
      <div class="chat-body" id="chatBody">
        ${bubbles || `<div class="empty">Say hi 👋</div>`}
      </div>
      <div class="chat-foot">
        <button class="chat-attach" id="chatAttach" title="Attach an image" ${chat.conversationId ? "" : "disabled"}>📎</button>
        <input type="file" id="chatImageInput" accept="image/*" style="display:none" />
        <input id="chatInput" class="input" placeholder="Type a message…" autocomplete="off" ${chat.conversationId ? "" : "disabled"} />
        <button class="chat-send" id="chatSend" ${chat.conversationId ? "" : "disabled"}>➤</button>
      </div>
    </div>`;

  const body = $("#chatBody");
  body.scrollTop = body.scrollHeight;

  $("#chatClose").addEventListener("click", closeChat);
  $("#chatBody").querySelectorAll("[data-report-msg]").forEach((b) =>
    b.addEventListener("click", () => openReportMessageModal(b.dataset.reportMsg)));
  $("#chatBody").querySelectorAll("[data-lightbox]").forEach((el) =>
    el.addEventListener("click", () => openImageLightbox(el.dataset.lightbox)));

  const inp = $("#chatInput");
  const send = async () => {
    const text = inp.value.trim();
    if (!text || !chat.conversationId) return;
    inp.value = "";
    const { data, error } = await sbSendMessage({ conversation_id: chat.conversationId, sender_id: state.user.id, text });
    if (error) return toast("Couldn't send: " + error.message);
    state.chatMessages.push(mapMessageRow(data));
    renderRealChat();
    $("#chatInput").focus();
  };
  $("#chatSend").addEventListener("click", send);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });

  const attachBtn = $("#chatAttach");
  const imgInput = $("#chatImageInput");
  attachBtn.addEventListener("click", () => imgInput.click());
  imgInput.addEventListener("change", async () => {
    const file = imgInput.files[0];
    imgInput.value = "";
    if (!file || !chat.conversationId) return;
    attachBtn.disabled = true; attachBtn.textContent = "…";
    try {
      const blob = await compressImageToBlob(file);
      const { path, error: upErr } = await sbUploadChatImage(chat.conversationId, blob);
      if (upErr) throw upErr;
      const { data, error } = await sbSendMessage({ conversation_id: chat.conversationId, sender_id: state.user.id, image_path: path });
      if (error) throw error;
      state.chatMessages.push(mapMessageRow(data));
      renderRealChat();
    } catch (err) {
      toast("Couldn't send image: " + (err.message || "something went wrong"));
      attachBtn.disabled = false; attachBtn.textContent = "📎";
    }
  });

  inp.focus();
}

function openReportMessageModal(messageId) {
  openModal(`
    ${modalHead("Report message")}
    <p class="row-sub" style="margin-bottom:10px">Tell us what's wrong — our team will review this conversation.</p>
    <textarea id="reportReason" class="input" rows="3" placeholder="Optional details…"></textarea>
    <button class="btn btn-primary btn-block" id="reportGo">Submit report</button>
  `);
  $("#reportGo").addEventListener("click", async () => {
    const btn = $("#reportGo");
    btn.disabled = true; btn.textContent = "Submitting…";
    const reason = $("#reportReason").value.trim();
    const { error } = await sbReportMessage(messageId, reason);
    if (error) {
      btn.disabled = false; btn.textContent = "Submit report";
      return toast("Couldn't submit report: " + error.message);
    }
    closeModal();
    toast("Message reported — thanks, our team will review it.");
  });
}

/* ==========================================================
   IMAGE UPLOAD helper (reads the chosen photo as a data URL)
   ========================================================== */

function bindUpload(onImage) {
  const box = $("#uploadBox");
  const file = $("#uploadFile");
  const prev = $("#uploadPreview");
  if (!box || !file) return;
  box.addEventListener("click", () => file.click());
  file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Please choose an image file");
    const reader = new FileReader();
    reader.onload = () => {
      onImage(reader.result);
      prev.innerHTML = `<img src="${reader.result}" alt="preview"><button class="upload-remove" id="uploadRemove">✕</button>`;
      prev.classList.remove("hidden");
      box.classList.add("hidden");
      $("#uploadRemove").addEventListener("click", (e) => {
        e.stopPropagation();
        onImage(null);
        file.value = "";
        prev.classList.add("hidden");
        box.classList.remove("hidden");
      });
    };
    reader.readAsDataURL(f);
  });
}

const uploadHTML = (label) => `
  <div class="upload-preview hidden" id="uploadPreview"></div>
  <div class="upload-box" id="uploadBox">
    <input type="file" id="uploadFile" accept="image/*" />
    <div class="up-ico">📷</div>
    <div class="up-text">${esc(label)}</div>
    <div class="up-hint">Tap to choose a photo from your device</div>
  </div>`;

const modalHead = (title) => `
  <div class="modal-head">
    <div class="modal-title">${esc(title)}</div>
    <button class="modal-close" data-close>✕</button>
  </div>`;

/* --- legal pages (Terms of Service / Privacy Policy / Cookie Use) ---
   Plain-language drafts reflecting what the app actually does today —
   not a substitute for real legal review before scaling past an early
   soft launch, but accurate and specific rather than generic boilerplate. */
const LEGAL_DOCS = {
  terms: {
    title: "Terms of Service",
    body: `
      <p class="row-sub">Last updated: July 2026</p>
      <h4 class="h3">1. What CampusHub is</h4>
      <p class="post-body">CampusHub is a campus marketplace, events, and study-hub platform for University of Lagos students and vendors. You must be affiliated with UNILAG (as a student or a vendor serving the UNILAG community) to use it.</p>
      <h4 class="h3">2. Your account</h4>
      <p class="post-body">You're responsible for keeping your login credentials secure and for all activity under your account. Information you provide during signup (name, matric number, department, level, or business details) must be accurate — fake details, fraud, or scamming other students can lead to a permanent ban and may be reported to school authorities and the police.</p>
      <h4 class="h3">3. Marketplace &amp; vendors</h4>
      <p class="post-body">Sellers are responsible for the accuracy of their listings and for delivering what they've sold. Buyers are responsible for reviewing listings and vendor ratings before purchasing. Vendor accounts go through a verification step before certain trust indicators are shown, but verification does not make CampusHub a party to any transaction between a buyer and a seller.</p>
      <h4 class="h3">4. Payments</h4>
      <p class="post-body">Paid transactions (marketplace purchases and event tickets) are processed through Paystack. CampusHub never sees or stores your card details. A service fee is included in the displayed price on paid transactions to cover platform and payment-processing costs; free "place order" listings and free event tickets carry no fee.</p>
      <h4 class="h3">5. Events &amp; ticketing</h4>
      <p class="post-body">Event organizers are responsible for the accuracy of event details and for honoring valid tickets. Refunds for canceled or misrepresented events are handled case by case — contact the organizer first, then CampusHub if unresolved.</p>
      <h4 class="h3">6. Conduct</h4>
      <p class="post-body">Harassment, scamming, posting false lost &amp; found reports, or misusing the messaging system is not allowed. Every message can be reported for review. We may suspend or terminate accounts that violate these terms.</p>
      <h4 class="h3">7. Changes</h4>
      <p class="post-body">We may update these terms as the platform grows. Continued use after a change means you accept the updated terms.</p>
      <h4 class="h3">8. Governing law</h4>
      <p class="post-body">These terms are governed by the laws of Lagos State, Nigeria.</p>
    `,
  },
  privacy: {
    title: "Privacy Policy",
    body: `
      <p class="row-sub">Last updated: July 2026</p>
      <h4 class="h3">1. What we collect</h4>
      <p class="post-body">Account info you provide directly: name, email, matric number, level, and department (students); business name, category, description, phone, and location (vendors). Content you create: marketplace listings, event posts, campus feed posts, chat messages, study materials, and anything else you post. Usage data such as timestamps on your activity (e.g. when a message was sent, when an order was placed).</p>
      <h4 class="h3">2. What we don't collect</h4>
      <p class="post-body">We never see or store your card or bank details — payments and payouts are handled entirely by Paystack, and CampusHub only receives a confirmation that a payment succeeded or a payout account was created.</p>
      <h4 class="h3">3. How it's used</h4>
      <p class="post-body">To operate core features (marketplace, events, chat, study hub), to show your name/department/level to classmates where relevant (e.g. class announcements), and to verify vendor businesses. We don't sell your data or share it with advertisers.</p>
      <h4 class="h3">4. Third-party services</h4>
      <p class="post-body">Supabase hosts our database, authentication, file storage, and real-time messaging. Paystack processes payments and payouts. Both only receive the data needed to perform their part (e.g. Paystack receives your bank details only if you set up payouts as a vendor).</p>
      <h4 class="h3">5. Data retention &amp; your rights</h4>
      <p class="post-body">Your data is kept for as long as your account is active. You can request a copy of your data or account deletion by contacting us. Some records (e.g. completed order/payment history) may be retained longer for dispute resolution and legal compliance.</p>
      <h4 class="h3">6. Moderation records</h4>
      <p class="post-body">If you report a message, the reported content, your identity as the reporter, and the reported user are stored for admin review — this is necessary for the reporting system to function and isn't visible to other users.</p>
      <h4 class="h3">7. Contact</h4>
      <p class="post-body">Questions about this policy or your data can be sent through the app's support channel once available, or to the platform administrator directly.</p>
    `,
  },
  cookies: {
    title: "Cookie Use",
    body: `
      <p class="row-sub">Last updated: July 2026</p>
      <p class="post-body">CampusHub doesn't use third-party advertising or tracking cookies. What we do use:</p>
      <h4 class="h3">Authentication</h4>
      <p class="post-body">Supabase Auth stores a session token in your browser's local storage so you stay logged in between visits. Without it, you'd have to log in every time.</p>
      <h4 class="h3">Local preferences</h4>
      <p class="post-body">A small amount of data is saved directly in your browser (not sent to any server): your dark/light mode preference, and your GPA/CGPA calculator entries, since those are personal scratch calculations with nothing to sync elsewhere.</p>
      <h4 class="h3">Your control</h4>
      <p class="post-body">Clearing your browser's site data for CampusHub will log you out and reset these local preferences. It won't affect anything stored in your account server-side (listings, messages, orders, etc.).</p>
    `,
  },
};

function showLegalDoc(type) {
  const doc = LEGAL_DOCS[type];
  if (!doc) return;
  openModal(`${modalHead(doc.title)}${doc.body}`, true);
}

/* --- listing detail --- */
async function showItem(id) {
  const l = state.listings.find((x) => x.id === id);
  if (!l) return;

  // every real listing's seller is a vendor, so look up their business —
  // falls back to the plain "verified student" card if none is found
  let shop = null, sellerProfile = null, avg = null, reviewCount = 0, followerCount = 0, salesCount = 0;
  if (l.sellerId) {
    const { data: biz } = await sbGetBusiness(l.sellerId);
    if (biz) {
      shop = biz;
      const [{ data: prof }, { data: reviews }, { count }, { data: sc }] = await Promise.all([
        sbGetProfile(l.sellerId),
        sbGetShopReviews(biz.id),
        sbGetFollowerCount(biz.id),
        sbGetPublicSalesCount(biz.id),
      ]);
      sellerProfile = prof;
      reviewCount = (reviews || []).length;
      avg = reviewCount ? reviews.reduce((s, r) => s + r.stars, 0) / reviewCount : null;
      followerCount = count || 0;
      salesCount = sc || 0;
    }
  }

  const trustCard = shop ? `
    <div class="trust-card">
      <div class="trust-top">
        <div class="post-avatar">${esc(shop.name[0])}</div>
        <div style="flex:1">
          <div class="trust-name">${esc(shop.name)} ${shop.verified ? '<span class="verified-badge">✅ Verified</span>' : ""}</div>
          <div class="trust-meta">${sellerProfile && sellerProfile.level ? `${esc(sellerProfile.dept)} · ${esc(sellerProfile.level)}` : "University of Lagos"}</div>
        </div>
      </div>
      <div class="trust-stats">
        <span>${avg !== null ? `⭐ ${avg.toFixed(1)} (${reviewCount})` : "No reviews yet"}</span>
        <span>✅ ${salesCount} completed sales</span>
        <span>👥 ${followerCount} followers</span>
      </div>
      <button class="btn btn-ghost btn-block" data-open-shop="${l.sellerId}" style="margin-top:10px">🏬 View shop</button>
    </div>` : `
    <div class="trust-card">
      <div class="trust-top">
        <div class="post-avatar">${esc(l.seller[0])}</div>
        <div style="flex:1">
          <div class="trust-name">${esc(l.seller)} <span class="verified-badge">✅ Verified Student</span></div>
          <div class="trust-meta">University of Lagos · identity confirmed at signup</div>
        </div>
      </div>
    </div>`;

  const canOrder = shop && l.productId && l.sellerId !== state.user.id;

  openModal(`
    ${modalHead("Listing")}
    ${imgBlock(l.img, "detail-img")}
    <span class="tag">${esc(l.cat)}</span>
    <div class="detail-title">${esc(l.title)}</div>
    <div class="detail-price">${naira(l.price)}</div>
    <p class="detail-desc">${esc(l.desc)}</p>
    <div class="detail-meta">📍 ${esc(l.loc)}</div>
    ${trustCard}
    ${canOrder ? `<button class="btn btn-accent btn-block" id="buyNowBtn" style="margin-top:12px">💳 Buy now</button>` : ""}
    ${canOrder ? `<button class="btn btn-ghost btn-block" id="placeOrderBtn" style="margin-top:8px">🛒 Place order (pay seller directly)</button>` : ""}
    <button class="btn btn-primary btn-block" id="msgSeller" style="margin-top:12px">💬 Message seller</button>
  `);
  $("#msgSeller").addEventListener("click", () => {
    if (l.sellerId === state.user.id) return toast("This is your own listing");
    openChat(l.sellerId, l.seller);
  });
  const vs = document.querySelector("[data-open-shop]");
  if (vs) vs.addEventListener("click", () => openShop(vs.dataset.openShop));
  const orderBtn = document.querySelector("#placeOrderBtn");
  if (orderBtn) orderBtn.addEventListener("click", () => showPlaceOrder(l, shop.id));
  const buyNowBtn = document.querySelector("#buyNowBtn");
  if (buyNowBtn) buyNowBtn.addEventListener("click", () => showBuyNow(l));
}

/* --- buyer pays immediately via Paystack; vendor's share is split to
   their bank automatically (see init-marketplace-payment) --- */
function showBuyNow(l) {
  const summaryFor = (qty) => {
    const itemTotal = l.price * qty;
    const fee = marketplaceFee(itemTotal);
    const total = estimateGrossUpTotal(itemTotal + fee);
    return `
      <div class="sum-row"><span>${qty} × ${esc(l.title)}</span><b>${naira(itemTotal)}</b></div>
      <div class="sum-row"><span>Service fee</span><b>${naira(fee)}</b></div>
      <div class="sum-div"></div>
      <div class="sum-total"><span>Total</span><span>${naira(total)}</span></div>`;
  };

  openModal(`
    ${modalHead("Buy now")}
    ${imgBlock(l.img, "detail-img")}
    <div class="detail-title">${esc(l.title)}</div>
    <div class="detail-price">${naira(l.price)} each</div>
    <input id="buyQty" class="input" type="number" min="1" value="1" placeholder="Quantity" />
    <div class="summary" id="buySummary">${summaryFor(1)}</div>
    <button class="btn btn-primary btn-block" id="buyGo">Continue to payment</button>
  `);

  $("#buyQty").addEventListener("input", () => {
    const q = Math.max(1, Number($("#buyQty").value) || 1);
    $("#buySummary").innerHTML = summaryFor(q);
  });

  $("#buyGo").addEventListener("click", async () => {
    const qty = Number($("#buyQty").value);
    if (!qty || qty < 1) return toast("Enter a valid quantity");
    const buyGo = $("#buyGo");
    buyGo.disabled = true; buyGo.textContent = "Starting payment…";

    const { data, error } = await sbInitMarketplacePayment(l.id, qty);
    if (error || data?.error) {
      buyGo.disabled = false; buyGo.textContent = "Continue to payment";
      return toast((data && data.error) || await edgeErrorMessage(error, "Couldn't start payment"));
    }

    const popup = new PaystackPop();
    popup.resumeTransaction(data.access_code, {
      onSuccess: async () => {
        const { data: confirmData, error: confirmErr } = await sbConfirmMarketplacePayment(data.order_id);
        if (confirmErr || !confirmData || confirmData.error) {
          const msg = (confirmData && confirmData.error) || await edgeErrorMessage(confirmErr, "Something went wrong confirming your payment.");
          toast(msg);
          return;
        }
        closeModal();
        toast("Payment successful — order placed 🎉");
        await hydrateMarketplace();
      },
      onCancel: () => {
        buyGo.disabled = false; buyGo.textContent = "Continue to payment";
        toast("Payment cancelled");
      },
    });
  });
}

/* --- buyer places an order for a product-backed listing --- */
function showPlaceOrder(l, shopId) {
  openModal(`
    ${modalHead("Place order")}
    ${imgBlock(l.img, "detail-img")}
    <div class="detail-title">${esc(l.title)}</div>
    <div class="detail-price">${naira(l.price)} each</div>
    <input id="orderQty" class="input" type="number" min="1" value="1" placeholder="Quantity" />
    <button class="btn btn-primary btn-block" id="orderGo">Place order</button>
  `);
  $("#orderGo").addEventListener("click", async () => {
    const qty = Number($("#orderQty").value);
    if (!qty || qty < 1) return toast("Enter a valid quantity");
    const orderGo = $("#orderGo");
    orderGo.disabled = true; orderGo.textContent = "Placing…";
    const { error } = await sbInsertOrder({
      shop_id: shopId, product_id: l.productId, buyer_id: state.user.id, qty,
    });
    if (error) { orderGo.disabled = false; orderGo.textContent = "Place order"; return toast("Couldn't place order: " + error.message); }
    closeModal();
    toast("Order placed! The vendor will confirm soon 🎉");
  });
}

/* --- buyer-facing storefront --- */
async function openShop(sellerId) {
  const { data: biz } = await sbGetBusiness(sellerId);
  if (!biz) return toast("This shop isn't available");
  const { data: prof } = await sbGetProfile(sellerId);
  const shopListings = state.listings.filter((l) => l.sellerId === sellerId);
  const { data: reviews } = await sbGetShopReviews(biz.id);
  const { count: followerCount } = await sbGetFollowerCount(biz.id);
  const { data: followRow } = await sbIsFollowing(biz.id, state.user.id);
  const { data: salesCount } = await sbGetPublicSalesCount(biz.id);
  let youFollow = !!followRow;
  const avg = reviews && reviews.length ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : 0;

  const prodGrid = shopListings.map((p) => `
    <button class="listing" data-shop-item="${p.id}">
      ${imgBlock(p.img, "thumb")}
      <div class="listing-body">
        <div class="listing-title">${esc(p.title)}</div>
        <div class="price">${naira(p.price)}</div>
      </div>
    </button>`).join("");

  const reviewRows = (reviews || []).map((r) => `
    <div class="card" style="margin-bottom:8px">
      <div class="post-head" style="margin-bottom:4px">
        <div class="post-avatar">${esc((r.reviewer?.name || "?")[0])}</div>
        <div style="flex:1">
          <div class="post-who">${esc(r.reviewer?.name || "Buyer")}</div>
          <div class="post-time">${fmtRowTime(r.created_at)}</div>
        </div>
        <span class="mat-stars">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</span>
      </div>
      <p class="post-body">${esc(r.text || "")}</p>
    </div>`).join("");

  const metaLine = prof && prof.level
    ? `${esc(prof.dept)} · ${esc(prof.level)} · run by ${esc(prof.name)}`
    : `run by ${esc((prof && prof.name) || "Vendor")}`;

  openModal(`
    ${modalHead("Shop")}
    <div class="shop-hero">
      <div class="shop-hero-avatar">${esc(biz.name[0])}</div>
      <div class="trust-name" style="font-size:20px">${esc(biz.name)} ${biz.verified ? '<span class="verified-badge">✅ Verified</span>' : ""}</div>
      <div class="trust-meta">${metaLine}</div>
      <p class="detail-desc" style="margin-top:6px">${esc(biz.description || "")}</p>
      <div class="shop-hero-stats">
        <div><b>⭐ ${avg.toFixed(1)}</b><span>${(reviews || []).length} ratings</span></div>
        <div><b>${salesCount || 0}</b><span>completed sales</span></div>
        <div><b id="folCount">${followerCount || 0}</b><span>followers</span></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn ${youFollow ? "btn-ghost" : "btn-accent"}" style="flex:1" id="folBtn">${youFollow ? "Following ✓" : "＋ Follow"}</button>
        <button class="btn btn-primary" style="flex:1" id="shopMsg">💬 Message</button>
      </div>
    </div>
    <div class="set-group">Products (${shopListings.length})</div>
    <div class="grid" style="grid-template-columns:repeat(2,1fr)">${prodGrid || `<div class="empty">No products listed yet</div>`}</div>
    <div class="set-group">Reviews (${(reviews || []).length})</div>
    ${reviewRows || `<div class="empty">No reviews yet</div>`}
  `, true);

  $("#folBtn").addEventListener("click", async () => {
    const btn = $("#folBtn");
    btn.disabled = true;
    if (youFollow) {
      const { error } = await sbUnfollowShop(biz.id, state.user.id);
      if (error) { btn.disabled = false; return toast("Couldn't unfollow: " + error.message); }
      youFollow = false;
    } else {
      const { error } = await sbFollowShop(biz.id, state.user.id);
      if (error) { btn.disabled = false; return toast("Couldn't follow: " + error.message); }
      youFollow = true;
    }
    $("#folCount").textContent = (Number($("#folCount").textContent) || 0) + (youFollow ? 1 : -1);
    btn.textContent = youFollow ? "Following ✓" : "＋ Follow";
    btn.className = "btn " + (youFollow ? "btn-ghost" : "btn-accent");
    btn.disabled = false;
    toast(youFollow ? "Following " + biz.name + " 🔔" : "Unfollowed " + biz.name);
  });
  $("#shopMsg").addEventListener("click", () => {
    if (sellerId === state.user.id) return toast("This is your own shop");
    openChat(sellerId, biz.name);
  });
  document.querySelectorAll("[data-shop-item]").forEach((b) =>
    b.addEventListener("click", () => showItem(b.dataset.shopItem)));
}

/* --- sell form --- */
function showSell() {
  if (state.user.role !== "vendor") return;
  const opts = state.cats.filter((c) => c !== "All")
    .map((c) => `<option>${esc(c)}</option>`).join("");
  let photo = null;
  openModal(`
    ${modalHead("Sell an item")}
    ${uploadHTML("Add a photo of your item")}
    <input id="sellTitle" class="input" placeholder="What are you selling?" />
    <input id="sellPrice" class="input" type="number" placeholder="Price (₦)" />
    <select id="sellCat" class="input">${opts}</select>
    <input id="sellLoc" class="input" placeholder="Pickup location (e.g. Moremi Hall)" />
    <textarea id="sellDesc" class="input" rows="3" placeholder="Describe it briefly…"></textarea>
    <button class="btn btn-primary btn-block" id="sellGo">Post to market</button>
  `);
  bindUpload((data) => { photo = data; });
  $("#sellGo").addEventListener("click", async () => {
    const title = $("#sellTitle").value.trim();
    const price = Number($("#sellPrice").value);
    if (!title || !price) return toast("Add a title and price first");
    const sellGo = $("#sellGo");
    sellGo.disabled = true; sellGo.textContent = "Posting…";
    const { data, error } = await sbInsertListing({
      seller_id: state.user.id,
      title, price,
      category: $("#sellCat").value,
      location: $("#sellLoc").value.trim() || "Campus",
      description: $("#sellDesc").value.trim(),
      image_url: photo || img("photo-1553062407-98eeb64c6a62"),
    });
    if (error) { sellGo.disabled = false; sellGo.textContent = "Post to market"; return toast("Couldn't post listing: " + error.message); }
    state.listings.unshift({
      id: data.id, title: data.title, price: data.price, cat: data.category,
      loc: data.location, desc: data.description, img: data.image_url,
      seller: state.user.name, sellerId: data.seller_id, productId: data.product_id,
    });
    closeModal(); render(); toast("Your item is live! 🎉");
  });
}

/* --- list an existing inventory product on the marketplace --- */
function showListProduct(productId) {
  const p = state.products.find((x) => x.id === productId);
  if (!p) return;
  const opts = state.cats.filter((c) => c !== "All")
    .map((c) => `<option>${esc(c)}</option>`).join("");
  let photo = p.img || null;
  openModal(`
    ${modalHead("List on marketplace")}
    ${uploadHTML("Add a photo of your item")}
    <input id="lpTitle" class="input" placeholder="What are you selling?" value="${esc(p.name)}" />
    <input id="lpPrice" class="input" type="number" placeholder="Price (₦)" value="${p.price}" />
    <select id="lpCat" class="input">${opts}</select>
    <input id="lpLoc" class="input" placeholder="Pickup location (e.g. Moremi Hall)" />
    <textarea id="lpDesc" class="input" rows="3" placeholder="Describe it briefly…"></textarea>
    <button class="btn btn-primary btn-block" id="lpGo">List on market</button>
  `);
  bindUpload((data) => { photo = data; });
  $("#lpGo").addEventListener("click", async () => {
    const title = $("#lpTitle").value.trim();
    const price = Number($("#lpPrice").value);
    if (!title || !price) return toast("Add a title and price first");
    const lpGo = $("#lpGo");
    lpGo.disabled = true; lpGo.textContent = "Listing…";
    const { data, error } = await sbInsertListing({
      seller_id: state.user.id,
      product_id: p.id,
      title, price,
      category: $("#lpCat").value,
      location: $("#lpLoc").value.trim() || "Campus",
      description: $("#lpDesc").value.trim(),
      image_url: photo || img("photo-1553062407-98eeb64c6a62"),
    });
    if (error) { lpGo.disabled = false; lpGo.textContent = "List on market"; return toast("Couldn't list product: " + error.message); }
    const { error: updErr } = await sbUpdateProduct(p.id, { listed: true });
    if (updErr) console.error("Listing created but failed to flag product as listed:", updErr.message);
    state.listings.unshift({
      id: data.id, title: data.title, price: data.price, cat: data.category,
      loc: data.location, desc: data.description, img: data.image_url,
      seller: (state.user.business && state.user.business.name) || state.user.name,
      sellerId: data.seller_id, productId: data.product_id,
    });
    p.listed = true;
    closeModal(); render(); toast("Added to marketplace! 🎉");
  });
}

/* ==========================================================
   TICKET CHECKOUT WIZARD  (Tickets → Contact → Payment)
   ========================================================== */

let checkoutTimer = null;

function openCheckout(eventId) {
  const ev = state.events.find((x) => x.id === eventId);
  if (!ev) return;
  const co = {
    ev,
    step: "tickets", // tickets | contact | payment
    qty: {},         // tierId -> quantity
    contact: { first: "", last: "", email: "", email2: "", phone: "" },
    secondsLeft: 600,
  };
  ev.tiers.forEach((t) => (co.qty[t.id] = 0));
  renderCheckout(co);
}

function coTotals(co) {
  let items = [], fees = 0, subtotal = 0, count = 0;
  co.ev.tiers.forEach((t) => {
    const q = co.qty[t.id] || 0;
    if (q > 0) {
      const fee = eventFee(t.price) * q;
      items.push({ name: t.name, q, amount: t.price * q });
      fees += fee;
      subtotal += t.price * q + fee;
      count += q;
    }
  });
  return { items, fees, subtotal, count };
}

function coSteps(step) {
  const order = ["tickets", "contact", "payment"];
  const labels = { tickets: "Tickets", contact: "Contact", payment: "Payment" };
  const idx = order.indexOf(step);
  return `<div class="steps">${order.map((s, i) => `
    <div class="step ${i < idx ? "done" : i === idx ? "current" : ""}">
      <span class="dot">${i < idx ? "✓" : ""}</span>${labels[s]}
    </div>${i < order.length - 1 ? '<div class="step-line"></div>' : ""}`).join("")}
  </div>`;
}

function coSummary(co, btnLabel, btnId, disabled) {
  const t = coTotals(co);
  const lines = t.items.length
    ? t.items.map((i) => `<div class="sum-row"><span>${i.q} × ${esc(i.name)}</span><b>${i.amount === 0 ? "Free" : naira(i.amount)}</b></div>`).join("")
    : `<div class="sum-row"><span>No tickets selected yet</span></div>`;
  return `
    <div class="summary">
      <div class="summary-title">${esc(co.ev.title)}</div>
      ${lines}
      <div class="sum-div"></div>
      <div class="sum-row"><span>Fees ⓘ</span><b>${t.fees === 0 ? "—" : naira(t.fees)}</b></div>
      <div class="sum-row"><span>Subtotal</span><b>${t.subtotal === 0 ? (t.count > 0 ? "Free" : "—") : naira(t.subtotal)}</b></div>
      <div class="sum-note">Fees support the CampusHub platform. Free events have no fees.</div>
      <div class="sum-total"><span>Total</span><span>${t.subtotal === 0 ? (t.count > 0 ? "Free" : "₦0") : naira(t.subtotal)}</span></div>
      <button class="continue-btn" id="${btnId}" ${disabled ? "disabled" : ""}>${btnLabel}</button>
    </div>`;
}

function fmtTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return m + ":" + sec;
}

function renderCheckout(co) {
  clearInterval(checkoutTimer);
  const t = coTotals(co);

  /* ----- STEP 1: choose tickets ----- */
  if (co.step === "tickets") {
    const tiers = co.ev.tiers.map((tier) => {
      if (tier.left === 0) {
        return `
        <div class="tier">
          <div class="tier-top">
            <div>
              <div class="tier-name muted">${esc(tier.name)}</div>
              <div class="tier-desc muted">${esc(tier.desc)}</div>
            </div>
            <span class="soldout-pill">Sold Out</span>
          </div>
        </div>`;
      }
      const max = Math.min(6, tier.left);
      const opts = Array.from({ length: max + 1 }, (_, i) =>
        `<option value="${i}" ${co.qty[tier.id] === i ? "selected" : ""}>${i}</option>`).join("");
      const fee = eventFee(tier.price);
      return `
      <div class="tier">
        <div class="tier-top">
          <div>
            <div class="tier-name">${esc(tier.name)}</div>
            <div class="tier-price">${tier.price === 0 ? "Free" : naira(tier.price + fee)}
              ${fee > 0 ? `<span class="tier-fee">includes ${naira(fee)} fee</span>` : ""}
            </div>
            <div class="tier-desc">${esc(tier.desc)}</div>
          </div>
          <select class="qty-select" data-tier="${tier.id}">${opts}</select>
        </div>
      </div>`;
    }).join("");

    openModal(`
      ${modalHead("Choose Tickets")}
      ${coSteps("tickets")}
      <div class="co-grid">
        <div>${tiers}</div>
        ${coSummary(co, "Continue", "coNext", t.count === 0)}
      </div>
    `, true);

    document.querySelectorAll("[data-tier]").forEach((sel) =>
      sel.addEventListener("change", () => {
        co.qty[sel.dataset.tier] = Number(sel.value);
        renderCheckout(co);
      }));
    $("#coNext").addEventListener("click", () => {
      if (coTotals(co).count === 0) return;
      co.step = "contact";
      renderCheckout(co);
    });
    return;
  }

  /* ----- STEP 2: contact information ----- */
  if (co.step === "contact") {
    const c = co.contact;
    openModal(`
      ${modalHead("Contact Information")}
      ${coSteps("contact")}
      <div class="co-grid">
        <div>
          <div class="reserve-note">We've reserved your tickets. Please complete checkout within <b id="coTimer">${fmtTime(co.secondsLeft)}</b> to secure them.</div>
          <div class="field-label"><span class="req">*</span>First name</div>
          <input id="cFirst" class="input" placeholder="First name" value="${esc(c.first)}" />
          <div class="field-label"><span class="req">*</span>Last name</div>
          <input id="cLast" class="input" placeholder="Last name" value="${esc(c.last)}" />
          <div class="field-label"><span class="req">*</span>Email address</div>
          <input id="cEmail" class="input" type="email" placeholder="Email address" value="${esc(c.email)}" />
          <div class="field-label"><span class="req">*</span>Confirm email address</div>
          <input id="cEmail2" class="input" type="email" placeholder="Confirm email address" value="${esc(c.email2)}" />
          <div class="field-label"><span class="req">*</span>Phone number</div>
          <div class="phone-row">
            <select class="input cc"><option>+234</option></select>
            <input id="cPhone" class="input" type="tel" placeholder="Phone number" value="${esc(c.phone)}" />
          </div>
          <p class="form-hint">🎟️ Tickets will be sent to the email address you provide here.</p>
        </div>
        ${coSummary(co, "Continue", "coNext", true)}
      </div>
    `, true);

    // countdown
    checkoutTimer = setInterval(() => {
      co.secondsLeft--;
      const el = $("#coTimer");
      if (el) el.textContent = fmtTime(co.secondsLeft);
      if (co.secondsLeft <= 0) {
        clearInterval(checkoutTimer);
        closeModal();
        toast("Reservation expired — please start again");
      }
    }, 1000);

    const fields = ["cFirst", "cLast", "cEmail", "cEmail2", "cPhone"];
    const keys = ["first", "last", "email", "email2", "phone"];
    const check = () => {
      fields.forEach((f, i) => (co.contact[keys[i]] = $("#" + f).value.trim()));
      const c2 = co.contact;
      const ok = c2.first && c2.last && c2.email.includes("@") &&
                 c2.email === c2.email2 && c2.phone.length >= 7;
      $("#coNext").disabled = !ok;
    };
    fields.forEach((f) => $("#" + f).addEventListener("input", check));
    check();
    $("#coNext").addEventListener("click", () => {
      if ($("#coNext").disabled) {
        if (co.contact.email !== co.contact.email2) toast("Email addresses don't match");
        return;
      }
      co.step = "payment";
      renderCheckout(co);
    });
    return;
  }

  /* ----- STEP 3: payment ----- */
  const free = t.subtotal === 0;
  openModal(`
    ${modalHead("Payment")}
    ${coSteps("payment")}
    <div class="co-grid">
      <div>
        <div class="pay-box">
          <div class="pay-amount ${free ? "free" : ""}">${free ? "Free" : naira(t.subtotal)}</div>
          <div class="pay-sub">${free
            ? "This event is free — no payment needed. 🎉"
            : "Total for " + t.count + " ticket" + (t.count > 1 ? "s" : "") + ", fees included."}</div>
          ${free ? "" : `<div class="pay-method">💳 Pay securely with Paystack</div>`}
        </div>
        <p class="form-hint">Ticket${t.count > 1 ? "s" : ""} will be sent to <b>${esc(co.contact.email)}</b>${free ? "." : " after payment."}</p>
      </div>
      ${coSummary(co, free ? "Get free tickets" : "Pay " + naira(t.subtotal), "coPay", false)}
    </div>
  `, true);

  const payLabel = free ? "Get free tickets" : "Pay " + naira(t.subtotal);
  $("#coPay").addEventListener("click", async () => {
    const payBtn = $("#coPay");

    const finish = async (ticketIds) => {
      const { data: confirmData, error: confirmErr } = await sbConfirmTicket(ticketIds);
      if (confirmErr || !confirmData || confirmData.error) {
        const msg = (confirmData && confirmData.error) || await edgeErrorMessage(confirmErr, "Something went wrong confirming your tickets.");
        payBtn.disabled = false; payBtn.textContent = payLabel;
        return toast(msg);
      }
      clearInterval(checkoutTimer);
      closeModal();
      toast(free ? "You're in! Tickets saved 🎉" : "Payment successful — tickets saved 🎉");
      await hydrateEvents();
    };

    if (free) {
      payBtn.disabled = true; payBtn.textContent = "Reserving…";
      // free tickets are reserved directly by the client — no split, no
      // Paystack involvement, so there's nothing to lock in server-side
      const rows = [];
      co.ev.tiers.forEach((tier) => {
        const q = co.qty[tier.id] || 0;
        if (q > 0) {
          rows.push({
            tier_id: tier.id, buyer_id: state.user.id, qty: q, total: 0,
            code: "CH-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
            status: "pending",
          });
        }
      });
      if (!rows.length) { payBtn.disabled = false; payBtn.textContent = payLabel; return; }
      const { data: reserved, error: reserveErr } = await sbInsertTickets(rows);
      if (reserveErr) {
        payBtn.disabled = false; payBtn.textContent = payLabel;
        return toast("Couldn't reserve tickets: " + reserveErr.message);
      }
      await finish(reserved.map((r) => r.id));
      return;
    }

    // paid tickets: the split (organizer subaccount + platform fee) is
    // locked in server-side before the popup ever shows — see
    // init-ticket-payment
    payBtn.disabled = true; payBtn.textContent = "Starting payment…";
    const tierSelections = co.ev.tiers
      .filter((tier) => (co.qty[tier.id] || 0) > 0)
      .map((tier) => ({ tier_id: tier.id, qty: co.qty[tier.id] }));

    const { data: initData, error: initErr } = await sbInitTicketPayment(tierSelections);
    if (initErr || initData?.error) {
      payBtn.disabled = false; payBtn.textContent = payLabel;
      return toast((initData && initData.error) || await edgeErrorMessage(initErr, "Couldn't start payment"));
    }

    const popup = new PaystackPop();
    popup.resumeTransaction(initData.access_code, {
      onSuccess: () => finish(initData.ticket_ids),
      onCancel: () => {
        payBtn.disabled = false; payBtn.textContent = payLabel;
        toast("Payment cancelled");
      },
    });
  });
}

/* ==========================================================
   HOST AN EVENT  (organizer info → event details → tickets)
   ========================================================== */

/* --- organizer check-in: verify a ticket code and mark it used --- */
function showScanTicket() {
  openModal(`
    ${modalHead("Scan tickets")}
    <p class="host-note">Enter or scan a ticket code to check a guest in. Each ticket can only be used once.</p>
    <input id="scanCode" class="input" placeholder="Ticket code (e.g. CH-AB12CD)" autocomplete="off" style="text-transform:uppercase" />
    <button class="btn btn-primary btn-block" id="scanGo">Verify</button>
    <button class="btn btn-ghost btn-block" id="scanCamBtn" style="margin-top:8px">📷 Scan with camera</button>
    <div id="scanCamWrap" class="hidden" style="margin-top:10px">
      <video id="scanVideo" style="width:100%;border-radius:12px;background:#000" playsinline muted></video>
    </div>
    <div id="scanResult" style="margin-top:14px"></div>
  `);

  const renderResult = (html) => { $("#scanResult").innerHTML = html; };

  const verify = async (code) => {
    if (!code || !code.trim()) return;
    const scanGo = $("#scanGo");
    scanGo.disabled = true;
    const { data, error } = await sbScanTicket(code.trim());
    scanGo.disabled = false;
    if (error) {
      const msg = await edgeErrorMessage(error, "Couldn't verify this code");
      renderResult(`<div class="trust-card"><div class="trust-name">❌ ${esc(msg)}</div></div>`);
      return;
    }
    if (data.error) {
      renderResult(`<div class="trust-card"><div class="trust-name">❌ ${esc(data.error)}</div></div>`);
      return;
    }
    if (!data.valid) {
      const reasonText = {
        not_found: "Ticket code not found.",
        not_paid: "This ticket was never paid for.",
        already_used: "Already used at " + new Date(data.used_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase() + ".",
      }[data.reason] || "This ticket isn't valid.";
      renderResult(`
        <div class="trust-card">
          <div class="trust-name">❌ ${esc(reasonText)}</div>
          ${data.buyer_name ? `<div class="trust-meta">${esc(data.buyer_name)} · ${esc(data.tier_name || "")} · ${esc(data.event_title || "")}</div>` : ""}
        </div>`);
      return;
    }
    renderResult(`
      <div class="trust-card">
        <div class="trust-name">✅ Valid entry — ${esc(data.buyer_name)}</div>
        <div class="trust-meta">${data.qty} × ${esc(data.tier_name)} · ${esc(data.event_title)}</div>
      </div>`);
  };

  $("#scanGo").addEventListener("click", () => verify($("#scanCode").value));
  $("#scanCode").addEventListener("keydown", (e) => { if (e.key === "Enter") verify($("#scanCode").value); });

  // camera scanning: the browser's native BarcodeDetector where available
  // (Chrome/Edge/Android), falling back to jsQR (canvas frame decoding)
  // everywhere else — that covers Brave, Safari, and iPhones, which don't
  // implement BarcodeDetector. Manual code entry above always works
  // regardless of browser support.
  let scanning = false, stream = null;
  const stopCamera = () => {
    scanning = false;
    if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null; }
  };
  $("#scanCamBtn").addEventListener("click", async () => {
    const useBarcodeDetector = "BarcodeDetector" in window;
    const useJsQR = !useBarcodeDetector && typeof jsQR === "function";
    if (!useBarcodeDetector && !useJsQR) {
      return toast("Camera scanning isn't supported in this browser — enter the code manually");
    }
    const wrap = $("#scanCamWrap");
    const video = $("#scanVideo");
    if (scanning) { stopCamera(); wrap.classList.add("hidden"); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch (e) {
      return toast("Couldn't access the camera: " + e.message);
    }
    video.srcObject = stream;
    await video.play();
    wrap.classList.remove("hidden");
    scanning = true;

    // detectFrame() resolves to a decoded string, or null if nothing found
    // in the current frame — the loop below is shared by both methods
    let detectFrame;
    if (useBarcodeDetector) {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      detectFrame = async () => {
        try {
          const codes = await detector.detect(video);
          return codes.length ? codes[0].rawValue : null;
        } catch (e) { return null; }
      };
    } else {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      detectFrame = async () => {
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return null;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        return result ? result.data : null;
      };
    }

    const loop = async () => {
      if (!scanning) return;
      const value = await detectFrame();
      if (value) {
        stopCamera();
        wrap.classList.add("hidden");
        $("#scanCode").value = value;
        verify(value);
        return;
      }
      requestAnimationFrame(loop);
    };
    loop();
  });

  // stop the camera if the modal is closed mid-scan
  const overlay = $("#overlay");
  if (overlay) overlay.addEventListener("click", (e) => { if (e.target.id === "overlay") stopCamera(); });
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", stopCamera));
}

function openHost() {
  const h = {
    step: "organizer", // organizer | details | tickets
    org: { name: "", email: "", phone: "" },
    ev: { title: "", date: "", time: "", venue: "", tag: "Party", desc: "" },
    photo: null,
    tiers: [{ name: "", price: "", qty: "" }],
  };
  renderHost(h);
}

function renderHost(h) {
  /* ----- STEP 1: organizer info ----- */
  if (h.step === "organizer") {
    openModal(`
      ${modalHead("Host an event — Your details")}
      <p class="host-note">Before you can publish an event, we need to know who's organizing it. This protects students from fake events, and it's how we pay you your ticket money.</p>
      <div class="field-label"><span class="req">*</span>Organizer / group name</div>
      <input id="hName" class="input" placeholder="e.g. UNILAG Tech Club" value="${esc(h.org.name)}" />
      <div class="field-label"><span class="req">*</span>Contact email</div>
      <input id="hEmail" class="input" type="email" placeholder="We'll send sales reports here" value="${esc(h.org.email)}" />
      <div class="field-label"><span class="req">*</span>Phone number (WhatsApp preferred)</div>
      <div class="phone-row">
        <select class="input cc"><option>+234</option></select>
        <input id="hPhone" class="input" type="tel" placeholder="Phone number" value="${esc(h.org.phone)}" />
      </div>
      <p class="form-hint">The real build verifies organizers and connects a bank account for payouts.</p>
      <button class="continue-btn" id="hNext" disabled>Continue</button>
    `);
    const check = () => {
      h.org.name = $("#hName").value.trim();
      h.org.email = $("#hEmail").value.trim();
      h.org.phone = $("#hPhone").value.trim();
      $("#hNext").disabled = !(h.org.name && h.org.email.includes("@") && h.org.phone.length >= 7);
    };
    ["hName", "hEmail", "hPhone"].forEach((f) => $("#" + f).addEventListener("input", check));
    check();
    $("#hNext").addEventListener("click", () => {
      if ($("#hNext").disabled) return;
      h.step = "details"; renderHost(h);
    });
    return;
  }

  /* ----- STEP 2: event details ----- */
  if (h.step === "details") {
    openModal(`
      ${modalHead("Host an event — Event details")}
      ${uploadHTML("Add an event banner")}
      <div class="field-label"><span class="req">*</span>Event title</div>
      <input id="eTitle" class="input" placeholder="e.g. End of Semester Party" value="${esc(h.ev.title)}" />
      <div class="field-label"><span class="req">*</span>Date &amp; time</div>
      <div class="phone-row">
        <input id="eDate" class="input" type="date" value="${esc(h.ev.date)}" />
        <input id="eTime" class="input" type="time" value="${esc(h.ev.time)}" />
      </div>
      <div class="field-label"><span class="req">*</span>Venue</div>
      <input id="eVenue" class="input" placeholder="e.g. Multipurpose Hall" value="${esc(h.ev.venue)}" />
      <div class="field-label">Category</div>
      <select id="eTag" class="input">
        ${["Party", "Dinner", "Workshop", "Concert", "Sports", "Religious", "Other"]
          .map((t) => `<option ${h.ev.tag === t ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      <div class="field-label">Description</div>
      <textarea id="eDesc" class="input" rows="3" placeholder="Tell students what to expect…">${esc(h.ev.desc)}</textarea>
      <button class="continue-btn" id="hNext" disabled>Continue to tickets</button>
    `);
    bindUpload((data) => { h.photo = data; });
    const check = () => {
      h.ev.title = $("#eTitle").value.trim();
      h.ev.date = $("#eDate").value.trim();
      h.ev.time = $("#eTime").value.trim();
      h.ev.venue = $("#eVenue").value.trim();
      h.ev.tag = $("#eTag").value;
      h.ev.desc = $("#eDesc").value.trim();
      $("#hNext").disabled = !(h.ev.title && h.ev.date && h.ev.time && h.ev.venue);
    };
    ["eTitle", "eDate", "eTime", "eVenue", "eDesc"].forEach((f) =>
      $("#" + f).addEventListener("input", check));
    $("#eTag").addEventListener("change", check);
    check();
    $("#hNext").addEventListener("click", () => {
      if ($("#hNext").disabled) return;
      h.step = "tickets"; renderHost(h);
    });
    return;
  }

  /* ----- STEP 3: ticket types ----- */
  const tierRows = h.tiers.map((t, i) => `
    <div class="tier-editor">
      <div class="tier-editor-head">
        <span>Ticket type ${i + 1}</span>
        ${h.tiers.length > 1 ? `<button class="tier-remove" data-remove="${i}">Remove</button>` : ""}
      </div>
      <input class="input t-name" data-i="${i}" placeholder="Name (e.g. Regular, VIP)" value="${esc(t.name)}" />
      <div class="phone-row">
        <input class="input t-price" data-i="${i}" type="number" min="0" placeholder="Price ₦ (0 = free)" value="${esc(t.price)}" />
        <input class="input t-qty" data-i="${i}" type="number" min="1" placeholder="Quantity available" value="${esc(t.qty)}" />
      </div>
    </div>`).join("");

  openModal(`
    ${modalHead("Host an event — Tickets")}
    <p class="host-note">Set a price of ₦0 to make a ticket free. Paid tickets carry a 9% platform fee, added on top for the buyer — you keep your full price.</p>
    ${tierRows}
    <button class="add-tier" id="addTier">＋ Add another ticket type</button>
    <button class="continue-btn" id="hPublish">Publish event</button>
  `);

  const sync = () => {
    document.querySelectorAll(".t-name").forEach((el) => (h.tiers[el.dataset.i].name = el.value));
    document.querySelectorAll(".t-price").forEach((el) => (h.tiers[el.dataset.i].price = el.value));
    document.querySelectorAll(".t-qty").forEach((el) => (h.tiers[el.dataset.i].qty = el.value));
  };
  document.querySelectorAll(".t-name, .t-price, .t-qty").forEach((el) =>
    el.addEventListener("input", sync));
  document.querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", () => {
      sync(); h.tiers.splice(Number(b.dataset.remove), 1); renderHost(h);
    }));
  $("#addTier").addEventListener("click", () => {
    sync(); h.tiers.push({ name: "", price: "", qty: "" }); renderHost(h);
  });
  $("#hPublish").addEventListener("click", async () => {
    sync();
    const valid = h.tiers.filter((t) => t.name.trim() && Number(t.qty) > 0);
    if (!valid.length) return toast("Add at least one ticket type with a name and quantity");
    const publishBtn = $("#hPublish");
    publishBtn.disabled = true; publishBtn.textContent = "Publishing…";

    const { data: event, error: eventErr } = await sbInsertEvent({
      organizer_id: state.user.id,
      organizer_name: h.org.name, organizer_email: h.org.email, organizer_phone: h.org.phone,
      title: h.ev.title, starts_at: new Date(h.ev.date + "T" + h.ev.time).toISOString(),
      venue: h.ev.venue, tag: h.ev.tag, description: h.ev.desc,
      image_url: h.photo || img("photo-1492684223066-81342ee5ff30"),
    });
    if (eventErr) { publishBtn.disabled = false; publishBtn.textContent = "Publish event"; return toast("Couldn't publish event: " + eventErr.message); }

    const { error: tiersErr } = await sbInsertTicketTiers(valid.map((t) => ({
      event_id: event.id, name: t.name.trim(),
      price: Math.max(0, Number(t.price) || 0),
      description: h.ev.desc || "Hosted by " + h.org.name,
      quantity_total: Number(t.qty),
    })));
    if (tiersErr) { publishBtn.disabled = false; publishBtn.textContent = "Publish event"; return toast("Event created, but couldn't save ticket types: " + tiersErr.message); }

    closeModal();
    toast("Event published! Students can now get tickets 🎉");
    await hydrateEvents();
  });
}

/* --- record sale --- */
function showSale() {
  const opts = state.products.map((p) =>
    `<option value="${p.id}">${esc(p.name)} — ${naira(p.price)} (${p.stock} left)</option>`).join("");
  openModal(`
    ${modalHead("Record a sale")}
    <select id="salePid" class="input">${opts}</select>
    <input id="saleQty" class="input" type="number" min="1" value="1" placeholder="Quantity" />
    <button class="btn btn-primary btn-block" id="saleGo">Save sale</button>
  `);
  $("#saleGo").addEventListener("click", async () => {
    const p = state.products.find((x) => x.id === $("#salePid").value);
    const qty = Number($("#saleQty").value);
    if (!p || qty < 1 || p.stock < qty) return toast("Not enough stock for that");
    const saleGo = $("#saleGo");
    saleGo.disabled = true; saleGo.textContent = "Saving…";
    const newStock = p.stock - qty;
    const { error: stockErr } = await sbUpdateProduct(p.id, { stock: newStock });
    if (stockErr) { saleGo.disabled = false; saleGo.textContent = "Save sale"; return toast("Couldn't update stock: " + stockErr.message); }
    const total = p.price * qty, profit = (p.price - p.cost) * qty;
    const { data, error } = await sbInsertSale({
      shop_id: state.user.business.id, product_id: p.id, qty,
      unit_price: p.price, unit_cost: p.cost, total, profit,
    });
    if (error) { closeModal(); render(); return toast("Stock updated, but couldn't record the sale: " + error.message); }
    p.stock = newStock;
    state.sales.unshift({ id: data.id, name: p.name, qty, total, profit, time: fmtRowTime(data.created_at) });
    closeModal(); render(); toast("Sale recorded");
  });
}

/* --- add product --- */
function showProduct() {
  let photo = null;
  openModal(`
    ${modalHead("Add a product")}
    ${uploadHTML("Add a product photo")}
    <input id="pName" class="input" placeholder="Product name" />
    <input id="pPrice" class="input" type="number" placeholder="Selling price (₦)" />
    <input id="pCost" class="input" type="number" placeholder="Cost price (₦) — for profit tracking" />
    <input id="pStock" class="input" type="number" placeholder="Stock quantity" />
    <button class="btn btn-primary btn-block" id="pGo">Add to shop</button>
  `);
  bindUpload((data) => { photo = data; });
  $("#pGo").addEventListener("click", async () => {
    const name = $("#pName").value.trim();
    const price = Number($("#pPrice").value);
    if (!name || !price) return toast("Product needs a name and price");
    const pGo = $("#pGo");
    pGo.disabled = true; pGo.textContent = "Adding…";
    const { data, error } = await sbInsertProduct({
      shop_id: state.user.business.id, name, price,
      cost: Number($("#pCost").value) || 0,
      stock: Number($("#pStock").value) || 0,
      image_url: photo,
    });
    if (error) { pGo.disabled = false; pGo.textContent = "Add to shop"; return toast("Couldn't add product: " + error.message); }
    state.products.push(mapProductRow(data));
    closeModal(); render(); toast("Product added to your shop");
  });
}

/* --- lost & found report --- */
function showLF() {
  let type = "lost";
  openModal(`
    ${modalHead("Report lost or found")}
    <div class="seg">
      <button class="seg-btn active" data-type="lost">I lost something</button>
      <button class="seg-btn" data-type="found">I found something</button>
    </div>
    <input id="lfItem" class="input" placeholder="What is the item?" />
    <input id="lfWhere" class="input" placeholder="Where? (e.g. near the library)" />
    <button class="btn btn-primary btn-block" id="lfGo">Post it</button>
  `);
  document.querySelectorAll(".seg-btn").forEach((b) =>
    b.addEventListener("click", () => {
      type = b.dataset.type;
      document.querySelectorAll(".seg-btn").forEach((x) =>
        x.classList.toggle("active", x === b));
    }));
  $("#lfGo").addEventListener("click", async () => {
    const item = $("#lfItem").value.trim();
    if (!item) return toast("What's the item?");
    const btn = $("#lfGo");
    btn.disabled = true; btn.textContent = "Posting…";
    const { error } = await sbInsertLostFound({
      reporter_id: state.user.id, type, item,
      location: $("#lfWhere").value.trim() || "Campus",
    });
    if (error) { btn.disabled = false; btn.textContent = "Post it"; return toast("Couldn't post: " + error.message); }
    await hydrateLostFound();
    closeModal(); render(); toast("Posted to Lost & Found");
  });
}

/* ==========================================================
   EVENTS / BINDING
   ========================================================== */

function bindScreenEvents() {
  // feed
  const postBtn = document.querySelector('[data-act="post"]');
  if (postBtn) postBtn.addEventListener("click", async () => {
    const inp = $("#postInput");
    const text = inp.value.trim();
    if (!text) return;
    const aud = $("#postAud") ? $("#postAud").value : "General";
    const audience_type = aud === "General" ? "general" : aud === state.user.level ? "level" : "department";
    const audience_value = audience_type === "general" ? null : aud;
    inp.value = "";
    const { error } = await sbInsertFeedPost({ author_id: state.user.id, audience_type, audience_value, text });
    if (error) return toast("Couldn't post: " + error.message);
    await hydrateFeed();
    render(); toast("Posted to " + aud);
  });

  // feed channel chips
  document.querySelectorAll("[data-feed]").forEach((b) =>
    b.addEventListener("click", () => { state.feedFilter = b.dataset.feed; render(); }));

  document.querySelectorAll('[data-act="lf-contact"]').forEach((b) =>
    b.addEventListener("click", () => openChat(b.dataset.reporterId, b.dataset.reporterName)));
  const lfBtn = document.querySelector('[data-act="open-lf"]');
  if (lfBtn) lfBtn.addEventListener("click", showLF);

  // messages inbox
  document.querySelectorAll("[data-open-conv]").forEach((b) =>
    b.addEventListener("click", () => openChat(b.dataset.openConv, b.dataset.openConvName)));

  // market
  const search = $("#searchInput");
  if (search) {
    search.addEventListener("input", () => {
      state.query = search.value;
      // re-render only the grid area to keep typing smooth
      render();
      const s = $("#searchInput");
      s.focus();
      s.setSelectionRange(s.value.length, s.value.length);
    });
  }
  document.querySelectorAll("[data-cat]").forEach((b) =>
    b.addEventListener("click", () => { state.cat = b.dataset.cat; render(); }));
  document.querySelectorAll("[data-item]").forEach((b) =>
    b.addEventListener("click", () => showItem(b.dataset.item)));
  const sellBtn = document.querySelector('[data-act="open-sell"]');
  if (sellBtn) sellBtn.addEventListener("click", showSell);

  // events
  document.querySelectorAll("[data-events-tab]").forEach((b) =>
    b.addEventListener("click", () => { state.eventsTab = b.dataset.eventsTab; render(); }));
  document.querySelectorAll("[data-buy]").forEach((b) =>
    b.addEventListener("click", () => openCheckout(b.dataset.buy)));
  const hostBtn = document.querySelector('[data-act="open-host"]');
  if (hostBtn) hostBtn.addEventListener("click", openHost);
  const scanBtn = document.querySelector('[data-act="open-scan"]');
  if (scanBtn) scanBtn.addEventListener("click", showScanTicket);

  // my events — tier management
  document.querySelectorAll("[data-edit-tier]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = findMyTier(b.dataset.editTier);
      if (t) showTierRenameForm(t.id, t.name, t.desc);
    }));
  document.querySelectorAll("[data-restock-tier]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = findMyTier(b.dataset.restockTier);
      if (t) showRestockForm(t.id, t.quantityTotal);
    }));
  document.querySelectorAll("[data-add-tier]").forEach((b) =>
    b.addEventListener("click", () => showAddTierForm(b.dataset.addTier)));
  document.querySelectorAll("[data-cancel-event]").forEach((b) =>
    b.addEventListener("click", () => {
      const ev = state.myEvents.find((e) => e.id === b.dataset.cancelEvent);
      if (ev) showCancelEventConfirm(ev);
    }));
  document.querySelectorAll("[data-reschedule-event]").forEach((b) =>
    b.addEventListener("click", () => {
      const ev = state.myEvents.find((e) => e.id === b.dataset.rescheduleEvent);
      if (ev) showRescheduleForm(ev);
    }));
  document.querySelectorAll("[data-request-reschedule-refund]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = state.tickets.find((x) => x.id === b.dataset.requestRescheduleRefund);
      if (t) showRequestRescheduleRefundConfirm(t);
    }));

  // shop
  const shopPayoutBtn = document.querySelector("#shopSetPayout");
  if (shopPayoutBtn) shopPayoutBtn.addEventListener("click", showPayoutForm);
  const reqVerifyBtn = document.querySelector("#requestVerificationBtn");
  if (reqVerifyBtn) reqVerifyBtn.addEventListener("click", async () => {
    reqVerifyBtn.disabled = true; reqVerifyBtn.textContent = "Requesting…";
    const { error } = await sbRequestBusinessVerification(state.user.business.id);
    if (error) { reqVerifyBtn.disabled = false; reqVerifyBtn.textContent = "Request Verification"; return toast("Couldn't request: " + error.message); }
    const { data: biz } = await sbGetBusiness(state.user.id);
    if (biz) {
      state.user.business.verificationRequestedAt = biz.verification_requested_at;
      state.user.business.rejectedAt = biz.rejected_at;
    }
    render();
    toast("Verification requested — an admin will review your shop soon");
  });
  const saleBtn = document.querySelector('[data-act="open-sale"]');
  if (saleBtn) saleBtn.addEventListener("click", showSale);
  const prodBtn = document.querySelector('[data-act="open-product"]');
  if (prodBtn) prodBtn.addEventListener("click", showProduct);
  document.querySelectorAll("[data-list-product]").forEach((b) =>
    b.addEventListener("click", () => showListProduct(b.dataset.listProduct)));
  document.querySelectorAll("[data-unlist-product]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.unlistProduct;
      const p = state.products.find((x) => x.id === id);
      if (!p) return;
      const { error } = await sbDeleteListingsByProduct(id);
      if (error) return toast("Couldn't remove listing: " + error.message);
      await sbUpdateProduct(id, { listed: false });
      state.listings = state.listings.filter((l) => l.productId !== id);
      p.listed = false;
      render(); toast("Removed from marketplace");
    }));

  // orders: complete → for old free "Place order" reservations (still
  // unpaid), this records the sale and updates stock, same as always.
  // For paid "Buy now" orders, confirm-marketplace-payment already did
  // both of those at payment time — completing here is just a
  // fulfillment acknowledgment (status flag only).
  document.querySelectorAll("[data-complete]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.complete;
      const o = state.myShop.orders.find((x) => x.id === id);

      if (o.paymentStatus === "paid") {
        const { error: orderErr } = await sbCompleteOrder(o.id);
        if (orderErr) return toast("Couldn't complete order: " + orderErr.message);
        o.status = "completed";
        render(); toast("Order marked complete ✅");
        return;
      }

      const p = state.products.find((x) => x.id === o.pid);
      if (!p || p.stock < o.qty) return toast("Not enough stock to complete this order");
      const newStock = p.stock - o.qty;
      const { error: stockErr } = await sbUpdateProduct(p.id, { stock: newStock });
      if (stockErr) return toast("Couldn't update stock: " + stockErr.message);
      const { error: orderErr } = await sbCompleteOrder(o.id);
      if (orderErr) return toast("Couldn't complete order: " + orderErr.message);
      const total = p.price * o.qty, profit = (p.price - p.cost) * o.qty;
      const { data, error: saleErr } = await sbInsertSale({
        shop_id: state.user.business.id, product_id: p.id, qty: o.qty,
        unit_price: p.price, unit_cost: p.cost, total, profit,
      });
      p.stock = newStock;
      o.status = "completed";
      if (!saleErr) state.sales.unshift({ id: data.id, name: p.name, qty: o.qty, total, profit, time: fmtRowTime(data.created_at) });
      render(); toast("Order completed — sale recorded ✅");
    }));
  document.querySelectorAll("[data-chat-buyer]").forEach((b) =>
    b.addEventListener("click", () => openChat(b.dataset.chatBuyer, b.dataset.chatBuyerName)));

  // For You tiles
  document.querySelectorAll("[data-goto]").forEach((b) =>
    b.addEventListener("click", () => {
      const go = b.dataset.goto;
      if (go === "events") state.tab = "events";
      else if (go === "market") { state.tab = "market"; state.cat = "All"; }
      else if (go === "market-hostel") { state.tab = "market"; state.cat = "Hostel Items"; }
      else if (go === "study-materials") { state.tab = "study"; state.studyTab = "materials"; }
      render(); window.scrollTo(0, 0);
    }));

  // study hub
  bindStudyEvents();

  // admin
  bindAdminEvents();
}

/* tab navigation (sidebar + bottom nav share data-tab) */
document.querySelectorAll("[data-tab]").forEach((b) =>
  b.addEventListener("click", () => { state.tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));

/* avatar = open settings (log out lives inside settings) */
document.querySelectorAll(".avatar").forEach((a) =>
  a.addEventListener("click", () => { if (state.user) showSettings(); }));

/* settings gear (mobile header + sidebar) */
document.querySelectorAll('[data-act="open-settings"]').forEach((b) =>
  b.addEventListener("click", () => { if (state.user) showSettings(); }));

/* restore saved theme */
try { if (localStorage.getItem("ch-theme") === "dark") document.body.classList.add("dark"); } catch (e) { /* private mode */ }

/* restore saved GPA/CGPA scratch data, if any (falls back to the demo defaults above) */
try {
  const savedGpa = JSON.parse(localStorage.getItem("ch-gpa") || "null");
  if (savedGpa && Array.isArray(savedGpa.gpaRows) && Array.isArray(savedGpa.semesters)) {
    state.gpaRows = savedGpa.gpaRows;
    state.semesters = savedGpa.semesters;
  }
} catch (e) { /* private mode or corrupt data — keep the demo defaults */ }

/* first paint: restore an existing Supabase session before showing the auth flow */
(async function boot() {
  const session = await sbGetSession();
  if (session) {
    const { data: profileRow } = await sbGetProfile(session.user.id);
    if (profileRow) {
      let businessRow = null;
      if (profileRow.role === "vendor") {
        const { data: biz } = await sbGetBusiness(session.user.id);
        businessRow = biz;
      }
      hydrateUser(profileRow, businessRow, "session");
      render();
      await hydrateFeed();
      await hydrateLostFound();
      await hydrateClassInfo();
      await hydrateMaterials();
      await hydrateAdmin();
      await hydrateMarketplace();
      await hydrateEvents();
      await hydratePayoutAccount();
      await hydrateFees();
      await hydrateVerificationRequirements();
      await hydrateConversations();
      startMyMessagesWatch();
      // covers the "clicked the confirmation link, landed back here with
      // a fresh session" case — completeAuth()'s login branch covers the
      // "closed that tab and logged in manually later" case
      await completeDeferredPayoutIfAny();
      return;
    }
  }
  render();
})();
