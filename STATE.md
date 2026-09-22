# GlobeGuard shop — START HERE (running state)

**Read this file first in any new session.** It is the resume point: what the project is, where
everything lives, what is done, what comes next, and how to start the stack. Keep it updated at
every milestone (it is the memory that survives when a chat ends).

Last updated: 2026-09-22.

---

## 1. What this project is

Merging two GlobeGuard web-shop repo pairs into one candidate that is then iterated on.

GlobeGuard GmbH (Untermühlestrasse 12, 6330 Cham, Switzerland, info@globeguard.ch,
CHE-184.027.784) sells OBD vehicle diagnostic devices and licences:

- **BASIC** (1 brand group, model years ~2008+), **WoMo** (1 chassis brand + Truma module),
  **PRO** (1 brand group, expandable to 3 via "Erweiterung" line items, ~1991+),
  **ELITE** (B2B: Cars Mixed 4–10 brand groups, per-class multibrand, Full).
- **SGW (Security Gateway)** unlock licences (Stellantis / Mercedes / VAG, durations day, week,
  month, year) and bypass cables (IVE for Iveco Daily, FCCA for the Fiat group).
- Truma adapter cable, remote diagnosis (Ferndiagnose), software updates, adapter cables.

German is the primary language (English secondary). Prices are NET CHF; EUR is a display-only
conversion (× 1.1). Accounts are mandatory at checkout.

### The two source pairs (both untouched, archives)

