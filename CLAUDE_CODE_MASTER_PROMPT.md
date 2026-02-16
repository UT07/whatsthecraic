# WhatsTheCraic — Claude Code Master Prompt

## PROJECT OVERVIEW

WhatsTheCraic is an Irish event discovery and management platform. It aggregates events from Ticketmaster, Bandsintown, Spotify, and Mixcloud, combines them with a local database of DJs and venues, and serves a personalized feed to users based on their Spotify listening habits and stated preferences. The platform also has an event organizer marketplace where promoters can plan events, shortlist DJs/venues, and send contact requests.

The goal is to make this a **world-class, professional event management website** — think Resident Advisor meets Dice.fm meets Eventbrite, but focused on the Irish music and nightlife scene. The UI should feel premium, image-rich, and data-driven.

---

## ARCHITECTURE

### Infrastructure (LIVE on AWS — DO NOT break existing deployments)
- **k3s Kubernetes** on EC2 `i-077f139e329506bf5` (t4g.small, EIP `18.200.151.2`)
- **MariaDB 10.5** on EC2 `i-0b90dcecaeadf43a2` (t4g.micro, private IP `REDACTED_DB_HOST`)
- **ECR**: `385017713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/*`
- **S3 Frontend**: `wtc-ui-385017713886-eu-west-1`
- **CloudFront**: `E2HRBT0I8G9WPY` → `whatsthecraic.run.place` + `www.whatsthecraic.run.place`
- **Route53 Zone**: `Z04190482472E3WUYYQ62`
- **API**: `api.whatsthecraic.run.place` → Traefik Ingress on k3s (Let's Encrypt TLS)
- **Auth**: `auth.whatsthecraic.run.place` → Traefik Ingress on k3s

### Microservices (all in k8s namespace `whatsthecraic`)
| Service | Port | Language | Purpose |
|---|---|---|---|
| aggregator | 4000 | Node.js/Express | Edge API gateway, proxies to all services |
| auth-service | 3001 | Node.js/Express | JWT auth, Spotify OAuth, user preferences |
| events-service | 4003 | Node.js/Express | Events CRUD, ingestion from external APIs, search, personalized feed, performers |
| dj-service | 4002 | Node.js/Express | DJ directory CRUD + CSV/XLSX import |
| venue-service | 4001 | Node.js/Express | Venue directory + availability slots |
| ml-service | 4004 | Python/FastAPI | Collaborative filtering, A/B testing, monitoring, recommendations |

### Frontend
- **React 19** + React Router 7 + Tailwind CSS 2.2 + Framer Motion
- **Chart.js** for analytics
- **Axios** for API calls
- Dark theme with Irish emerald accent (`--emerald: #00d67d`)

### Database: MySQL/MariaDB (`gigsdb`)
- Tables: users, events, event_sources, ingest_state, djs, venues, availability_slots, user_preferences, user_saved_events, user_hidden_events, alerts, organizer_plans, organizer_shortlist, contact_templates, contact_requests, ml_interactions, ab_assignments

### External APIs (keys already configured in k8s secrets)
- **Ticketmaster Discovery API** — event ingestion for Ireland (`TICKETMASTER_API_KEY`)
- **Bandsintown API** — artist-based event discovery (`BANDSINTOWN_APP_ID`)
- **Spotify Web API** — artist search, images, genres, user top artists/tracks (`SPOTIFY_CLIENT_ID/SECRET`)
- **Mixcloud API** (no auth needed) — DJ discovery, cloudcast search, genre extraction (`MIXCLOUD_ENABLED=true`)
- **Eventbrite API** — disabled currently but integration exists
- **Dice.fm via Apify** — disabled currently

### GitHub
- Repo: `UT07/whatsthecraic`
- PAT: `<redacted>` (stored in GitHub secrets)
- CI/CD: `.github/workflows/deploy.yml` uses SSM RunShellScript

### Credentials (in k8s secrets)
- DB: `REDACTED_DB_USER` / `REDACTED_DB_PASSWORD` @ `REDACTED_DB_HOST:3306/gigsdb`
- JWT_SECRET: `REDACTED_JWT_SECRET`
- TICKETMASTER_API_KEY: `OvTzrsAoD4gpLHZjvEON2Fsgnv3FhWGG`
- BANDSINTOWN_APP_ID: `5a5456e9c02c389fc71856e8f4843467`
- SPOTIFY_CLIENT_ID: `2251c81c607e4ebaa993a4e01a1a6a0b`
- SPOTIFY_CLIENT_SECRET: `4a129ffc60ba4525a059ba56f2058b99`

---

## ML & RECOMMENDATION ENGINE (CRITICAL — MUST BE SURFACED IN UI)

### Architecture Overview
There are TWO recommendation systems — one is active, one is built but **not yet wired to the frontend**:

1. **On-device scoring** (ACTIVE) — runs inside `events-service/index.js`
   - `scoreEventRow(event, userSignals)` computes a 0-1 score per event
   - Signals: user preferences, Spotify top artists/genres, saved event history, hidden events
   - Scoring weights: artist match (+5), venue match (+4), Spotify artist (+4), genre (+3), Spotify genre (+2), city (+2), budget (+1/-2), recency (+0-1), day-of-week (+1)
   - Returns `rank_score` and `rank_reasons` array per event
   - Used by `GET /v1/users/me/feed`

2. **ML Service** (BUILT but NOT called from frontend) — `ml-service/` Python/FastAPI
   - **Collaborative filtering** via scikit-learn with user-item cosine similarity
   - **Content-based filtering** via genre/artist matching
   - **Hybrid approach** — 60% collaborative + 40% content-based, with popularity fallback for cold starts
   - **A/B testing framework** — 4 variants (control/popularity, collaborative, content-based, hybrid) with consistent user hashing via DynamoDB
   - **CloudWatch monitoring** — request counts, prediction latency, feedback tracking, model metrics
   - **Prometheus `/metrics` endpoint** — ml_requests_total, ml_predictions_total, ml_errors_total, ml_prediction_latency_ms

### ML Service API Endpoints (at ml-service:4004, proxied through aggregator)
- `POST /v1/recommendations` — Get personalized recommendations (user_id, city, limit, context) → returns recommendations + model_version + ab_experiment
- `POST /v1/feedback` — Record user action (user_id, event_id, action: save/hide/click/skip, context)
- `GET /v1/model/info` — Model version, last_trained, training_samples, validation_metrics, prediction_count, avg_latency
- `POST /v1/model/retrain` — Trigger retraining, returns new version + metrics
- `GET /v1/experiments` — List active A/B experiments
- `GET /v1/experiments/{experiment_id}/results` — Per-variant conversion rates

### Training Data Sources
- `user_saved_events` (weight: +1.0) — positive signal
- `user_hidden_events` (weight: -0.5) — negative signal
- `user_preferences` (genres, artists, cities, budget)
- `user_spotify` (top_artists, top_genres from Spotify OAuth sync)
- Event features (title, city, price, genres, venue, artist)
- `ml_feedback` table for explicit feedback loop

### Spotify Integration (feeds ML)
- OAuth flow: `GET /auth/spotify/login` → Spotify → callback → store tokens
- Syncs: top 50 artists (short/medium/long term), followed artists, saved track artists, genre aggregation
- Stored in `user_spotify` table: spotify_user_id, top_artists (JSON), top_genres (JSON), last_synced_at
- Auto-refreshes expired tokens

### What IS Shown in Dashboard Currently
- Match percentage badge (e.g., "85% match") with color coding (emerald >70%, gold 40-70%, muted <40%)
- Match reason badges: "Genre match", "Artist you follow", "Favourite venue", "Your city"
- Spotify profile widget: connected status, top 5 genres, top 4 artists, sync button
- Quick stats pills: total events, artists, venues

### What is NOT Shown (NEEDS TO BE BUILT)
- **Model version & training info** — the ML model's version, when it was last trained, how many samples
- **A/B experiment variant** — user doesn't know which recommendation algorithm they're seeing
- **A/B test results dashboard** — per-variant conversion rates, user counts (admin only)
- **Algorithm explanation** — "Why am I seeing this?" per-event explainability
- **Confidence scores** — how confident the model is in each recommendation
- **Prediction latency** — how fast recommendations are served
- **CloudWatch/Prometheus metrics** — no admin ML monitoring dashboard
- **ML feedback loop** — currently only save/hide tracked; no click tracking or explicit thumbs up/down
- **Collaborative filtering results** — the ML service's collaborative model is never called from the UI
- **Recommendation quality indicators** — no visual difference between ML-ranked and popularity-ranked
- **Genre heatmap** — BetterHeatMap component exists (react-vis based) but isn't wired to real data
- **Trending analysis** — no "trending in your area" based on save velocity

### ML Dashboard Features TO BUILD
1. **"Why This?" Explainability** — click on any recommended event to see score breakdown (which factors contributed: Spotify genre match, saved history, artist follow, etc.) with a visual bar chart
2. **ML Insights Panel** on Dashboard — show "Your taste profile" radar chart (genres), "Match quality" distribution, "Discovery score" (how diverse your recommendations are)
3. **A/B Experiment Dashboard** (admin page) — conversion rates per variant, statistical significance, ability to end experiments
4. **Model Health Widget** (admin) — last trained, training samples, coverage %, avg similarity, prediction latency
5. **Recommendation Feedback** — thumbs up/down on each recommendation, feeds back to ml_feedback table via `POST /v1/feedback`
6. **Genre Heatmap** — wire BetterHeatMap to show event density by genre/day-of-week, or user preference distribution
7. **Taste Evolution** — "Your taste is evolving toward [genre]" based on recent saves vs historical
8. **Smart Notifications** — "Events matching your taste just announced" using alerts + ML scoring
9. **Click Tracking** — instrument event card clicks to feed `POST /v1/feedback` with action='click'
10. **Collaborative "Fans like you"** — actually call `POST /v1/recommendations` from the frontend and show a "Fans like you also saved" section

### ML Integration Steps
To activate the full ML pipeline in the frontend:
1. Add `mlAPI.js` service file with calls to `/v1/recommendations`, `/v1/feedback`, `/v1/model/info`, `/v1/experiments`
2. On Dashboard mount, call both `/v1/users/me/feed` (on-device scoring) AND `/v1/recommendations` (ML service) and blend or A/B test them
3. Instrument all event card interactions: save → feedback(save), hide → feedback(hide), click → feedback(click)
4. Add admin route `/admin/ml` with model health, A/B results, retraining trigger
5. Add "Why this?" modal component that shows `rank_reasons` breakdown visually

---

## KNOWN BUGS TO FIX

### 1. React Error #31 in Dashboard.jsx (CRITICAL)
**File:** `gigfinder-app/src/pages/Dashboard.jsx` around lines 220-230
**Problem:** `topGenres` from the backend returns `[{genre: "House", count: 5}, ...]` (objects), but the JSX renders `{g}` directly instead of `{g.genre}`.
**Fix:** Change `key={g}` → `key={typeof g === 'object' ? g.genre : g}` and `{g}` → `{typeof g === 'object' ? g.genre : g}` (or better yet, normalize the data once on receipt).

### 2. TLS Certificates — API endpoints may still use self-signed certs
**Problem:** Traefik ACME TLS-ALPN-01 was rate-limited by Let's Encrypt after multiple failures. The certs may have since been issued, or may still be self-signed.
**Check:** `curl -v https://api.whatsthecraic.run.place/health 2>&1 | grep "issuer"` on EC2 via SSM.
**Fix if needed:** Clear `/data/acme.json` on the Traefik pod and restart it. Ensure Ingress only has `api.` and `auth.` hosts (not root domain — that's on CloudFront).

### 3. Frontend Build & Deploy
The frontend needs to be rebuilt with fixes and deployed to S3. The build command:
```bash
cd /tmp/whatsthecraic/gigfinder-app
npm install --legacy-peer-deps
export PATH="$PWD/node_modules/.bin:$PATH"
export NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=1024"
REACT_APP_API_BASE=https://api.whatsthecraic.run.place react-scripts build
aws s3 sync build/ s3://wtc-ui-385017713886-eu-west-1/ --delete
aws cloudfront create-invalidation --distribution-id E2HRBT0I8G9WPY --paths "/*"
```
NOTE: Use `--legacy-peer-deps` because of react-vis dependency conflict. Use `--openssl-legacy-provider` for Node 18+ compatibility.

### 4. GitHub Actions Secret
`EC2_INSTANCE_ID` needs updating to `i-077f139e329506bf5` (old instance was terminated).

### 5. Code Not Committed
Changes from prior sessions (collation fix, Dashboard.jsx fix, deploy.yml health checks) haven't been pushed to GitHub. There was a `.git/index.lock` permission issue in the mounted workspace. Fix by cloning fresh on EC2 or the local dev machine.

---

## WHAT NEEDS TO BE BUILT / IMPROVED

### PRIORITY 1: Make Search Actually Work End-to-End
The backend search works (`/v1/events/search` returns results), but the frontend experience needs improvement:

1. **Default to Search mode** for unauthenticated users (currently defaults to "For You" feed which requires auth)
2. **Search should auto-trigger** when user types and hits Enter or clicks Search
3. **Show results from ALL sources** — Ticketmaster, Bandsintown, local DB, Spotify-enriched
4. **Display source badges** on each event card (Ticketmaster, local, etc.)
5. **Ensure event images display properly** — many Ticketmaster events have images; use `getBestImage()` from `utils/imageUtils.js`

### PRIORITY 2: Rich Artist/DJ Images Everywhere
The platform looks empty without images. Fix this across all pages:

1. **Event cards** — must always show an image. If the event has no image, try fetching the artist image from Spotify API. Fall back to a styled gradient placeholder with the first letter
2. **DJ cards** — local DJs currently show only gradient placeholders. When a local DJ has a Spotify or Mixcloud match, fetch and cache their image
3. **Performer cards** (DJs.jsx Discovered tab) — already shows images from Spotify/Mixcloud, but should show more performers and larger images
4. **Dashboard** — the "Upcoming Events" section should have image thumbnails
5. **Venue cards** — consider adding venue photos (could come from Google Places API in future, or manual upload)

### PRIORITY 3: Mixcloud Integration — Stream Links
Mixcloud integration already exists in the backend (`events-service/mixcloud-client.js`) and frontend (`DJs.jsx`). But improve it:

1. **Add "Listen on Mixcloud" buttons** on event cards when the performing artist has a Mixcloud profile
2. **Embed Mixcloud player** — Mixcloud has an oEmbed API. Add an expandable player on artist detail or DJ profile
3. **Show recent mixes** — when viewing a DJ, show their latest cloudcasts with play links
4. **Genre discovery** — use Mixcloud genre search to suggest DJs for specific genres the user likes

### PRIORITY 4: Professional Dashboard Redesign with ML Intelligence
The Dashboard (640 lines) needs to feel like a premium, ML-powered app homepage:

1. **Hero section** — large featured event (highest ML score) with full-width image, gradient overlay, CTA, and "98% match" badge
2. **"This Weekend" carousel** — horizontal scrollable cards for events happening this Fri-Sun, ML-ranked
3. **"Trending Near You"** — events ranked by save velocity / popularity, with trend indicators
4. **"Because You Like [Genre]"** — personalized recommendations grouped by genre affinity from Spotify + preferences
5. **"Fans Like You Also Saved"** — collaborative filtering section using `POST /v1/recommendations` from the ML service
6. **Artist spotlight** — featured artist with image, bio snippet, upcoming events, Mixcloud embed
7. **ML Taste Profile panel** — radar/spider chart of user's genre affinities (from Spotify + saved events), "Your discovery score", taste evolution over time
8. **Quick stats with ML** — total events this week, match quality distribution, events saved, "X events match your taste this week"
9. **Genre heatmap** — wire BetterHeatMap to show event density by genre/time, or user preference distribution
10. **"Why This?" explainability** — every recommended card should have expandable explanation showing score breakdown (Spotify genre +2, saved venue +4, etc.)
11. **Recommendation feedback** — thumbs up/down on each card, feeds `POST /v1/feedback`
12. **A/B variant indicator** (subtle) — show which algorithm variant the user is in, for transparency

### PRIORITY 5: Venue Page Improvements
1. **Map integration** — show venue locations on a map (Leaflet.js or Mapbox)
2. **Venue detail view** — upcoming events at this venue, capacity, amenities
3. **Venue photos** — image gallery
4. **Availability calendar** — already has backend support, wire it up properly

### PRIORITY 6: Organizer Page Polish
The Organizer page (728 lines) has event planning, shortlisting, and contacts. Improve:
1. **Better plan creation UX** — step-by-step wizard
2. **Shortlist comparison view** — side-by-side DJ/venue comparison
3. **Budget tracker** — track estimated costs
4. **Timeline view** — event planning timeline

### PRIORITY 7: Mobile Responsiveness
Ensure all pages work beautifully on mobile. The current Tailwind setup should help but needs testing and tweaks.

---

## FRONTEND FILE MAP

```
gigfinder-app/
├── src/
│   ├── App.jsx                    — Routes (dashboard, discover, djs, venues, organizer, preferences, auth)
│   ├── index.css                  — Tailwind + CSS variables (dark theme, emerald accent)
│   ├── pages/
│   │   ├── Dashboard.jsx          — Main hub (640 lines) — NEEDS REDESIGN
│   │   ├── CombinedGigs.jsx       — Event search & feed (553 lines)
│   │   ├── DJs.jsx                — Artist discovery (387 lines)
│   │   ├── Venues.jsx             — Venue search (564 lines)
│   │   ├── Organizer.jsx          — Event planning (728 lines)
│   │   ├── Preferences.jsx        — User settings (171 lines)
│   │   └── Auth/
│   │       ├── Login.jsx
│   │       ├── Signup.jsx
│   │       └── ForgotPassword.jsx
│   ├── components/
│   │   ├── Navbar.jsx             — Main nav with auth state
│   │   ├── Sidebar.jsx            — Side navigation
│   │   └── BetterHeatMap.jsx      — Analytics heatmap
│   ├── services/
│   │   ├── apiClient.js           — Axios instance + auth token management
│   │   ├── eventsAPI.js           — Events, feed, performers, alerts, organizer endpoints
│   │   ├── djAPI.js               — DJ CRUD + search
│   │   ├── venueAPI.js            — Venue CRUD + availability + search
│   │   └── authAPI.js             — Auth + Spotify + preferences
│   └── utils/
│       └── imageUtils.js          — getBestImage() for responsive image selection
```

## ML SERVICE FILE MAP
```
ml-service/
├── main.py                              — FastAPI app, routes, middleware, startup
├── src/
│   ├── config.py                        — Environment config (DB, Redis, AWS, model paths)
│   ├── models/
│   │   └── recommendation_engine.py     — Core ML: collaborative filtering, content-based, hybrid, popularity fallback
│   ├── ab_testing.py                    — A/B framework: DynamoDB-backed experiments, consistent hashing, conversion tracking
│   └── monitoring.py                    — CloudWatch + Prometheus metrics: requests, predictions, feedback, errors
├── requirements.txt                     — fastapi, scikit-learn, pandas, numpy, boto3, pymysql, redis, joblib, scipy
└── Dockerfile
```

## BACKEND API ENDPOINTS (via aggregator at api.whatsthecraic.run.place)

### Events
- `GET /v1/events/search?city=&q=&genres=&artist=&venue=&from=&to=&priceMax=&source=&limit=` — Search events
- `GET /v1/users/me/feed` — Personalized feed (requires auth)
- `GET /v1/events/:id` — Event detail
- `POST /v1/events/:id/save` — Save event
- `POST /v1/events/:id/hide` — Hide event
- `DELETE /v1/events/:id/hide` — Unhide
- `GET /v1/users/me/saved` — Saved events
- `GET /v1/users/me/hidden` — Hidden events
- `GET /v1/performers?city=&q=&include=ticketmaster,spotify,mixcloud&limit=` — Discover performers

### Alerts
- `POST /v1/alerts` — Create alert
- `GET /v1/alerts` — List alerts
- `GET /v1/alerts/notifications` — Check
- `DELETE /v1/alerts/:id` — Delete

### DJs
- `GET /djs` — All DJs
- `GET /v1/djs/search?q=&city=&genres=&feeMax=` — Search
- `POST /djs` / `PUT /djs/:id` / `DELETE /djs/:id` — CRUD

### Venues
- `GET /venues` — All venues
- `GET /v1/venues/search?q=&city=&capacity_min=&capacity_max=` — Search
- `GET /v1/venues/:id/availability` — Availability slots

### Organizer
- `POST /v1/organizer/plans` — Create plan
- `GET /v1/organizer/plans` — List plans
- `POST /v1/organizer/plans/:id/search/djs` — Search DJs for plan
- `POST /v1/organizer/plans/:id/search/venues` — Search venues
- `POST /v1/organizer/plans/:id/shortlist` — Add to shortlist
- `GET /v1/organizer/plans/:id/shortlist` — Get shortlist
- `GET /v1/organizer/plans/:id/shortlist/export?format=csv` — Export

### ML Service (via aggregator)
- `POST /v1/recommendations` — body: `{user_id, city?, limit?, context?}` → personalized recs with model_version + ab_experiment
- `POST /v1/feedback` — body: `{user_id, event_id, action: "save"|"hide"|"click"|"skip", context?}`
- `GET /v1/model/info` — model version, last_trained, training_samples, validation_metrics, prediction_count
- `POST /v1/model/retrain` — trigger retraining, returns new metrics
- `GET /v1/experiments` — list active A/B experiments with variants
- `GET /v1/experiments/:id/results` — per-variant conversion rates + user counts
- `GET /health` — model_loaded, model_version, status
- `GET /metrics` — Prometheus-format metrics

### Auth (at auth.whatsthecraic.run.place)
- `POST /auth/signup` / `POST /auth/login`
- `GET /auth/preferences` / `POST /auth/preferences`
- `GET /auth/spotify/status` / `POST /auth/spotify/sync` / `GET /auth/spotify/profile`
- `GET /auth/spotify/login?token=<JWT>` — initiate Spotify OAuth (scope: user-top-read, user-library-read, user-follow-read)

---

## STYLING GUIDE

**Theme:** Dark mode with Irish emerald accent
**Primary color:** `--emerald: #00d67d`
**Accents:** Gold `#f5a623`, Coral `#ff4757`, Sky `#4fc3f7`, Violet `#a78bfa`
**Backgrounds:** `#0a0a0a` (base), `#111` (surface), `#1a1a1a` (elevated)
**Text:** `#f5f5f5` (primary), `#a0a0a0` (muted)
**Font:** Inter
**Border radius:** 12-16px for cards, 8px for buttons
**Animations:** Framer Motion — fade-in + slide-up on card mount

**CSS Classes available:**
- `.card`, `.card-event`, `.card-artist` — card containers
- `.btn`, `.btn-primary`, `.btn-outline`, `.btn-ghost`, `.btn-sm` — buttons
- `.input` — form inputs
- `.chip`, `.chip-active` — tag chips
- `.badge` — status badges
- `.glass` — frosted glass effect
- `.section-title`, `.section-subtitle` — headings
- `.grid-events` — responsive grid for event cards
- `.tabs`, `.tab`, `.tab-active` — tab navigation
- `.skeleton` — loading skeleton
- `.line-clamp-1`, `.line-clamp-2` — text truncation

---

## DEPLOYMENT WORKFLOW

### Frontend
1. Make changes in `gigfinder-app/`
2. Build: `REACT_APP_API_BASE=https://api.whatsthecraic.run.place react-scripts build`
3. Deploy: `aws s3 sync build/ s3://wtc-ui-385017713886-eu-west-1/ --delete`
4. Invalidate: `aws cloudfront create-invalidation --distribution-id E2HRBT0I8G9WPY --paths "/*"`

### Backend (per service)
1. Build Docker image: `docker build -t whatsthecraic/<service> .`
2. Tag: `docker tag whatsthecraic/<service> 385017713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/<service>:latest`
3. Push: `docker push 385017713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/<service>:latest`
4. Restart pod: `kubectl rollout restart deployment/<service> -n whatsthecraic`

### Via SSM (for remote execution)
```bash
aws ssm send-command --instance-ids i-077f139e329506bf5 \
  --document-name AWS-RunShellScript \
  --parameters commands=["<base64-encoded-script> | base64 -d | bash"]
```

---

## COLLATION NOTE
MariaDB 10.5 does NOT support `utf8mb4_0900_ai_ci`. All DDL must use `utf8mb4_general_ci`.
This was already fixed in `events-service/index.js`, `init-gigsdb.sql`, and `backup.sql`, but watch for it in any new migrations.

---

## IMMEDIATE TODO (in priority order)

### Phase 1: Fix & Stabilize
1. Fix React Error #31 in Dashboard.jsx (topGenres object rendering)
2. Verify TLS certs are valid (not self-signed) — check and fix Traefik ACME
3. Rebuild and deploy frontend to S3 + CloudFront invalidation
4. Test search end-to-end (unauthenticated and authenticated flows)

### Phase 2: ML Integration & Intelligence
5. Create `gigfinder-app/src/services/mlAPI.js` — client for ML service endpoints (/v1/recommendations, /v1/feedback, /v1/model/info, /v1/experiments)
6. Wire ML recommendations into Dashboard — call `POST /v1/recommendations` and show "Fans Like You" section alongside the on-device feed
7. Add click tracking — instrument event card clicks to send `POST /v1/feedback` with action='click'
8. Add thumbs up/down feedback buttons on recommended events → `POST /v1/feedback`
9. Build "Why This?" explainability modal — show rank_reasons breakdown as a visual bar chart per event
10. Build ML Taste Profile panel — radar chart of genre affinities from Spotify + saved events
11. Wire BetterHeatMap to real data — genre/day-of-week event density or preference distribution
12. Build admin ML dashboard page (`/admin/ml`) — model health, A/B experiment results, retraining trigger

### Phase 3: Visual & UX Polish
13. Add rich artist images everywhere (Spotify, Mixcloud, Ticketmaster images on event cards, DJ cards, dashboard)
14. Add Mixcloud stream links and embedded players on DJ profiles
15. Redesign Dashboard as premium, ML-powered homepage (hero, carousels, trending, collaborative recs, taste profile, genre heatmap)
16. Improve mobile responsiveness across all pages
17. Add venue map integration (Leaflet.js)

### Phase 4: Deploy & Maintain
18. Commit all changes to GitHub (fix .git/index.lock first)
19. Update GitHub Actions secret `EC2_INSTANCE_ID` to `i-077f139e329506bf5`
20. Set up ML model retraining cron job (daily or weekly)
21. Rebuild and deploy all changed backend services to ECR + k8s
