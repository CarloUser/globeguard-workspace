# Merge progress log

Newest first. Each entry: what was done, **how it was verified**, and what is still open. The
verification half is the point — "added X" is not useful to the next person, "added X, proven by
Y" is.

Working with someone else? Add your entry under a `## YYYY-MM-DD — @you` heading of your own
rather than editing theirs, and it will merge cleanly. The open items live in `TODO.md`; this
file is the narrative behind them. See MERGE-PLAN.md for the plan and DECISIONS.md for the
decisions already locked.

## 2026-10-18 — @richard

### Done
- **Empty band under the navbar removed** (frontend). The header has been `sticky top-0` since
  the initial import, so it takes its own space in the flow; but 18 content pages still had
  `pt-32` on `<main id="main-content">`, the offset you need for a `fixed` header. The result was
  a 128px empty grey band between the nav and the white heading block. Dropped `pt-32` on all 18
  `<main>`s. `/track-order` is the one page without a heading band of its own (its `pt-32` was
  the only spacing above the h1), so its container got `pt-10` instead. The home hero's `pt-32`
  is real padding inside the dark hero and stays.

### How it was verified
- Rebuilt the frontend image in the local compose stack and measured 23 routes (the 18 page
  types incl. all 7 legal pages) at 1440px and 390px: `<main>` has no top padding, the first
  block starts directly under the header, and the nav-to-h1 distance is 40px on most pages (more
  where a breadcrumb sits above the h1). Screenshots of /produkte/basic, /track-order and
  /kontakt (mobile) looked right.
- Nothing used the 128px as an offset: no `scroll-mt`, `scroll-padding` or `scrollIntoView` in `src`.
- Gates in `node:22-bookworm-slim`: tsc (after `next typegen`), eslint, 115/115 vitest.
- Not checked live: the blog post page (no posts in the local database); it is the same one-line
  change as /blog.

- **Navbar no longer overflows on phones** (frontend). Below `sm` row 1 (logo 168, language
  picker 99, CHF/EUR 82, cart 36, menu 36, gaps and padding) needed ~481px at every phone width,
  so on a 390px phone the currency toggle was cut off and the page scrolled sideways. Below `sm`
  only: the language picker shows just the globe as a 32px square (the language name is hidden
  with `hidden sm:inline`, the aria-label "Sprache wechseln" is unchanged, the dropdown is
  unchanged), the logo is 120px (`sizes` updated to match), and the logo-to-cluster gap is
  `gap-2`. A first attempt to narrow the CHF/EUR items had no effect — inside a `spacing=0`
  toggle group `group-data-[spacing=0]:px-2` overrides any `px-*` on the item — and was dropped.

