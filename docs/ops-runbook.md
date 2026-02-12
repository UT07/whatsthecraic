# Ops Runbook (Phase 0)

## Current Baseline (Feb 9, 2026)
- Deployment target: EC2 `t4g.micro` running Docker Compose.
- Primary entrypoint: aggregator on port `4000`.
- Secrets: injected at runtime (do not commit `.env`).
- Ingestion: implemented in `events-service`, toggled by `INGESTION_ENABLED` and source-specific flags.
- Rate limiting: enforced per service via `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `TRUST_PROXY`.
- Spotify OAuth: requires HTTPS redirect URIs for non-localhost; use a domain + TLS termination.

## Deployment Verification (EC2 baseline)
Checklist:
1. Confirm the latest SSM command finished:
   `aws ssm list-command-invocations --command-id <command-id> --details`
2. If the command is stuck in `InProgress` for more than 20 minutes, check instance system logs and consider canceling, then re-run:
   `aws ssm cancel-command --command-id <command-id>`
3. Confirm containers are healthy:
   `docker ps --format "table {{.Names}}\t{{.Status}}"` 
4. Confirm health endpoints:
   `curl -fsS http://<host>:4000/health`
   `curl -fsS http://<host>:4003/health`
   `curl -fsS http://<host>:4002/health`
   `curl -fsS http://<host>:4001/health`
   `curl -fsS http://<host>:3001/health`
   `curl -fsS http://<host>:4000/metrics`
   `curl -fsS http://<host>:4003/metrics`
   `curl -fsS http://<host>:4002/metrics`
   `curl -fsS http://<host>:4001/metrics`
   `curl -fsS http://<host>:3001/metrics`
5. Confirm secrets are loaded in containers without printing values:
   `docker exec events_service sh -lc 'test -n "$TICKETMASTER_API_KEY" && echo "TICKETMASTER_API_KEY set"'`
   `docker exec events_service sh -lc 'test -n "$EVENTBRITE_API_TOKEN" && echo "EVENTBRITE_API_TOKEN set"'`
   `docker exec events_service sh -lc 'test -n "$BANDSINTOWN_APP_ID" && echo "BANDSINTOWN_APP_ID set"'`
   `docker exec events_service sh -lc 'echo "DICE_APIFY_ENABLED=$DICE_APIFY_ENABLED"'`
   `docker exec events_service sh -lc 'test -n "$APIFY_TOKEN" && echo "APIFY_TOKEN set"'`
6. Confirm rate limits are active by sending a short burst and expecting `429` after the limit.
7. Optional CI checks (local):
   - `npm run lint`
   - `npm run test:unit`

## Domain + TLS (Route53 + Caddy)
1. Create a public hosted zone in Route53 for your domain.
2. Update your registrar to use the Route53 nameservers.
3. Create A records for:
   - root domain (e.g. `whatsthecraic.run.place`) -> EC2 public IP
   - `www` -> EC2 public IP
   - `api` -> EC2 public IP
   - `auth` -> EC2 public IP
4. Caddy runs in Docker Compose and terminates TLS automatically once DNS resolves.
5. Set Spotify redirect to: `https://auth.<domain>/auth/spotify/callback`.

## Ingestion Validation (Phase 1)
1. Confirm ingestion is enabled:
   `docker exec events_service sh -lc 'echo "INGESTION_ENABLED=$INGESTION_ENABLED"'`
   `docker exec events_service sh -lc 'echo "DICE_APIFY_ENABLED=$DICE_APIFY_ENABLED"'`
   `docker exec events_service sh -lc 'echo "BANDSINTOWN_APP_ID=$BANDSINTOWN_APP_ID"'`
   `docker exec events_service sh -lc 'echo "BANDSINTOWN_SEED_ARTISTS=$BANDSINTOWN_SEED_ARTISTS"'`
2. (Optional) Set country code for Ticketmaster if city lookups are empty:
   `TICKETMASTER_COUNTRY_CODE=IE`
2. Trigger search:
   `curl -fsS "http://<host>:4000/v1/events/search?city=Dublin"`
