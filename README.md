# WhatsTheCraic 2.0 — Dev Setup

## Overview
This repo is a monorepo for WhatsTheCraic services:
- `aggregator-service` — unified gigs feed (local + external sources)
- `events-service` — local events CRUD
- `dj-service` — DJ directory
- `venue-service` — venue directory
- `auth-service` — email/password auth (JWT)

## Local Run (Docker)
1. Copy env template and set values:
   - `cp .env.example .env`
   - Set `JWT_SECRET` (required)
   - Set `TICKETMASTER_API_KEY` (optional for Ticketmaster)
2. Start everything:
   - `docker compose up --build`

Services will be available on:
- Aggregator: `http://localhost:4000`
- Events: `http://localhost:4003`
- DJs: `http://localhost:4002`
- Venues: `http://localhost:4001`
- Auth: `http://localhost:3001`

Health checks:
- `GET /health` on each service
Metrics:
- `GET /metrics` on each service

## Environment Variables
From `./.env.example`:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `TICKETMASTER_API_KEY`
- `TICKETMASTER_COUNTRY_CODE`
- `EVENTBRITE_API_TOKEN`
- `EVENTBRITE_ORG_IDS`
- `XRAVES_ENABLED`, `XRAVES_BASE_URL`, `XRAVES_USER_AGENT`
- `VENUE_SERVICE_URL`, `DJ_SERVICE_URL`, `LOCAL_EVENTS_URL`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `TRUST_PROXY`
- `AGGREGATOR_PORT`, `DJ_SERVICE_PORT`, `EVENTS_SERVICE_PORT`, `VENUE_SERVICE_PORT`, `AUTH_SERVICE_PORT`
- `JWT_SECRET`
- `INGESTION_ENABLED`, `INGESTION_STALE_HOURS`, `INGESTION_DEFAULT_CITY`, `INGESTION_MAX_PAGES`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SPOTIFY_SCOPES`

## Architecture Notes
- MySQL is used for DJs, Venues, Local Events, and Users.
- `init-gigsdb.sql` seeds local dev data.
- Aggregator queries local services and Ticketmaster; if a source is unavailable, it returns partial results.

## Phase 1 API (Canonical Events)
- `GET /v1/events/search?city=&from=&to=&genres=&priceMax=&source=`
- `GET /v1/events/:id`
- `POST /v1/events/:id/save` (requires `Authorization: Bearer <token>` from auth-service)
Personalization:
- `GET /v1/events/search?rank=personalized` with `Authorization: Bearer <token>` will include `rank_score` and `rank_reasons`.

Spotify linking (auth-service):
- `GET /auth/spotify/login` with `Authorization: Bearer <token>`
- Browser-friendly: `GET /auth/spotify/login?token=<JWT>` (token is redacted in logs)

## Phase 2 API (Personalization)
- `GET /v1/users/me/feed` (requires `Authorization: Bearer <token>`)
- `GET /auth/preferences`
- `POST /auth/preferences`
- `GET /auth/spotify/status`
- `GET /auth/spotify/profile`
- `POST /auth/spotify/sync`
Preference payload supports:
- `preferred_genres`, `preferred_artists`, `preferred_cities`, `preferred_venues`, `preferred_djs`
- `budget_max`, `radius_km`, `night_preferences` (e.g. `weekday`, `weekend`)

## Phase 3 API (Organizer Marketplace)
- `POST /v1/organizer/plans`
- `GET /v1/organizer/plans`
- `GET /v1/organizer/plans/:id`
- `PUT /v1/organizer/plans/:id`
- `POST /v1/organizer/plans/:id/search/djs`
- `POST /v1/organizer/plans/:id/search/venues`
- `POST /v1/organizer/plans/:id/shortlist`
- `GET /v1/organizer/plans/:id/shortlist`
- `POST /v1/organizer/contact-requests`
- `GET /v1/organizer/contact-requests`
Organizer endpoints require a JWT with role `organizer` (set `role=organizer` on signup).

## Ingestion (Phase 1)
- Set `TICKETMASTER_API_KEY` and/or `EVENTBRITE_API_TOKEN`.
- Enable XRaves ingestion with `XRAVES_ENABLED=true` (permission-based).
- Set `INGESTION_ENABLED=true` to allow on-demand and scheduled ingestion.
- Default schedule uses `INGESTION_DEFAULT_CITY` and runs every `INGESTION_STALE_HOURS`.
- Manual run (inside `events-service`): `npm run ingest`

## Spotify OAuth (Phase 2)
- Set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`.
- Local dev redirect example: `http://localhost:3001/auth/spotify/callback`.
- Production requires HTTPS redirect URIs (non-localhost) and a public domain/TLS termination.
- Default scopes: `user-top-read user-read-email`.

## Deployment Notes (High-Level)
- Ensure secrets are injected at runtime (do not commit `.env`).
- Run DB migrations before rolling out new service versions.
- Configure CORS origins via `CORS_ORIGIN` (comma-separated list) on the aggregator.

## ECS Secrets (Task Definitions)
Task definition JSON files now reference SSM Parameter Store paths:
- `/whatsthecraic/prod/DB_PASSWORD`
- `/whatsthecraic/prod/TICKETMASTER_API_KEY`
- `/whatsthecraic/prod/EVENTBRITE_API_TOKEN`
- `/whatsthecraic/prod/JWT_SECRET`

Update these paths to match your environment or swap to Secrets Manager ARNs.

## Frontend
- `gigfinder-app` is a React client.
- Example env: `gigfinder-app/.env.example`
