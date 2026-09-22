# 301 redirect map — globeguard.ch (WooCommerce) → new storefront

Data file: [`redirect-map.json`](./redirect-map.json) — 203 entries.
Produced 2026-09-22. Regenerate/verify with the recipe in §6.

---

## 1. What this is

The current live shop at `https://globeguard.ch` is WordPress + WooCommerce + Polylang
(German at the root, an `/en/` tree for English). The replacement is the Next.js storefront in
`globeguard-frontend`, whose public routes are frozen in [`DECISIONS.md`](./DECISIONS.md) O1.

This map pairs **every URL the live site publishes in its sitemap** with a route on the new site,
so the cutover does not drop the accumulated link equity.

`redirect-map.json` is an array of:

```json
{ "from": "/produkt/globeguard-basic-ineos", "to": "/products/gg-basic-car-ineos",
  "kind": "product", "confidence": "high", "note": "…" }
```

- `from` — **path only**, no host, **no trailing slash** (except `/`). The live site serves
  everything with a trailing slash; the consumer must match both forms (see §6).
- `to` — a path on the new site. Always one of the routes frozen in O1. No route was invented.
- `kind` — `product` | `category` | `page` | `post` | `other`.
- `confidence` — `high` | `medium` | `low`.
- `note` — present wherever the choice is not self-evident.

---

## 2. How it was produced

1. **Enumerated the live site.** `https://globeguard.ch/wp-sitemap.xml` responded `200` and listed
   15 child sitemaps (posts, pages ×2 locales, products ×2, post categories, post tags,
   product categories ×2, product tags ×2, Download Monitor categories/tags, users ×2).
   All 15 were fetched sequentially with a normal desktop User-Agent and a ~1 s delay between
   requests. Every one returned `200`. **Nothing blocked us; no fallback to the old project notes
   was needed.** Total: **203 unique URLs** — under the 400-URL budget, so the enumeration is
   complete rather than truncated.

   There is no `/en/wp-sitemap-posts-post-1.xml`: the English tree has no blog posts.

2. **Read the old catalogue authoritatively.** Rather than guessing from slugs, the public
   WooCommerce Store API (`/wp-json/wc/store/v1/products?per_page=100`, one request, `200`)
   supplied the real product names and categories for all 46 product URLs. This mattered — four
   old slugs contradict their own titles (see §5).

3. **Read the new catalogue from the running backend.** `POST http://localhost:3000/shop-api`
   (`Accept-Language: de`) for products and collections. The shop API caps `take` at 100, so
   products were paginated: **233 products, 28 collections**. Product page slugs are the SKU
   lowercased, except for the four multi-variant products (`gg-sgw-lic-mercedes`,
   `gg-sgw-lic-vag`, `gg-sgw-lic-stellantis`, `gg-svc-fern`) whose slug is the SKU *prefix* and
   whose durations are variants.

4. **Matched** by product name and manufacturer/brand words, using the German names.

5. **Verified** every distinct target against the running storefront (§4).

### Mapping rules applied

| Old URL shape | Rule |
|---|---|
| `/produkt/<slug>` | → `/products/<new-slug>` when one new product succeeds it. The old site sold **variable "set" products** ("BASIC – CAR", "PRO – CARS ONE") where the brand was a dropdown; the new catalogue splits each into one product per brand group. Those have no single successor, so they map to the **collection page that lists the successors**, e.g. `/produkte/kategorie/basic-car` (49 products). |
| `/produkt-kategorie/<slug>` | → the matching new collection under `/produkte/kategorie/<slug>`, or a **tier page** (`/produkte/basic`, `/produkte/pro`) where the old category *is* a tier. |
| WordPress pages | → the matching frozen route (`/support` → `/support`, `/kontakt-neu` → `/kontakt`, `/geschaeftsbedingungen` → `/agb`, …). |
| Blog posts | → `/blog` (see §5 — no post has been migrated yet). |
| Tag / category / author archives | Bulk rule: these taxonomy archives are not reproduced on the new site. Product tags → the closest collection or tier, else `/produkte`. Post tags, post categories and author archives → `/blog`. Marked `medium`/`low` and **not** individually listed as "needs review" — the rule is deliberate, not an unresolved question. |
| `/en/…` | The same target with the `/en` prefix (`/` → `/en`). |

### Two deliberate deviations worth knowing

