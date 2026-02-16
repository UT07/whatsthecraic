# WhatsTheCraic: Multi-Agent Transformation Design

**Date:** 2026-02-15
**Status:** Approved
**Approach:** Domain-Based Parallelization with Progressive Waves
**Scope:** All 4 Phases (Fix & Stabilize, ML Integration, Visual Polish, Deploy & Maintain)

---

## Executive Summary

Transform WhatsTheCraic from a basic event platform into a world-class, ML-powered event discovery experience using 5 specialized subagents working collaboratively across 3 progressive waves. The goal is to surface the existing ML recommendation engine in the UI, add comprehensive visual polish with rich images and Mixcloud integration, build an admin ML dashboard, and deploy everything to production with comprehensive verification.

**Timeline:** ~6-7 hours for all phases
**Deployment:** Development branch → comprehensive testing → staged production rollout
**Risk Mitigation:** Progressive waves, shared coordination, comprehensive verification before production

---

## 1. Architecture Overview

### Git Workflow

```
master (protected, live production)
  └── dev/phase-1-4-complete (main development branch)
       ├── worktree-backend-api (Agent 1)
       ├── worktree-ml-intelligence (Agent 2)
       ├── worktree-frontend-core (Agent 3)
       ├── worktree-visual-media (Agent 4)
       └── worktree-admin-devops (Agent 5)
```

### Collaborative Coordination Model

Subagents coordinate through:

1. **Shared Coordination File** - `docs/agent-coordination.md`
   - Each agent logs progress, exposes contracts, notes blockers
   - Example: ML Agent writes "ML API contract ready", Frontend Agent reads and integrates

2. **Shared Task Board** - Real-time task management via TaskCreate/TaskUpdate
   - Agents claim tasks, mark dependencies, update status
   - Visibility into "Task X blocks Task Y"

3. **Git-Based Coordination**
   - Agents view each other's branches/commits
   - Progressive integration: Agent B starts after Agent A commits foundational work

4. **Orchestrator (Main Agent) as Coordinator**
   - Launch agents in strategic waves (not all at once)
   - Pass outputs from earlier agents as inputs to later ones
   - Monitor progress and trigger next wave when dependencies clear

### Progressive Wave Strategy

**Wave 1 (Foundation)** - 2 agents:
- Backend & API Agent → Fix TLS, verify endpoints, ensure ML service ready
- ML Intelligence Agent → Build mlAPI.js, expose ML contract

*Checkpoint: Verify ML API contract and backend health*

**Wave 2 (Integration & Features)** - 3 agents:
- Frontend Core Agent → Fix bugs, integrate ML API, rebuild search flow
- Visual & Media Agent → Rich images, Mixcloud integration
- Admin & DevOps Agent → Admin dashboard, CI/CD prep

*These agents use the ML API and verified backend from Wave 1*

**Wave 3 (Polish & Deploy)** - 2 agents continue:
- Frontend Core Agent → Dashboard redesign, mobile polish
- Admin & DevOps Agent → Deployment scripts, cron jobs, final merge

### Domain Boundaries

```
Frontend Core:      gigfinder-app/src/pages/, gigfinder-app/src/components/
ML Intelligence:    gigfinder-app/src/services/mlAPI.js, ml-service/, Dashboard ML features
Visual & Media:     Image handling across all pages, Mixcloud integration
Backend & API:      events-service/, auth-service/, aggregator-service/, TLS/certs
Admin & DevOps:     Admin pages, GitHub Actions, k8s configs, deployment scripts
```

**Benefits:**
- ✅ Agents build on each other's work instead of working in silos
- ✅ Natural dependency flow (backend → ML API → frontend integration)
- ✅ Lower integration risk (progressive testing at each wave)
- ✅ Shared context through coordination file and task board

---

## 2. Agent Specifications

### Wave 1: Foundation Agents

#### **Agent 1: Backend & API Agent** 🔧
**Worktree:** `worktree-backend-api`
**Primary Files:** `events-service/`, `auth-service/`, `aggregator-service/`, `k8s/`

