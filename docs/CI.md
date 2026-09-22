# Continuous integration

Two GitHub Actions workflows, one per repository, both at `.github/workflows/ci.yml`:

| Repository | Workflow name | Job | Budget |
|---|---|---|---|
| `globeguard-backend` | Backend CI | Typecheck, build, boot smoke | ~15 min (timeout 25) |
| `globeguard-frontend` | Frontend CI | Typecheck, lint, unit tests, build | ~8 min (timeout 15) |

Both run on `push` to `main` and on every `pull_request`, both declare
`permissions: contents: read` and nothing else, both use a per-ref concurrency group with
`cancel-in-progress: true` so a new push supersedes the run it replaces, and neither uses a
repository secret, a schedule or a matrix.

They are **quality gates, not a pipeline**. Nothing in them deploys, publishes, pushes a commit or
touches the Hetzner beta. Deployment stays the manual recipe in `DEPLOY.md`.

## 1. Backend CI

Ubuntu, Node 22 (the same major the `Dockerfile` builds on), `npm ci` with the npm cache keyed on
`package-lock.json`, and a `postgres:16` service container (`POSTGRES_DB=globeguard`,
`POSTGRES_PASSWORD=postgres`, `pg_isready` health check, published on `5432`).

| Step | Command | What it proves |
|---|---|---|
| Typecheck | `npx tsc -p tsconfig.json --noEmit` | `src/**` compiles: plugins, config, entities, resolvers. |
| Build | `NODE_ENV=production npm run build` | `tsc` emits `dist/`, and `vite build` produces the dashboard bundle — including the `lingui extract` pass over `packages/dashboard`. |
| Boot smoke | `node dist/index.js` against the service container | A cold Vendure boot on an empty database: TypeORM `synchronize` creates the whole schema from the entity decorators, the channel invariants run, `CatalogPlugin` seeds the catalogue, and the shop API answers. |

The build step deliberately runs the **full** `npm run build`, not `build:server`. Two reasons:

- `NODE_ENV=production` mirrors the `Dockerfile`, so the dashboard bundle resolves the API host as
  `auto` instead of baking in `http://localhost:3000`. A green build here is a green Docker build.
- It is the Linux proof for the dashboard translations. On Windows the upstream Vite translations
  plugin globs with backslashes and silently emits a bundle with **no** extension translations
  (`STATE.md` section 7). CI is therefore the only place the German dashboard strings are
  routinely verified to survive extraction. The step rewrites the tracked `.po` files in the
  workspace; CI never commits them, it only has to succeed.

### The boot smoke test in detail

Environment: `APP_ENV=test`, `SEED_CATALOG=true`, `REDIS_DISABLED=true`, `DB_*` pointing at the
service container, plus throwaway `COOKIE_SECRET` / `SUPERADMIN_PASSWORD` values that exist only
for the life of the job. `BEXIO_ENABLED=false` and `CUPS_SERVER_URL` unset, so neither plugin is
registered (`CUPS_SERVER_URL` would make `/health` report 503).

The step then:

1. Starts `node dist/index.js` in the background.
2. Polls `GET /health` every 5 s for up to 10 minutes, and aborts early if the process dies.
   The long window is not padding: Vendure runs `onApplicationBootstrap` — where the schema
   synchronize and the catalogue seed happen — **before** the HTTP server starts listening, so on a
   cold database `/health` is legitimately unreachable for minutes.
3. Posts `{ products { totalItems } }` to `/shop-api` and asserts `totalItems > 200`.
   `data/product-catalog.csv` carries 256 rows plus the multi-variant products in
   `data/extras.json`; the seeded local database reports 233 shop-visible products. A partial seed
   (missing data file, failed upserts, wrong tax zone) drops well below the threshold.
4. Kills the server. On any failure it prints the last 200 lines of the server log, and a final
   `if: failure()` step dumps 400 more.

No worker is started. The shop `products` query reads the database directly, so it does not depend
on the search index — the reindex job the seeder queues simply stays queued.

## 2. Frontend CI

Ubuntu, Node 22, `npm ci` with the npm cache. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set for the
install because `@playwright/test` is a devDependency whose browsers this workflow never uses.

| Step | Command | What it proves |
|---|---|---|
| Route types | `npx next typegen` | Setup, not a gate — see below. |
| Typecheck | `npx tsc --noEmit` | `src/**`, `e2e/**` and `playwright.config.ts` typecheck (`tsconfig.json` includes `**/*.ts`), including the gql.tada document types against the committed `src/graphql-env.d.ts`. |
| Lint | `npx eslint .` | `eslint-config-next/typescript` over everything outside `node_modules`, `.next`, `out`, `build`. |
| Unit tests | `npm test` (`vitest run`) | The pure domain modules under `src/lib/**`: picker, add-on plan, vehicle type, blog helpers, order-tracking and sitemap data. |
| Build | `NEXT_TELEMETRY_DISABLED=1 npm run build` | `next build` with `output: 'standalone'` succeeds **without a backend**. |

