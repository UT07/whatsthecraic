# Backlog

## P0 (Must Fix Now)
1. Rotate leaked credentials and API keys (DB + Ticketmaster).
2. Purge secrets from git history (`.env` was previously committed).
3. Add request validation + consistent error format across all services.
4. Ensure local dev is one-command (`docker compose up --build`).
5. Add missing DB tables/columns required by services (`users`, `djs.currency`).

## P1 (Next)
1. Add unit tests for core CRUD paths (events, DJs, venues, auth).
2. Add minimal integration tests that hit `/health` and a core endpoint.
3. Add request IDs and structured logs across services (JSON logging).
4. Add rate limiting to public endpoints beyond auth.
5. Add service-level config validation on startup.

## P2 (Soon)
1. Implement Eventbrite ingestion pipeline + normalization.
2. Add search endpoint `/v1/events/search` with canonical schema.
3. Add personalization v1 (preferences + ranked feed).
4. Add organizer marketplace v1 (DJs + venues + contact workflow).
5. Add monitoring hooks and alerting (ingestion failures, latency).