**Tasks:**
1. Verify TLS certificates on Traefik (check ACME, fix if self-signed)
2. Verify ML service endpoints are accessible and healthy (`/v1/recommendations`, `/v1/feedback`, `/v1/model/info`, `/v1/experiments`)
3. Test backend API integration points (ensure aggregator proxies ML service correctly)
4. Fix any backend bugs discovered during verification
5. Run backend smoke tests

**Deliverables:**
- Backend health report (TLS status, endpoint verification)
- ML service API documentation (contracts for Frontend/ML agents)
- Backend test results

**Skills:**
- `superpowers:systematic-debugging` (for any backend issues)
- `superpowers:verification-before-completion` (verify all endpoints work)

**Coordination:**
- Writes "Backend Ready ✅" to `docs/agent-coordination.md`
- Exposes ML service endpoint documentation for other agents

---

#### **Agent 2: ML Intelligence Agent** 🤖
**Worktree:** `worktree-ml-intelligence`
**Primary Files:** `gigfinder-app/src/services/mlAPI.js`, `ml-service/`, Dashboard ML features

**Tasks:**
1. Create `gigfinder-app/src/services/mlAPI.js` - Client for ML service endpoints
   - `getRecommendations(userId, city, limit, context)`
   - `sendFeedback(userId, eventId, action, context)`
   - `getModelInfo()`
   - `triggerRetrain()`
   - `getExperiments()`
   - `getExperimentResults(experimentId)`

2. Wire ML recommendations into Dashboard - Call `getRecommendations()` and display "Fans Like You" section
3. Add click tracking - Instrument event card clicks → `sendFeedback(action='click')`
4. Add thumbs up/down feedback buttons on recommended events
5. Build "Why This?" explainability modal - Show `rank_reasons` breakdown as visual bar chart
6. Build ML Taste Profile panel - Radar chart of genre affinities from Spotify + saved events
7. Wire BetterHeatMap to real data - Genre/day-of-week event density

**Deliverables:**
- `mlAPI.js` service client (contract exposed for Frontend Agent)
- ML features integrated into Dashboard
- Explainability modal component
- Taste profile radar chart component
- Genre heatmap wired to data

**Skills:**
- `superpowers:test-driven-development` (for mlAPI.js client)
- `superpowers:brainstorming` (for designing ML UI components)
- `superpowers:verification-before-completion` (verify ML endpoints work end-to-end)
- `figma:implement-design` (if Figma designs exist)

**Coordination:**
- Depends on: Backend Agent confirming ML service endpoints work
- Exposes: ML API contract to `docs/agent-coordination.md`
- Used by: Frontend Agent, Admin Agent

---

### Wave 2: Integration & Features Agents

#### **Agent 3: Frontend Core Agent** 🎨
**Worktree:** `worktree-frontend-core`
**Primary Files:** `gigfinder-app/src/pages/Dashboard.jsx`, `CombinedGigs.jsx`, `Preferences.jsx`

**Tasks:**
1. Fix React Error #31 in Dashboard.jsx (topGenres object rendering)
2. Improve search flow - Default to Search mode for unauthenticated users, auto-trigger search
3. Integrate ML API client (from ML Agent) - Use `mlAPI.getRecommendations()` in Dashboard
4. Display ML features (explainability modal, taste profile panel from ML Agent)
5. Redesign Dashboard as premium ML-powered homepage:
   - Hero section with highest-scored event
   - "This Weekend" carousel
   - "Trending Near You" section
   - "Because You Like [Genre]" personalized sections
   - "Fans Like You Also Saved" (collaborative filtering)
   - Artist spotlight with Mixcloud embed (from Visual Agent)
   - Quick stats with ML quality indicators
6. Mobile responsiveness - Ensure all pages work beautifully on mobile
7. Rebuild and deploy frontend to S3 + CloudFront invalidation