### How it was verified (navbar)
- Measured row 1 in the rebuilt stack at 320/340/360/375/390/414/430/639/640/768/1024/1440px on
  /kontakt, plus / and /produkte/basic at 360px: no horizontal scroll and a 16px right margin from
  ~345px up; at 640px and above the widths are the same as before. Screenshot at 390px with the
  language dropdown open (.playwright-mcp/navbar-mobile-fixed.png on Richard's machine).
- Gates: tsc (after `next typegen`), eslint, 115/115 vitest. The e2e helpers find the language
  button by its aria-label, and `home.spec.ts` checks its text at desktop width, so they are not
  affected; the e2e suite itself was not run.

- **Navbar at 320px: CHF/EUR moves into the mobile menu** (frontend, product call by Richard).
  The changes above fit from ~345px; below that only dropping something from row 1 helps. Below
  360px the navbar's `DisplayCurrencyToggle` gets `hidden min-[360px]:flex`, and the mobile menu
  sheet renders the same component under its own heading `Common.displayCurrency`
  ("Anzeigewährung") with `min-[360px]:hidden`. Both read and write the same
  `DisplayCurrencyProvider` cookie, so there is one state.
- Verified: measured 320/340/359/360/375/390/640/1440px — no horizontal scroll, 16px right margin
  everywhere, toggle in the navbar from 360px, in the menu below. At 320px on
  /produkte/kategorie/zubehoer: opened the menu, chose EUR — EUR pressed, prices 90.00 CHF →
  99.00 EUR, cookie `gg-display-currency=EUR`; switched back to CHF. Gates as above, green. The e2e
  suite runs at 1440px only and does not touch the currency toggle.
- **Schema-drift warning for `faq_section.items` silenced** (backend). The TODO item asked for a
  catch-up migration, but the baseline and the database already had `DEFAULT '[]'::jsonb` (the
  table itself is empty locally). Reading TypeORM 0.3.28 showed a false positive: the query runner
  strips `::type` casts from the default it reads back (`'[]'::jsonb` → `'[]'`), while a function
  default from the entity is compared verbatim (`'[]'::jsonb`), so they never matched. The entity
  default is now `() => "'[]'"`; Postgres applies the cast itself, the stored default is the same.
  No migration, no data change.
- Verified: `docker compose build server` (runs `tsc`) and restart of server + worker; the boot log
  goes from "Your database schema does not match ... ALTER TABLE "faq_section" ..." straight to
  "No pending migrations found"; `information_schema` still shows `'[]'::jsonb`. No other entity
  has a cast inside a `default: () =>`. The backend has no unit tests.
- **Responsive pass 320–1440 px** (frontend). 32 public routes (incl. two product pages, cart,
  auth pages, search, a 404) in German and English at 320/360/375/390/414/768/1024/1280/1440 px,
  run as same-origin iframes: horizontal scroll, and for each hit the text node or element that
  causes it. Fixes from it:
  - Related-products carousel: the shadcn arrows sit at `-left-12`/`-right-12`, outside a 16px
    gutter, so product pages scrolled sideways from 768 to 1280 px. The carousel now has a
    `md:px-12` gutter and the arrows sit at `left-0`/`right-0` inside it (`product-carousel.tsx`;
    the generic `ui/carousel.tsx` is untouched).
  - Legal-page h1: "Geschäftsbedingungen" and "Datenschutzerklärung" are single words wider than a
    320px screen at 30px. `hyphens-auto` was tried first, but the test browser has no German
    hyphenation dictionary, so only the `break-words` fallback applied and split mid-word.
    Now `text-2xl` (24px) below `sm`, `sm:text-3xl`, `md:text-4xl`, with `break-words` kept as a
    safety net; "Allgemeine / Geschäftsbedingungen" breaks between the words.
  - Desktop nav from 1024 to 1279 px: the eight links need ~1080–1107 px and got 960, so the
    `h-12` row wrapped and its second line hung over the page. Richard chose to keep the menu
    button up to `xl`: row 2 is `xl:flex`, the toggle `xl:hidden`, search stays from `lg`.
- Verified: the full sweep again after the fixes — 0 of 576 checks scroll sideways (15 timeouts
  in one window during the run all passed on a re-run); nav measured at 8 widths in both
  languages; screenshots of /agb at 320, a product page at 1024 and the menu sheet at 1024.
  Gates: tsc (after `next typegen`), eslint, 115/115 vitest.
- Sweep gotcha: visiting any `/en` page sets `NEXT_LOCALE=en`; German root URLs then redirect to
  `/en/...`. The first sweep fell into this (only 320 px was really German), so clear the cookie
  before each batch or test English through explicit `/en/` URLs.
- New items in `TODO.md` §4: unknown URLs get Next's bare English 404 instead of
  `[locale]/not-found.tsx` (fixed, next entry); the carousel's screen-reader labels are
  hard-coded English (open). §2: Richard hands over his FAQ texts (format defined there).
- **Unknown URLs get the shop's 404** (frontend). An unmatched URL never reached the `[locale]`
  layout, so Next served its bare English "404: This page could not be found." (no header, no
  `lang`). New `app/[locale]/[...rest]/page.tsx` calls `notFound()`, which renders
  `[locale]/not-found.tsx` inside the shop layout, still status 404; its metadata sets the
  `NotFound.title` and `noindex, follow`. `not-found.tsx` now wraps its content in `<main
  id="main-content">` (the skip link had no target on 404s). Checked beforehand that the catch-all
  cannot shadow anything: redirects run before routing, the `/assets` rewrite is `afterFiles` and
  beats dynamic routes, `ownRoutes()` in next.config.ts skips `[...]` folders.
- Verified: curl over unknown (incl. nested), existing and technical URLs — 404/200/308 as
  expected; in the browser after hydration de/en 404s have the shop layout, the right `lang`,
  title, noindex and a `#main-content` target; `npm run verify:redirects` OK (203 legacy URLs),
  `npm run audit:a11y` clean, an `/assets/preview/...png` still 200 through the rewrite. Gates:
  tsc, eslint, 115/115 vitest. No e2e test covers the 404 page.
- A fresh checkout needs `npx next typegen` before `tsc --noEmit` passes (`PageProps` /
  `LayoutProps` are generated globals); `next build` does this itself.

## 2026-09-22 (day 2, later)

### Done
- **Everything committed, in three repos.** `C:\GlobeGuard` itself is now a git repo (STATE.md,
  docs/, docker-compose.yml, .env.example, README) — those files were the project memory and
  existed on one machine only. `reference/` stays untracked: it holds a Bexio customer address
  export and the owner's price masters.
- **Go-live workflow findings applied** (3 major, 7 minor). The schema policy is now enforced,
  not defaulted: APP_ENV is validated against a list (a typo like `produciton` used to read as
  "not production" and would have synchronised a production database) and DB_SYNCHRONIZE=true is
  refused when APP_ENV=production. Docker runs `node dist/migrate.js && node dist/index.js`.
  deploy-beta.mjs installs sharp before the migration so migrate and restart stay contiguous, and
  a missing `ss` on the host is fatal rather than "nothing to stop". Backup/restore: no silent
  fall-back to another database's dump, a maintenance-database probe that degrades, and both
  completions awaited instead of nested. Re-proven end to end: dump -> restore into a scratch
  database -> identical row counts (product 260, order 62, asset 125, customer 28) -> dropped.
- **`npm run db:adopt-baseline`** — found while testing: a database built by synchronize fails the
  baseline with `relation "collection_asset" already exists`. migrate.js exits 1 (so the deploy
  stops safely) but then printed "No pending migrations found.", which reads like success. Both
  fixed. The beta needs an owner decision first (docs/TODO.md section 1).
- **Redirects live**: 203 map entries wired into next.config.ts, verified against a running build
  with `npm run verify:redirects` (also the cutover check). Two bugs found doing it, both now
  build-time guards: identity entries made /faq, /impressum and /support return
  ERR_TOO_MANY_REDIRECTS, and `/en/checkout -> /en/cart` (true of the old site) made the new
  English checkout unreachable — caught by the e2e suite.
- **Product + BreadcrumbList JSON-LD** on product pages, AggregateOffer for the four products
  that show a price range. Verified against the shop API.
- **Hero image**: was a CSS background, so next/image never saw it — 634 KB per visitor at full
  size on a phone. Now 17 KB AVIF at 640 px. Along the way: when sharp cannot load, next/image
  silently serves the originals, which is what the local bundle had been doing; the deploy now
  fails on that.
- **`npm run reindex`** for the search index, with the "no worker running" case spelled out.
- e2e suite re-run after all of it: 16/16. Gates: tsc (app + e2e), eslint, 115 vitest tests,
  next build, backend tsc + build.

- **Docker full stack booted for the first time.** Both images build; the server applied the
  baseline migration to an empty database and seeded 260 products; five services healthy; shop
  API 233 products / CHF / de; dashboard and storefront 200; redirects working in the container.
  Two old warnings are now measured: the Linux dashboard bundle carries the German extension
  translations a Windows build drops (de.js 74,950 bytes with Blog/FAQ/Bexio strings vs 52,257
  and none), and ASSET_URL_PREFIX cannot be localhost in compose because next/image fetches it
  from inside the frontend container — the host IP works from both sides.
- **The first real `docker compose build` found a broken frontend lockfile.** npm 11 (Node 24,
  this machine) wrote a lock that npm 10 (Node 22, the images and both CI workflows) rejects over
  an unmet @swc/helpers peer. Nothing local reproduced it; it would have broken Docker, CI and
  the Hetzner deploy at once. Regenerated with the image's own npm, `npm ci` then verified under
  node:22 for both repos.
- **The Docker build context was 316 MB and included `backups/`** — gzipped pg_dump output with
  customer data, heading into an image layer. Now 100 KB.
- **Redis-backed rate limiter** for the public trackOrder query, so the limit holds across server
  processes instead of being multiplied by their number. Proven against a real Redis.
- **Accessibility**: `npm run audit:a11y` over twelve pages found four real problems (no skip
  link, three pages without a `<main>` landmark, two h1 on the cart, footer h4 jumping h1 → h4).
  All fixed; the audit reports the set clean and exits non-zero on a regression.

### Still blocked
- Hetzner publish: the `drivkf` SSH password and the managed Postgres password are not on this
  machine, there is no SSH key, and the only stored Hetzner credentials belong to the `globewp`
  production WordPress account, which must not be touched.
- GitHub push: no `gh` CLI, no credential helper, repo names unconfirmed.
## 2026-09-22 (day 2)

### Done
- **Phase 3 end-to-end suite written and green**: `globeguard-frontend/e2e/` (16 Playwright specs,
  Chromium, serial, against the running backend 3000 + standalone frontend 3200). Covers home +
  tier cards + language switch, the BASIC and PRO pickers through to the configured product page,
  WoMo Truma prompt, ELITE Cars Mixed blocking rule and ELITE Cars Multibrand no-SGW dialog, cart
  (NET lines, selection badges, SGW removal dialog, guest checkout redirect), checkout in German
  and English (Swiss address, Schweizer Post methods, no-payment-method notice), account pages in
  both locales, and order tracking. Gates after the run: `tsc --noEmit` (app and e2e), `eslint .`,
  `vitest run` (109 tests). Two frontend bugs found and fixed: duplicate DOM ids at checkout
  (`delivery-step.tsx` / `shipping-address-step.tsx` used raw Vendure ids, breaking `label[for]`
  when an address id collided with a shipping-method id) and missing `languageCode` on the checkout
  active-order and customer-addresses queries (English checkout showed German country/product
  names). Blocked: placing an order needs a Mollie test key.
- **Running memory file added**: `C:/GlobeGuard/STATE.md` is the single resume point for a new chat
  (project, layout, decisions, status, stack commands, gotchas). Both repo CLAUDE.md files and the
  assistant memory point at it. Keep it updated at every milestone.
- Docker Desktop + WSL2 working (engine 29.8.0, Linux, 12 CPU, 7.9 GB). The workspace
  docker-compose.yml passes `docker compose config`; images not built yet. The compose Postgres
  publishes host port 5432 and collides with the portable PostgreSQL: stop one before running.
- Local stack restarted after the out-of-memory kills: portable Postgres, backend (233 products,
  CHF), worker, standalone frontend on 3200.
- **Phase 2c-3 / 2e integrated and committed** (frontend 73c6679): configurator on the product page, tier pages, category route with redirect from /collection, cart badges and SGW removal dialog, Mollie checkout flow (single online tile, redirect intent, polling confirmation), rebuilt home page, order tracking form, sitemap with products/categories, Phase 2d review fixes. Integration gates: typecheck, lint, 109 tests, build, standalone runtime smoke, backend contract via curl. **The two review agents of that workflow were cut off by a session limit and still have to run.**
- Docker Desktop installed by the owner (not yet exercised).

- Reviews rerun (both agents): only minor findings (locale switch dropping picker params, order-confirmation soft-404, PostFinance Pay wording, dead keys, variant guard, proxy hop count). Backend side fixed and committed (TRUST_PROXY_HOPS, localized e-mail subjects); frontend fixes in progress.
- E-mail pipeline verified locally: registration -> worker -> dev mailbox; verification link and footer links point at the new storefront routes; no forbidden claims; no unrendered placeholders.
- Docker Desktop cannot start on this PC: WSL is not installed (owner action: `wsl --install` as admin, reboot, start Docker Desktop once).

### Next
- Commit the frontend review fixes; restart backend + worker for the new e-mail subjects and re-check a German subject in the dev mailbox.
- Browser QA of the client-side flows (picker navigation, SGW dialog, quantities, add-to-cart, cart dialog, checkout steps) with Chrome tools.
- Docker: validate the workspace compose (docker compose config, image builds, first boot recipe).

## 2026-09-17 (day 1)

### Done
- Workspace `C:\GlobeGuard\` created: backend cloned with history, frontend started fresh from the NEW tree, reference files, docs, portable PostgreSQL 16 in `.tools/` (see `.tools/README.md`), local backend `.env`.
- 744 product images for 224 of 233 products pulled from the live beta into `globeguard-backend/scripts/assets/beta-product-images/` (gitignored).
- **Phase 1 (backend) complete and committed** (4 commits on `globeguard-backend` main). Verified: server compiles, full build incl. dashboard passes, first boot against the empty local database seeds 260 products / 28 collections, channel CHF + de/en, 29 countries, `/health` 200, dev mailbox at `/mailbox`, GG order codes at runtime, basic-womo collection filled after the worker ran, Bexio overlay present in the dashboard bundle. Two independent reviewers, all findings fixed and re-verified.
- **Phase 2a (frontend base) complete and committed** (1 commit on `globeguard-frontend` main). Verified: typecheck, lint, `next build` without a backend, runtime smoke with an unreachable backend (error boundaries, hreflang, titles, sitemap). Two reviewers, all findings fixed and re-verified.

- Product images imported into the local shop with scripts/sync-product-assets.mjs (224 products, 125 unique assets). Windows gotcha confirmed: Vendure stores asset identifiers with backslashes when uploaded on Windows; normalised in the DB with `UPDATE asset SET source = replace(source, chr(92), '/'), preview = replace(preview, chr(92), '/')` (never needed on Linux).
- Phase 2b done: frontend gql.tada types regenerated from the running backend (run the CLI via `node node_modules/gql.tada/bin/cli.js generate-output`; the .cmd shim prints nothing under Git Bash). SDL snapshot in docs/shop-schema.graphql.

- **Phase 2c-1 done and committed**: domain logic ported as pure modules with 97 unit tests (picker, add-on plan builder, cart line builder, vehicle types, highlights). Reviewer confirmed rule fidelity; three hardening items applied.
- **Phase 2d done and committed**: legal/company pages, FAQ, blog, partners, support hub, SGW table, supported brands, why-GlobeGuard, device finder, products hub; per-feature message files; runtime smoke of 32 pages in both locales.
- Backend: order-tracking plugin (public trackOrder query with rate limiting) committed; German dashboard translations (350 entries) committed; path-aware Hetzner supervisor committed; workspace docker-compose.yml, .env.example and docs/DEPLOY.md written (Docker run still pending).

### In progress
- Phase 2c-3 / 2e workflow: configurator + product page, tier pages + category route, cart badges + Mollie checkout, home page + order tracking form + dynamic sitemap, plus the Phase 2d review fixes (layout Suspense/404, blog pagination clamp, slug contract).


### Open for the owner
- Docker Desktop (or keep the portable PostgreSQL); beta SSH/DB credentials for the drivkf account; Mollie test key (needed at the checkout end-to-end test).
- Pre-go-live decisions B1-B14 in MERGE-PLAN.md section 6 (defaults applied so far are listed in DECISIONS.md O1-O7).

### Known follow-ups carried forward
- Windows-only: the upstream @vendure/dashboard 3.5.5 Vite translations plugin builds its glob with backslashes, so a dashboard bundle built on Windows contains no extension translations (`Found 0 translation files from plugins`). Linux builds (Docker, Hetzner) are unaffected; do not ship a Windows-built dashboard bundle.
- EU VAT: zone and placeholder rate exist; `AddressBasedTaxZoneStrategy` is not configured yet (owner decision A7/B).
- Hetzner: `deploy/app.js` still proxies everything to Next; needs path-aware routing (or an api. hostname) for `/shop-api`, `/assets`, `/dashboard`, `/payments/mollie`, `/health` before the merged stack can run on the beta (Phase 2f).
- Beta database: existing shipping methods keep the old 25 percent tax argument until corrected once in the dashboard (bootstrap no longer overwrites existing rows); `sumup`/`paypal` rows are disabled automatically.
- Dashboard: ~440 German admin strings still untranslated (LLM batch pending, decision B9).
- pg DeprecationWarning during the 256-row seed (serialise seeder queries before pg 9).
