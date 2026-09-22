# GlobeGuard merge workspace

This repository is the **workspace**, not the application. It holds the shared state of the merge
of the two GlobeGuard website builds into one candidate: the running notes, the decisions, the
deploy recipes, the go-live list, and the full-stack `docker-compose.yml` that ties the two
application repositories together.

The applications live next to this file in their own git repositories, ignored here:

| Path | What it is |
|---|---|
| `globeguard-backend/` | Vendure 3.5.5 backend (shop + admin API, dashboard, plugins, Bexio, Mollie) |
| `globeguard-frontend/` | Next.js 16 storefront |

## Start here

**New machine? Read [`ONBOARDING.md`](ONBOARDING.md).** Clone, `docker compose build`, first boot,
where the URLs are, and what to do when something looks wrong. It is the whole setup in one file.

```bash
git clone <this-repo-url> GlobeGuard && cd GlobeGuard
node scripts/bootstrap.mjs     # clones the two app repos beside this file, writes .env
docker compose build
```

**Already set up?** [`docs/TODO.md`](docs/TODO.md) is the shared to-do list — read it after you
pull, update it before you push. It is how everyone sees what the others did and what is left.

**`STATE.md`** is the resume point for the project as a whole: what this project is, which of the
two source repositories is authoritative, the workspace layout, the owner's decisions, the current
status, how to start the stack, and the gotchas that cost time.

Then, as needed:

| File | Purpose |
|---|---|
| `docs/TODO.md` | **The shared to-do list** — what is open, who is on what, and what was finished by whom |
| `docs/DECISIONS.md` | Owner answers (A1–A10) and the calls made in their absence (O1–O12) |
| `docs/PROGRESS.md` | Chronological log: what was done, how it was verified, what is still open |
| `docs/DEPLOY.md` | Local dev, Docker full stack, the Hetzner beta, and the database/migration policy |
| `docs/MERGE-PLAN.md` | The plan the merge follows and the open pre-go-live questions (B1–B14) |
| `docs/CI.md` | The two GitHub Actions workflows and what they prove |
| `docs/redirect-map.md` | 203 old WooCommerce URLs mapped to the new routes |
| `docs/merge-inventory/` | The raw inventory of both source builds, taken before anything was merged |
| `ONBOARDING.md` | Clone to running stack on a new machine, plus the common failures |

## What is deliberately not here

`reference/` (the price sheets and a Bexio customer address export), `.tools/` (portable
PostgreSQL), `.env`, and the run logs under `docs/`. See `.gitignore`.
