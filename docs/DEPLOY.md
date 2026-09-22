# GlobeGuard shop deployment

How the merged stack (Vendure backend `globeguard-backend` + Next.js storefront `globeguard-frontend`) runs in the three environments, and the exact beta deploy recipe. Facts come from the code and from `globeguard-backend/PROJECT-CONTEXT.md` section 7 (Hetzner) and 14 (Docker); decisions from `DECISIONS.md` (A3, A8, Hetzner access).

| Environment | Where | Runtime | Purpose |
|---|---|---|---|
| Local development | this PC | portable PostgreSQL 16 in `C:\GlobeGuard\.tools`, `node dist/index.js` + `next dev` | day-to-day work, dev mailbox |
| Docker full stack | this PC (needs Docker Desktop) | `C:\GlobeGuard\docker-compose.yml` | canonical runtime (A3), integration tests, first-boot rehearsal |
| Hetzner beta | `driv.beta.globeguard.ch`, konsoleH account `drivkf` | `deploy/app.js` supervisor (socket-activated) | owner review, Mollie webhook test, pre-go-live |

## 1. Public URL layout (same for every environment)

The backend owns these path prefixes; everything else is the storefront.

| Prefix | Owner | Notes |
|---|---|---|
| `/shop-api`, `/admin-api` | Vendure | GraphQL |
| `/assets` | Vendure | product images (`ASSET_URL_PREFIX` must point here) |
| `/dashboard` | Vendure | admin UI |
| `/payments` | Vendure | Mollie webhook `POST /payments/mollie/<channelToken>/<paymentMethodId>` (`VENDURE_HOST` must point here) |
| `/bexio` | Vendure | OAuth callback, only with `BEXIO_ENABLED=true` |
| `/health` | Vendure | database (and CUPS when `CUPS_SERVER_URL` is set) |
| `/mailbox` | Vendure | dev mailbox, only when `APP_ENV` is not `production` |
| `/`, `/produkte/...`, `/api/health`, `/api/revalidate`, `/_next/...`, ... | Next.js | the storefront has no rewrites of its own |

Locally and in Docker the two are separate origins (`:3000` / `:3100`), so `VENDURE_HOST=http://localhost:3000`. On the beta the supervisor merges them behind one origin, so `VENDURE_HOST = PUBLIC_ORIGIN = https://driv.beta.globeguard.ch`.

## 2. Local development (portable PostgreSQL)

Commands and credentials are in `C:\GlobeGuard\.tools\README.md` (start/stop/status/psql; superuser `postgres`/`postgres`, database `globeguard`, port 5432). Replace with Docker Desktop whenever it is installed.

Backend (`C:\GlobeGuard\globeguard-backend`, `.env` from `.env.example` with `DB_PORT=5432`, `REDIS_DISABLED=true` unless a Redis exists, `APP_ENV=development`):

```bash
.tools/pgsql/bin/pg_ctl -D .tools/pgdata -l .tools/pg.log start     # from C:\GlobeGuard
cd globeguard-backend
npm run build:server                                                 # tsc -> dist/
SEED_CATALOG=true node dist/index.js                                 # FIRST boot on an empty DB: server alone
#   wait for "[CatalogSeeder] Catalog seed finished", stop it, then normally:
npm run dev:app                                                      # server :3000 + dashboard Vite :5173
node dist/index-worker.js                                            # worker (second terminal; never together with the first seed boot)
```

URLs: shop API `http://localhost:3000/shop-api`, dashboard `http://localhost:3000/dashboard` (Vite HMR at `:5173/dashboard/` under `dev:app`), dev mailbox `http://localhost:3000/mailbox`. `npm run dev` / `npm start` are the managed-Redis wrappers; use `dev:app` / `start:app` on a machine without Redis.

Frontend (`C:\GlobeGuard\globeguard-frontend`, `.env.local` from `.env.example` with `VENDURE_SHOP_API_URL=http://localhost:3000/shop-api`, `NEXT_PUBLIC_SITE_URL=http://localhost:3001`): `npm run dev` on `http://localhost:3001`.

Gotchas: the server and worker must never start simultaneously on an empty database (TypeORM `synchronize` race); Vendure stores asset identifiers with backslashes when images are imported on Windows (normalise with the `UPDATE asset ...` in `PROGRESS.md`); `SEED_CATALOG=true` re-upserts `data/*` on every boot and overwrites dashboard product edits.

## 3. Docker full stack

Files: `C:\GlobeGuard\docker-compose.yml` (committed template, header comment has the full recipe) and `C:\GlobeGuard\.env` copied from `C:\GlobeGuard\.env.example`. Images are built from `globeguard-backend/Dockerfile` (server + worker, `node dist/index.js` / `dist/index-worker.js`, Debian slim because of `bcrypt`) and `globeguard-frontend/Dockerfile` (standalone Next, port 3100, runtime `VENDURE_SHOP_API_URL`).

```powershell
cd C:\GlobeGuard
Copy-Item .env.example .env            # fill SUPERADMIN_*, COOKIE_SECRET, REVALIDATION_SECRET
docker compose build                   # 5-15 min
# first boot, empty database: server ALONE migrates the schema and seeds the catalog
docker compose up -d --wait postgres redis server
docker compose logs -f server          # until "[CatalogSeeder] Catalog seed finished"
docker compose up -d worker frontend   # worker runs the queued search reindex
# then .env: SEED_CATALOG=false and `docker compose up -d` once more
```

