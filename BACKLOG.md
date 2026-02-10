# Backlog

## Completed
1. Added rate limiting, request IDs, and consistent error formatting across services.
2. Implemented canonical events ingestion + search (Ticketmaster, Eventbrite).
3. Added Spotify OAuth + preference storage + personalized feed ranking.
4. Added XRaves ingestion (permission-based) with canonical normalization.
5. Added metrics endpoints (`/metrics`) across services.
6. Added organizer marketplace tables + APIs (plans, search, shortlist, contact requests).
7. Added CI smoke test workflow (Docker Compose health + metrics checks).

## P0 (Must Fix Now)
1. Rotate leaked credentials and API keys (DB + Ticketmaster).
2. Purge secrets from git history (`.env` was previously committed).
3. Ensure production secrets are injected via SSM/Secrets Manager (no `.env` on servers).

## P1 (Next)
1. Add unit tests for core CRUD paths (events, DJs, venues, auth).
2. Add service-level config validation on startup.
3. Add structured JSON logging (replace printf logs).

## P2 (Soon)
1. Add monitoring hooks + alerting (ingestion failures, latency).
2. Add cron-based ingestion runner (if not running on app nodes).
3. Add spam/fraud checks for organizer contact requests.

## Product North Star (Final Goal)
1. Personalized event discovery using user preferences + Spotify data.
2. Spotify OAuth onboarding to fetch top artists/genres.
3. Preference model that blends explicit picks + Spotify signals.
4. Ranking pipeline with explainable reasons (artist match, genre match, distance, recency).
5. Ongoing feedback loop (save/skip/like) to refine rankings.

## Optional Infra (Resume Alignment)
1. ECS Fargate + ALB path routing for 4+ services.
2. Aurora MySQL (multi-AZ) for core data.
3. S3 for raw payload storage + presigned uploads.
4. SQS → SNS notifications with idempotent processing.
5. DynamoDB for idempotency keys + lightweight user signals.
6. Route53 for custom domain + TLS.
7. GitHub Actions CI/CD for backend + infra.
8. AWS Amplify for React hosting.
9. CloudWatch metrics + autoscaling policies.