- **`/kasse` → `/cart`** (not `/checkout`), and likewise `/en/checkout` → `/en/cart`.
  `/checkout` requires a session — accounts are mandatory at checkout — so it answers `307` to
  `/sign-in?redirectTo=/checkout` for anonymous visitors. Redirecting the old checkout URL there
  would produce a two-hop chain that never reaches a `200`. `/cart` is a `200` for everyone and is
  the natural entry into checkout.
- **`/mein-konto` → `/sign-in`** (and `/en/my-account` → `/en/sign-in`), for the same reason:
  every `/account/*` route `307`s for anonymous visitors.

---

## 3. Counts

**203 entries.**

| kind | high | medium | low | total |
|---|---:|---:|---:|---:|
| product  | 42 |  2 |  2 | **46** |
| category | 12 |  – |  2 | **14** |
| page     | 21 |  5 |  6 | **32** |
| post     |  – |  – | 17 | **17** |
| other    |  – | 80 | 14 | **94** |
| **total** | **75** | **87** | **41** | **203** |

`other` (94) is entirely taxonomy archives that the new site does not reproduce: 63 product tags,
15 post tags, 3 post categories, 8 author archives, 5 Download Monitor taxonomy URLs.

**83 distinct targets**, all of which are routes from the frozen O1 map.

---

## 4. Sanity check — every target returns 200

Every distinct target was requested against the running standalone storefront on
`http://localhost:3200` (not a sample — the full set):

```
83 targets probed → 83 × HTTP 200, 0 failures
  32 product pages        (/products/… and /en/products/…, 16 distinct products × 2 locales)
  30 collection/tier pages (/produkte, /produkte/basic|pro|womo,
                            /produkte/kategorie/{adapter,basic-car,basic-moto,basic-womo,
                            pro-car,pro-moto,pro-trailer,pro-truck,services,software-updates,
                            zubehoer} × 2 locales)
  21 content pages        (/, /agb, /blog, /cart, /datenschutz, /faq, /impressum, /kontakt,
                            /partner, /sign-in, /support, /support/sgw + /en equivalents)
```

**One fix was applied as a result of this check.** The first pass mapped `/kasse` → `/checkout`
and `/en/checkout` → `/en/checkout`; both returned `307`. They were re-pointed to `/cart` and
`/en/cart` (reasoning in §2). After the fix the whole set is `200`.

Caveat: the probes ran against the storefront's *current* build. Re-run §6 after any route change.

---

## 5. Needs review — owner decisions

22 individually flagged entries plus the blog-post block. Each already has a safe target in the
JSON; these are the ones where a human should confirm or improve it.

### A. Products with no successor

| From | Best guess | Why unsure |
|---|---|---|
| `/produkt/globetelematics` | `/produkte` | **GlobeTelematics has no product and no collection in the new 233-product catalogue.** Either the line was discontinued or it has not been imported. If it is coming back, re-point to its future product page. |
| `/en/produkt/globetelematics-2` | `/en/produkte` | Same. |
| `/produkt-kategorie/globetelematics-de` | `/produkte` | Same, category level. |
| `/en/produkt-kategorie/globetelematics-en` | `/en/produkte` | Same, category level. |

### B. Products where the old data contradicts itself

| From | Best guess | Why unsure |
|---|---|---|
| `/en/produkt/globeguard-basic-car-update-from-2-year` | `/en/products/gg-upd-basic-car-jahr` | The live **title** says "GlobeGuard **Pro** – CAR – Update from the 2. year", but the **slug** and its German Polylang pair (`globeguard-basis-car-update-ab-2-jahr`, "BASIC") say BASIC. Mapped to BASIC. If the title is right, re-point to `/en/products/gg-upd-pro-car-jahr`. |
| `/en/produkt/__trashed-2` | `/en/products/gg-kab-ad-ts02-084` | WordPress trashed-slug artefact still published in the sitemap. The product name ("Adapter cable TRUCK – MB 14p") makes the target unambiguous; the question is whether a trashed URL deserves a redirect at all. |

Resolved by the Store API lookup, but worth a glance because the **slugs are actively misleading**
(these are mapped `high`, not listed as review items):

- `/produkt/software-update-globeguard-basic-set-truck-bus-one` — slug says BASIC, the product is
  "Software Update GlobeGuard **PRO** – TRUCK/BUS/TRAILER" → `/products/gg-upd-pro-truck-jahr`.
- `/produkt/software-update-globeguard-basic-set-motorbike-one` — slug says BASIC *update*, the
  product is "GlobeGuard **Pro** MOTORRAD – **Eine weitere Marke**" (an extension, not an update)
  → `/products/gg-pro-ext-moto`.