The stack runs with `APP_ENV=production` and `DB_SYNCHRONIZE=false`, so the schema comes from the baseline migration: the `server` service's command is `node dist/migrate.js && node dist/index.js`. It owns the schema alone — the worker never migrates — and a failed migration stops the container instead of starting a server against a half-migrated database (see section "Database").

Services: `postgres` (16-alpine, host port 5432), `redis` (7-alpine, optional via `REDIS_DISABLED=true`), `server` (healthcheck `GET /health`), `worker` (same image, waits for the server healthcheck, `SEED_CATALOG=false` always), `frontend` (build args `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_SITE_NAME` / `NEXT_PUBLIC_ASSET_HOST`, runtime `VENDURE_SHOP_API_URL=http://server:3000/shop-api`, `VENDURE_CHANNEL_TOKEN`, `REVALIDATION_SECRET`, healthcheck `GET /api/health`). Named volumes `postgres_data`, `redis_data`, `backend_assets` survive `docker compose down`.

Caveats:

- `APP_ENV=production` (the default in `.env.example`) disables the dev mailbox and, without `SENDGRID_API_KEY`, discards every e-mail, so registration cannot complete. Set `APP_ENV=development` in `.env` for flow tests (mailbox at `http://localhost:3000/mailbox`).
- `NEXT_PUBLIC_*` values are baked into the frontend image: change them, then `docker compose build frontend`.
- Product images are not in git; pull them from the beta with `npm run sync:product-assets` (backend repo, host `DB_*`/API at localhost) or run the importer.
- The backend repo's own `docker-compose.yml` is only the dev-deps helper (Postgres on host 6544). Both stacks bind Redis 6379: do not run both.
- `next/image` pages (product carousel, blog, order pages) fetch `ASSET_URL_PREFIX` server-side from inside the frontend container, where `localhost:3000` is not the backend. How to resolve that (hosts alias, shared hostname, unoptimized images) is decided at the first real Docker run.
- Status: `docker compose config` passes against Docker Desktop 29.8.0 (WSL2), resolved output in `docs/compose-config.out`. Building the images and the first real boot are still pending. The compose Postgres publishes host port 5432 and collides with the portable PostgreSQL — stop that one first.

## 4. Hetzner beta (konsoleH supervisor)

### 4.1 Topology (details: PROJECT-CONTEXT 7.1-7.4)

- Hetzner Managed Server MC30 `dedivirt5332.your-server.de` (178.105.47.244), Debian 13, konsoleH Node.js app (Node 24), account `drivkf`. SSH shell on port **222**; port 22 is SFTP only. The same server hosts the production WordPress account `globewp`: never touch it from the shop project.
- Managed PostgreSQL `globeguard_db` at `lqy0.your-database.de:5432`, user `globe_db`, SSL required, reachable from outside. Redis via Unix socket `/run/redis_drivkf/redis.sock`.
- Layout `~/globeguard/{app.js, backend/, frontend/}`, supervisor log `~/globeguard-node.log`.
- konsoleH socket activation: systemd hands the domain socket to `app.js`; the supervisor's first `listen()` is redirected onto it and the children get `LISTEN_*` stripped. konsoleH app settings: Arbeitsverzeichnis `globeguard`, Skript `app.js`, Node 24. Port 80 stays Apache (static + ACME).
- Children of `app.js`: backend `dist/index.js` on `:3010`, worker `dist/index-worker.js`, Next on `:8080`. Killing a child makes the supervisor respawn it (5 s x n, max 60 s; the counter resets after a minute of uptime). Killing the supervisor: systemd relaunches it on the next connection.

### 4.2 What changed for the merged stack

`deploy/app.js` is now a path-aware proxy (section 1 table) instead of forwarding everything to Next, and it starts the standalone frontend with `node server.js`. It is configured through the konsoleH app environment:

| Variable | Beta value | Note |
|---|---|---|
| `BACKEND_PORT` | `3010` | default |
| `FRONTEND_PORT` | `8080` | default |
| `PUBLIC_ORIGIN` | `https://driv.beta.globeguard.ch` | default; sets `x-forwarded-proto/-host` and the frontend's runtime `NEXT_PUBLIC_SITE_URL` |
| `FRONTEND_COMMAND` | `node server.js` | default (standalone). Legacy `next start` frontend: `node node_modules/next/dist/bin/next start` |
| `SUPERVISOR_SPAWN` | unset (`true`) | `false` = proxy only (local testing) |
| `VENDURE_CHANNEL_TOKEN`, `REVALIDATION_SECRET` | | passed through to the frontend; alternatively `~/globeguard/frontend/.env.production` (Next loads it) |

Backend env additions in `~/globeguard/backend/.env` (template `deploy/backend.env.example`; keep the quoted `#` in `DB_PASSWORD`):