**Deliverables:**
- Dashboard.jsx bug fixed
- Search flow improved
- Premium Dashboard redesign complete
- Mobile-responsive UI
- Frontend deployed to S3

**Skills:**
- `superpowers:systematic-debugging` (for React bug)
- `superpowers:test-driven-development` (for Dashboard fixes)
- `superpowers:brainstorming` (for Dashboard redesign)
- `superpowers:verification-before-completion` (verify build/deploy)
- `figma:implement-design` (for premium UI)

**Coordination:**
- Depends on: ML Agent's mlAPI.js client and ML components
- Depends on: Visual Agent's image utilities and Mixcloud components
- Uses: Backend Agent's verified endpoints

---

#### **Agent 4: Visual & Media Agent** 🖼️
**Worktree:** `worktree-visual-media`
**Primary Files:** Image handling across pages, Mixcloud integration, `utils/imageUtils.js`

**Tasks:**
1. Add rich artist images everywhere:
   - Event cards: Fetch artist image from Spotify if event has no image
   - DJ cards: Fetch Spotify/Mixcloud images for local DJs
   - Performer cards: Larger images, more performers
   - Dashboard "Upcoming Events": Image thumbnails
   - Venue cards: Placeholder for future venue photos

2. Enhance `utils/imageUtils.js` - Add Spotify/Mixcloud image fetching utilities
3. Mixcloud integration:
   - "Listen on Mixcloud" buttons on event cards
   - Embed Mixcloud player component (oEmbed API)
   - Show recent mixes on DJ detail pages
   - Genre discovery via Mixcloud search

4. Image caching strategy - Avoid redundant API calls

**Deliverables:**
- Rich images across all pages (events, DJs, venues, dashboard)
- Enhanced `imageUtils.js` with Spotify/Mixcloud fetching
- Mixcloud player component
- Mixcloud integration on DJ pages

**Skills:**
- `superpowers:test-driven-development` (for image utilities)
- `superpowers:brainstorming` (for image caching strategy)
- `superpowers:verification-before-completion` (verify images load)

**Coordination:**
- Exposes: Image utilities for Frontend Agent to use
- Exposes: Mixcloud player component for Dashboard redesign

---

#### **Agent 5: Admin & DevOps Agent** ⚙️
**Worktree:** `worktree-admin-devops`
**Primary Files:** Admin pages, `.github/workflows/deploy.yml`, `k8s/`, deployment scripts

**Tasks:**
1. Build admin ML dashboard page (`/admin/ml`):
   - Model health widget (version, last trained, training samples, metrics)
   - A/B experiment results dashboard (conversion rates per variant)
   - Manual retrain trigger button
   - CloudWatch/Prometheus metrics visualization

2. Update GitHub Actions secret `EC2_INSTANCE_ID` to `i-077f139e329506bf5`
3. Commit all changes to GitHub
4. Set up ML model retraining cron job (daily or weekly)
5. Prepare deployment scripts for rebuilding backend services to ECR + k8s
6. Create comprehensive deployment runbook

**Deliverables:**
- Admin ML dashboard (`/admin/ml` page)
- GitHub Actions updated with correct instance ID
- All changes committed and pushed
- ML retraining cron job configured
- Deployment scripts ready
- Deployment runbook document

**Skills:**
- `superpowers:test-driven-development` (for admin dashboard)
- `superpowers:brainstorming` (for admin dashboard design)
- `superpowers:verification-before-completion` (verify CI/CD)
- `commit-commands:commit` (for git operations)
- `superpowers:finishing-a-development-branch` (for final merge)

**Coordination:**
- Depends on: ML Agent's ML API client for admin dashboard
- Coordinates with: All agents for final merge and deployment

---

## 3. Coordination & Integration Points

### Shared Coordination File: `docs/agent-coordination.md`

