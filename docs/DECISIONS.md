# Decisions register

Owner answers to the questions in MERGE-PLAN.md section 6. Each entry: decision, date, consequence. Nothing here is a proposal; treat as locked unless the owner changes it.

## A. Blocking decisions (answered 2026-09-17)

| # | Decision | Consequence |
|---|---|---|
| A1 | Workspace `C:\GlobeGuard\`. New GitHub repos under CarloUser (names to confirm at first push). Backend keeps Navil history; frontend starts fresh from the NEW tree. Commits as `CarloUser <carlobronold@gmail.com>`, **no AI attribution trailers** (owner rule, overrides tool default). | Workspace created 2026-09-17. `Desktop\GlobeGuard_final` was moved into `C:\GlobeGuard\docs\`. |
| A2 | Third-party commits after 7 July 2026 are approved; the developers still have access to the CarloUser repos. | No revert gate. The pm2 deploy workflow is still removed from the merged repos until the deploy design (0.3) because its target host is unknown and the new repos carry no secrets. |
| A3 | Deployment is on Hetzner. Local testing via Docker/localhost; deploying to the beta URL on Hetzner is fine. | Canonical runtime = Docker full stack (PROJECT-CONTEXT §14, corrected); beta = konsoleH supervisor adapted for the new frontend. See "Hetzner access" below. |
| A4 | German at root, `/en/` prefixed; product pages `/products/<slug>`; German slugs for cart/account later. | next-intl `defaultLocale: 'de'`, `localePrefix: 'as-needed'`, `de-CH` formatting. |
| A5 | No Mollie account or test key yet; owner provides when needed. Methods at launch: TWINT, cards, PostFinance Pay, Apple Pay, PayPal. Immediate capture. One "Online bezahlen" tile. Keep invoice for approved company customers. Delete SumUp/PayPal rows. | Mollie integration built against env placeholders; the end-to-end payment test (Phase 3) is the first point that needs the test key. |
| A6 | CHF-only channel; EUR display-only at x1.1; NEW's multi-currency switching removed. | Seeder sets `defaultCurrencyCode = CHF`. |
| A7 | Delivery countries at launch: CH, LI, DE, AT plus EU; EU VAT rates before go-live. | Countries/zones seeded accordingly. |
| A8 | "Beta" = the live Vendure deployment at https://driv.beta.globeguard.ch on the Hetzner server (user drivkf, managed Postgres), NOT a folder on this PC. Verified 2026-09-17: it runs the pre-8-July code (`/api` path), channel currency USD, 0 blog posts, 28 collections, 233 products. Treated as disposable; a dump is taken before it is touched. Product images are pulled from it. Price sheet V110, product photos and manuals live on another laptop; not needed for the merge, needed later for catalog regeneration and photo import. | |
| A9 | Light-only, Inter. | Dark-mode switcher removed; `next/font` Inter. |
| A10 | Drop car-lookup, wishlist, garage, reviews. Keep a track-order feature: the Navil page is a non-functional template stub (no submit handler), so it is rebuilt small in the new frontend (order code + e-mail lookup via a tiny shop-API resolver) rather than ported. CUPS gated behind `CUPS_SERVER_URL`. Bexio local-only, gated behind `BEXIO_ENABLED`. | |

## B. Pre-go-live decisions

Open. See MERGE-PLAN.md section 6B. Defaults apply until answered.

## Hetzner access found on this machine (2026-09-17)

- `Isar3D/Globeguard/migration-credentials.json` (gitignored) holds the **production WordPress** account on the same Hetzner server (konsoleH account, SSH user `globewp`, MySQL `globewp_db0`). globeguard.ch WooCommerce was migrated from Hosttech to Hetzner on 2026-09-04 (`MIGRATION_CONTEXT.md`). Never touch that account from the shop project.
- The **beta Vendure account** (`drivkf`, managed Postgres `globeguard_db@lqy0.your-database.de`, Vendure superadmin, COOKIE_SECRET) is documented in PROJECT-CONTEXT §7 and §12 but its credentials file `hetzner-credentials.md` is NOT on this machine. `~/.ssh/known_hosts` shows the server was reached from here on port 222 (likely as `globewp`). Needed before any beta deploy: drivkf SSH password (or the konsoleH account login to reset it) and the Postgres password.

## Local toolchain (2026-09-17)

Node 24.11, npm 11.19, winget present. No Docker, no PostgreSQL, no Redis installed. Local boot testing needs one of: Docker Desktop (recommended, matches the documented stack) or a native PostgreSQL 16 install. Redis is optional (`REDIS_DISABLED=true`).

## Orchestrator calls made during Phase 1/2a (reversible; owner may override)

| # | Call | Reason |
|---|---|---|
| O1 | Frozen public route map for the storefront: `/`, `/geraet-finden`, `/produkte`, `/produkte/basic|pro|womo|elite`, `/produkte/kategorie/[slug]`, `/products/[slug]`, `/warum-globeguard`, `/unterstuetzte-marken`, `/support`, `/support/sgw`, `/blog`, `/blog/[slug]`, `/faq`, `/kontakt`, `/partner`, `/ueber-uns`, `/impressum`, `/agb`, `/datenschutz`, `/widerruf`, `/zahlungsarten`, `/versand`, `/track-order`, `/cart`, `/checkout`, `/order-confirmation/[code]`, `/account/*`, `/sign-in`, `/register`, `/verify`, `/verify-pending`, `/forgot-password`, `/reset-password`, `/search`. German at root, `/en/` prefixed. | FAQ page keys, footer, email links, sitemap and redirects all need one map (plan 2d). Legal/company pages get German slugs now because they are new routes with no existing links; cart/account keep English slugs (existing links, A4). |
| O2 | Customer groups named `Privatkunden` / `Geschäftskunden`, created at boot, admin-assigned. | A5 asked for German names; these are the plainest. |
| O3 | EU zone gets a 0 percent placeholder tax rate named "EU MwSt (Platzhalter – vor Go-Live festlegen)". | A7: EU VAT decided before go-live; a zone without a rate behaves the same (0) but is invisible in the admin. |
| O4 | INEOS `basicFromYear` set to 2022 in the generated data (B3 default). Lamborghini SGW left unchanged (no default). | |
| O5 | Mollie method provisioned from env at boot (`MOLLIE_API_KEY`), code `mollie`, single "Online bezahlen" tile; skipped with a warning when the key is absent. | A5. Keeps the key out of the database export path and matches how the existing payment/shipping bootstrap works. |
| O6 | Email deep links default to `/verify`, `/reset-password`, `/account/verify-email` (the NEW frontend's routes, unprefixed German). | Fewer moving parts than renaming routes; overridable by env. |
| O7 | Third-party deploy workflow removed from both merged repos. | Target host unknown, `git reset --hard` on push; new repos carry no secrets anyway. Re-add deliberately in Phase 2f if it turns out to target the Hetzner beta. |
| O8 | Blog slugs must be identical in German and English for now: the backend resolves `blog(slug)` against the base (German) slug, so the storefront builds every link, alternate and sitemap entry from the base slug. | Translated slugs need a backend change (resolve through `BlogTranslation.slug`); owner decision B. |
| O9 | Add-on quantities scale with the device quantity (B1 default): main SGW licence quantity × devices, cables and Erweiterungen × devices; ELITE licences stay at 1 per order line. | Implemented as a parameter in the pure plan builder (`scaleAddOnsWithQuantity`, default true); a single flag reverts to the old behaviour. |
| O10 | Public order tracking (`trackOrder(code, emailAddress)`): in-memory limiter 10 attempts per IP and code, 60 per IP, 10-minute window; German/English error; nothing revealed about which input was wrong. | Redis-backed limiter before running more than one backend replica. |
| O11 | The storefront layout no longer wraps pages in a top-level Suspense boundary, so unknown slugs return real HTTP 404s instead of streamed soft-404s. | SEO: unknown products/posts are not indexed as 200 pages. |
| O12 | Routes that redirect or call notFound() carry no `loading.tsx` Suspense boundary (checkout, product page, category page), so redirects are real 307s and unknown slugs real 404s. | Loading skeletons stay on pages that never redirect/404 (cart, search, account). |
