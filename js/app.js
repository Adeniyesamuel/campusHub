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
  new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
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
  feedFilter: "All",
  tab: "home",
  cat: "All",
  query: "",
  listings: [
    { id: 1, title: "HP EliteBook 840 G5", price: 185000, cat: "Electronics", seller: "Adaeze O.", loc: "Moremi Hall", desc: "8GB RAM, 256GB SSD. Very clean, light use. Charger included.", img: img("photo-1496181133206-80ce9b88a853") },
    { id: 2, title: "GST 102 Textbook (New Edition)", price: 2500, cat: "Books", seller: "Tunde B.", loc: "Faculty of Arts", desc: "Barely used, no markings inside.", img: img("photo-1544716278-ca5e3f4abd8c") },
    { id: 3, title: "Mini Fridge", price: 45000, cat: "Hostel Items", seller: "Kemi A.", loc: "Makama Hall", desc: "Perfect for hostel room. Works perfectly, selling because I'm graduating.", img: img("photo-1571175443880-49e1d25b2bc5") },
    { id: 4, title: "Oud Perfume Oil (12ml)", price: 3500, cat: "Fashion & Beauty", seller: "Lagos Scents", shopId: 1, loc: "New Hall Gate", desc: "Long-lasting oil perfume. Wholesale price available for 6+.", img: img("photo-1541643600914-78b084683601") },
    { id: 5, title: "Scientific Calculator fx-991", price: 7000, cat: "Electronics", seller: "Emeka N.", loc: "Engineering Block", desc: "Original Casio. Slight scratch on cover, screen perfect.", img: img("photo-1587145820266-a5951ee6f620") },
    { id: 6, title: "Ankara Two-Piece (M)", price: 9500, cat: "Fashion & Beauty", seller: "Bisi Stitches", shopId: 2, loc: "Amina Hall", desc: "Tailored, never worn. Can sew to your size in 3 days.", img: img("photo-1445205170230-053b83016050") },
    { id: 7, title: "Portrait Photoshoot Session (1hr)", price: 15000, cat: "Services", seller: "SnapByEmeka", shopId: 3, loc: "Lagoon Front / Your Hall", desc: "Professional portraits — graduation, birthday shoots, or your matric photos. 20 edited pictures included.", img: img("photo-1554048612-b6a482bc67e5") },
  ],
  cats: ["All", "Electronics", "Books", "Hostel Items", "Fashion & Beauty", "Food", "Services"],
  events: [
    {
      id: 1, title: "Faculty of Science Dinner Night", date: "Sat, 18 Jul", time: "6:00 PM",
      venue: "Multipurpose Hall", tag: "Dinner", img: img("photo-1414235077428-338989a2e8c0"),
      organizer: "Faculty of Science SA",
      tiers: [
        { id: 1, name: "Early Bird", price: 2000, desc: "Discounted early access — limited quantity.", left: 0 },
        { id: 2, name: "Regular", price: 3000, desc: "Full dinner access: three-course meal, live band and awards night.", left: 42 },
        { id: 3, name: "VIP Table", price: 10000, desc: "Front table seating for you and a guest, priority serving and a photo session.", left: 8 },
      ],
    },
    {
      id: 2, title: "Tech Club: Intro to AI Workshop", date: "Wed, 22 Jul", time: "10:00 AM",
      venue: "CITS Auditorium", tag: "Workshop", img: img("photo-1517245386807-bb43f82c33c4"),
      organizer: "UNILAG Tech Club",
      tiers: [
        { id: 1, name: "General Admission", price: 0, desc: "Free entry. Bring your laptop — hands-on session with real AI tools.", left: 120 },
      ],
    },
    {
      id: 3, title: "Freshers' Welcome Jam", date: "Fri, 31 Jul", time: "7:00 PM",
      venue: "Sports Centre Field", tag: "Party", img: img("photo-1501281668745-f7f57925c3b4"),
      organizer: "Student Union",
      tiers: [
        { id: 1, name: "Regular", price: 1500, desc: "General entry to the biggest welcome party of the year.", left: 260 },
        { id: 2, name: "VIP", price: 5000, desc: "VIP section access, free drink and fast-track entry.", left: 30 },
      ],
    },
  ],
  tickets: [],
  feed: [
    { id: 1, who: "Student Affairs", tag: "Official", aud: "General", time: "9:12 AM", text: "GST exam timetable has been revised. New timetable is now on departmental notice boards. Check before Friday." },
    { id: 2, who: "CSC Class Rep", tag: "Class", aud: "Computer Science", time: "8:40 AM", text: "CSC 201 lecture moved from LT2 to CITS Hall for today only. 12pm sharp." },
    { id: 3, who: "100L Coordinator", tag: "Class", aud: "100 Level", time: "8:05 AM", text: "All 100 level students: course registration closes this Friday. See your level adviser if you have issues." },
    { id: 4, who: "Health Centre", tag: "Official", aud: "General", time: "Yesterday", text: "Free malaria testing continues at the medical centre this week, 9am–3pm daily." },
  ],
  lost: [
    { id: 1, type: "lost", item: "Blue ID card wallet", where: "Around the library steps", who: "Femi O.", time: "Today, 10:05 AM" },
    { id: 2, type: "found", item: "Silver wristwatch", where: "LT1, back row", who: "Zainab A.", time: "Yesterday" },
  ],
  products: [
    { id: 1, name: "Oud Perfume Oil 12ml", price: 3500, cost: 2000, stock: 14, img: img("photo-1541643600914-78b084683601") },
    { id: 2, name: "Arabian Musk 6ml", price: 2000, cost: 1100, stock: 23, img: img("photo-1592945403244-b3fbafd7f539") },
    { id: 3, name: "Gift Box (3 oils)", price: 9000, cost: 5500, stock: 5, img: img("photo-1549465220-1a8b9238cd48") },
  ],
  sales: [
    { id: 1, name: "Oud Perfume Oil 12ml", qty: 2, total: 7000, profit: 3000, time: "8:15 AM" },
  ],
  chats: {},          // { "Seller Name": [ {from:"me"|"them", text, time} ] }
  chatWith: null,     // name of the person the chat panel is open with

  /* ---- Storefronts (buyer-facing shops) ---- */
  shops: [
    {
      id: 1, name: "Lagos Scents", owner: "Sadiq A.", cat: "Fashion & Beauty",
      desc: "Long-lasting oil perfumes at student-friendly prices. Wholesale for resellers.",
      verified: true, studentVendor: true, uni: "UNILAG", dept: "Marketing", level: "300 Level",
      ratingSum: 46, ratingCount: 10, sales: 87, followers: 132, youFollow: false,
      reviews: [
        { who: "Kemi A.", stars: 5, text: "The oud lasted from morning lectures till night class. Certified plug 🔥", time: "2 days ago" },
        { who: "Tunde B.", stars: 4, text: "Quick delivery to my hall. Would buy again.", time: "1 week ago" },
      ],
    },
    {
      id: 2, name: "Bisi Stitches", owner: "Bisi O.", cat: "Fashion & Beauty",
      desc: "Custom tailoring and ready-to-wear. Ankara sets, corporate wear, matric outfits.",
      verified: true, studentVendor: true, uni: "UNILAG", dept: "Business Administration", level: "400 Level",
      ratingSum: 38, ratingCount: 8, sales: 54, followers: 96, youFollow: false,
      reviews: [
        { who: "Adaeze O.", stars: 5, text: "She sewed my two-piece in 3 days and it fit PERFECTLY.", time: "3 days ago" },
      ],
    },
    {
      id: 3, name: "SnapByEmeka", owner: "Emeka N.", cat: "Tutoring & Services",
      desc: "Campus photographer — portraits, events, graduation shoots. Same-week edited delivery.",
      verified: true, studentVendor: true, uni: "UNILAG", dept: "Mass Communication", level: "200 Level",
      ratingSum: 29, ratingCount: 6, sales: 41, followers: 210, youFollow: false,
      reviews: [
        { who: "Femi O.", stars: 5, text: "My birthday shoot came out clean. He knows his angles.", time: "5 days ago" },
      ],
    },
  ],

  /* ---- The logged-in vendor's own shop ---- */
  myShop: {
    followers: 23,
    reviews: [
      { who: "Zainab A.", stars: 5, text: "Original product, fast response. Trusted seller!", time: "Yesterday" },
      { who: "Musa L.", stars: 4, text: "Good price. Delivery took a bit but worth it.", time: "4 days ago" },
    ],
    orders: [
      { id: 1, buyer: "Kemi A.", pid: 1, qty: 2, status: "new", time: "10:12 AM" },
      { id: 2, buyer: "Tunde B.", pid: 3, qty: 1, status: "new", time: "9:47 AM" },
      { id: 3, buyer: "Adaeze O.", pid: 2, qty: 3, status: "completed", time: "Yesterday" },
    ],
    completedSales: 12,
  },

  /* ---- Study hub ---- */
  studyTab: "class",  // class | materials | cgpa
  classroom: {
    announcements: [
      { id: 1, who: "Course Rep", text: "CSC 201 test has been confirmed for next week Thursday. Chapters 1–4. No excuses o!", time: "Today, 7:50 AM" },
      { id: 2, who: "Course Rep", text: "Dr. Adeyemi says submit all outstanding practical reports before Friday.", time: "Yesterday" },
    ],
    timetable: [
      { day: "Mon", course: "CSC 201", time: "10:00 – 12:00", venue: "LT2" },
      { day: "Mon", course: "MTH 201", time: "1:00 – 3:00", venue: "Maths Lab" },
      { day: "Tue", course: "GST 201", time: "9:00 – 11:00", venue: "Main Aud." },
      { day: "Wed", course: "CSC 203", time: "8:00 – 10:00", venue: "CITS Hall" },
      { day: "Thu", course: "CSC 205", time: "12:00 – 2:00", venue: "LT1" },
      { day: "Fri", course: "STA 201", time: "10:00 – 12:00", venue: "Stats Room" },
    ],
    exams: [
      { id: 1, course: "CSC 201", type: "Test", date: "Thu, 16 Jul", time: "10:00 AM", venue: "LT2" },
      { id: 2, course: "MTH 201", type: "Test", date: "Mon, 20 Jul", time: "1:00 PM", venue: "Maths Lab" },
      { id: 3, course: "GST 201", type: "Exam", date: "Wed, 5 Aug", time: "9:00 AM", venue: "Main Aud." },
    ],
    assignments: [
      { id: 1, course: "CSC 203", title: "Flowchart & pseudocode exercise (Q1–Q5)", due: "Fri, 17 Jul", submitted: false, file: null },
      { id: 2, course: "STA 201", title: "Probability worksheet 2", due: "Mon, 20 Jul", submitted: true, file: "sta201_worksheet2.pdf" },
    ],
    polls: [
      { id: 1, q: "Should we move tomorrow's CSC 201 class from 10am to 2pm?", options: [ { label: "Yes, move it", votes: 34 }, { label: "No, keep 10am", votes: 21 } ], voted: null },
    ],
    attendance: [
      { course: "CSC 201", present: 10, total: 12 },
      { course: "MTH 201", present: 8, total: 12 },
      { course: "CSC 203", present: 12, total: 12 },
      { course: "GST 201", present: 7, total: 10 },
    ],
  },
  materials: [
    { id: 1, title: "CSC 201 Past Questions (2019–2024, with answers)", course: "CSC 201", type: "Past Questions", by: "Adaeze O.", sum: 47, count: 10, mine: 0 },
    { id: 2, title: "Data Structures summary — handwritten notes", course: "CSC 201", type: "Handwritten Notes", by: "Tunde B.", sum: 38, count: 9, mine: 0 },
    { id: 3, title: "MTH 201 lecture slides (complete)", course: "MTH 201", type: "Slides", by: "Course Rep", sum: 27, count: 7, mine: 0 },
    { id: 4, title: "GST 201 recorded tutorial — exam focus areas", course: "GST 201", type: "Recorded Tutorial", by: "Emeka N.", sum: 18, count: 6, mine: 0 },
    { id: 5, title: "STA 201 formula sheet PDF", course: "STA 201", type: "PDF", by: "Kemi A.", sum: 12, count: 5, mine: 0 },
  ],
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
    if (!state.authRole) screen = roleScreen();
    else if (state.authStage === "vtype") screen = vtypeScreen();
    else if (state.authStage === "vverify") screen = vverifyScreen();
    else if (state.authStage === "profile") screen = profileScreen();
    else screen = authScreen();
    $("#content").innerHTML = screen;
    bindAuthEvents();
    return;
  }
  document.body.classList.remove("unauthed");

  // students don't see the vendor tab; non-students don't see Study
  document.querySelectorAll('[data-tab="shop"]').forEach((b) =>
    b.classList.toggle("hidden", state.user.role !== "vendor"));
  document.querySelectorAll('[data-tab="study"]').forEach((b) =>
    b.classList.toggle("hidden", !state.user.level));
  if (state.user.role !== "vendor" && state.tab === "shop") state.tab = "home";
  if (!state.user.level && state.tab === "study") state.tab = "home";

  // nav highlighting (both navs)
  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === state.tab));

  const screens = { home: homeScreen, market: marketScreen, events: eventsScreen, shop: shopScreen, study: studyScreen };
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
            ? `<p class="auth-terms">By continuing, you agree to our <b>Terms of Service</b>, <b>Privacy Policy</b> and <b>Cookie Use</b>.</p>`
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

          <p class="auth-terms">By continuing, you agree to our <b>Terms of Service</b>, <b>Privacy Policy</b> and <b>Cookie Use</b>.</p>

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
        <p class="auth-sub">Log in to your ${roleLabel} account.</p>

        <input id="authId" class="auth-input" placeholder="Email or phone number" autocomplete="username" />
        <button class="continue-btn" id="authContinue" disabled>Continue</button>

        <p class="auth-switch">
          Don't have an account?
          <button data-act="auth-toggle">Sign up</button>
        </p>
      </div>
    </div>`;
}

function completeAuth(via) {
  // demo login has no database, so give logins a sample profile if none picked
  const lvl = state.profile.level || "100 Level";
  const dpt = state.profile.dept || "Computer Science";
  const academic = state.authRole === "student" || state.vendorType === "student";
  state.user = {
    role: state.authRole,
    via,
    vendorType: state.authRole === "vendor" ? (state.vendorType || "external") : null,
    name: state.profile.name || (state.authRole === "vendor" && state.vendorType === "external" ? state.business.name : "") || "Demo User",
    matric: academic ? (state.profile.matric || "210000000") : null,
    level: academic ? lvl : null,
    dept: academic ? dpt : null,
    business: state.authRole === "vendor" ? { ...state.business } : null,
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
  render();
  const who = state.user.role === "vendor"
    ? (state.user.vendorType === "student" ? "a student vendor" : "a campus vendor")
    : "a student";
  toast((state.authMode === "signup" ? "Account created" : "Logged in") + " as " + who + " (demo)");
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
      // student vendors continue to student identity; campus vendors go to signup
      state.authStage = state.vendorType === "student" ? "profile" : "auth";
      render();
    });
  }
  const vvBack = document.querySelector('[data-act="vv-back"]');
  if (vvBack) vvBack.addEventListener("click", () => { state.authStage = "vtype"; render(); });

  // back to role picker (from vendor type or auth screens)
  const back = document.querySelector('[data-act="auth-back"]');
  if (back) back.addEventListener("click", () => {
    state.authRole = null; state.authStage = null; state.vendorType = null;
    state.authStep = "start"; state.authId = "";
    render();
  });

  // back from profile → verification (student vendors) or role picker (students)
  const pfBack = document.querySelector('[data-act="profile-back"]');
  if (pfBack) pfBack.addEventListener("click", () => {
    if (state.authRole === "vendor") { state.authStage = "vverify"; }
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

  // social / phone buttons (demo — real build connects Google, Apple & SMS OTP)
  document.querySelectorAll("[data-auth]").forEach((b) =>
    b.addEventListener("click", () => completeAuth(b.dataset.auth)));

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
  const topMat = [...state.materials].sort((a, b) => (b.sum / b.count) - (a.sum / a.count))[0];
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
      <button class="lf-contact" data-act="lf-contact" data-who="${esc(l.who)}">Contact</button>
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
const eventFee = (price) => (price > 0 ? Math.round(price * 0.09) : 0); // 9% platform fee

function eventsScreen() {
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
            <div class="event-meta">${esc(ev.date)} · ${esc(ev.time)}</div>
            <div class="event-meta">📍 ${esc(ev.venue)}</div>
            <div class="event-meta">By ${esc(ev.organizer)}</div>
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
          <div class="ticket-label">CampusHub Ticket</div>
          <div class="ticket-event">${esc(t.event)}</div>
          <div class="ticket-meta">${t.qty} × ${esc(t.tier)} · ${t.total === 0 ? "Free" : naira(t.total)}</div>
          <div class="ticket-code">${esc(t.code)}</div>
        </div>`).join("")}
       </div>`
    : "";

  return `
    <div class="section-head">
      <div>
        <div class="eyebrow">Events &amp; tickets</div>
        <h1 class="h1">Don't miss out</h1>
      </div>
      <button class="btn btn-accent btn-sm" data-act="open-host">＋ Host event</button>
    </div>
    <div class="events-grid">${cards}</div>
    ${myTickets}`;
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
          <div class="row-title">${o.qty} × ${esc(p.name)}</div>
          <div class="row-sub">from ${esc(o.buyer)} · ${esc(o.time)} · ${naira(p.price * o.qty)}</div>
        </div>
        ${o.status === "new"
          ? `<div style="display:flex;gap:6px">
               <button class="btn btn-ghost btn-sm" data-chat-buyer="${esc(o.buyer)}">💬</button>
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

  return `
    <div class="section-head">
      <div>
        <div class="eyebrow">My shop · ${esc(state.user.business && state.user.business.name ? state.user.business.name : "Your Business")} <span class="verified-badge">🛡️ Verified</span></div>
        <h1 class="h1">Vendor dashboard</h1>
      </div>
    </div>

    <div class="trust-strip">
      <div class="trust-stat"><b>👥 ${ms.followers}</b><span>followers</span></div>
      <div class="trust-stat"><b>⭐ ${avg.toFixed(1)}</b><span>${ms.reviews.length} reviews</span></div>
      <div class="trust-stat"><b>✅ ${ms.completedSales}</b><span>completed sales</span></div>
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

  const anns = cr.announcements.map((a) => `
    <div class="card">
      <div class="post-head">
        <div class="post-avatar">📣</div>
        <div><div class="post-who">${esc(a.who)}</div><div class="post-time">${esc(a.time)}</div></div>
      </div>
      <p class="post-body">${esc(a.text)}</p>
    </div>`).join("");

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const tt = days.map((d) => {
    const rows = cr.timetable.filter((t) => t.day === d);
    if (!rows.length) return "";
    return `<div class="tt-day">${d}</div>` + rows.map((t) => `
      <div class="tt-row">
        <b>${esc(t.course)}</b><span>${esc(t.time)}</span><span>📍 ${esc(t.venue)}</span>
      </div>`).join("");
  }).join("");

  const exams = cr.exams.map((e) => `
    <div class="card row-item">
      <div class="row-ico">${e.type === "Exam" ? "📝" : "🧪"}</div>
      <div class="row-main">
        <div class="row-title">${esc(e.course)} — ${esc(e.type)}</div>
        <div class="row-sub">${esc(e.date)} · ${esc(e.time)} · ${esc(e.venue)}</div>
      </div>
    </div>`).join("");

  const assigns = cr.assignments.map((a) => `
    <div class="card row-item">
      <div class="row-ico">${a.submitted ? "✅" : "📄"}</div>
      <div class="row-main">
        <div class="row-title">${esc(a.course)}: ${esc(a.title)}</div>
        <div class="row-sub">Due ${esc(a.due)}${a.submitted ? " · submitted: " + esc(a.file) : ""}</div>
      </div>
      ${a.submitted
        ? `<span class="stock-pill stock-ok">Submitted</span>`
        : `<button class="btn btn-accent btn-sm" data-submit="${a.id}">Submit</button>`}
    </div>`).join("");

  const polls = cr.polls.map((p) => {
    const total = p.options.reduce((s, o) => s + o.votes, 0) || 1;
    const opts = p.options.map((o, i) => {
      const pct = Math.round((o.votes / total) * 100);
      if (p.voted === null) {
        return `<button class="poll-opt" data-poll="${p.id}" data-opt="${i}">${esc(o.label)}</button>`;
      }
      return `
        <div class="poll-result ${p.voted === i ? "mine" : ""}">
          <div class="poll-bar" style="width:${pct}%"></div>
          <span>${esc(o.label)}${p.voted === i ? " ✓" : ""}</span><b>${pct}%</b>
        </div>`;
    }).join("");
    return `
      <div class="card">
        <div class="row-title">🗳️ ${esc(p.q)}</div>
        <div class="poll-opts">${opts}</div>
        <div class="row-sub" style="margin-top:8px">${total} vote${total !== 1 ? "s" : ""}${p.voted !== null ? " · you voted" : ""}</div>
      </div>`;
  }).join("");

  const att = cr.attendance.map((a) => {
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
  }).join("");

  return `
    <div class="two-col">
      <div>
        <div class="section-head"><div><div class="eyebrow">From your course rep</div><h3 class="h3">Class announcements</h3></div></div>
        ${anns}
        <div class="section-head"><div><div class="eyebrow">This week</div><h3 class="h3">Timetable</h3></div></div>
        <div class="card">${tt}</div>
        <div class="section-head"><div><div class="eyebrow">Coming up</div><h3 class="h3">Tests &amp; exam dates</h3></div></div>
        ${exams}
      </div>
      <div>
        <div class="section-head"><div><div class="eyebrow">Don't carry over 😅</div><h3 class="h3">Assignments</h3></div></div>
        ${assigns}
        <div class="section-head"><div><div class="eyebrow">Class decisions</div><h3 class="h3">Polls</h3></div></div>
        ${polls}
        <div class="section-head"><div><div class="eyebrow">Your attendance</div><h3 class="h3">Attendance</h3></div></div>
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
    .sort((a, b) => (b.sum / b.count) - (a.sum / a.count));

  const cards = list.length ? list.map((m) => {
    const avg = m.sum / m.count;
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
              <span class="mat-stars">${stars(avg)}</span>
              <b>${avg.toFixed(1)}</b><span class="row-sub">(${m.count} rating${m.count !== 1 ? "s" : ""})</span>
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

function bindStudyEvents() {
  document.querySelectorAll("[data-study]").forEach((b) =>
    b.addEventListener("click", () => { state.studyTab = b.dataset.study; render(); }));

  /* my class */
  document.querySelectorAll("[data-submit]").forEach((b) =>
    b.addEventListener("click", () => showAssignmentSubmit(Number(b.dataset.submit))));
  document.querySelectorAll("[data-poll]").forEach((b) =>
    b.addEventListener("click", () => {
      const poll = state.classroom.polls.find((p) => p.id === Number(b.dataset.poll));
      poll.options[Number(b.dataset.opt)].votes++;
      poll.voted = Number(b.dataset.opt);
      render(); toast("Vote recorded 🗳️");
    }));
  document.querySelectorAll("[data-mat-jump]").forEach((b) =>
    b.addEventListener("click", () => {
      state.studyTab = "materials"; state.matFilter = b.dataset.matJump; render();
    }));

  /* materials */
  document.querySelectorAll("[data-mat]").forEach((b) =>
    b.addEventListener("click", () => { state.matFilter = b.dataset.mat; render(); }));
  document.querySelectorAll("[data-rate]").forEach((b) =>
    b.addEventListener("click", () => {
      const m = state.materials.find((x) => x.id === Number(b.dataset.rate));
      const val = Number(b.dataset.val);
      if (m.mine > 0) { m.sum -= m.mine; m.count--; } // replace previous rating
      m.mine = val; m.sum += val; m.count++;
      render(); toast("Thanks for rating ⭐");
    }));
  document.querySelectorAll("[data-download]").forEach((b) =>
    b.addEventListener("click", () => toast("Download starts in the real build 📥")));
  const upBtn = document.querySelector('[data-act="open-upload"]');
  if (upBtn) upBtn.addEventListener("click", showMaterialUpload);

  /* cgpa: recompute by re-render on change, keeping it simple */
  const rerender = () => render();
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

/* --- assignment submission modal --- */
function showAssignmentSubmit(id) {
  const a = state.classroom.assignments.find((x) => x.id === id);
  if (!a) return;
  let fileName = null;
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
  const box = $("#subBox"), file = $("#subFile"), go = $("#subGo");
  box.addEventListener("click", () => file.click());
  file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) return;
    fileName = f.name;
    box.querySelector(".up-text").textContent = "📄 " + f.name;
    box.querySelector(".up-hint").textContent = "Tap to change file";
    go.disabled = false;
  });
  go.addEventListener("click", () => {
    a.submitted = true; a.file = fileName;
    closeModal(); render(); toast("Assignment submitted ✅");
  });
}