| Folder | What it is |
|---|---|
| `C:\Users\carlo\OneDrive\Desktop\Navil_gg_website\` | GitHub `CarloUser/*`. **Authoritative business logic**: catalogue, compatibility, SGW rules, Bexio, blog, FAQ. Forked from a Swedish auto-parts template ("Drivknuten"). Frontend is Pages Router + Bootstrap. |
| `C:\Users\carlo\OneDrive\Desktop\New_globeguard_website\` | GitHub `Bilregistret/*`, built by a third party who misunderstood the business model. **Design donor only**: the App Router look and page architecture. Its backend is discarded. |

The folder names mislead: "New" is the *older*, rejected build.

---

## 2. Where things are

```
C:\GlobeGuard\                    <- the merged workspace (this is where work happens)
  globeguard-backend\             Vendure 3.5.5 backend (git, history from the Navil repo)
  globeguard-frontend\            Next.js 16 App Router storefront (git, fresh history)
  reference\                      owner Excel masters + brands PDF + Bexio export (untracked)
  .tools\                         portable PostgreSQL 16 (no admin rights needed; see its README)
  docs\
    STATE.md                      <- this file
    PROGRESS.md                   chronological log: done / in progress / open
    DECISIONS.md                  owner answers A1–A10 + orchestrator calls O1–O12 (locked)
    GO-LIVE.md                    <- the to-do list between here and launch (owner vs assistant)
    MERGE-PLAN.md                 the full plan, manifests, open questions B1–B14
    DEPLOY.md                     three environments + beta recipe + curl checks
    merge-inventory\              the original 4-repo inventory (file:line evidence)
    shop-schema.graphql           SDL snapshot of the merged backend shop API
  docker-compose.yml, .env.example  full local stack (Postgres, Redis, server, worker, frontend)
```

Both repos have their own `CLAUDE.md` with the rules that apply inside them.

---

## 3. Owner decisions that shape everything (full list in DECISIONS.md)

- Backend = the Navil backend cleaned; frontend = the NEW design refilled with Navil logic.
- Kustom (ex-Klarna) removed, **Mollie** is the online rail (one "Online bezahlen" tile, immediate
  capture, TWINT/cards/PostFinance Pay/Apple Pay/PayPal); invoice stays for approved company
  customers. No Mollie key yet — owner provides when the end-to-end payment test runs.
- CHF-only channel, EUR display-only ×1.1. German at root, `/en/` prefixed, `de-CH` formatting.
- Delivery countries at launch: CH, LI, DE, AT + EU (EU VAT rates before go-live).
- Light theme only, font Inter. Product URLs `/products/<slug>`.
- Dropped: car-lookup, wishlist, garage, reviews. Kept and rebuilt: track-order.
- Bexio gated behind `BEXIO_ENABLED`, CUPS behind `CUPS_SERVER_URL`.
- Commits as `CarloUser <carlobronold@gmail.com>`, **never** with AI attribution trailers.
- The Hetzner beta database is disposable; product images were pulled from it.

---

## 4. Status

### Done and committed

**Backend** (`globeguard-backend`, main):
Drivknuten-era code removed (Kustom, car-lookup, ABS-ring scripts, dashboard virtual-products),
Mollie wired, Bexio/CUPS gated, order codes `GG` + 6 digits, Swiss 8.1 % shipping tax, customer
groups Privatkunden/Geschäftskunden, channel invariants seeded on every boot (CHF, de/en,
countries CH/LI/DE/AT + EU-27, zones, tax rates), catalogue pipeline reads `../reference`,
e-mail templates fixed (all variables, no forbidden claims, dev mailbox, localized subjects),
public `trackOrder` query with rate limiting, German dashboard translations, path-aware Hetzner
supervisor, docs rewritten.

**Frontend** (`globeguard-frontend`, main):
App Router base cleaned of the third party's invented content; domain logic ported as pure modules
with 109 unit tests; all content pages (legal, FAQ, blog, partners, support, SGW table, supported
brands, why-GlobeGuard, device finder, products hub); configurator on the product page; tier pages
and category route; cart with selection badges and SGW removal dialog; Mollie checkout flow;
home page; order tracking; sitemap. Gates green: typecheck, lint, 109 tests, build, standalone
runtime smoke in both locales, backend contract verified by curl.

### In flight / next

1. **Playwright end-to-end suite** (Phase 3) — the click-through flows a browser must prove:
   picker navigation, SGW dialog, quantity/duration totals, add-to-cart, cart dialog, checkout
   steps, tracking. The workflow was written and launched twice; the first run died on a session
   limit, the second on usage credits. Re-run it (see §6).
2. **Docker stack validation** — Docker Desktop + WSL2 work since 2026-09-22 (engine 29.8.0, Linux
   containers, 12 CPU, 7.9 GB). `docker compose config` on `C:/GlobeGuard/docker-compose.yml`
   validates (5 services). Still to do: build both images and run the first-boot recipe. Note that
   the compose Postgres publishes host port 5432 and collides with the portable PostgreSQL — stop
   that one first (or change the published port).
3. Browser QA with the Chrome extension (extension was not connected in the last session).
4. Remaining owner items: Mollie test key, Hetzner `drivkf` SSH + managed-Postgres passwords,
   legal texts, pre-go-live decisions B1–B14. **The full launch to-do list is `docs/GO-LIVE.md`** —
   every open item, marked owner or assistant. Publishing to the beta is blocked only by the two
   Hetzner passwords; the deploy script, checklist and path-aware supervisor are ready.

---

## 5. Running the stack locally

**Database** (portable, no admin rights):

```bash
T=/c/GlobeGuard/.tools
"$T/pgsql/bin/pg_ctl.exe" -D "$T/pgdata" -l "$T/pg.log" -w start     # stop / status likewise
PGPASSWORD=postgres "$T/pgsql/bin/psql.exe" -h 127.0.0.1 -U postgres -d globeguard
```

The database is already seeded (233 shop-visible products, 28 collections, images imported).
`SEED_CATALOG=false` in `globeguard-backend/.env` — set it to `true` only on an empty database,
and start the **server alone** first (synchronize race), then the worker.

**Backend** (port 3000; shop API `/shop-api`, admin `/admin-api`, dashboard `/dashboard`,
health `/health`, dev mailbox `/mailbox`):

```bash
cd /c/GlobeGuard/globeguard-backend
npm run build:server            # tsc only; npm run build also builds the dashboard
node dist/index.js              # server
node dist/index-worker.js       # worker (e-mails, collection filters, search index)
```

**Frontend** (dev on 3001, standalone smoke on 3200):

```bash
cd /c/GlobeGuard/globeguard-frontend
npm run dev                                   # http://localhost:3001
NEXT_TELEMETRY_DISABLED=1 npx next build
cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
cd .next/standalone && PORT=3200 HOSTNAME=0.0.0.0 \
  VENDURE_SHOP_API_URL=http://localhost:3000/shop-api \
  NEXT_PUBLIC_SITE_URL=http://localhost:3200 node server.js
```

Docker CLI on this machine is **not on PATH** (per-user install); use
`"$LOCALAPPDATA/Programs/DockerDesktop/resources/bin/docker.exe"` (and `... compose` for compose).
If the engine reports "Docker Desktop is unable to start", kill `Docker Desktop` and the
`com.docker.*` processes and start `Docker Desktop.exe` again.

---

## 5b. Viewing the site (local URLs)

| URL | What |
|---|---|
| http://localhost:3001 | storefront, **dev server** — use this for browsing, product images work |
| http://localhost:3200 | storefront, production standalone build (what the e2e suite drives) |
| http://localhost:3000/dashboard | Vendure admin (user `superadmin`, password in `globeguard-backend/.env`) |
| http://localhost:3000/mailbox | dev mailbox: every e-mail the shop sends |
| http://localhost:3000/shop-api | GraphQL shop API |

Product images are served by the backend at `http://localhost:3000/assets/...`. On the production
build (3200) `next/image` refuses to optimise them because the host is a private IP, so they return
400; the dev server allows it. In a real deployment `NEXT_PUBLIC_ASSET_HOST` is a real hostname and
the problem disappears.

After changing catalogue data or fixing asset paths, trigger a search reindex through the admin API
(`mutation { reindex { id state } }` with a superadmin bearer token), otherwise listing pages keep
serving stale products and stale image paths. The search index, not the database, feeds the
collection and search pages.

---

## 6. End-to-end suite (Playwright) — exists and is green

`globeguard-frontend/e2e/` holds the storefront end-to-end suite (16 specs, Chromium, serial).
It drives an **already running** stack and never starts one: backend on 3000, standalone
frontend on 3200 (see section 5).

```
cd C:/GlobeGuard/globeguard-frontend
npx playwright test            # or: npm run test:e2e / npm run test:e2e:ui
```

Layout: `playwright.config.ts` (baseURL from `E2E_BASE_URL`, default http://localhost:3200),
`e2e/helpers.ts` (money parsing for `CHF 1'234.00`, the backend dev mailbox, register + verify +
sign-in, checkout address dialog, language switch), and the specs `home`, `picker-basic`,
`picker-pro`, `womo-elite`, `cart`, `checkout`, `account-locale`, `tracking`. `e2e/` has its own
tsconfig and is excluded from the Next tsconfig; vitest is untouched.

Registration goes through the UI, then the helper reads the newest JSON in
`globeguard-backend/static/email/test-emails`, pulls the token out of the verification link and
rewrites its origin (the backend renders links with FRONTEND_BASE_URL = port 3001).

Facts the specs assert (NET CHF): BASIC Fiat/Alfa/Lancia 620.00; with `?year=2020` the SGW bypass
cable FCCA 90.00 and the Stellantis licence (20/50/90/370 for day/week/month/year) are auto-added
-> 730.00 default, 800.00 with a month licence, 890.00 with two of them, 620.00 without SGW; PRO VW
Gruppe 820.00 + Erweiterung CAR 320.00 + VAG licence = 1160.00; WoMo Ford 848.00 + Truma cable
90.00 = 938.00; ELITE Cars Mixed 2380.00 needs 4-10 brand groups and shows "4 Markengruppen
gewaehlt" on the cart line.

Known limits: **no Mollie key locally**, so `eligiblePaymentMethods` is empty for a private
customer and the checkout stops at the payment step with the translated "no payment method"
notice — placing an order cannot be tested until a Mollie test key exists. ELITE **Cars Mixed**
deliberately has no SGW multi-select (`isEliteDeviceProduct` excludes it), so the no-SGW confirm
dialog is covered on ELITE **Cars Multibrand** instead.

Frontend bugs this suite found and fixed: duplicate DOM ids at checkout (raw Vendure ids used for
both the saved-address radios and the shipping-method radios, which broke `label[for]` whenever the
ids collided) and the checkout page querying the active order and the customer addresses without a
`languageCode`, so the English checkout showed "Schweiz" and German product names.

---

## 7. Gotchas worth remembering

- **Memory**: this PC has 15 GB and runs close to full. Docker Desktop alone takes ~2 GB. Running
  Postgres + backend + worker + frontend + Playwright + Docker at once gets processes killed.
  Start only what the current step needs.
- **Windows asset paths**: Vendure stores asset identifiers with backslashes when uploaded on
  Windows. Fix after an import:
  `UPDATE asset SET source = replace(source, chr(92), '/'), preview = replace(preview, chr(92), '/');`
- **Windows dashboard build**: the upstream Vite translations plugin globs with backslashes, so a
  dashboard bundle built on Windows contains no extension translations. Build it on Linux
  (Docker/Hetzner) for production.
- **gql.tada CLI**: run `node node_modules/gql.tada/bin/cli.js generate-output` (the `.cmd` shim
  prints nothing under Git Bash). Regenerate after backend schema changes.
- **Routes that redirect or 404** must not sit under a `loading.tsx`/Suspense boundary, otherwise
  Next streams a 200 (decision O12).
- **Standalone server**: never set `HOSTNAME=127.0.0.1` (redirect loop with next-intl); use
  `0.0.0.0`. `next build` does not copy `.next/static` and `public` into `.next/standalone`.
- **Hetzner beta** cannot be deployed until the owner supplies the `drivkf` SSH password and the
  managed-Postgres password; the supervisor is ready and path-aware.
- The backend `.env` holds the local superadmin password; it is gitignored.