### C. Content pages with no equivalent route

| From | Best guess | Why unsure |
|---|---|---|
| `/videos` | `/support` | The frozen route map (O1) has no video route. If the tutorial videos are being kept, they need a home — `/support` is the closest. |
| `/en/video-en` | `/en/support` | Same. |
| `/veranstaltungen` | `/blog` | Events/trade-fair page. The new site has no events route; the trade-fair content is blog material. |
| `/en/no-access` | `/en/sign-in` | A restricted-content notice page. Sign-in is the nearest intent, but it may be better to let this one `410`. |
| `/sample-page` | `/` | WordPress' default "Sample Page". Almost certainly has no inbound links — a `410 Gone` would be cleaner than a redirect. |
| `/elementor-996` | `/` | Orphan Elementor draft/template page; its content cannot be told from the sitemap. **Please open it and say what it is** — it may be a real landing page with inbound links. |
| `/en/elementor-1329` | `/en` | Same. |
| `/en/elementor-1422` | `/en` | Same. |

### D. Affiliate programme (AffiliateWP) — no successor feature

| From | Best guess | Why unsure |
|---|---|---|
| `/affiliate-area` | `/` | The new shop has **no affiliate programme**. |
| `/affiliate-login` | `/` | Deliberately **not** sent to `/sign-in` — that is the customer account system, not the affiliate one, and landing there would confuse affiliates. If the programme is being retired, consider a `410` plus an e-mail to the affiliates. |
| `/affiliate-registration` | `/` | Deliberately **not** sent to `/register`, same reason. |

### E. Download Monitor taxonomy URLs (query strings, not paths)

| From | Best guess | Why unsure |
|---|---|---|
| `/?dlm_download_category=dokumente` | `/support` | These five are **query-string URLs on `/`**, so a plain `source` match cannot express them — they need a Next.js `has: [{type:'query', …}]` matcher (§6), and they must be ordered **before** any rule for `/`. There is also no downloads route in O1: if manuals and software are being republished, these should point there instead. |
| `/?dlm_download_category=software` | `/support` | Same. |
| `/?dlm_download_tag=downloads` | `/support` | Same. |
| `/?dlm_download_tag=dokumente` | `/support` | Same. |
| `/?dlm_download_tag=software` | `/support` | Same. |

### F. Blog posts — 17 URLs, no targets exist yet

**The new backend currently has 0 blog posts** (`blogs` query returns `totalItems: 0`), so every
old post maps to `/blog`. That is a safe parent but a real loss: these are the pages most likely to
carry external links (trade-fair coverage, the INEOS and Cape-to-Cape sponsorships).

**Recommendation: migrate the posts before cutover and re-point each entry to `/blog/<slug>`,
keeping the old slug.** The 17 URLs:

```
/oca-st-gallen                     /adventure-southside-2025
/bolliger-hausmesse-mai-2024       /adventure-southside-2025-2
/adventure-southside               /suisse-caravan-salon-2025
/suisse-caravan-salon-2024         /5-vario-treffen-2025
/f-re-e-2025                       /dubai-4x4-expo
/abenteuer-allrad-2025             /ineos-riess-globeguard
/sprintervan-festival-2026         /oca-st-gallen-2026
/aaae-messe-globeguard-live-in-australien
/stolzer-sponsor-cape-to-cape-2026-von-der-arktis-bis-nach-afrika
/abenteuer-allrad-2026
```

Note `/adventure-southside-2025` and `/adventure-southside-2025-2` are a duplicate pair on the old
site — only one needs migrating; the other should redirect to it.

---

## 6. How the map is applied