`next typegen` is there because `next-env.d.ts` and `.next/types/*` are gitignored while
`tsconfig.json` pulls both in, so a clean checkout has neither. `next typegen` writes them
(pointing at `.next/types/routes.d.ts`, the production layout) without a full build, which makes
the typecheck see what a developer sees locally. Without it, `tsc` runs with no `next` type
references at all and the result is meaningless.

The build needs no backend by construction: `src/lib/vendure/api.ts` resolves
`VENDURE_SHOP_API_URL` per request rather than at module load, and the only
`generateStaticParams` in the app returns the locale list. The `NEXT_PUBLIC_*` values passed to
the build are the `.env.example` development ones — the beta and production bundles are built with
their own `NEXT_PUBLIC_SITE_URL`, which is also what makes the beta `robots.txt` disallow
everything (`DEPLOY.md` 4.6 and 4.9).

## 3. What CI deliberately does not cover

- **End-to-end / browser tests.** The Playwright suite drives the real stack (seeded PostgreSQL,
  backend on `:3000`, standalone storefront on `:3200`). It is not part of the per-PR gate. See
  section 4.
- **Deployment.** No workflow deploys anything. `DEPLOY.md` section 4 stays a manual recipe, and it
  is blocked on owner credentials anyway (`drivkf` SSH, managed-Postgres password).
- **Secrets, scheduled runs, matrices.** None of the three exist in either workflow. There is one
  job per repository, so there is no `fail-fast` to turn off.
- **Docker image builds.** `docker build` of either image is not run. The backend build step covers
  the same `npm run build` the backend image runs, but the image layers, the frontend multi-stage
  build and the compose stack are unverified in CI.
- **The worker.** `dist/index-worker.js` is typechecked and built but never started, so job-queue
  processing, e-mail rendering and the search reindex are not exercised.
- **Payments, e-mail delivery, Bexio, CUPS.** All gated off (no Mollie key, no SendGrid key,
  `BEXIO_ENABLED=false`, no `CUPS_SERVER_URL`).
- **Migrations.** The backend still boots with `synchronize: true` and `migrations: []`. CI proves
  the schema can be created from the entities, not that a migration path from an existing database
  works. That gate has to be added together with the baseline migration before go-live.
- **Dashboard typecheck.** Only `tsconfig.json` is checked, not `tsconfig.dashboard.json`
  (`npm run typecheck` does both). The dashboard is still covered indirectly: `vite build` fails on
  a broken extension.
- **Translation drift.** The build regenerates the `.po` catalogues but CI does not fail when the
  result differs from what is committed. Adding `git diff --exit-code packages/dashboard/src/i18n`
  after the build would turn that into a gate; do it only once the catalogues are stable.

## 4. Adding the Playwright job later

A commented-out `e2e` job is already at the bottom of the frontend workflow. It is a
services-based stack rather than Docker Compose: a `postgres:16` service container plus both
repositories checked out side by side, which is the CI translation of the local recipe in
`STATE.md` section 5.

To enable it:

1. Commit `e2e/` and `playwright.config.ts` in the frontend repo (they are currently untracked).
2. Create a fine-grained personal access token with read access to the private
   `CarloUser/globeguard-backend` repository and store it as the `BACKEND_CHECKOUT_TOKEN` secret on
   the frontend repository. This is the one place the "no secrets" rule has to give way, because
   the storefront cannot check out a private sibling repository without it.
3. Uncomment the job, keeping `needs: verify` so the cheap gates still fail fast.
4. Expect roughly 25-35 minutes: two `npm ci` runs, a backend build and catalogue seed, a frontend
   build, a chromium download, then the specs.

Things to get right when you do:

- Start the backend **alone** on an empty database (`SEED_CATALOG=true`) and wait for `/health`
  before anything else; never start the worker alongside a seeding server (`synchronize` race).
- `next build` does not copy `.next/static`, `public` or `messages` into `.next/standalone`; the
  commented job copies all three, same as the local recipe.
- Never set `HOSTNAME=127.0.0.1` on the standalone server (redirect loop with next-intl) — use
  `0.0.0.0`.
- Product images are not in git. Anything asserting on a real image will fail in CI; assert on
  layout and the `next/image` request instead.
- Upload `playwright-report/` as an artifact with `if: always()`, otherwise a red run tells you
  nothing.

If the suite grows past the point where it is comfortable on every pull request, move it to
`workflow_dispatch` plus a nightly schedule rather than deleting it.

## 5. Verification status

The two workflow files were validated on the authoring machine by parsing them with `js-yaml`
(both load, with the expected `on` / `permissions` / `concurrency` / jobs / steps structure), by
`bash -n` over the extracted boot-smoke script, by executing the heredoc that writes the
`totalItems` assertion and running that assertion against both a passing (233) and a failing (12)
payload, and by checking every `run:` step against the scripts in the respective `package.json` and
the binaries in `node_modules/.bin`. The `/health` shape and the
`{ products { totalItems } }` answer used in the assertion were confirmed against the locally
running backend (233 products).

**The workflows themselves have never been executed.** GitHub Actions cannot run on this machine,
so the first real run happens on the first push and may still need small corrections — the likely
candidates are the cold-boot seed duration against the 10-minute `/health` window, and `npx eslint .`
once the untracked `e2e/` specs are committed.