3. Confirm response includes `events` and each event includes `sources` with entries like `ticketmaster`, `eventbrite`, `bandsintown`, `dice` (optional), or `local`.
4. Dice ingestion is optional/paid (Apify). Leave `DICE_APIFY_ENABLED=false` unless you want this source. If enabled, it uses the Apify actor (default `lexis-solutions~dice-fm`) with inputs like `query`, `type=city`, `maxItems`, `dateFrom`, `dateUntil`.
5. If Eventbrite returns `401`, refresh the OAuth token and restart `events-service`.
   If Eventbrite returns `404` on search, it may require org-scoped ingestion:
   - Set `EVENTBRITE_ORG_IDS=<comma-separated org ids>` or let the service fetch your orgs.
   If Dice ingestion returns `401` or `403`, verify `APIFY_TOKEN` and that the actor is accessible under your account.
5. Validate ingestion state in DB:
   `docker exec gigsdb sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT source, city, last_synced_at FROM ingest_state ORDER BY last_synced_at DESC LIMIT 10" gigsdb'`
6. Validate dedupe/normalize:
   `docker exec gigsdb sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT event_id, COUNT(*) AS sources FROM source_events GROUP BY event_id HAVING sources > 1 LIMIT 10" gigsdb'`

## Alerts + Calendar Exports
1. Create an alert:
   `curl -fsS -X POST http://<host>:4000/v1/alerts -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"artist_name":"Bicep","city":"Dublin"}'`
2. Check notifications:
   `curl -fsS http://<host>:4000/v1/alerts/notifications -H "Authorization: Bearer <token>"`
3. Export calendar (single event):
   `curl -fsS http://<host>:4000/v1/events/<id>/calendar`
4. Export saved calendar:
   `curl -fsS "http://<host>:4000/v1/users/me/calendar?token=<JWT>"`

## Hide Events (Personalization Feedback)
1. Hide an event:
   `curl -fsS -X POST http://<host>:4000/v1/events/<id>/hide -H "Authorization: Bearer <token>"`
2. View hidden events:
   `curl -fsS http://<host>:4000/v1/users/me/hidden -H "Authorization: Bearer <token>"`
3. Unhide an event:
   `curl -fsS -X DELETE http://<host>:4000/v1/events/<id>/hide -H "Authorization: Bearer <token>"`

## Saved Events
1. Save an event:
   `curl -fsS -X POST http://<host>:4000/v1/events/<id>/save -H "Authorization: Bearer <token>"`
2. List saved events:
   `curl -fsS http://<host>:4000/v1/users/me/saved -H "Authorization: Bearer <token>"`

## Rate Limit Enforcement
1. Aggregator defaults: `RATE_LIMIT_WINDOW_MS=60000`, `RATE_LIMIT_MAX=60`.
2. Events-service defaults: `RATE_LIMIT_WINDOW_MS=60000`, `RATE_LIMIT_MAX=120`.
3. Auth/DJ/Venue defaults: `RATE_LIMIT_WINDOW_MS=60000`, `RATE_LIMIT_MAX=120`.
4. For stricter limits, update `.env` and restart Compose.
5. Organizer contact workflow (events-service): `ORGANIZER_CONTACT_REQUEST_WINDOW_MS=3600000`, `ORGANIZER_CONTACT_REQUEST_MAX=10` (keyed by `user_id`).

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

## Product + Infra Plan (MVP to Production)
1. Stabilize and verify the new AWS deployment (cheapest-first).
2. Phase 1 ingestion + search: validate Ticketmaster/Eventbrite pulls, dedupe/normalize, and `/v1/events/search` correctness.
3. Phase 2 personalization + Spotify: OAuth, top artists/genres import, blend with explicit prefs, feed ranking.
4. Phase 3 organizer marketplace: event plan, DJ/venue search, shortlist, contact workflow.
5. Phase 4 production hardening: tests, CI, observability, runbooks.
6. Optional resume-alignment infra: ECS Fargate + ALB + Aurora + S3 + SQS/SNS + DynamoDB + Route53 + GitHub Actions + Amplify.

## Metrics to Watch (Minimum)
- Error rate per service
- p95 latency per service
- Aggregator upstream failure rate