/* --- upload study material modal --- */
function showMaterialUpload() {
  let fileName = null;
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
  const box = $("#matBox"), file = $("#matFile");
  box.addEventListener("click", () => file.click());
  file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) return;
    fileName = f.name;
    box.querySelector(".up-text").textContent = "📄 " + f.name;
    box.querySelector(".up-hint").textContent = "Tap to change file";
  });
  $("#matGo").addEventListener("click", () => {
    const title = $("#matTitle").value.trim();
    if (!title) return toast("Give your material a title");
    if (!fileName) return toast("Attach a file first");
    state.materials.unshift({
      id: Date.now(), title,
      course: $("#matCourse").value.trim() || "General",
      type: $("#matType").value,
      by: "You", sum: 5, count: 1, mine: 0,
    });
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

  $("#setPw").addEventListener("click", () => toast("Password change comes with the real accounts system"));
  let notif = true;
  $("#setNotif").addEventListener("click", () => {
    notif = !notif;
    $("#notifState").textContent = notif ? "On" : "Off";
  });
  $("#setLogout").addEventListener("click", () => {
    closeModal();
    state.user = null; state.authRole = null; state.authMode = "signup";
    state.authStage = null; state.vendorType = null;
    state.profile = { level: "", dept: "" }; state.feedFilter = "All";
    render();
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
   LIVE CHAT (demo — real build uses websockets / Firebase)
   ========================================================== */

const cannedReplies = [
  "Hello! 😊 Yes, it's still available.",
  "You can pick it up any time after 2pm today.",
  "Last price? Okay, I can do a small discount for you 😄",
  "No wahala, I'll hold it for you till tomorrow.",
  "Sure! Send me your hall and I'll deliver.",
];
let replyIndex = 0;
let typingTimer = null;

function openChat(name) {
  state.chatWith = name;
  if (!state.chats[name]) {
    state.chats[name] = [
      { from: "them", text: "Hi! Thanks for reaching out 👋 How can I help?", time: timeNow() },
    ];
  }
  closeModal();
  renderChat();
}

function closeChat() {
  state.chatWith = null;
  clearTimeout(typingTimer);
  $("#chatRoot").innerHTML = "";
}

function renderChat(showTyping = false) {
  const name = state.chatWith;
  if (!name) return;
  const msgs = state.chats[name] || [];

  const bubbles = msgs.map((m) => `
    <div class="bubble ${m.from}">
      ${esc(m.text)}
      <div class="bubble-time">${esc(m.time)}</div>
    </div>`).join("");

  $("#chatRoot").innerHTML = `
    <div class="chat-panel">
      <div class="chat-head">
        <div class="chat-avatar">${esc(name[0])}</div>
        <div>
          <div class="chat-name">${esc(name)}</div>
          <div class="chat-status">online</div>
        </div>
        <button class="chat-close" id="chatClose">✕</button>
      </div>
      <div class="chat-body" id="chatBody">
        ${bubbles}
        ${showTyping ? `<div class="chat-typing">${esc(name)} is typing…</div>` : ""}
      </div>
      <div class="chat-foot">
        <input id="chatInput" class="input" placeholder="Type a message…" autocomplete="off" />
        <button class="chat-send" id="chatSend">➤</button>
      </div>
    </div>`;

  const body = $("#chatBody");
  body.scrollTop = body.scrollHeight;

  $("#chatClose").addEventListener("click", closeChat);
  const inp = $("#chatInput");
  const send = () => {
    const text = inp.value.trim();
    if (!text) return;
    state.chats[name].push({ from: "me", text, time: timeNow() });
    inp.value = "";
    renderChat(true);
    $("#chatInput").focus();
    // simulated reply — the real build delivers actual seller messages
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      if (state.chatWith !== name) return;
      state.chats[name].push({
        from: "them",
        text: cannedReplies[replyIndex++ % cannedReplies.length],
        time: timeNow(),
      });
      renderChat();
      $("#chatInput").focus();
    }, 1400);
  };
  $("#chatSend").addEventListener("click", send);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  inp.focus();
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

/* --- listing detail --- */
function showItem(id) {
  const l = state.listings.find((x) => x.id === id);
  if (!l) return;
  const shop = l.shopId ? state.shops.find((s) => s.id === l.shopId) : null;

  const trustCard = shop ? `
    <div class="trust-card">
      <div class="trust-top">
        <div class="post-avatar">${esc(shop.name[0])}</div>
        <div style="flex:1">
          <div class="trust-name">${esc(shop.name)} <span class="verified-badge">✅ Verified Student</span></div>
          <div class="trust-meta">${esc(shop.uni)} · ${esc(shop.dept)} · ${esc(shop.level)}</div>
        </div>
      </div>
      <div class="trust-stats">
        <span>⭐ ${(shop.ratingSum / shop.ratingCount).toFixed(1)} (${shop.ratingCount})</span>
        <span>✅ ${shop.sales} completed sales</span>
        <span>👥 ${shop.followers} followers</span>
      </div>
      <button class="btn btn-ghost btn-block" data-open-shop="${shop.id}" style="margin-top:10px">🏬 View shop</button>
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

  openModal(`
    ${modalHead("Listing")}
    ${imgBlock(l.img, "detail-img")}
    <span class="tag">${esc(l.cat)}</span>
    <div class="detail-title">${esc(l.title)}</div>
    <div class="detail-price">${naira(l.price)}</div>
    <p class="detail-desc">${esc(l.desc)}</p>
    <div class="detail-meta">📍 ${esc(l.loc)}</div>
    ${trustCard}
    <button class="btn btn-primary btn-block" id="msgSeller" style="margin-top:12px">💬 Message seller</button>
  `);
  $("#msgSeller").addEventListener("click", () => openChat(l.seller));
  const vs = document.querySelector("[data-open-shop]");
  if (vs) vs.addEventListener("click", () => openShop(Number(vs.dataset.openShop)));
}

/* --- buyer-facing storefront --- */
function openShop(shopId) {
  const s = state.shops.find((x) => x.id === shopId);
  if (!s) return;
  const products = state.listings.filter((l) => l.shopId === s.id);
  const avg = s.ratingSum / s.ratingCount;

  const prodGrid = products.map((p) => `
    <button class="listing" data-shop-item="${p.id}">
      ${imgBlock(p.img, "thumb")}
      <div class="listing-body">
        <div class="listing-title">${esc(p.title)}</div>
        <div class="price">${naira(p.price)}</div>
      </div>
    </button>`).join("");

  const reviews = s.reviews.map((r) => `
    <div class="card" style="margin-bottom:8px">
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

  openModal(`
    ${modalHead("Shop")}
    <div class="shop-hero">
      <div class="shop-hero-avatar">${esc(s.name[0])}</div>
      <div class="trust-name" style="font-size:20px">${esc(s.name)} <span class="verified-badge">✅ Verified Student</span></div>
      <div class="trust-meta">${esc(s.uni)} · ${esc(s.dept)} · ${esc(s.level)} · run by ${esc(s.owner)}</div>
      <p class="detail-desc" style="margin-top:6px">${esc(s.desc)}</p>
      <div class="shop-hero-stats">
        <div><b>⭐ ${avg.toFixed(1)}</b><span>${s.ratingCount} ratings</span></div>
        <div><b>${s.sales}</b><span>completed sales</span></div>
        <div><b id="folCount">${s.followers}</b><span>followers</span></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn ${s.youFollow ? "btn-ghost" : "btn-accent"}" style="flex:1" id="folBtn">${s.youFollow ? "Following ✓" : "＋ Follow"}</button>
        <button class="btn btn-primary" style="flex:1" id="shopMsg">💬 Message</button>
      </div>
    </div>
    <div class="set-group">Products (${products.length})</div>
    <div class="grid" style="grid-template-columns:repeat(2,1fr)">${prodGrid || `<div class="empty">No products listed yet</div>`}</div>
    <div class="set-group">Reviews (${s.reviews.length})</div>
    ${reviews || `<div class="empty">No reviews yet</div>`}
  `, true);

  $("#folBtn").addEventListener("click", () => {
    s.youFollow = !s.youFollow;
    s.followers += s.youFollow ? 1 : -1;
    $("#folCount").textContent = s.followers;
    $("#folBtn").textContent = s.youFollow ? "Following ✓" : "＋ Follow";
    $("#folBtn").className = "btn " + (s.youFollow ? "btn-ghost" : "btn-accent");
    toast(s.youFollow ? "Following " + s.name + " 🔔" : "Unfollowed " + s.name);
  });
  $("#shopMsg").addEventListener("click", () => openChat(s.name));
  document.querySelectorAll("[data-shop-item]").forEach((b) =>
    b.addEventListener("click", () => showItem(Number(b.dataset.shopItem))));
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
  $("#sellGo").addEventListener("click", () => {
    const title = $("#sellTitle").value.trim();
    const price = Number($("#sellPrice").value);
    if (!title || !price) return toast("Add a title and price first");
    state.listings.unshift({
      id: Date.now(), title, price,
      cat: $("#sellCat").value,
      loc: $("#sellLoc").value.trim() || "Campus",
      desc: $("#sellDesc").value.trim(),
      seller: "You",
      img: photo || img("photo-1553062407-98eeb64c6a62"),
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
  $("#lpGo").addEventListener("click", () => {
    const title = $("#lpTitle").value.trim();
    const price = Number($("#lpPrice").value);
    if (!title || !price) return toast("Add a title and price first");
    const listing = {
      id: Date.now(), title, price,
      cat: $("#lpCat").value,
      loc: $("#lpLoc").value.trim() || "Campus",
      desc: $("#lpDesc").value.trim(),
      seller: (state.user.business && state.user.business.name) || "You",
      productId: p.id,
      img: photo || img("photo-1553062407-98eeb64c6a62"),
    };
    state.listings.unshift(listing);
    p.listed = true;
    p.listingId = listing.id;
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
        co.qty[Number(sel.dataset.tier)] = Number(sel.value);
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
          ${free ? "" : `<div class="pay-method">💳 Pay securely with Paystack <span style="margin-left:auto;font-size:11px;color:var(--muted)">demo</span></div>`}
        </div>
        <p class="form-hint">Ticket${t.count > 1 ? "s" : ""} will be sent to <b>${esc(co.contact.email)}</b>${free ? "." : " after payment."}</p>
      </div>
      ${coSummary(co, free ? "Get free tickets" : "Pay " + naira(t.subtotal), "coPay", false)}
    </div>
  `, true);

  $("#coPay").addEventListener("click", () => {
    // issue tickets + reduce availability
    co.ev.tiers.forEach((tier) => {
      const q = co.qty[tier.id] || 0;
      if (q > 0) {
        tier.left -= q;
        const fee = eventFee(tier.price) * q;
        state.tickets.unshift({
          id: Date.now() + tier.id,
          event: co.ev.title,
          tier: tier.name,
          qty: q,
          total: tier.price * q + fee,
          code: "CH-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        });
      }
    });
    clearInterval(checkoutTimer);
    closeModal();
    render();
    toast(free ? "You're in! Tickets saved 🎉" : "Payment successful — tickets saved 🎉");
  });
}

/* ==========================================================
   HOST AN EVENT  (organizer info → event details → tickets)
   ========================================================== */

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
        <input id="eDate" class="input" placeholder="e.g. Sat, 15 Aug" value="${esc(h.ev.date)}" />
        <input id="eTime" class="input" placeholder="e.g. 7:00 PM" value="${esc(h.ev.time)}" />
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
      $("#hNext").disabled = !(h.ev.title && h.ev.date && h.ev.venue);
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
  $("#hPublish").addEventListener("click", () => {
    sync();
    const valid = h.tiers.filter((t) => t.name.trim() && Number(t.qty) > 0);
    if (!valid.length) return toast("Add at least one ticket type with a name and quantity");
    state.events.unshift({
      id: Date.now(),
      title: h.ev.title, date: h.ev.date, time: h.ev.time || "TBA",
      venue: h.ev.venue, tag: h.ev.tag,
      img: h.photo || img("photo-1492684223066-81342ee5ff30"),
      organizer: h.org.name,
      tiers: valid.map((t, i) => ({
        id: i + 1, name: t.name.trim(),
        price: Math.max(0, Number(t.price) || 0),
        desc: h.ev.desc || "Hosted by " + h.org.name,
        left: Number(t.qty),
      })),
    });
    closeModal(); render();
    toast("Event published! Students can now get tickets 🎉");
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
  $("#saleGo").addEventListener("click", () => {
    const p = state.products.find((x) => x.id === Number($("#salePid").value));
    const qty = Number($("#saleQty").value);
    if (!p || qty < 1 || p.stock < qty) return toast("Not enough stock for that");
    p.stock -= qty;
    state.sales.unshift({
      id: Date.now(), name: p.name, qty,
      total: p.price * qty, profit: (p.price - p.cost) * qty, time: timeNow(),
    });
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
  $("#pGo").addEventListener("click", () => {
    const name = $("#pName").value.trim();
    const price = Number($("#pPrice").value);
    if (!name || !price) return toast("Product needs a name and price");
    state.products.push({
      id: Date.now(), name, price,
      cost: Number($("#pCost").value) || 0,
      stock: Number($("#pStock").value) || 0,
      img: photo,
    });
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
  $("#lfGo").addEventListener("click", () => {
    const item = $("#lfItem").value.trim();
    if (!item) return toast("What's the item?");
    state.lost.unshift({
      id: Date.now(), type, item,
      where: $("#lfWhere").value.trim() || "Campus",
      who: "You", time: "Just now",
    });
    closeModal(); render(); toast("Posted to Lost & Found");
  });
}

/* ==========================================================
   EVENTS / BINDING
   ========================================================== */

function bindScreenEvents() {
  // feed
  const postBtn = document.querySelector('[data-act="post"]');
  if (postBtn) postBtn.addEventListener("click", () => {
    const inp = $("#postInput");
    const text = inp.value.trim();
    if (!text) return;
    const aud = $("#postAud") ? $("#postAud").value : "General";
    const tag = state.user.role === "vendor" && state.user.vendorType !== "student" ? "Vendor" : "Student";
    state.feed.unshift({ id: Date.now(), who: "You", tag, aud, time: "Just now", text });
    render(); toast("Posted to " + aud);
  });

  // feed channel chips
  document.querySelectorAll("[data-feed]").forEach((b) =>
    b.addEventListener("click", () => { state.feedFilter = b.dataset.feed; render(); }));

  document.querySelectorAll('[data-act="lf-contact"]').forEach((b) =>
    b.addEventListener("click", () => openChat(b.dataset.who)));
  const lfBtn = document.querySelector('[data-act="open-lf"]');
  if (lfBtn) lfBtn.addEventListener("click", showLF);

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
    b.addEventListener("click", () => showItem(Number(b.dataset.item))));
  const sellBtn = document.querySelector('[data-act="open-sell"]');
  if (sellBtn) sellBtn.addEventListener("click", showSell);

  // events
  document.querySelectorAll("[data-buy]").forEach((b) =>
    b.addEventListener("click", () => openCheckout(Number(b.dataset.buy))));
  const hostBtn = document.querySelector('[data-act="open-host"]');
  if (hostBtn) hostBtn.addEventListener("click", openHost);

  // shop
  const saleBtn = document.querySelector('[data-act="open-sale"]');
  if (saleBtn) saleBtn.addEventListener("click", showSale);
  const prodBtn = document.querySelector('[data-act="open-product"]');
  if (prodBtn) prodBtn.addEventListener("click", showProduct);
  document.querySelectorAll("[data-list-product]").forEach((b) =>
    b.addEventListener("click", () => showListProduct(Number(b.dataset.listProduct))));
  document.querySelectorAll("[data-unlist-product]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = Number(b.dataset.unlistProduct);
      const p = state.products.find((x) => x.id === id);
      if (!p) return;
      state.listings = state.listings.filter((l) => l.id !== p.listingId);
      p.listed = false;
      p.listingId = null;
      render(); toast("Removed from marketplace");
    }));

  // orders: complete → records the sale, updates stock and trust stats
  document.querySelectorAll("[data-complete]").forEach((b) =>
    b.addEventListener("click", () => {
      const o = state.myShop.orders.find((x) => x.id === Number(b.dataset.complete));
      const p = state.products.find((x) => x.id === o.pid);
      if (!p || p.stock < o.qty) return toast("Not enough stock to complete this order");
      p.stock -= o.qty;
      o.status = "completed";
      state.myShop.completedSales++;
      state.sales.unshift({
        id: Date.now(), name: p.name, qty: o.qty,
        total: p.price * o.qty, profit: (p.price - p.cost) * o.qty, time: timeNow(),
      });
      render(); toast("Order completed — sale recorded ✅");
    }));
  document.querySelectorAll("[data-chat-buyer]").forEach((b) =>
    b.addEventListener("click", () => openChat(b.dataset.chatBuyer)));

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

/* first paint */
render();