**Structure:**
```markdown
# Agent Coordination Log

## Wave 1 Progress

### Backend & API Agent
- [ ] TLS verified
- [ ] ML endpoints verified
- [ ] Backend tests passing
- **Contract Exposed:** ML service endpoints documented

### ML Intelligence Agent
- [ ] mlAPI.js complete
- [ ] ML components built
- **Contract Exposed:** mlAPI.js interface at gigfinder-app/src/services/mlAPI.js
- **Blockers:** Waiting for Backend Agent to verify ML endpoints

## Wave 2 Progress

### Frontend Core Agent
- [ ] React bug fixed
- [ ] Search flow improved
- [ ] Dashboard redesign complete
- **Dependencies:** Using mlAPI.js from ML Agent, image utilities from Visual Agent

### Visual & Media Agent
- [ ] Image utilities complete
- [ ] Mixcloud integration complete
- **Contract Exposed:** imageUtils.js enhancements, Mixcloud player component

### Admin & DevOps Agent
- [ ] Admin dashboard complete
- [ ] CI/CD updated
- **Dependencies:** Using mlAPI.js from ML Agent

## Integration Checkpoints
- [ ] Wave 1 complete - Backend ready, ML API contract exposed
- [ ] Wave 2 complete - All features integrated
- [ ] Final merge - All agents merged to dev branch
- [ ] Verification complete - Ready for production
```

### Key Integration Points

1. **ML API Contract (Wave 1 → Wave 2)**
   - ML Agent exposes mlAPI.js interface
   - Frontend Agent and Admin Agent consume it
   - Handoff: ML Agent commits mlAPI.js, updates coordination file

2. **Image Utilities (Wave 2 parallel)**
   - Visual Agent builds image utilities
   - Frontend Agent uses them in Dashboard redesign
   - Handoff: Visual Agent exposes utilities, Frontend Agent imports

3. **Mixcloud Components (Wave 2 parallel)**
   - Visual Agent builds Mixcloud player component
   - Frontend Agent embeds it in Dashboard
   - Handoff: Visual Agent commits component, Frontend Agent integrates

4. **Backend Verification (Wave 1 gates Wave 2)**
   - Backend Agent verifies all endpoints healthy
   - All Wave 2 agents can proceed with confidence
   - Handoff: Backend Agent updates coordination file with "Backend Ready ✅"

---

## 4. Comprehensive Verification Strategy

After all agents complete their work and merge to `dev/phase-1-4-complete`, run comprehensive verification.

### Phase 1: Automated Testing

**Backend Tests:**
```bash
npm run test:unit
npm run test:integration
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:4004/health  # ML service
```

**Frontend Tests:**
```bash
cd gigfinder-app
npm run test
npm run lint
npm run build
```

**ML Service Tests:**
```bash
cd ml-service
pytest tests/
```

**Expected:** All tests green, no build errors

---

### Phase 2: Manual Smoke Testing

**Critical User Flows:**

1. **Unauthenticated User Flow:**
   - Visit homepage → defaults to Search mode
   - Search for "Dublin" → returns events from all sources
   - Event cards show images (Spotify, Ticketmaster, gradients)
   - Source badges visible

2. **Authentication Flow:**
   - Sign up, log in, navigate to Dashboard
   - Spotify connection works
   - Top genres/artists display

3. **ML-Powered Feed:**
   - Dashboard shows "For You" feed with match percentages
   - "Fans Like You Also Saved" section appears
   - "Why This?" explainability modal works
   - Taste profile radar chart displays
   - Genre heatmap shows event density

4. **Feedback & Interaction:**
   - Save event → feedback fires
   - Hide event → feedback fires
   - Click event → feedback fires
   - Thumbs up/down → feedback sent

5. **Visual & Media:**
   - Rich images everywhere
   - Mixcloud buttons appear
   - Mixcloud player embeds correctly

6. **Admin Dashboard:**
   - Navigate to `/admin/ml`
   - Model health widget shows metrics
   - A/B results display
   - Manual retrain works

7. **Mobile Responsiveness:**
   - Test all pages on mobile viewport

---

### Phase 3: Performance & Load Testing

