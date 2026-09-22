# Getting the GlobeGuard shop running on a new machine

You need **Docker Desktop** and **git**. Node 22 is optional and only needed if you want to run
tests or a hot-reloading dev server outside Docker.

Everything below has been run end to end on Windows 11 with Docker Desktop 29.8.0 (WSL2).

---

## 1. Clone

The stack is three repositories that must sit **side by side in one folder**, because
`docker-compose.yml` builds the other two from relative paths:

```
GlobeGuard/                 <- this repo (docs, docker-compose.yml, the to-do list)
  globeguard-backend/       <- Vendure backend
  globeguard-frontend/      <- Next.js storefront
```

```bash
git clone <workspace-repo-url> GlobeGuard
cd GlobeGuard
node scripts/bootstrap.mjs          # clones the other two next to this file and writes .env
```

If you have no Node yet, do the same by hand:

```bash
git clone <backend-repo-url>  globeguard-backend
git clone <frontend-repo-url> globeguard-frontend
cp .env.example .env
# then edit .env: set SUPERADMIN_PASSWORD, COOKIE_SECRET and REVALIDATION_SECRET to
# long random strings of your own. Any value works locally; they are not shared secrets.
```

`.env` is gitignored and never leaves your machine.

---

## 2. First boot

```bash
docker compose build            # 5-15 min the first time: two npm ci plus three builds
```

Then, on an empty database, **start the server alone** so the catalogue seed finishes before the
worker begins indexing:

```bash
# .env: SEED_CATALOG=true
docker compose up -d --wait postgres redis server
docker compose logs -f server   # wait for "[CatalogSeeder] Catalog seed finished: created=260"
docker compose up -d worker frontend
# .env: SEED_CATALOG=false        <- important, see below
docker compose up -d
```

Every boot after that is just:

```bash
docker compose up -d --wait
```

**Set `SEED_CATALOG=false` once the first seed is done.** Left on, it re-imports `data/*` on every
boot and overwrites anything you changed in the dashboard.

| What | Where |
|---|---|
| Storefront | http://localhost:3100 |
| Admin dashboard | http://localhost:3000/dashboard (`superadmin` + your `SUPERADMIN_PASSWORD`) |
| Shop API (GraphQL) | http://localhost:3000/shop-api |
| Health | http://localhost:3000/health |

Expect 233 products, 28 collections, currency CHF, German as the default language.

---

## 3. Product images

**A fresh database has none** — the images are not in git. Pull them from the live beta once, with
the stack running:

```bash
cd globeguard-backend
npm install                                   # needs Node 22
npm run sync:product-assets -- --apply        # ~744 images for 224 of the 233 products
```

Add `--limit=5` first if you just want to see it work. The script needs `SUPERADMIN_USERNAME` and
`SUPERADMIN_PASSWORD` in its environment — the same values as in the workspace `.env`.

Nothing else to configure: `ASSET_URL_PREFIX` is the **storefront's** origin and the storefront
rewrites `/assets/*` to the backend container. That is the only arrangement where one URL works both
in the browser and inside the frontend container, where `next/image` fetches it server-side.

---

## 4. Making changes

The two application repos are ordinary git repos — commit and push in them as usual. Read each
repo's own `CLAUDE.md` for the rules that apply inside it (they are short and worth the five
minutes: German-first copy, NET CHF prices, where the frozen business logic lives).

After changing **backend** code:

```bash
docker compose build server && docker compose up -d server worker
```

After changing **frontend** code:

```bash
docker compose build frontend && docker compose up -d frontend
```

For day-to-day storefront work the Docker rebuild is too slow. Run the storefront outside Docker
against the Dockerised backend instead — hot reload, same data:

```bash
cd globeguard-frontend
npm install
VENDURE_SHOP_API_URL=http://localhost:3000/shop-api npm run dev    # http://localhost:3001
```

### Before you push

```bash
cd globeguard-frontend && npm run check      # typecheck (app + e2e), lint, build
npm test                                     # 115 unit tests
npm run test:e2e                             # 16 Playwright specs, needs a running stack
npm run audit:a11y                           # structural accessibility of 12 pages
npm run verify:redirects                     # the 203 old WooCommerce URLs

cd ../globeguard-backend && npx tsc -p tsconfig.json --noEmit && npm run build
```

The e2e, a11y and redirect checks run against `http://localhost:3200` by default. Point them at the
Docker storefront with `E2E_BASE_URL=http://localhost:3100` / by passing the URL as an argument.

---

## 5. The database

Schema changes come from migrations, never from TypeORM synchronize — the server container runs
`node dist/migrate.js` before it starts, and `DB_SYNCHRONIZE=true` with `APP_ENV=production` is
refused outright. If you change an entity, generate a migration: `docs/DEPLOY.md` section D.4.

```bash
cd globeguard-backend
npm run db:backup                 # -> backups/<db>-<stamp>.sql.gz (gitignored)
npm run db:restore -- --list
```

Backups hold customer data. They are gitignored and excluded from the Docker image; keep them off
shared drives.

Starting over completely:

```bash
docker compose down -v            # -v also drops the database and uploaded assets
```

---

## 6. When something looks wrong

| Symptom | Cause |
|---|---|
| `port 5432 already in use` | Another Postgres is running. Stop it, or change the published port in `docker-compose.yml`. |
| Registration never sends an e-mail | `APP_ENV=production` discards mail without a SendGrid key. Set `APP_ENV=development` in `.env` and read the mailbox at http://localhost:3000/mailbox. |
| Listing pages show old products or old images | The collection and search pages read Vendure's search index, not the tables. `cd globeguard-backend && npm run reindex`. |
| Product images 400 | `ASSET_URL_PREFIX` must be the storefront origin (`http://localhost:3100/assets/`), not the backend one. |
| Images load but are huge | `next/image` serves originals when sharp cannot load — it does not error. Inside Docker this works; outside, see `globeguard-frontend/CLAUDE.md`. |
| Checkout has no payment method | Expected: there is no Mollie key yet. Everything up to the payment step works. |
| `npm ci` fails on `@swc/helpers` | Your npm is newer than the images'. Regenerate the lockfile with the image's npm — `docs/DEPLOY.md` covers it. |

---

## 7. Where to read next

| File | What it is |
|---|---|
| `STATE.md` | The running state of the project: what is done, what is next, the gotchas |
| `docs/TODO.md` | **The shared to-do list.** Read it before starting, update it when you finish |
| `docs/DECISIONS.md` | Decisions already locked — check here before changing behaviour |
| `docs/DEPLOY.md` | The three environments, the database policy, the beta deploy |
| `docs/PROGRESS.md` | Chronological log of what was done and how it was verified |
