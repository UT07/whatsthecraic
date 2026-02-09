# WhatsTheCraic 2.0 — Dev Setup

## Overview
This repo is a monorepo for WhatsTheCraic services:
- `aggregator-service` — unified gigs feed (local + Ticketmaster)
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

## Environment Variables
From `./.env.example`:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `TICKETMASTER_API_KEY`
- `EVENTBRITE_API_TOKEN`
- `VENUE_SERVICE_URL`, `DJ_SERVICE_URL`, `LOCAL_EVENTS_URL`
- `AGGREGATOR_PORT`, `DJ_SERVICE_PORT`, `EVENTS_SERVICE_PORT`, `VENUE_SERVICE_PORT`, `AUTH_SERVICE_PORT`
- `JWT_SECRET`
- `INGESTION_ENABLED`, `INGESTION_STALE_HOURS`, `INGESTION_DEFAULT_CITY`, `INGESTION_MAX_PAGES`

## Architecture Notes
- MySQL is used for DJs, Venues, Local Events, and Users.
- `init-gigsdb.sql` seeds local dev data.
- Aggregator queries local services and Ticketmaster; if a source is unavailable, it returns partial results.

## Phase 1 API (Canonical Events)
- `GET /v1/events/search?city=&from=&to=&genres=&priceMax=&source=`
- `GET /v1/events/:id`
- `POST /v1/events/:id/save` (requires `Authorization: Bearer <token>` from auth-service)

## Ingestion (Phase 1)
- Set `TICKETMASTER_API_KEY` and/or `EVENTBRITE_API_TOKEN`.
- Set `INGESTION_ENABLED=true` to allow on-demand and scheduled ingestion.
- Default schedule uses `INGESTION_DEFAULT_CITY` and runs every `INGESTION_STALE_HOURS`.
- Manual run (inside `events-service`): `npm run ingest`

## Deployment Notes (High-Level)
- Ensure secrets are injected at runtime (do not commit `.env`).
- Run DB migrations before rolling out new service versions.
- Configure CORS origins via `CORS_ORIGIN` (comma-separated list) on the aggregator.

## Frontend
- `gigfinder-app` is a React client.
- Example env: `gigfinder-app/.env.example`