```bash
# ML prediction latency
curl -X POST http://localhost:4004/v1/recommendations
# Should respond <200ms

# Feed personalization latency
curl -H "Authorization: Bearer <token>" http://localhost:4000/v1/users/me/feed
# Should respond <300ms
```

**Check Metrics:**
- `ml_prediction_latency_ms` p95 <200ms
- `ml_requests_total` incrementing
- `ml_errors_total` = 0 or very low

---

### Phase 4: Visual QA

- Dashboard looks premium
- Color scheme consistent (emerald `#00d67d`)
- Typography clean (Inter)
- Border radius consistent (12-16px)
- Animations smooth (Framer Motion)
- Images high quality

---

### Phase 5: Security & Data Validation

```bash
# Verify TLS valid
curl -v https://api.whatsthecraic.run.place/health 2>&1 | grep "issuer"

# No exposed secrets
grep -r "REDACTED_DB_PASSWORD" gigfinder-app/
```

**Data Validation:**
- Preferences saved correctly
- Events persisted
- ML feedback logged
- A/B assignments consistent

---

### Phase 6: Integration Testing

**End-to-End ML Pipeline:**
1. User signs up and connects Spotify
2. User saves 3 House genre events
3. Check ml_feedback table has 3 'save' entries
4. Trigger retrain: `POST /v1/model/retrain`
5. Get recommendations: `POST /v1/recommendations`
6. Verify recommendations include House genre events

---

**Verification Sign-Off Checklist:**
- [ ] All automated tests passing
- [ ] All manual smoke tests passing
- [ ] Performance metrics acceptable
- [ ] Visual QA approved
- [ ] Security checks passed
- [ ] Integration tests passed
- [ ] Mobile responsiveness verified

---

## 5. Staged Deployment Plan

### Pre-Deployment

1. **Create Git Tag:**
   ```bash
   git tag -a v2.0.0-ml-transformation -m "Phase 1-4 complete"
   git push origin v2.0.0-ml-transformation
   ```

2. **Backup Database:**
   ```bash
   mysqldump -u REDACTED_DB_USER -p gigsdb > backup-pre-v2.0.0-$(date +%Y%m%d).sql
   aws s3 cp backup-pre-v2.0.0-*.sql s3://wtc-backups/
   ```

---

### Stage 1: Frontend Deployment

```bash
cd gigfinder-app
REACT_APP_API_BASE=https://api.whatsthecraic.run.place \
  NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=1024" \
  npm run build --legacy-peer-deps

aws s3 sync build/ s3://wtc-ui-385017713886-eu-west-1/ --delete
aws cloudfront create-invalidation --distribution-id E2HRBT0I8G9WPY --paths "/*"
```

**Verify:** Visit https://whatsthecraic.run.place, check Dashboard, no console errors

**Rollback:** Redeploy previous S3 version

---

### Stage 2: Backend Services Deployment

**ML Service:**
```bash
cd ml-service
docker build -t whatsthecraic/ml-service .
docker tag whatsthecraic/ml-service 385017713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/ml-service:v2.0.0
docker push 385017713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/ml-service:v2.0.0

kubectl set image deployment/ml-service ml-service=385017713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/ml-service:v2.0.0 -n whatsthecraic
kubectl rollout status deployment/ml-service -n whatsthecraic
```

**Verify:**
```bash
curl https://api.whatsthecraic.run.place/v1/model/info
```

**Rollback:** `kubectl rollout undo deployment/ml-service -n whatsthecraic`

*Repeat for events-service, auth-service, aggregator if updated*

---

### Stage 3: Database Migrations

```bash
# If new tables/columns added
mysql -h REDACTED_DB_HOST -u REDACTED_DB_USER -p gigsdb < migrations/add-ml-feedback-table.sql
```

---

### Stage 4: Configuration Updates

- Update GitHub Actions secret `EC2_INSTANCE_ID` to `i-077f139e329506bf5`
- Set up ML retraining cron: `0 2 * * * curl -X POST http://ml-service:4004/v1/model/retrain`

---

### Stage 5: Post-Deployment Verification

