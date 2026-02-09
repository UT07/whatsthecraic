# Ops Runbook (Phase 0)

## Incident: Aggregator returns no Ticketmaster events
Checks:
1. Confirm `TICKETMASTER_API_KEY` is present in the running environment.
2. Check logs for rate limiting (`429`) or API errors.
3. Temporarily disable Ticketmaster by unsetting the key; aggregator will still serve local events.

## Incident: Ingestion not running
1. Verify `INGESTION_ENABLED=true` and `EVENTBRITE_API_TOKEN` / `TICKETMASTER_API_KEY` are set.
2. Check `ingest_state` table for recent sync timestamps.
3. Trigger on-demand ingest by hitting `GET /v1/events/search?city=<city>`.

## Incident: Service healthcheck failing
1. Verify container is running: `docker ps`.
2. Check service logs: `docker logs <service>`.
3. Validate DB connectivity from the service (`DB_HOST`, `DB_USER`, `DB_PASSWORD`).

## Incident: Auth signup/login failing
1. Verify `JWT_SECRET` is set.
2. Confirm `users` table exists in DB.
3. Check auth logs for validation errors.

## Incident: DB schema mismatch
1. Apply migrations in `docs/migrations.md`.
2. Restart dependent services.

## Metrics to Watch (Minimum)
- Error rate per service
- p95 latency per service
- Aggregator upstream failure rate
