# Go-live to-do list

Everything still open between the current state and a public launch of the merged shop on
globeguard.ch. Work through it in any order inside a section; the sections are ordered by how much
they block everything else.

Legend: `[ ]` open, `[x]` done, `[~]` partly done (detail in the note).
**Owner** = only you can do it (credentials, business facts, legal, money).
**Assistant** = can be done without you; ask for it in a new chat.

Status of the build itself is in `STATE.md` and `PROGRESS.md`. Locked decisions are in
`DECISIONS.md`; the open pre-go-live questions from the merge plan keep their B-numbers here.

---

## 1. Blocked right now (owner input needed before anything else moves)

- [ ] **Hetzner beta credentials** (Owner). The merged stack cannot be published to
      `driv.beta.globeguard.ch` without them. Needed: the SSH password for user `drivkf` on
      `dedivirt5332.your-server.de` port 222, and the password of the managed Postgres
      `globeguard_db` on `lqy0.your-database.de`. They were in `hetzner-credentials.md` on the old
      MSI laptop; they are not on this machine and there is no SSH key here. Alternative: your
      konsoleH account login, so the password can be reset there.
      Everything else for the deploy is ready: `deploy/deploy-beta.mjs`, `deploy/beta-checklist.md`
      and the path-aware supervisor are in the backend repo.
- [ ] **Mollie account and test key** (Owner). Until `MOLLIE_API_KEY` exists, private customers see
      "no payment method available" and the checkout cannot be finished end to end. A test key is
      enough to prove the flow; the live key is a separate item in section 5.
- [ ] **GitHub destination** (Owner). Decide the repository names under `CarloUser` for the merged
      backend and frontend, and give this machine push access (no `gh` CLI and no stored git
      credentials are present). Until then both repos exist only locally, fully committed.

---

## 2. Content and legal (owner writes, assistant wires up)

- [ ] **Impressum details** (Owner): managing director, commercial register entry. The page is live
      with the verified facts and explicit placeholders for these two.
- [ ] **AGB, Datenschutz, Widerruf, Zahlungsarten, Versand** (Owner, B12). The routes exist and show
      a neutral "content is being prepared" notice plus the verified facts. Datenschutz must name
      Mollie B.V., SendGrid and Bexio as processors.
- [ ] **AGB acceptance checkbox at checkout** (Owner decision B12, then Assistant).
- [ ] **Cookie consent and analytics** (Owner decision B12). Current state: no analytics, no banner.
- [ ] **Phone number and opening hours** (Owner, B5). The footer, contact page and e-mail templates
      render the phone line only when `SUPPORT_PHONE` is set.
- [ ] **Partner workshops** (Owner content). `/partner` reads the store-locator plugin; the list is
      empty until locations are entered in the dashboard.
- [ ] **FAQ and blog content** (Owner content). Both are wired to the backend plugins; the FAQ page
      keys match the route map, so a section published in the dashboard appears immediately.
- [ ] **Migrate the 17 live blog posts** (Owner content, Assistant can import). The current site has
      17 posts (trade fairs, INEOS, the Cape-to-Cape sponsorship) and the new backend has none, so
      all 17 old URLs currently redirect to `/blog`. Keep the old slugs when importing and the
      redirects become exact.
- [ ] **GlobeTelematics** (Owner). The old site sells it (product and category page) but it is not in
      the catalogue, so those four URLs redirect to `/produkte`. Decide: discontinue, or supply SKU
      and price so it can be added.
- [ ] **Product photography and the V110 price sheet** (Owner). Current images came from the beta
      shop. The originals and the current price master are on the other laptop; the catalogue build
      script reads them from `C:/GlobeGuard/reference/`.
- [ ] **Marketing claim review** (Owner). All copy was ported from the approved old storefront, but
      a final read of `/warum-globeguard`, the home page and the tier pages is worth it.

---

## 3. Commerce configuration (mostly owner decisions, small assistant tasks)

- [ ] **Shipping rates** (Owner, B-plan item 3). Live values are placeholders: Swiss Post Priority
      15.00, Economy 9.00, Geschäftsversand 25.00, EU tracked 35.00, pickup Cham 0.00 (NET CHF).
      The bootstrap only creates methods that do not exist, so changing them in the dashboard is
      safe and permanent.
- [ ] **EU VAT strategy** (Owner, A7/B). The EU zone exists with a 0 percent placeholder rate. To
      charge EU VAT the backend also needs `AddressBasedTaxZoneStrategy` and one zone per rate.
      Decide OSS (destination country VAT) versus origin, then Assistant implements.
- [ ] **Swiss price display law** (Owner, B2). The shop shows NET prices with "zzgl. MwSt." to
      everyone. Confirm with your legal advisor that this is acceptable for private customers, or
      the display rule changes for B2C pages.
- [ ] **Invoice payment eligibility** (Owner). "Rechnung" is restricted to the customer group
      `Geschäftskunden`; somebody has to assign approved companies to that group in the dashboard.