- Visit https://whatsthecraic.run.place
- Sign up, connect Spotify, view feed
- Test ML recommendations
- Visit admin dashboard
- Monitor CloudWatch metrics

---

### Stage 6: Monitoring & Cleanup

**Alerts:**
- ML prediction latency >500ms
- Error rate >1%
- Model training failures

**Cleanup:**
```bash
git worktree remove worktree-frontend-core
git worktree remove worktree-ml-intelligence
git worktree remove worktree-visual-media
git worktree remove worktree-backend-api
git worktree remove worktree-admin-devops

git branch -d dev/phase-1-4-complete
git push origin --delete dev/phase-1-4-complete
```

**Documentation:**
- Update README.md
- Update docs/ops-runbook.md
- Create docs/ML_FEATURES.md

---

**Deployment Sign-Off Checklist:**
- [ ] Frontend deployed
- [ ] Backend services deployed
- [ ] Database migrations applied
- [ ] GitHub Actions updated
- [ ] ML cron configured
- [ ] Production tests passing
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Cleanup complete

---

## 6. Success Criteria

**Technical:**
- ✅ All 4 phases complete (~20 tasks)
- ✅ React Error #31 fixed
- ✅ ML service integrated with frontend
- ✅ Rich images everywhere (Spotify, Mixcloud, Ticketmaster)
- ✅ Mixcloud integration complete
- ✅ Admin ML dashboard built
- ✅ TLS certificates valid
- ✅ All tests passing
- ✅ ML prediction latency <200ms p95
- ✅ Frontend deployed to CloudFront
- ✅ Backend services deployed to k8s

**User Experience:**
- ✅ Platform feels premium (Resident Advisor meets Dice.fm)
- ✅ ML intelligence visible and explainable
- ✅ Images rich and professional
- ✅ Mobile responsive
- ✅ Search works for unauthenticated users
- ✅ Personalized feed works for authenticated users

**Business:**
- ✅ Production deployment successful
- ✅ No downtime during deployment
- ✅ Monitoring/alerts configured
- ✅ Documentation complete
- ✅ Ready for real users

---

## 7. Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Multiple agents touching same files | Clear domain boundaries, git worktrees |
| Integration issues when merging | Progressive waves, shared coordination file |
| Breaking production during deployment | Comprehensive verification, staged rollout, rollback plan |
| ML service not working | Backend Agent verifies endpoints in Wave 1 before Wave 2 starts |
| Image API rate limits | Caching strategy, fallback to gradients |
| Performance degradation | Load testing before deployment, monitoring after |

---

## 8. Timeline Estimate

- Wave 1 (2 agents): 1.5 hours
- Wave 2 (3 agents): 2.5 hours
- Wave 3 (polish/deploy): 1.5 hours
- Integration & merge: 0.5 hours
- Comprehensive verification: 1.5 hours
- Deployment: 0.5 hours

**Total: ~6-7 hours**

---

## Appendix: Agent Launch Commands

**Wave 1:**
```bash
# Launch Backend & API Agent
claude-code task launch backend-api-agent --worktree worktree-backend-api --skills systematic-debugging,verification-before-completion

# Launch ML Intelligence Agent
claude-code task launch ml-intelligence-agent --worktree worktree-ml-intelligence --skills test-driven-development,brainstorming,verification-before-completion
```

**Wave 2:**
```bash
# Launch Frontend Core Agent
claude-code task launch frontend-core-agent --worktree worktree-frontend-core --skills systematic-debugging,test-driven-development,brainstorming,verification-before-completion,figma:implement-design

# Launch Visual & Media Agent
claude-code task launch visual-media-agent --worktree worktree-visual-media --skills test-driven-development,brainstorming,verification-before-completion

# Launch Admin & DevOps Agent
claude-code task launch admin-devops-agent --worktree worktree-admin-devops --skills test-driven-development,brainstorming,verification-before-completion,commit-commands:commit,finishing-a-development-branch
```

---

**End of Design Document**
