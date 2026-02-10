# WhatsTheCraic

A monorepo for the WhatsTheCraic gigs platform: ingestion, canonical events API, personalization, and two React frontends.

## Repo Layout
- `aggregator-service` — edge API that proxies canonical events and legacy `/api/gigs`.
- `events-service` — canonical events API + ingestion + personalization scoring.
- `dj-service` — DJ directory service.
- `venue-service` — venue directory service.
- `auth-service` — email/password auth + Spotify OAuth + user preferences.
- `gigfinder-app` — primary React client.
- `gigfinder` — legacy/alternate React client (now tracked as a normal folder).
- `docs/ops-runbook.md` — deployment + verification runbook.
- `docs/migrations.md` — DB migrations.
- `init-gigsdb.sql` — local DB bootstrap data.

## Quick Start (Local)
1. Copy the env template and set values.
   - `cp .env.example .env`
   - Set `JWT_SECRET`.
   - Optional: `TICKETMASTER_API_KEY`, `EVENTBRITE_API_TOKEN`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`.
2. Start everything.
   - `docker compose up --build`
3. Verify health.
   - `curl -fsS http://localhost:4000/health`

## Services & Ports
- Aggregator: `http://localhost:4000`
- Events: `http://localhost:4003`
- DJs: `http://localhost:4002`
- Venues: `http://localhost:4001`
- Auth: `http://localhost:3001`

Health + metrics:
- `GET /health`
- `GET /metrics`

## Canonical Events API (Implemented)
- `GET /v1/events/search?city=&from=&to=&genres=&priceMax=&source=`
- `GET /v1/events/:id`
- `POST /v1/events/:id/save` (requires `Authorization: Bearer <token>`)

Personalized ranking:
- `GET /v1/events/search?rank=personalized` (requires `Authorization: Bearer <token>`)
- Returns `rank_score` and `rank_reasons` when personalization is applied.

Legacy/combined gigs:
- `GET /api/gigs` (aggregator; combines local + Ticketmaster with simple ranking)

## Feed API (Implemented)
- `GET /v1/users/me/feed` (requires `Authorization: Bearer <token>`)
- Ranked using explicit preferences + Spotify signals when available.

## Auth + Preferences (Implemented)
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/preferences`
- `POST /auth/preferences`

Preference payload supports:
- `preferred_genres`
- `preferred_artists`

## Spotify OAuth (Implemented)
- `GET /auth/spotify/login` with `Authorization: Bearer <token>`
- Browser-friendly: `GET /auth/spotify/login?token=<JWT>` (token is redacted in logs)
- `GET /auth/spotify/callback`
- `GET /auth/spotify/status`
- `GET /auth/spotify/profile`
- `POST /auth/spotify/sync`

Required env:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`

Local redirect example:
- `http://localhost:3001/auth/spotify/callback`

## Ingestion
Sources supported:
- Ticketmaster (Discovery API)
- Eventbrite (token-based)
- XRaves (scraper or direct fetch)
- Local events

Key env flags (see `.env.example`):
- `INGESTION_ENABLED=true`
- `INGESTION_DEFAULT_CITY` + `INGESTION_STALE_HOURS`
- `TICKETMASTER_API_KEY` + `TICKETMASTER_COUNTRY_CODE`
- `EVENTBRITE_API_TOKEN` + `EVENTBRITE_ORG_IDS`
- `XRAVES_ENABLED`, `XRAVES_BASE_URL`, `XRAVES_SCRAPER_URL`

Manual run (inside `events-service`):
- `npm run ingest`

## Database
- MySQL is used for DJs, venues, users, and canonical events.
- Local bootstrap: `init-gigsdb.sql`.
- Migrations: `docs/migrations.md`.

## Deployment (Current)
- Cheapest baseline is EC2 `t4g.micro` running Docker Compose.
- See `docs/ops-runbook.md` for verification and recovery steps.
- Secrets must be injected at runtime; do not commit `.env`.

## Frontends
Primary UI:
- `gigfinder-app`
- Start: `cd gigfinder-app && npm install && npm start`

Legacy/alternate UI:
- `gigfinder`
- Start: `cd gigfinder && npm install && npm start`

## Roadmap (Planned)
- Improve ranking explainability + feedback loop.
- Organizer marketplace (plans, shortlist, contact workflow).
- Production hardening: CI, tests, observability, runbooks.
- Optional infra upgrades: ECS Fargate + ALB + Aurora + S3 + SQS/SNS + DynamoDB + Route53 + Amplify.