> **Done, 2026-09-22.** The map lives in the storefront repo at
> `globeguard-frontend/src/data/redirect-map.json` and `next.config.ts` turns it into 202 rules at
> build time (198 from the map + 4 for the old sitemaps). All 203 entries were verified against a
> running production build with `npm run verify:redirects`, which is the cutover check too:
>
> ```bash
> npm run verify:redirects                          # default http://localhost:3200
> npm run verify:redirects -- https://globeguard.ch  # on cutover day
> ```
>
> Three things the first implementation got wrong, all caught by that check and now guarded:
>
> 1. **Identity entries are not redirects.** Five URLs the new site kept unchanged (`/`, `/faq`,
>    `/impressum`, `/support`, `/en/cart`) are in the map as documentation. Emitted as rules they
>    redirect to themselves, and `/faq` really did return `ERR_TOO_MANY_REDIRECTS`. They are now
>    skipped, and the verifier asserts they answer **200**.
> 2. **A chained redirect fails the build.** If an entry's destination is itself another entry's
>    source, `next.config.ts` throws with the offending chain rather than shipping it.
> 3. **`statusCode: 301`, not `permanent: true`** (which is 308) — this is a search-engine
>    migration, and 301 is what every crawler and legacy client already understands.
>
> Two behaviours are expected and intentional: the trailing-slash form the old site served resolves
> in **two hops** (Next's own 308 slash-strip, then the 301), and the five Download-Monitor query
> URLs keep their query string on the way to `/support`, which the page ignores.
>
> Still open for cutover: submit `/sitemap.xml` in Search Console (section 6.2).

### 6.1 How `redirects()` is generated (for reference)

`next.config.ts` reads the JSON at build time, so the map stays the single source of truth. The
shape is:

```ts
// next.config.ts
import redirectMap from './redirect-map.json';   // copy docs/redirect-map.json into the repo

const redirects = async () =>
    redirectMap.flatMap(({from, to}) => {
        // Query-string entries (…/?dlm_download_category=x) need a `has` matcher.
        const [path, query] = from.split('?');
        if (query) {
            const [key, value] = query.split('=');
            return [{
                source: path === '/' ? '/' : path.replace(/\/$/, ''),
                has: [{type: 'query' as const, key, value}],
                destination: to,
                permanent: true,
            }];
        }
        // Match with and without the trailing slash the old site served.
        const base = path.replace(/\/$/, '');
        return base === ''
            ? []                                   // "/" → "/" is a no-op
            : [{source: base, destination: to, permanent: true}];
    });

const nextConfig: NextConfig = {
    // …existing config…
    redirects,
};
```

Notes:

- `permanent: true` emits **308** (the modern permanent redirect). If Google Search Console
  reporting is easier with a classic **301**, use `statusCode: 301` instead of `permanent`.
- Next.js normalises trailing slashes before matching (`trailingSlash` is not enabled here), so a
  single slash-less `source` catches both `/produkt/x` and `/produkt/x/`. Verify this with the
  curl loop below rather than trusting it.
- Config redirects are evaluated before the next-intl middleware, so write `to` exactly as it
  appears in the JSON — `/en/...` already carries its prefix and must not be re-prefixed.
- The five query-string rules must be emitted **before** any catch-all for `/`.

A `_redirects`/nginx-style file is equally valid if the deployment terminates in front of Next:

```bash
python - <<'PY'
import json
for e in json.load(open('docs/redirect-map.json', encoding='utf-8')):
    print('rewrite ^%s/?$ %s permanent;' % (e['from'].split('?')[0].rstrip('/') or '/', e['to']))
PY
```

### 6.2 Keep the old sitemap URL responding

**Done.** `/wp-sitemap.xml`, `/en/wp-sitemap.xml` and every child sitemap
(`/wp-sitemap-posts-product-1.xml`, `/en/wp-sitemap-taxonomies-product_cat-1.xml`, …) now 301 to
`/sitemap.xml` through two wildcard rules in `next.config.ts`. They are deliberately not in
`redirect-map.json` — they are infrastructure, not content — and the verifier checks all four
shapes on every run.

The reason it matters: Google re-fetches a submitted sitemap for a long time, and a 404 there slows
down discovery of the new URLs.

Also submit the new `/sitemap.xml` in Search Console on cutover day and keep the old property's
data for the comparison.

### 6.3 Re-verify after any route change

```bash
python - <<'PY' > /tmp/targets.txt
import json
for t in sorted({e['to'] for e in json.load(open('docs/redirect-map.json', encoding='utf-8'))}):
    print(t)
PY
tr -d '\r' < /tmp/targets.txt | while read -r t; do
    printf '%s\t%s\n' "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3200$t")" "$t"
done | grep -v '^200' || echo "all targets 200"
```

(The `tr -d '\r'` matters on Windows — Python writes CRLF to stdout and curl will otherwise
request a URL with a stray carriage return and report `000` for every target.)

Once the new site is live, run the same loop over the **`from`** side against the real host to
confirm each old URL answers `301`/`308` and lands on a `200`:

```bash
python - <<'PY' | tr -d '\r' | while read -r u; do
    printf '%s\t%s\n' "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://globeguard.ch$u")" "$u"
done
import json
for e in json.load(open('docs/redirect-map.json', encoding='utf-8')):
    print(e['from'])
PY
```