- [ ] **Which Mollie methods** (Owner). Planned: TWINT, cards, PostFinance Pay, Apple Pay, PayPal.
      Apple Pay additionally needs domain verification on the storefront host.
- [ ] **Order number format** (Assistant, needs a nod). Currently `GG` + 6 digits, collision-checked.
- [ ] **Device and licence tracking** (Owner decision, then Assistant, B13). Gates the rule that a
      logged-in customer only sees the update they are eligible for. Until it exists, all update
      SKUs are purchasable by anyone.

---

## 4. Technical work the assistant can finish without you

- [~] **Baseline migration and synchronize policy**, backup and restore tooling. Being generated and
      verified right now; see `DEPLOY.md` section "Database" once it lands.
- [~] **CI workflows** for both repos (typecheck, lint, tests, build, backend boot smoke). Written
      in this round, pending verification. They cannot run until the repos are on GitHub.
- [~] **Parameterised beta deploy script** with a dry run, rollback and post-deploy verification.
      Written in this round, dry run pending verification; the real run needs the Hetzner password.
- [~] **End-to-end test suite** (Playwright) for the storefront flows: 8 specs written (home, BASIC
      and PRO pickers, WoMo and ELITE, cart, checkout, account/locale, tracking); the first full run
      and the independent re-run are in progress.
- [ ] **Docker full-stack first boot**: build both images, run the documented first-boot recipe,
      confirm the dashboard bundle built on Linux contains the German admin translations (a Windows
      build silently drops them).
- [x] **301 redirect map from the old WooCommerce URLs**: `redirect-map.json` (203 URLs) and
      `redirect-map.md`. All 83 distinct targets verified as 200 on the new storefront. Still to do:
      wire it into `next.config.ts` (the file has a ready-to-paste `redirects()`), keep
      `/wp-sitemap.xml` and its 15 child sitemaps responding after cutover, and handle the five
      Download-Monitor query-string URLs with a `has` matcher.
- [ ] **Product JSON-LD** on product pages (the builder exists but is not wired).
- [ ] **Accessibility and responsive pass** over the new pages (keyboard paths, contrast, 320 px to
      1440 px), with fixes.
- [ ] **Performance pass**: image sizes (the hero is a 649 KB JPEG named `.png`), font loading,
      bundle size of the configurator route.
- [ ] **Search index freshness**: the collection and search pages read Vendure's search index, so a
      reindex has to run after every catalogue import. Wire it into the seed and import scripts.
- [ ] **Redis-backed rate limiter** for the public order-tracking query before the backend ever runs
      as more than one process.
- [ ] **Beta hostname noindex check** after the first beta deploy (the storefront already returns a
      disallow-all robots.txt when the site URL contains `beta.`).

---

## 5. Cutover (do these in order on launch day)

- [ ] **Rotate every credential that travelled through chat or screenshots** (Owner): Hetzner SSH,
      managed Postgres, Vendure superadmin, cookie secret. Also rotate the values that were
      committed inside the discarded Bilregistret backend repository.
- [ ] **SendGrid** (Owner): account, API key, and SPF plus DKIM records for `globeguard.ch`. Without
      it production e-mail is silently discarded; verification and password reset then dead-end.
- [ ] **Mollie live key** (Owner) and a real 1 CHF test purchase.
- [ ] **Canonical host** (Owner, B4): apex `globeguard.ch` or `www`. The storefront and the blog
      JSON-LD must agree.
- [ ] **DNS cutover** (Owner + Assistant): lower the TTL at hosttech the day before, point the apex
      and `www` at the new stack, keep mail records untouched.
- [ ] **WooCommerce export before shutdown** (Owner): products, customers and orders, plus the
      complete URL list for the redirect map.
- [ ] **Customer migration decision** (Owner, B11): import the existing WooCommerce and Bexio
      customers, which triggers password-reset e-mails, or start fresh.
- [ ] **Google Search Console**: submit the new sitemap, keep the old sitemap URL responding.
- [ ] **Backups and monitoring** (Owner decides who owns it): schedule the database backup script,
      test one restore, decide on error tracking (for example Sentry) and uptime alerts.
- [ ] **Final gate**: `DB_SYNCHRONIZE=false` in production, `SEED_CATALOG=false`, `VENDURE_HOST`
      set to the public origin, `TRUST_PROXY_HOPS` matching the real proxy chain, `BEXIO_ENABLED`
      as decided, and the beta host left on noindex.

---

## 6. Nice to have after launch

- [ ] Header mini-cart (the old storefront had one; the new one only shows a count).
- [ ] Leaflet map on the partner page (coordinates are already fetched).
- [ ] French and Italian (B7): routing is ready, no content exists.
- [ ] Bexio live run (B): currently local-only behind `BEXIO_ENABLED`, untested against the real
      API, and re-running an order sync would create duplicate invoices.
- [ ] Blog slugs per language (O8): the backend resolves the German slug only, so de and en slugs
      must stay identical for now.
- [ ] CUPS label printing: the plugin is gated off; nothing prints labels yet.
