# StockEx — Frontend Prototype

Static HTML/CSS/JS build of the four screens Stitch generated (Dashboard, Inventory,
Add Product, Reports), corrected against `StockEx-PRD.pdf` v0.2. No framework, no CDN,
no build step — open any `.html` file directly in a browser.

## Structure

```
stockex/
├── index.html           Landing page — what an unauthenticated visitor sees first
├── signup.html          Sign Up
├── login.html           Log In
├── forgot-password.html Forgot Password
├── choose-category.html Choose Business Category (one-time, post-signup)
├── dashboard.html       Dashboard (Home) — was index.html before this pass
├── inventory.html       Inventory / Stock
├── add-product.html     Add Product
├── reports.html         Reports
├── settings.html        Settings — Business Info, Account, Notifications, Thresholds
├── css/
│   └── styles.css       All design tokens + components, one file
├── js/
│   └── expiry.js         The five-tier expiry engine — single source of truth
├── assets/
│   ├── logo-icon.svg     Square mark (favicon / app icon)
│   └── logo-lockup.svg   Icon + wordmark (headers)
└── README.md
```

Each page duplicates its own small inline SVG icon sprite and the header/bottom-nav
markup, since this is a static multi-page site with no templating layer. That's normal
for this stage — when you move to a real frontend framework (React, Vue, or similar) for
the backend-connected build, the header/nav/icon-sprite becomes one shared component
instead of copy-pasted markup.

## The full flow, now wired end to end

`index.html` (landing) → `signup.html` or `login.html` → (new accounts only)
`choose-category.html` → `dashboard.html` ↔ `inventory.html` ↔ `add-product.html`,
`reports.html`, `settings.html`. The bottom nav's Account tab now goes to
`settings.html` on every page instead of a dead `#` link, and Home now correctly points
to `dashboard.html` (the former `index.html`) rather than the landing page.

There's no real session handling since there's no backend yet — "Log in" and "Sign up"
just navigate forward, and "Log out" (in Settings, behind a confirmation, per PRD
interaction rules on destructive/consequential actions) sends you back to the landing
page. Once Supabase Auth is wired up (see below), these become real authenticated
routes with an actual logged-out state guarding the app pages.

**Note on scope:** `choose-category.html` implements the simplified onboarding you
asked for a few turns back (Sign Up → Choose Category → Dashboard), not the PRD's
original 5-step wizard (Profile → Category → Product Selection → Inventory Details →
Ready). If you actually want the full 5-step wizard back, say so — the simplified
version is what's built because it was the more recent explicit instruction.

## What changed from Stitch's output

See the audit in the previous message. In short: removed invented features not in the
PRD ("Shelf Audit Mode," "Batch Audit," markdown/discount/write-off actions), fixed a
real bug in the expiry-tier math (Urgent/Expiring Soon boundaries were wrong), fixed
label/color consistency issues (In Stock / Safe Stock no longer colored like an
attention tier, Safe badge is neutral everywhere, Mark Sold no longer uses a
checkout/POS icon, Edit is no longer icon-only), and replaced the Google Fonts icon
CDN with an inline SVG sprite so the app doesn't lose its icons when actually offline.

## Still open — needs your decision

- **Storage / Shelf Location field** (on Add Product): not in the PRD's data model
  (Section 07 only defines `name`, `category`, `quantity`, `unit`, `expiry_date`,
  `barcode`, `date_added` on `products`). Kept as a UI field across every iteration
  without objection — needs an explicit yes/no before a backend column gets built for
  it. If yes, add `storage_location: string | null` to the `products` table.
- **Business Setup Wizard vs. simplified onboarding** — see the note above.

---

## Next steps: backend and full functionality

This is a static, offline-data mockup — every number on every page is hardcoded HTML.
Turning it into the real product means building the layers the PRD already specifies
in Section 6 and 7. Roughly in order:

### 1. Stand up Supabase (PRD Sections 6–7)
- Create a Supabase project. This gives you Postgres + Auth + Row Level Security out
  of the box, which is exactly what Section 6 specifies (not a custom backend server).
- Create the two tables exactly as Section 07 defines them: `businesses` and
  `products`. Do **not** add a `status` column — status is never stored, only computed
  from `expiry_date` at read time (Section 07's explicit note, and what `js/expiry.js`
  already does correctly on the frontend).
- Enable Row Level Security on both tables with a policy scoping every row to
  `business_id = auth.uid()`-equivalent ownership, per Section 07's security model.

### 2. Wire up authentication
- Supabase Auth handles Sign Up / Log In / Forgot Password directly (email + password,
  Section 8.1) — you won't hand-roll session handling.
- On successful sign-up, insert one row into `businesses` for that owner, then route to
  Choose Business Category (per the simplified onboarding flow we settled on), not the
  old 5-step wizard.

### 3. Replace hardcoded HTML with real queries
- Each page's static list becomes a Supabase query: `select * from products where
  business_id = ...`, run through `js/expiry.js`'s `calculateExpiryStatus()` to derive
  each row's tier at render time — the function is already written to do exactly this,
  it just needs real rows instead of the hardcoded ones in the HTML right now.
- Dashboard's four stat cards become aggregate queries (counts/sums) over the same
  table, not separate hand-maintained numbers.

### 4. Offline queue (PRD Section 6 & 10)
- Register a service worker to cache the app shell (the HTML/CSS/JS files themselves)
  so the app loads with no connection at all.
- Writes (add/edit/mark-sold) get queued in IndexedDB when offline, then replayed
  against Supabase on reconnect. The sync banner already in `inventory.html` is the UI
  for this — it just needs a real queue behind it instead of a static "2 queued
  updates" string.

### 5. Barcode scanning + Open Food Facts (Phase 2, Section 10 & 12)
- Add a JS barcode-scanning library (not just the native `BarcodeDetector` API, since
  Safari disables it by default — Section 10 is explicit about this). Requires HTTPS.
- On a successful scan, query the free Open Food Facts API to pre-fill the confirm
  card; on no match, fall back to Manual entry with whatever was already typed
  preserved (the "Scan" tab in `add-product.html` already has this fallback wired up
  as a placeholder — swap the `alert()` calls for the real camera/lookup flow).

### 6. Notifications (Phase 2)
- Email or push notifications for expiring/expired stock — this needs a scheduled
  job (Supabase Edge Function on a cron trigger works well) that runs the same tier
  calculation server-side and sends alerts, since it has to fire even when nobody has
  the app open.

### 7. Configurable thresholds (Phase 3)
- Add a `thresholds` field to `businesses` (or a separate settings table), and change
  `js/expiry.js`'s `THRESHOLDS` constant to read from the business's saved values
  instead of the hardcoded PRD defaults — the function is already structured so this is
  a small change, not a rewrite.

### 8. Deploy
- Since this is a PWA (Section 6), a static host (Vercel, Netlify, Cloudflare Pages) is
  enough — no server runtime needed beyond Supabase itself. Add a `manifest.json` and
  the service worker for installability.

A reasonable build order: (1) and (2) first so you have real accounts and real data,
then (3) so every screen reflects that data instead of hardcoded HTML, then (4)
offline queueing, then (5)–(7) as the Phase 2/3 features you already confirmed you want.
