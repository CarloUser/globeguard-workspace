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

**`STATE.md`** is the resume point. Read it first in a new session: what this project is, which of
the two source repositories is authoritative, the workspace layout, the owner's decisions, the
current status, how to start the stack, where to look at it, and the gotchas that cost time.

Then, as needed:

| File | Purpose |
|---|---|
| `docs/GO-LIVE.md` | Everything still open before a public launch, split into what needs the owner and what does not |
| `docs/DECISIONS.md` | Owner answers (A1–A10) and the calls made in their absence (O1–O12) |
| `docs/PROGRESS.md` | Chronological log: what was done, how it was verified, what is still open |
| `docs/DEPLOY.md` | Local dev, Docker full stack, the Hetzner beta, and the database/migration policy |
| `docs/MERGE-PLAN.md` | The plan the merge follows and the open pre-go-live questions (B1–B14) |
| `docs/CI.md` | The two GitHub Actions workflows and what they prove |
| `docs/redirect-map.md` | 203 old WooCommerce URLs mapped to the new routes |
| `docs/merge-inventory/` | The raw inventory of both source builds, taken before anything was merged |

## What is deliberately not here

`reference/` (the price sheets and a Bexio customer address export), `.tools/` (portable
PostgreSQL), `.env`, and the run logs under `docs/`. See `.gitignore`.