```env
VENDURE_HOST=https://driv.beta.globeguard.ch       # = PUBLIC_ORIGIN: /payments/mollie/* now reaches Vendure
FRONTEND_BASE_URL=https://driv.beta.globeguard.ch
EMAIL_BASE_URL=https://driv.beta.globeguard.ch
ASSET_URL_PREFIX=https://driv.beta.globeguard.ch/assets/
MOLLIE_API_KEY=                                     # test key from the owner (A5); empty = invoice only
SENDGRID_API_KEY=                                   # empty = e-mails discarded (APP_ENV=production)
SUPPORT_EMAIL=info@globeguard.ch
BEXIO_ENABLED=false
# CUPS_SERVER_URL stays unset (would make /health 503)
```

### 4.3 Prerequisites (open, see DECISIONS.md "Hetzner access")

- `drivkf` SSH password (or the konsoleH account login to reset it). `hetzner-credentials.md` is not on this machine.
- Managed Postgres password for `globe_db` (`DB_PASSWORD` in the server `.env`, and for the dump below).
- Ability to edit the konsoleH Node.js app environment (for `PUBLIC_ORIGIN` etc.; the defaults already match the beta, so this is only needed for overrides).
- Optional: Mollie test key (A5), SendGrid key (registration on the beta needs it because `APP_ENV=production`).

The full, ordered pre-deploy list — with the complete `.env` variable table, the mandatory dump, the `SEED_CATALOG` and USD→CHF consequences and the post-deploy checks — is `globeguard-backend/deploy/beta-checklist.md`.

### 4.4 Deploying: one command (`deploy/deploy-beta.mjs`)

The whole beta deploy is a single script in the backend repo. It is pure Node (no new dependencies,
it drives the system `ssh`/`sftp` and GNU `tar`), it contains **no credentials** — the target comes
from the environment, the SSH password is typed at the prompt or replaced by `BETA_SSH_KEY`, and the
database password only ever lives in `~/globeguard/shared/backend.env` on the host.

```bash
cd C:/GlobeGuard/globeguard-backend
npm run build                                   # tsc -> dist/, vite -> dist/dashboard
# storefront built with the BETA values (4.6 has the full command):
#   NEXT_PUBLIC_SITE_URL=https://driv.beta.globeguard.ch ... npx next build && copy static/public/messages
node deploy/deploy-beta.mjs --dry-run           # contacts nothing: checks, packs, prints every remote command
node deploy/deploy-beta.mjs                     # the real deploy
```

`deploy/beta-checklist.md` is the ordered list of everything that must be true before the first run:
credentials, the full `shared/backend.env` variable table, the mandatory database dump,
`SEED_CATALOG` semantics on a database that already has products, the one-way USD→CHF price relabel,
the reindex afterwards and the `noindex` rule for the beta hostname. Read it once; the script
enforces the parts that can be enforced.

The seven steps, each logged, each guarded — on a failure at any of them the script prints the exact
rollback commands:

