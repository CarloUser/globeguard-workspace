# Merge progress log

Newest first. Each entry: what was done, how it was verified, what is still open. See MERGE-PLAN.md for the plan and DECISIONS.md for owner decisions.

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
  fixed. The beta needs an owner decision first (GO-LIVE section 1).
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