| Step | What it does | Guard |
|---|---|---|
| 1 preflight | backend `dist/` + `dist/dashboard/` + `static/email/templates` + `data/` + `package*.json`, storefront `.next/standalone` with `.next/static`, `public` and `messages`; resolves `ssh`/`sftp`/GNU `tar`; TCP-probes ports 222 and 22 | stops before anything is packed; refuses a storefront bundle that was **not** built with `BETA_PUBLIC_ORIGIN` (wrong canonicals + indexable `robots.txt`); warns about the Windows dashboard bundle |
| 2 package | two tarballs in the gitignored `deploy/build/`, `tar --force-local` (Windows' own `tar.exe` is bsdtar and rejects that flag, so the GNU tar from Git for Windows is preferred), excluding `node_modules`, `.env`, `.git`, `test-emails`, `backups`, `.next/cache` | SHA-256 + size report + `manifest-<stamp>.json`; the storefront tarball **keeps** its traced `node_modules` (that is the runtime tree) but drops the Windows-only `sharp` binaries |
| 3 upload | sftp (port 22) into `~/globeguard/releases/<stamp>/`: both tarballs, `deploy/app.js`, the generated remote script | one sftp session, so one password prompt |
| 4 remote install | unpack, adopt/symlink `shared/backend.env` + `shared/assets`, `npm ci --omit=dev`, **dump the database**, `node dist/migrate.js`, install Linux `sharp@0.34.5`, switch the `backend`/`frontend` symlinks | refuses to continue without `shared/backend.env` (exit 20) or without `pg_dump` for the pre-migration dump (exit 23); the previous release is kept |
| 5 restart | kills only the processes listening on `:3010` / `:8080` plus `dist/index-worker.js`, then waits for `/health` and `/api/health` | the supervisor is identified via `pgrep -f "app[.]js"` and `/proc/<pid>/cmdline` and is **never** killed; exit 22 plus the last 60 log lines if health does not come up |
| 6 verify | `/health`, a `shop-api` products query, a real asset URL, `POST /payments/mollie/x/y` (must answer Vendure JSON, not a Next 404 — proves the path-aware proxy), `/`, `/dashboard/`, `robots.txt` | any failure fails the run |
| 7 rollback | printed on failure: re-point the symlinks at `shared/previous-release`, restore `app.js.prev`, kill the children; plus how to restore the dump if a migration ran | |

Release layout it creates on the host (the supervisor contract is unchanged — `app.js` still finds
`backend/` and `frontend/` next to itself, they are just symlinks now):

```
~/globeguard/
  app.js                    the supervisor (konsoleH starts it; never killed by the script)
  backend  -> releases/<stamp>/backend
  frontend -> releases/<stamp>/frontend
  releases/<stamp>/         one per deploy, the previous one kept for rollback (BETA_KEEP_RELEASES=3)
  shared/backend.env        the real .env, symlinked into every release
  shared/frontend.env.production
  shared/assets             Vendure static/assets, survives every release
  shared/backups/           pre-migration dumps (scripts/db-backup.mjs, 10 kept)
  shared/previous-release   the rollback target
  legacy/                   a hand-deployed backend/ or frontend/ found on the first run
```

Configuration (defaults are the beta; `node deploy/deploy-beta.mjs --help` prints them all):
`BETA_SSH_HOST` `dedivirt5332.your-server.de`, `BETA_SSH_PORT` `222`, `BETA_SFTP_PORT` `22`,
`BETA_SSH_USER` `drivkf`, `BETA_REMOTE_DIR` `globeguard`, `BETA_PUBLIC_ORIGIN`
`https://driv.beta.globeguard.ch`, plus `BETA_SSH_KEY`, `BETA_BACKEND_PORT`, `BETA_FRONTEND_PORT`,
`BETA_KEEP_RELEASES`, `BETA_DB_BACKUP`, `BETA_RUN_MIGRATIONS`, `BETA_SHARP_VERSION`,
`BETA_HEALTH_TIMEOUT`, `BETA_TAR`. Flags: `--dry-run`, `--yes`, `--keep=<n>`, `--skip-verify`,
`--skip-db-backup`, `--skip-migrations`, `--allow-origin-mismatch`, `--no-sharp-fix`, `--verbose`.

Sections 4.5–4.8 are the **manual fallback**: the same operations by hand, for the case where the
script cannot run (no OpenSSH, no GNU tar) or where only one half has to be replaced.

### 4.5 Manual fallback: backend deploy

> **Layout note.** This section describes the flat, hand-deployed layout (`~/globeguard/backend`,
> env at `~/globeguard/backend/.env`). Once `deploy/deploy-beta.mjs` has run once, the host uses
> releases instead: unpack into `~/globeguard/releases/<new-stamp>/backend`, switch the
> `~/globeguard/backend` symlink, and edit the env at `~/globeguard/shared/backend.env` (which the
> release symlinks in). `~/globeguard/shared/current-release` names the live one.

Local (Git Bash, `C:\GlobeGuard\globeguard-backend`):

```bash
npm run build                                   # tsc -> dist/, vite -> dist/dashboard (dashboard i18n sync first)
tar --force-local -czf C:/GlobeGuard/backend-beta.tar.gz dist static/email/templates data package.json package-lock.json
sftp -P 22 drivkf@dedivirt5332.your-server.de   # put C:/GlobeGuard/backend-beta.tar.gz globeguard/
```

Host (SSH port 222; use `conn.shell()` channels when scripting with `ssh2`, exec channels get rate-limited):

```bash
cd ~/globeguard/backend
tar -xzf ../backend-beta.tar.gz                 # replaces dist/, templates, data/, package files
npm ci --omit=dev                               # Phase 1 added dependencies (Mollie plugin); required once per lockfile change
# add the section 4.2 keys to .env, then restart the children (the supervisor respawns them):
kill $(ss -tlnp | grep ':3010' | grep -o 'pid=[0-9]*' | cut -d= -f2); pkill -f "dist/index-worker[.]js"
tail -f ~/globeguard-node.log                   # first boot: "Catalog seed finished" only if SEED_CATALOG=true
```

Assets: `static/assets` lives on the host; after an image import on the dev machine sync it separately (tar + SFTP). A catalog reseed is a one-off `SEED_CATALOG=true PORT=3222 nohup node dist/index.js > /tmp/gg-seed.log &` with the worker stopped, killed after "Catalog seed finished" (env beats the `.env` value).

### 4.6 Manual fallback: frontend deploy (standalone bundle)

The **build** part of this section is always needed, also for `deploy/deploy-beta.mjs` — the script packages `.next/standalone`, it does not build it. The upload/extract/restart part is the fallback.

> **Layout note.** As in 4.5: after a `deploy/deploy-beta.mjs` run the frontend lives at
> `~/globeguard/releases/<stamp>/frontend` with `~/globeguard/frontend` pointing at it, not at a
> flat `~/globeguard/frontend` directory.

`NEXT_PUBLIC_*` values are baked at build time, so build with the beta values. Local (Git Bash, `C:\GlobeGuard\globeguard-frontend`):

```bash
NEXT_PUBLIC_SITE_NAME=GlobeGuard \
NEXT_PUBLIC_SITE_URL=https://driv.beta.globeguard.ch \
NEXT_PUBLIC_ASSET_HOST=driv.beta.globeguard.ch \
npm run build                                   # output: 'standalone'
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r messages .next/standalone/messages         # already traced via outputFileTracingIncludes; explicit copy is the safety net
tar --force-local -czf C:/GlobeGuard/frontend-beta.tar.gz -C .next/standalone .
sftp -P 22 drivkf@dedivirt5332.your-server.de   # put C:/GlobeGuard/frontend-beta.tar.gz globeguard/
```

Host:

```bash
cd ~/globeguard
rm -rf frontend.old; mv frontend frontend.old; mkdir frontend
tar -xzf frontend-beta.tar.gz -C frontend
cp frontend.old/.env.production frontend/ 2>/dev/null || true       # VENDURE_CHANNEL_TOKEN, REVALIDATION_SECRET (create on first deploy)
kill $(ss -tlnp | grep ':8080' | grep -o 'pid=[0-9]*' | cut -d= -f2) # Next renames itself to bare "node": find it by port
```

The supervisor respawns the frontend as `node server.js` with `PORT=8080 HOSTNAME=0.0.0.0 VENDURE_SHOP_API_URL=http://127.0.0.1:3010/shop-api NEXT_PUBLIC_SITE_URL=<PUBLIC_ORIGIN>`.

Platform gotcha: a bundle built on Windows carries only `@img/sharp-win32-x64`; Next 16 needs `sharp` for `next/image` on the Linux host. Either build on Linux (WSL2, or `docker build` the frontend image and `docker cp` `/app` out of it) or, after extracting on the host, install the Linux binaries once per deploy:

```bash
mkdir -p /tmp/sharp && cd /tmp/sharp && npm init -y >/dev/null && npm install --no-audit --no-fund sharp@0.34.5
cp -r node_modules/sharp node_modules/@img ~/globeguard/frontend/node_modules/   # adds @img/sharp-linux-x64 + libvips
```

(0.34.5 is the version currently resolved in the frontend lockfile; check `node -e "console.log(require('sharp/package.json').version)"` after dependency updates.)

### 4.7 Supervisor restart (first deploy of the new app.js, or after env changes)

```bash
pkill -f "dist/index[.]js"; pkill -f "dist/index-worker[.]js"
kill $(ss -tlnp | grep ':8080' | grep -o 'pid=[0-9]*' | cut -d= -f2)
pkill -f "app[.]js"                              # children first, then the supervisor: otherwise the new one races the old on :3010/:8080
curl -sI https://driv.beta.globeguard.ch/health   # first request re-activates the socket; 503 splash until the backend is up
```

Use bracket patterns (`app[.]js`) so `pkill -f` does not match its own SSH command line.

### 4.8 Smoke tests after every deploy

`deploy/deploy-beta.mjs` runs all of these in its step 6 and fails the deploy if one of them fails (`--skip-verify` turns that off). Run them by hand after a manual change. The ordered post-deploy list, including the parts a script cannot check (reindex, browser walkthrough, e-mail, Mollie), is `globeguard-backend/deploy/beta-checklist.md` section C.

Expected answers are the ones the proxy produced against the local backend on 2026-09-17 (section 5).

```bash
H=https://driv.beta.globeguard.ch
curl -s $H/health                                                    # {"status":"ok","info":{"database":{"status":"up"}},...}
curl -s $H/shop-api -H 'Content-Type: application/json' \
     -d '{"query":"{ products { totalItems } }"}'                     # {"data":{"products":{"totalItems":<n>}}}
curl -s $H/shop-api -H 'Content-Type: application/json' \
     -d '{"query":"{ products(options:{take:1}) { items { featuredAsset { preview } } } }"}'
curl -sI <preview URL from the previous answer>                      # HTTP 200, content-type image/*
curl -s -X POST $H/payments/mollie/x/y -d id=tr_test                 # Vendure JSON {"statusCode":5xx/4xx,...,"path":"/payments/mollie/x/y"}, NOT a Next 404 page
curl -sI $H/                                                         # 200 text/html from Next
curl -sI $H/produkte/basic                                           # 200 text/html from Next
curl -s $H/robots.txt                                                # "Disallow: /" (beta host, section 4.9)
curl -sI $H/dashboard/                                               # 200 text/html (admin login)
```

Rollback after a **scripted** deploy (4.4): `prev="$(cat ~/globeguard/shared/previous-release)"`, then `ln -sfn "releases/$prev/backend" backend` and the same for `frontend`, kill the children by port, the supervisor respawns the previous tree. The script prints these commands with the values filled in whenever it fails. After a **manual** deploy the old trees are `backend.old` / `frontend.old`: `mv frontend frontend.failed && mv frontend.old frontend`.

A code rollback does not undo a migration or the USD→CHF price relabel. For that, restore the dump from `~/globeguard/shared/backups/` (scripted deploy) or the one taken in the checklist, with `scripts/db-restore.mjs` — see the "Database" section D.5 for its guards.

### 4.9 Beta must not be indexed

`src/app/robots.ts` in the frontend is `force-dynamic` and reads `NEXT_PUBLIC_SITE_URL` at request time; a hostname containing `beta.` yields `Disallow: /` for every user agent and no sitemap. The supervisor passes `NEXT_PUBLIC_SITE_URL=<PUBLIC_ORIGIN>` to the frontend, so `https://driv.beta.globeguard.ch` is noindexed by construction. Canonicals, hreflang and the sitemap are baked at build time from the same variable, which is why the beta bundle must be built with the beta URL and the production bundle with `https://globeguard.ch` (and `PUBLIC_ORIGIN` switched accordingly).

## 5. Proxy verification record (2026-09-17, local)

`deploy/app.js` run with `PORT=3090 BACKEND_PORT=3000 FRONTEND_PORT=3091 SUPERVISOR_SPAWN=false` against the local dev backend and a stub HTTP server answering `frontend:<path>`:

| Request | Result |
|---|---|
| `GET /health` | 200, backend JSON `{"status":"ok",...}` |
| `POST /shop-api` (GraphQL) | 200, `{"data":{"products":{"totalItems":233,...}}}` |
| `GET /assets/preview/4-B_DSC_1746__05__preview.png` | 200, `image/png`, 34574 bytes of image data |
| `GET /`, `GET /produkte/basic` | 200, `frontend:/` and `frontend:/produkte/basic` (stub) |
| `POST /payments/mollie/x/y` | 500 Vendure JSON `{"statusCode":500,...,"path":"/payments/mollie/x/y"}` (reached Vendure, not the stub) |
| `POST /echo` 261 336-byte JSON, `Content-Length` and `Transfer-Encoding: chunked` | body identical byte for byte (sha256 match) in both modes |
| `/assetsfoo`, `/healthcheck`, `/dashboards`, `/api/health`, `/shop-apix` | stub (prefix match stops at path boundaries) |
| `/dashboard/`, `/health?x=1`, `/mailbox`, `/admin-api` | backend (200 / 200 / 200 / 400) |
| forwarded headers seen by the stub | `x-forwarded-for: 203.0.113.9, ::ffff:127.0.0.1`, `x-forwarded-proto: https`, `x-forwarded-host: 127.0.0.1:3090`, `Host` unchanged |
| dead upstream ports | backend path: 503 JSON `{"status":"unavailable",...}`; frontend path: 503 German splash, `retry-after: 10` |

## 6. Open items

- Beta credentials (`drivkf` SSH, `globe_db` password) before anything in section 4 can run. Everything else for the beta deploy is ready: `deploy/deploy-beta.mjs` is written and was proven with `--dry-run` (both tarballs built, remote script generated) and by running the generated remote script against a throwaway Debian container; `deploy/beta-checklist.md` lists what the owner has to supply.
- `docker compose config` + first real Docker boot; settle the `next/image` asset-host question for the container network.
- The frontend bundle for the beta is built on Windows and patched on the host: `deploy/deploy-beta.mjs` drops `@img/sharp-win32-x64` from the tarball and installs `sharp@0.34.5` on the Linux host (`--no-sharp-fix` disables it). Building on Linux stays the better answer for **production**, mainly because of the dashboard translations (4.6).
- konsoleH `PUBLIC_ORIGIN` and backend `VENDURE_HOST`/`FRONTEND_BASE_URL`/`EMAIL_BASE_URL`/`ASSET_URL_PREFIX` switch to `https://globeguard.ch` at go-live (frontend rebuilt with that `NEXT_PUBLIC_SITE_URL`), plus the go-live list in MERGE-PLAN Phase 4 (baseline migration and `synchronize: false`, SendGrid SPF/DKIM, Mollie live key, DNS).
- The proxy passes `HOSTNAME=0.0.0.0` to the frontend as specified; `FRONTEND_HOSTNAME=127.0.0.1` in the konsoleH env is the tighter choice on the shared host, since only the supervisor needs to reach `:8080`.


## Proxy hop count (rate limiter correctness)

`TRUST_PROXY_HOPS` tells Vendure how many reverse proxies sit between the client and the backend process (Express `trust proxy`). The public `trackOrder` rate limiter keys on the resulting `req.ip`, so a wrong value either throttles every visitor together (too few hops trusted) or lets clients spoof their IP (too many). Beta/Hetzner: 1 (the supervisor). Docker stack: 1 if an ingress sits in front of the server container, otherwise unset. Local dev: unset. Staging check: look up one order code from two different client IPs; both must return `null` before either is throttled.

## Database (schema policy, migrations, backup/restore)

Everything in this section lives in `globeguard-backend`. It settles the "baseline migration and `synchronize: false`" bullet in section 6: the baseline exists and is proven, what is left is running it on the beta and on production.

### D.1 Schema policy

`src/vendure-config.ts` → `dbConnectionOptions`:

```ts
const SYNCHRONIZE = process.env.DB_SYNCHRONIZE === undefined ? IS_DEV : process.env.DB_SYNCHRONIZE === 'true';
if (SYNCHRONIZE && !IS_DEV) {
  throw new Error('DB_SYNCHRONIZE=true is refused when APP_ENV=production: ...');
}
// dbConnectionOptions
synchronize: SYNCHRONIZE,
migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
```

| `DB_SYNCHRONIZE` | Effect |
|---|---|
| unset | follows `APP_ENV`: synchronize **on** in development, **off** when `APP_ENV=production` |
| `false` | off. The schema comes only from `src/migrations/*`. **This is what the beta, Docker and production set** (`deploy/backend.env.example`, `docker-compose.yml`). |
| `true` | on in development and test; **refused outright when `APP_ENV=production`** — the process throws at config load and never reaches the database. |

Two things make this a policy rather than a default:

1. **`APP_ENV` is validated against `development | test | production`** and an unknown value is a startup
   error. Otherwise a typo (`produciton`) would read as "not production", flip `IS_DEV` to true and
   synchronize a production database on the next boot — the exact accident this section exists to prevent.
2. **`DB_SYNCHRONIZE=true` plus `APP_ENV=production` throws.** Nobody can turn synchronize back on for a
   production database by setting one variable.

Both checks run at module load in `src/vendure-config.ts`, so they apply to the server, the worker and
`dist/migrate.js` alike.

TypeORM `synchronize` re-derives the schema from the entity decorators on every boot: it drops a column whose entity property disappeared, without asking, without a review step and without a way back. That is fine on a local database that can be reseeded; it is never acceptable where real orders and customers live.

`migrations` is a glob, not a list, so a newly generated file is picked up without editing the config. `__dirname` is `dist/` at runtime, so the compiled `dist/migrations/*.js` are what actually run — `npm run migrate` compiles first (`tsc && node dist/migrate.js`).

### D.2 Migrations are an explicit step, not part of boot

Vendure also supports `runMigrations(config).then(() => bootstrap(config))` inside `src/index.ts`. **This repo does not do that.** `src/index.ts` is a plain `bootstrap(config)`, `src/migrate.ts` is a separate entry point and `npm run migrate` already existed, so the explicit step is the option with the least surprise here — and the safer one on the beta, where the konsoleH supervisor respawns `dist/index.js` by itself (`deploy/app.js`): a migration inside the boot path would be retried by every respawn, and by the worker as well.

The rule is therefore: **`npm run migrate` finishes before the server process is (re)started.** `src/migrate.ts` prints the database it is about to touch (`Running migrations against <db> @ <host>:<port>`) — read that line.

In the beta recipe (section 4.5) this goes between unpacking the tarball and killing the children:

```bash
cd ~/globeguard/backend
tar -xzf ../backend-beta.tar.gz
npm ci --omit=dev
npm run db:backup                 # D.5: dump first, always
node dist/migrate.js              # dist/ is already built; `npm run migrate` would rerun tsc
kill $(ss -tlnp | grep ':3010' | grep -o 'pid=[0-9]*' | cut -d= -f2); pkill -f "dist/index-worker[.]js"
```

### D.3 The baseline migration

`src/migrations/1790095839585-baseline.ts` (generated 2026-09-22) creates the whole schema: **89 tables, 648 columns, 225 constraints, 241 indexes**, including this project's own entities (`blog`, `blog_translation`, `blog_inline_asset`, `faq_section`, `store_location`) and every custom field (`customFieldsUid`, `customFieldsVatnumber`, `customFieldsBexiocontactid`, `customFieldsBexioinvoiceid`, `customFieldsBrandgroupid`, `customFieldsTierkey`, `customFieldsCompatiblefromyear`/`Toyear`, `customFieldsSelectedbrandgroupid(s)`, `customFieldsSelectedyear`).

Two plugins are registered conditionally and are therefore **not** in the baseline:

| Flag | Tables it would add |
|---|---|
| `BEXIO_ENABLED=true` | `bexio_connection`, `bexio_sync_event` |
| `CUPS_SERVER_URL=...` | `cups_configuration` |

Both are off on the beta and in production (decision A10), which is exactly the shape the baseline was generated in. Turning either on in an environment that runs migrations needs its own generated migration first (D.4) — otherwise the plugin boots against tables that do not exist. The Bexio **custom fields** on `customer` and `order` are always registered and are already in the baseline, so that flag can be toggled without any schema change.

Generated migrations are never hand-edited. A change to an entity gets a new migration.

### D.4 Generating the next migration

`generateMigration` diffs the entity metadata against a live database and writes the difference, so the database it is pointed at decides what comes out:

- a **baseline** (the whole schema) is generated against an **empty** database;
- an **incremental** migration is generated against a database that is already at the previous migration.

Never point it at a development database that is in use, and never at production. Use a scratch database:

```bash
cd C:/GlobeGuard/globeguard-backend
PGPASSWORD=postgres ../.tools/pgsql/bin/psql -h 127.0.0.1 -U postgres -d postgres \
  -c "CREATE DATABASE globeguard_next"
npm run build:server                                            # entities must be compiled first

# bring the scratch database up to the current migrations, then diff against it
DB_NAME=globeguard_next DB_SYNCHRONIZE=false REDIS_DISABLED=true PORT=3061 node dist/migrate.js

# generate: a one-off that loads the built config with the scratch DB_NAME
node -e "process.env.DB_NAME='globeguard_next';process.env.DB_SYNCHRONIZE='false';process.env.REDIS_DISABLED='true';process.env.PORT='3061';const {generateMigration}=require('@vendure/core');generateMigration(require('./dist/vendure-config').config,{name:'what-changed',outputDir:'src/migrations'}).then(f=>{console.log(f);process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"

# compile and apply the new file, then throw the scratch database away
npm run build:server
DB_NAME=globeguard_next DB_SYNCHRONIZE=false REDIS_DISABLED=true PORT=3061 node dist/migrate.js
PGPASSWORD=postgres ../.tools/pgsql/bin/psql -h 127.0.0.1 -U postgres -d postgres \
  -c "DROP DATABASE globeguard_next"
```

`DB_NAME` from the environment wins over `.env` (dotenv does not overwrite a variable that is already set), which is what keeps the running `globeguard` database out of the way. `PORT=3061` and `REDIS_DISABLED=true` keep the one-off away from the ports and the cache of the running stack.

Known false positive: after running the migrations, `migrate.js` prints

```
Your database schema does not match your current configuration...
 - ALTER TABLE "faq_section" ALTER COLUMN "items" SET DEFAULT '[]'::jsonb
```

The column already has that default — in the migrated database *and* in the synchronize-built development database (`information_schema.columns.column_default` is `'[]'::jsonb` in both). It is TypeORM comparing `@Column({ type: 'jsonb', default: () => "'[]'::jsonb" })` with what PostgreSQL reports back, and the statement is a no-op. Do not turn it into a migration; if a generated file contains nothing but that line, delete the file.

### D.5 Backup and restore

`scripts/db-backup.mjs` and `scripts/db-restore.mjs`: plain Node, nothing beyond the standard library, `pg_dump`/`psql` located via `PG_BIN`, then `PATH`, then the workspace's portable PostgreSQL (`C:\GlobeGuard\.tools\pgsql\bin`). Connection details come from `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` in the environment or `.env`; `DB_SSL=true` sets `PGSSLMODE=require`, so the Hetzner managed PostgreSQL works unchanged. Dumps are plain SQL, gzipped in-process, written to the gitignored `backups/` folder as `<database>-<UTC timestamp>.sql.gz`.

```bash
npm run db:backup                                   # dump DB_NAME -> backups/<db>-<stamp>.sql.gz
npm run db:backup -- --list                         # what is in backups/ (no connection needed)
npm run db:backup -- --keep=10                      # dump, then keep only the 10 newest of that DB
npm run db:backup -- --db=other --out=/srv/dumps    # another database / another folder

npm run db:restore -- --list
npm run db:restore -- --db=globeguard_restore_test --create --yes    # newest dump into a new DB
npm run db:restore -- --db=globeguard --file=backups/globeguard-2026-09-22T16-56-55Z.sql.gz --yes --force
```

A backup is read-only on the source and is safe to take while the server is running. A restore is not, so it never happens implicitly:

- `--db=NAME` is **required** and is never taken from `DB_NAME`; the target is always typed out.
- `--yes` is **required**. Without it the script prints the plan (dump, target, flags) and exits 1.
- A target that already contains tables is refused unless `--force` is added too; `--force` then drops and recreates schema `public` before loading the dump.
- The load runs with `--single-transaction --set ON_ERROR_STOP=1`, so a failed restore rolls back and leaves the target as it was.

`--file` defaults to the newest dump for `--db`, otherwise the newest dump in the folder — always read the `dump` line of the printed plan before adding `--yes`.

### D.6 Rule: a dump is taken before any deploy that touches an existing database

Any deploy that runs a migration, flips `SEED_CATALOG=true`, or points a new build at a database that already holds data starts with `npm run db:backup` against that database, and the dump is still there when the deploy ends. It is the same dump section 4.4 requires before the first deploy of the merged code onto the beta, and the one the rollback path restores. Dumps contain customer data: `backups/` is gitignored, and a dump leaves the host it was taken on only over SFTP to the owner's machine.

### D.7 Verification record (2026-09-22, local)

Against the portable PostgreSQL 16 on `127.0.0.1:5432`, with the development stack on `:3000` left running throughout:

| Step | Evidence |
|---|---|
| baseline generated against the **empty** scratch database `globeguard_baseline` | `src/migrations/1790095839585-baseline.ts`: 89 `CREATE TABLE`, 250 `ALTER TABLE` |
| applied with synchronize off (`node dist/migrate.js`) | `Successfully ran migration: Baseline1790095839585`; the `migrations` table holds `Baseline1790095839585`; 90 tables (89 + `migrations`) |
| migrated schema vs. the synchronize-built `globeguard` | 648 columns identical (name, type, nullability, default); 225 constraints identical; 241 indexes identical |
| server booted against it with `DB_SYNCHRONIZE=false PORT=3061` | `Vendure server (v3.5.5) now running on port 3061`; `POST /shop-api {activeChannel{defaultCurrencyCode}}` → `{"data":{"activeChannel":{"defaultCurrencyCode":"CHF"}}}`; `GET /health` → `{"status":"ok","info":{"database":{"status":"up"}}}`; still 90 tables afterwards, so synchronize really was off |
| scratch database dropped | only `globeguard` left on the server |
| backup of the running `globeguard` | `backups/globeguard-2026-09-22T16-56-55Z.sql.gz`, 320.3 KB |
| restored into `globeguard_restore_test` | 89 tables; `product` 260 = 260, `product_variant` 272 = 272, `collection` 29 = 29, `order` 20 = 20, `customer` 7 = 7, `asset` 125 = 125 |
| guards | restore without `--yes` → exit 1; restore into a non-empty target without `--force` → exit 1; `--keep=1` pruned the older dump |
| afterwards | `:3000` still answering `{"data":{"products":{"totalItems":233}}}`, `globeguard` untouched |
