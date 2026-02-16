# Multi-Agent WhatsTheCraic Transformation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task with parallel agents.

**Goal:** Orchestrate 5 specialized subagents across 3 progressive waves to transform WhatsTheCraic into a world-class, ML-powered event discovery platform with comprehensive verification and staged production deployment.

**Architecture:** Domain-based parallelization with progressive waves. Wave 1 (Foundation): Backend + ML API. Wave 2 (Integration): Frontend + Visual + Admin. Wave 3 (Deploy). Each wave has integration checkpoints. All agents coordinate via shared coordination file and git.

**Tech Stack:** Claude Code Task tool for agent orchestration, git worktrees for isolation, bash for verification, AWS (S3, CloudFront, ECR, k8s) for deployment

---

## Pre-Flight Checklist

Before starting, verify:
- [ ] Current directory: `/Users/ut/whatsthecraic`
- [ ] On master branch with clean working tree
- [ ] Master prompt read: `CLAUDE_CODE_MASTER_PROMPT.md`
- [ ] Design doc read: `docs/plans/2<REDACTED_DB_PASSWORD>26-<REDACTED_DB_PASSWORD>2-15-multi-agent-transformation-design.md`
- [ ] AWS credentials configured
- [ ] kubectl configured for k8s cluster

---

## Task 1: Setup Development Environment

### Step 1: Create development branch

```bash
git checkout -b dev/phase-1-4-complete
```

**Expected:** `Switched to a new branch 'dev/phase-1-4-complete'`

---

### Step 2: Create coordination file

**Create:** `docs/agent-coordination.md`

```bash
cat > docs/agent-coordination.md << 'EOF'
# Agent Coordination Log

**Last Updated:** $(date)

## Wave 1 Progress

### Backend & API Agent (worktree-backend-api)
- [ ] TLS verified
- [ ] ML endpoints verified (`/v1/recommendations`, `/v1/feedback`, `/v1/model/info`, `/v1/experiments`)
- [ ] Backend tests passing
- **Status:** Not started
- **Contract Exposed:** None yet
- **Blockers:** None

### ML Intelligence Agent (worktree-ml-intelligence)
- [ ] mlAPI.js complete
- [ ] ML components built (explainability modal, taste profile, heatmap)
- **Status:** Not started
- **Contract Exposed:** None yet
- **Blockers:** Waiting for Backend Agent to verify ML endpoints

---

## Wave 2 Progress

### Frontend Core Agent (worktree-frontend-core)
- [ ] React Error #31 fixed
- [ ] Search flow improved
- [ ] ML API integrated
- [ ] Dashboard redesign complete
- **Status:** Blocked - waiting for Wave 1
- **Dependencies:** mlAPI.js from ML Agent, image utilities from Visual Agent
- **Blockers:** Wave 1 must complete first

### Visual & Media Agent (worktree-visual-media)
- [ ] Image utilities complete
- [ ] Mixcloud integration complete
- **Status:** Blocked - waiting for Wave 1
- **Contract Exposed:** None yet
- **Blockers:** Wave 1 must complete first

### Admin & DevOps Agent (worktree-admin-devops)
- [ ] Admin ML dashboard complete
- [ ] CI/CD updated
- [ ] Deployment scripts ready
- **Status:** Blocked - waiting for Wave 1
- **Dependencies:** mlAPI.js from ML Agent
- **Blockers:** Wave 1 must complete first

---

## Integration Checkpoints

- [ ] **Wave 1 Complete** - Backend ready, ML API contract exposed
- [ ] **Wave 2 Complete** - All features integrated
- [ ] **Final Merge** - All agents merged to dev branch
- [ ] **Verification Complete** - Ready for production

---

## Notes

Agents should update this file after completing major milestones. Mark checkboxes with `[x]`, update status, expose contracts, note blockers.
EOF
```

**Expected:** File created at `docs/agent-coordination.md`

---

### Step 3: Commit coordination file

```bash
git add docs/agent-coordination.md
git commit -m "chore: add agent coordination tracking file

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Expected:** Commit successful

---

### Step 4: Create git worktrees for all 5 agents

```bash
# Create worktree parent directory
mkdir -p /tmp/wtc-worktrees

# Create 5 worktrees (one per agent)
git worktree add /tmp/wtc-worktrees/worktree-backend-api dev/phase-1-4-complete
git worktree add /tmp/wtc-worktrees/worktree-ml-intelligence dev/phase-1-4-complete
git worktree add /tmp/wtc-worktrees/worktree-frontend-core dev/phase-1-4-complete
git worktree add /tmp/wtc-worktrees/worktree-visual-media dev/phase-1-4-complete
git worktree add /tmp/wtc-worktrees/worktree-admin-devops dev/phase-1-4-complete
```

**Expected:** 5 worktrees created successfully

---

### Step 5: Verify worktrees

```bash
git worktree list
```

**Expected:** Should show 6 entries (main repo + 5 worktrees)

---

### Step 6: Commit setup

```bash
git add .
git commit -m "chore: setup multi-agent development environment

- Created dev/phase-1-4-complete branch
- Created agent coordination file
- Set up 5 git worktrees for parallel agent work

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Expected:** Commit successful

---

## Task 2: Wave 1 - Launch Foundation Agents

**Goal:** Launch Backend & API Agent and ML Intelligence Agent in parallel. Backend Agent verifies infrastructure, ML Agent builds mlAPI.js client.

---

### Step 1: Launch Backend & API Agent

**Agent Prompt:**

```
You are the Backend & API Agent for the WhatsTheCraic transformation.

WORKING DIRECTORY: /tmp/wtc-worktrees/worktree-backend-api

PRIMARY OBJECTIVE: Verify backend infrastructure is healthy and ML service endpoints are ready for Wave 2 agents to use.

TASKS:
1. Verify TLS certificates on Traefik (check ACME status, fix if self-signed)
   - SSH to EC2 i-<REDACTED_DB_PASSWORD>77f139e3295<REDACTED_DB_PASSWORD>6bf5 via SSM
   - Check traefik pod logs for ACME errors
   - Verify https://api.whatsthecraic.run.place uses Let's Encrypt cert (not self-signed)

2. Verify ML service endpoints are accessible and healthy
   - GET /v1/model/info → should return model version, metrics
   - POST /v1/recommendations → should return recommendations array
   - POST /v1/feedback → should accept feedback
   - GET /v1/experiments → should return experiment list
   - GET /v1/experiments/:id/results → should return results

3. Test backend API integration (aggregator proxies ML service correctly)
   - Verify aggregator routes /v1/recommendations to ml-service:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>4
   - Verify aggregator routes /v1/feedback to ml-service:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>4

4. Fix any backend bugs discovered during verification

5. Run backend smoke tests
   - npm run test:unit
   - npm run test:integration

DELIVERABLES:
- Update docs/agent-coordination.md with:
  - TLS status (valid Let's Encrypt or needs fixing)
  - ML endpoint verification results (all working or blockers)
  - Backend test results (passing or failing)
  - "Backend Ready ✅" when all tasks complete

- Create docs/ml-api-contract.md documenting:
  - ML service endpoint specs (request/response formats)
  - Example requests for each endpoint
  - Error handling behavior

SKILLS TO USE:
- superpowers:systematic-debugging (for any backend issues)
- superpowers:verification-before-completion (verify all endpoints work)

COORDINATION:
- Mark tasks complete in docs/agent-coordination.md
- Expose ML service API documentation for other agents
- Update "Backend Ready ✅" when done

COMMIT OFTEN: After each task completion.
```

**Launch Command:**

Use the Task tool to launch the Backend & API Agent with the above prompt.

---

### Step 2: Launch ML Intelligence Agent

**Agent Prompt:**

```
You are the ML Intelligence Agent for the WhatsTheCraic transformation.

WORKING DIRECTORY: /tmp/wtc-worktrees/worktree-ml-intelligence

PRIMARY OBJECTIVE: Build the ML API client (mlAPI.js) and create ML UI components for the Dashboard.

IMPORTANT: Check docs/agent-coordination.md regularly. You are BLOCKED until Backend Agent marks "Backend Ready ✅".

TASKS:
1. Wait for Backend Agent to verify ML endpoints (check docs/agent-coordination.md)

2. Create gigfinder-app/src/services/mlAPI.js with TDD approach:
   - Test: test_getRecommendations_returns_array
   - Implement: getRecommendations(userId, city, limit, context)
   - Test: test_sendFeedback_posts_action
   - Implement: sendFeedback(userId, eventId, action, context)
   - Test: test_getModelInfo_returns_version
   - Implement: getModelInfo()
   - Implement: triggerRetrain(), getExperiments(), getExperimentResults(experimentId)

3. Wire ML recommendations into Dashboard.jsx:
   - Import mlAPI
   - Call getRecommendations() on mount
   - Display "Fans Like You Also Saved" section with results
   - Add loading state, error handling

4. Add click tracking to event cards:
   - Instrument onClick → mlAPI.sendFeedback(action='click')
   - Ensure all event card clicks tracked

5. Add thumbs up/down feedback buttons:
   - Create FeedbackButtons component (thumbs up/down icons)
   - Wire to mlAPI.sendFeedback(action='thumbs_up'/'thumbs_down')
   - Add to event cards

6. Build "Why This?" explainability modal:
   - Create ExplainabilityModal component
   - Show rank_reasons breakdown as visual bar chart (Chart.js)
   - Display which factors contributed (genre match, artist follow, etc.)
   - Wire to event cards with "Why?" button

7. Build ML Taste Profile panel:
   - Create TasteProfilePanel component
   - Radar chart of genre affinities (Chart.js radar)
   - Pull data from user Spotify + saved events
   - Display on Dashboard

8. Wire BetterHeatMap to real data:
   - Connect to event density data (genre/day-of-week)
   - Or user preference distribution
   - Display on Dashboard

DELIVERABLES:
- gigfinder-app/src/services/mlAPI.js with tests
- ML features integrated into Dashboard
- ExplainabilityModal component
- TasteProfilePanel component
- BetterHeatMap wired to data

- Update docs/agent-coordination.md:
  - Mark mlAPI.js complete
  - Mark ML components built
  - Expose contract: "mlAPI.js interface ready for import"

SKILLS TO USE:
- superpowers:test-driven-development (for mlAPI.js client)
- superpowers:brainstorming (for designing ML UI components)
- superpowers:verification-before-completion (verify ML endpoints work end-to-end)

COORDINATION:
- BLOCKED until Backend Agent marks "Backend Ready ✅" in docs/agent-coordination.md
- Update coordination file after each milestone
- Commit mlAPI.js so other agents can use it

COMMIT OFTEN: After each component completion.
```

**Launch Command:**

Use the Task tool to launch the ML Intelligence Agent with the above prompt.

---

### Step 3: Monitor Wave 1 progress

**Check coordination file:**

```bash
cat docs/agent-coordination.md
```

**Expected:** Both agents updating their status as they progress

**Check git logs in worktrees:**

```bash
cd /tmp/wtc-worktrees/worktree-backend-api && git log --oneline -5
cd /tmp/wtc-worktrees/worktree-ml-intelligence && git log --oneline -5
```

**Expected:** Commits from both agents appearing

---

### Step 4: Wait for Wave 1 completion

**Completion Criteria:**
- [ ] Backend Agent marks "Backend Ready ✅" in coordination file
- [ ] ML Agent marks "mlAPI.js complete" in coordination file
- [ ] Both agents have committed their work
- [ ] No blockers listed in coordination file

**Verify:** Read docs/agent-coordination.md and check all Wave 1 tasks marked `[x]`

---

### Step 5: Wave 1 Checkpoint - Verify ML API contract

**Read ML API contract:**

```bash
cat docs/ml-api-contract.md
```

**Expected:** Documentation of ML service endpoints with examples

**Test ML API locally:**

```bash
cd /tmp/wtc-worktrees/worktree-ml-intelligence/gigfinder-app
npm test -- mlAPI.test.js
```

**Expected:** All mlAPI tests passing

---

### Step 6: Merge Wave 1 work to dev branch

**Merge Backend Agent work:**

```bash
cd /tmp/wtc-worktrees/worktree-backend-api
git add .
git commit -m "feat(backend): verify infrastructure and ML endpoints

- Verified TLS certificates on Traefik
- Verified ML service endpoints healthy
- Documented ML API contract
- All backend tests passing

Co-Authored-By: Backend & API Agent <noreply@anthropic.com>"

git push origin dev/phase-1-4-complete
```

**Merge ML Intelligence Agent work:**

```bash
cd /tmp/wtc-worktrees/worktree-ml-intelligence
git add .
git commit -m "feat(ml): build ML API client and UI components

- Created mlAPI.js service client with tests
- Built ExplainabilityModal component
- Built TasteProfilePanel radar chart
- Wired BetterHeatMap to event data
- Added click tracking and feedback buttons

Co-Authored-By: ML Intelligence Agent <noreply@anthropic.com>"

git push origin dev/phase-1-4-complete
```

**Expected:** Both agents' work merged to dev branch

---

### Step 7: Update coordination file - Wave 1 complete

```bash
# In main repo
git pull origin dev/phase-1-4-complete

# Update coordination file
cat >> docs/agent-coordination.md << 'EOF'

---

## Wave 1 Complete ✅

- Backend infrastructure verified
- ML endpoints healthy
- mlAPI.js client ready
- ML components built
- Ready to proceed to Wave 2

EOF

git add docs/agent-coordination.md
git commit -m "chore: mark Wave 1 complete

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin dev/phase-1-4-complete
```

**Expected:** Wave 1 checkpoint marked complete

---

## Task 3: Wave 2 - Launch Integration & Features Agents

**Goal:** Launch Frontend Core, Visual & Media, and Admin & DevOps agents in parallel. These agents use the ML API and verified backend from Wave 1.

---

### Step 1: Pull Wave 1 work to all Wave 2 worktrees

```bash
cd /tmp/wtc-worktrees/worktree-frontend-core && git pull origin dev/phase-1-4-complete
cd /tmp/wtc-worktrees/worktree-visual-media && git pull origin dev/phase-1-4-complete
cd /tmp/wtc-worktrees/worktree-admin-devops && git pull origin dev/phase-1-4-complete
```

**Expected:** All Wave 2 worktrees have Wave 1 code (mlAPI.js, ML components, backend fixes)

---

### Step 2: Launch Frontend Core Agent

**Agent Prompt:**

```
You are the Frontend Core Agent for the WhatsTheCraic transformation.

WORKING DIRECTORY: /tmp/wtc-worktrees/worktree-frontend-core

PRIMARY OBJECTIVE: Fix bugs, integrate ML features, and redesign Dashboard as a premium ML-powered homepage.

DEPENDENCIES:
- mlAPI.js from ML Agent (already available in gigfinder-app/src/services/mlAPI.js)
- Image utilities from Visual Agent (will arrive during Wave 2)
- Mixcloud components from Visual Agent (will arrive during Wave 2)

TASKS:
1. Fix React Error #31 in Dashboard.jsx:
   - Line ~22<REDACTED_DB_PASSWORD>-23<REDACTED_DB_PASSWORD>: topGenres rendering issue
   - Backend returns [{genre: "House", count: 5}, ...]
   - JSX renders {g} instead of {g.genre}
   - Fix: Normalize data or use g.genre/g in rendering

2. Improve search flow (CombinedGigs.jsx):
   - Default to Search mode for unauthenticated users (not "For You")
   - Auto-trigger search when user types and hits Enter
   - Show results from ALL sources (Ticketmaster, local, Bandsintown)
   - Display source badges on event cards

3. Integrate ML API client:
   - Import mlAPI from gigfinder-app/src/services/mlAPI.js
   - Call mlAPI.getRecommendations() on Dashboard mount
   - Display "Fans Like You Also Saved" section
   - Handle loading state, errors

4. Display ML features (from ML Agent):
   - Import ExplainabilityModal, TasteProfilePanel
   - Add "Why This?" button on event cards → open ExplainabilityModal
   - Add TasteProfilePanel to Dashboard sidebar
   - Ensure BetterHeatMap displays

5. Redesign Dashboard as premium ML-powered homepage:
   - Hero section: Highest-scored event with full-width image, gradient overlay, "98% match" badge
   - "This Weekend" carousel: Horizontal scrollable cards for Fri-Sun events
   - "Trending Near You": Events by save velocity
   - "Because You Like [Genre]": Personalized sections grouped by genre
   - "Fans Like You Also Saved": Collaborative filtering (from mlAPI)
   - Artist spotlight: Featured artist with image, bio, upcoming events, Mixcloud embed (from Visual Agent)
   - Quick stats: Total events, match quality distribution, ML indicators
   - Use Framer Motion for animations (fade-in + slide-up)
   - Tailwind CSS for styling (dark theme, emerald accent #<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>d67d)

6. Mobile responsiveness:
   - Test Dashboard on mobile viewport (375px, 768px, 1<REDACTED_DB_PASSWORD>24px)
   - Ensure cards stack vertically on mobile
   - Ensure images scale properly
   - Ensure carousels scroll smoothly

7. Rebuild and deploy frontend (DO NOT deploy yet - just prepare):
   - Run build: REACT_APP_API_BASE=https://api.whatsthecraic.run.place npm run build --legacy-peer-deps
   - Verify build succeeds
   - DO NOT aws s3 sync yet - that happens in Wave 3

DELIVERABLES:
- Dashboard.jsx bug fixed
- Search flow improved
- ML features integrated
- Premium Dashboard redesign complete
- Mobile-responsive UI
- Frontend build ready (not deployed yet)

- Update docs/agent-coordination.md:
  - Mark React bug fixed
  - Mark search flow improved
  - Mark Dashboard redesign complete

SKILLS TO USE:
- superpowers:systematic-debugging (for React bug)
- superpowers:test-driven-development (for Dashboard fixes)
- superpowers:brainstorming (for Dashboard redesign)
- superpowers:verification-before-completion (verify build succeeds)

COORDINATION:
- Use mlAPI.js from ML Agent (already available)
- Wait for image utilities from Visual Agent before using in Dashboard redesign
- Check docs/agent-coordination.md for Visual Agent progress

COMMIT OFTEN: After each bug fix, after each redesign section.
```

**Launch Command:**

Use the Task tool to launch the Frontend Core Agent with the above prompt.

---

### Step 3: Launch Visual & Media Agent

**Agent Prompt:**

```
You are the Visual & Media Agent for the WhatsTheCraic transformation.

WORKING DIRECTORY: /tmp/wtc-worktrees/worktree-visual-media

PRIMARY OBJECTIVE: Add rich images everywhere (Spotify, Mixcloud, Ticketmaster) and build Mixcloud integration components.

TASKS:
1. Enhance gigfinder-app/src/utils/imageUtils.js:
   - Add fetchSpotifyArtistImage(artistName) → returns image URL or null
   - Add fetchMixcloudArtistImage(artistName) → returns image URL or null
   - Add imageCacheStrategy() → avoid redundant API calls
   - Use TDD approach: write tests first

2. Add rich artist images to event cards (across all pages):
   - CombinedGigs.jsx: Event cards should show artist image from Spotify if event has no image
   - Fallback: Ticketmaster image → Spotify artist image → gradient placeholder
   - Use getBestImage() from imageUtils.js

3. Add rich images to DJ cards:
   - DJs.jsx: Fetch Spotify/Mixcloud images for local DJs
   - Replace gradient placeholders with real images when available
   - Cache images to avoid redundant fetches

4. Add rich images to performer cards:
   - DJs.jsx Discovered tab: Larger images, more performers shown
   - Fetch from Spotify/Mixcloud

5. Dashboard "Upcoming Events": Add image thumbnails

6. Venue cards: Placeholder for future venue photos (can be gradient for now)

7. Mixcloud integration:
   - Create MixcloudPlayer.jsx component:
     - Use Mixcloud oEmbed API to embed player
     - Props: artistName or mixcloudUrl
     - Returns iframe with player
   - Add "Listen on Mixcloud" buttons to event cards (when artist has Mixcloud profile)
   - DJs.jsx: Show recent mixes on DJ detail pages
   - Genre discovery: Mixcloud search by genre

8. Image caching strategy:
   - Store fetched images in sessionStorage/localStorage
   - TTL-based expiry (24 hours)
   - Avoid redundant API calls for same artist

DELIVERABLES:
- Enhanced imageUtils.js with Spotify/Mixcloud fetching
- Rich images across all pages (events, DJs, venues, dashboard)
- MixcloudPlayer component
- Mixcloud integration on DJ pages
- Image caching implemented

- Update docs/agent-coordination.md:
  - Mark image utilities complete
  - Mark Mixcloud integration complete
  - Expose: "imageUtils.js ready for import, MixcloudPlayer component available"

SKILLS TO USE:
- superpowers:test-driven-development (for image utilities)
- superpowers:brainstorming (for image caching strategy)
- superpowers:verification-before-completion (verify images load correctly)

COORDINATION:
- Expose imageUtils.js and MixcloudPlayer for Frontend Agent to use
- Update coordination file when ready

COMMIT OFTEN: After each image enhancement, after Mixcloud component.
```

**Launch Command:**

Use the Task tool to launch the Visual & Media Agent with the above prompt.

---

### Step 4: Launch Admin & DevOps Agent

**Agent Prompt:**

```
You are the Admin & DevOps Agent for the WhatsTheCraic transformation.

WORKING DIRECTORY: /tmp/wtc-worktrees/worktree-admin-devops

PRIMARY OBJECTIVE: Build admin ML dashboard, update CI/CD, prepare deployment scripts.

DEPENDENCIES:
- mlAPI.js from ML Agent (already available)

TASKS:
1. Build admin ML dashboard page (gigfinder-app/src/pages/AdminML.jsx):
   - Create new page at /admin/ml (add to App.jsx routes)
   - Requires admin role (check JWT)
   - Layout: Dark theme, emerald accent, responsive

   - Model Health Widget:
     - Call mlAPI.getModelInfo()
     - Display: version, last_trained, training_samples, validation_metrics, prediction_count, avg_latency
     - Color-code latency: <1<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms green, 1<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>-2<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms yellow, >2<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms red

   - A/B Experiment Results Dashboard:
     - Call mlAPI.getExperiments()
     - For each experiment, call mlAPI.getExperimentResults(experimentId)
     - Display table: variant name, user count, conversion rate, statistical significance
     - Color-code significance: p<<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>5 green, else gray

   - Manual Retrain Trigger:
     - Button: "Retrain Model Now"
     - onClick → mlAPI.triggerRetrain()
     - Show progress spinner, success/error toast
     - Refresh model info after retrain

   - CloudWatch/Prometheus Metrics Visualization:
     - Fetch /metrics endpoint (Prometheus format)
     - Parse ml_prediction_latency_ms, ml_requests_total, ml_errors_total
     - Display as Chart.js line charts (last 24 hours)

2. Update GitHub Actions:
   - .github/workflows/deploy.yml
   - Update EC2_INSTANCE_ID secret to i-<REDACTED_DB_PASSWORD>77f139e3295<REDACTED_DB_PASSWORD>6bf5
   - Ensure workflow uses correct instance

3. Prepare deployment scripts:
   - Create scripts/deploy-ml-service.sh:
     - Docker build, tag, push to ECR
     - kubectl set image, rollout status
   - Create scripts/deploy-frontend.sh:
     - npm build, S3 sync, CloudFront invalidation
   - Make scripts executable

4. Create comprehensive deployment runbook:
   - docs/DEPLOYMENT_RUNBOOK.md
   - Step-by-step deployment instructions
   - Rollback procedures
   - Verification steps

5. Set up ML model retraining cron job (prepare, don't deploy yet):
   - Create k8s CronJob manifest: k8s/ml-retrain-cronjob.yaml
   - Schedule: <REDACTED_DB_PASSWORD> 2 * * * (daily at 2 AM)
   - Command: curl -X POST http://ml-service:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>4/v1/model/retrain
   - DO NOT kubectl apply yet - that happens in Wave 3

6. Commit all changes:
   - Use commit-commands:commit skill
   - Ensure all files staged and committed

DELIVERABLES:
- Admin ML dashboard (/admin/ml page)
- GitHub Actions updated
- Deployment scripts ready
- Deployment runbook created
- ML retraining cron job manifest ready (not deployed)
- All changes committed

- Update docs/agent-coordination.md:
  - Mark admin dashboard complete
  - Mark CI/CD updated
  - Mark deployment scripts ready

SKILLS TO USE:
- superpowers:test-driven-development (for admin dashboard)
- superpowers:brainstorming (for admin dashboard design)
- superpowers:verification-before-completion (verify CI/CD works)
- commit-commands:commit (for git operations)

COORDINATION:
- Use mlAPI.js from ML Agent
- Update coordination file when complete

COMMIT OFTEN: After each deliverable.
```

**Launch Command:**

Use the Task tool to launch the Admin & DevOps Agent with the above prompt.

---

### Step 5: Monitor Wave 2 progress

**Check coordination file:**

```bash
cat docs/agent-coordination.md
```

**Expected:** All 3 agents updating their status

**Check git logs in worktrees:**

```bash
cd /tmp/wtc-worktrees/worktree-frontend-core && git log --oneline -1<REDACTED_DB_PASSWORD>
cd /tmp/wtc-worktrees/worktree-visual-media && git log --oneline -1<REDACTED_DB_PASSWORD>
cd /tmp/wtc-worktrees/worktree-admin-devops && git log --oneline -1<REDACTED_DB_PASSWORD>
```

**Expected:** Commits from all 3 agents

---

### Step 6: Wait for Wave 2 completion

**Completion Criteria:**
- [ ] Frontend Agent marks "Dashboard redesign complete" in coordination file
- [ ] Visual Agent marks "Image utilities complete, Mixcloud integration complete"
- [ ] Admin Agent marks "Admin dashboard complete, CI/CD updated"
- [ ] All agents have committed their work
- [ ] No blockers listed

**Verify:** Read docs/agent-coordination.md and check all Wave 2 tasks marked `[x]`

---

### Step 7: Wave 2 Checkpoint - Verify integration

**Test Frontend build:**

```bash
cd /tmp/wtc-worktrees/worktree-frontend-core/gigfinder-app
npm run build --legacy-peer-deps
```

**Expected:** Build succeeds, no errors

**Test image utilities:**

```bash
cd /tmp/wtc-worktrees/worktree-visual-media/gigfinder-app
npm test -- imageUtils.test.js
```

**Expected:** All image utility tests passing

**Test admin dashboard renders:**

```bash
cd /tmp/wtc-worktrees/worktree-admin-devops/gigfinder-app
npm test -- AdminML.test.jsx
```

**Expected:** Admin dashboard tests passing

---

### Step 8: Merge Wave 2 work to dev branch

**Merge Frontend Core Agent work:**

```bash
cd /tmp/wtc-worktrees/worktree-frontend-core
git add .
git commit -m "feat(frontend): fix bugs, integrate ML, redesign Dashboard

- Fixed React Error #31 (topGenres rendering)
- Improved search flow for unauthenticated users
- Integrated mlAPI for recommendations
- Redesigned Dashboard as premium ML-powered homepage
- Mobile responsiveness ensured

Co-Authored-By: Frontend Core Agent <noreply@anthropic.com>"

git push origin dev/phase-1-4-complete
```

**Merge Visual & Media Agent work:**

```bash
cd /tmp/wtc-worktrees/worktree-visual-media
git add .
git commit -m "feat(visual): add rich images and Mixcloud integration

- Enhanced imageUtils with Spotify/Mixcloud fetching
- Added rich images across all pages
- Built MixcloudPlayer component
- Implemented image caching strategy

Co-Authored-By: Visual & Media Agent <noreply@anthropic.com>"

git push origin dev/phase-1-4-complete
```

**Merge Admin & DevOps Agent work:**

```bash
cd /tmp/wtc-worktrees/worktree-admin-devops
git add .
git commit -m "feat(admin): build ML dashboard and deployment scripts

- Built admin ML dashboard (/admin/ml)
- Updated GitHub Actions EC2_INSTANCE_ID
- Created deployment scripts
- Created deployment runbook
- Prepared ML retraining cron job

Co-Authored-By: Admin & DevOps Agent <noreply@anthropic.com>"

git push origin dev/phase-1-4-complete
```

**Expected:** All agents' work merged to dev branch

---

### Step 9: Update coordination file - Wave 2 complete

```bash
# In main repo
git pull origin dev/phase-1-4-complete

# Update coordination file
cat >> docs/agent-coordination.md << 'EOF'

---

## Wave 2 Complete ✅

- Frontend bugs fixed, ML integrated, Dashboard redesigned
- Rich images everywhere, Mixcloud integration complete
- Admin ML dashboard built, CI/CD updated
- Ready to proceed to Wave 3 (Polish & Deploy)

EOF

git add docs/agent-coordination.md
git commit -m "chore: mark Wave 2 complete

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin dev/phase-1-4-complete
```

**Expected:** Wave 2 checkpoint marked complete

---

## Task 4: Integration & Merge

**Goal:** Merge all agent work into dev branch and resolve any conflicts.

---

### Step 1: Pull all work to main repo

```bash
# In main repo
git checkout dev/phase-1-4-complete
git pull origin dev/phase-1-4-complete
```

**Expected:** All agent work merged

---

### Step 2: Check for merge conflicts

```bash
git status
```

**Expected:** No conflicts (clean working tree)

If conflicts exist, resolve them manually.

---

### Step 3: Run full test suite

**Backend tests:**

```bash
npm run test:unit
npm run test:integration
```

**Expected:** All tests passing

**Frontend tests:**

```bash
cd gigfinder-app
npm install --legacy-peer-deps
npm run test
npm run lint
```

**Expected:** All tests passing, no lint errors

**ML service tests:**

```bash
cd ml-service
pytest tests/
```

**Expected:** All tests passing

---

### Step 4: Build frontend

```bash
cd gigfinder-app
REACT_APP_API_BASE=https://api.whatsthecraic.run.place \
  NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=1<REDACTED_DB_PASSWORD>24" \
  npm run build --legacy-peer-deps
```

**Expected:** Build succeeds

---

### Step 5: Update coordination file - Integration complete

```bash
cat >> docs/agent-coordination.md << 'EOF'

---

## Integration Complete ✅

- All agent work merged to dev/phase-1-4-complete
- No conflicts
- All tests passing
- Frontend builds successfully
- Ready for comprehensive verification

EOF

git add docs/agent-coordination.md
git commit -m "chore: mark integration complete

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin dev/phase-1-4-complete
```

**Expected:** Integration checkpoint marked complete

---

## Task 5: Comprehensive Verification

**Goal:** Run all verification phases before production deployment.

---

### Phase 1: Automated Testing

**Run all automated tests:**

```bash
# Backend
npm run test:unit
npm run test:integration

# Frontend
cd gigfinder-app && npm test && npm run lint && cd ..

# ML service
cd ml-service && pytest tests/ && cd ..
```

**Expected:** All tests green

**Checklist:**
- [ ] Backend tests passing
- [ ] Frontend tests passing
- [ ] ML service tests passing
- [ ] Lint checks passing
- [ ] Build succeeds

---

### Phase 2: Manual Smoke Testing

**Start local dev environment:**

```bash
docker-compose up
```

**Test flows:**

1. **Unauthenticated User Flow:**
   - [ ] Visit http://localhost:3<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>
   - [ ] Defaults to Search mode (not "For You")
   - [ ] Search "Dublin" → returns events
   - [ ] Event cards show images (Spotify, Ticketmaster, gradients)
   - [ ] Source badges visible

2. **Authentication Flow:**
   - [ ] Sign up new user
   - [ ] Log in
   - [ ] Navigate to Dashboard
   - [ ] Spotify connection widget visible
   - [ ] Connect Spotify → OAuth works
   - [ ] Top genres/artists display

3. **ML-Powered Feed:**
   - [ ] Dashboard shows "For You" feed
   - [ ] "Fans Like You Also Saved" section appears
   - [ ] Click "Why This?" → explainability modal shows
   - [ ] Taste profile radar chart displays
   - [ ] Genre heatmap shows event density

4. **Feedback & Interaction:**
   - [ ] Save event → check DevTools network tab (POST /v1/feedback)
   - [ ] Hide event → check network tab
   - [ ] Click event → check network tab
   - [ ] Thumbs up/down → feedback sent

5. **Visual & Media:**
   - [ ] Rich images everywhere (events, DJs)
   - [ ] Mixcloud "Listen" buttons appear
   - [ ] Mixcloud player embeds correctly

6. **Admin Dashboard:**
   - [ ] Navigate to http://localhost:3<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>/admin/ml
   - [ ] Model health widget shows metrics
   - [ ] A/B results display
   - [ ] Manual retrain button works

7. **Mobile Responsiveness:**
   - [ ] Test Dashboard on mobile viewport (DevTools)
   - [ ] Cards stack vertically
   - [ ] Images scale properly

**Checklist:**
- [ ] All user flows tested
- [ ] No console errors
- [ ] UI looks professional

---

### Phase 3: Performance & Load Testing

**Test ML prediction latency:**

```bash
curl -X POST http://localhost:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>4/v1/recommendations \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "city": "Dublin", "limit": 2<REDACTED_DB_PASSWORD>}' \
  -w "\nTime: %{time_total}s\n"
```

**Expected:** <<REDACTED_DB_PASSWORD>.2s (2<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms)

**Test feed personalization latency:**

```bash
TOKEN="<get-from-login>"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>/v1/users/me/feed \
  -w "\nTime: %{time_total}s\n"
```

**Expected:** <<REDACTED_DB_PASSWORD>.3s (3<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms)

**Checklist:**
- [ ] ML prediction latency <2<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms
- [ ] Feed latency <3<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms

---

### Phase 4: Visual QA

**Check design consistency:**

- [ ] Dashboard looks premium (hero, carousels, trending)
- [ ] Color scheme consistent (emerald #<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>d67d)
- [ ] Typography clean (Inter font)
- [ ] Border radius consistent (12-16px cards)
- [ ] Animations smooth (Framer Motion)
- [ ] Images high quality, no broken placeholders

**Checklist:**
- [ ] Visual QA passed

---

### Phase 5: Security & Data Validation

**Check for exposed secrets:**

```bash
grep -r "wtcRds2<REDACTED_DB_PASSWORD>26secureP" gigfinder-app/
grep -r "ghp_l2g<REDACTED_DB_PASSWORD>tBHTi73cbg1zwLlI2J3EamGoXs<REDACTED_DB_PASSWORD>GOO4o" gigfinder-app/
```

**Expected:** No results (no exposed secrets)

**Data validation:**

```bash
# Check ml_feedback table has entries
mysql -h localhost -u REDACTED_DB_USER -p gigsdb -e "SELECT COUNT(*) FROM ml_feedback;"
```

**Expected:** Feedback entries present

**Checklist:**
- [ ] No exposed secrets
- [ ] Data persisted correctly

---

### Phase 6: Integration Testing

**End-to-end ML pipeline:**

1. Sign up new user
2. Connect Spotify
3. Save 3 House genre events
4. Check ml_feedback table: `SELECT * FROM ml_feedback WHERE action='save';`
5. Trigger retrain: `curl -X POST http://localhost:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>4/v1/model/retrain`
6. Get recommendations: `curl -X POST http://localhost:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>4/v1/recommendations -d '{"user_id": <id>}'`
7. Verify House genre events in recommendations

**Checklist:**
- [ ] Full ML pipeline works end-to-end

---

### Verification Sign-Off

**Master Checklist:**
- [ ] All automated tests passing
- [ ] All manual smoke tests passing
- [ ] Performance metrics acceptable
- [ ] Visual QA approved
- [ ] Security checks passed
- [ ] Integration tests passed
- [ ] Mobile responsiveness verified

**Update coordination file:**

```bash
cat >> docs/agent-coordination.md << 'EOF'

---

## Verification Complete ✅

- All automated tests passing
- All manual smoke tests passing
- Performance metrics acceptable (<2<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms ML, <3<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms feed)
- Visual QA approved
- Security checks passed
- Integration tests passed
- Mobile responsiveness verified

**Ready for production deployment.**

EOF

git add docs/agent-coordination.md
git commit -m "chore: mark verification complete - ready for production

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin dev/phase-1-4-complete
```

---

## Task 6: Staged Production Deployment

**Goal:** Deploy to production with staged rollout and rollback plan.

---

### Pre-Deployment

**Step 1: Create git tag**

```bash
git tag -a v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>-ml-transformation -m "Phase 1-4 complete: ML integration, visual polish, admin dashboard"
git push origin v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>-ml-transformation
```

**Step 2: Backup production database**

```bash
# SSH to database EC2 via SSM
aws ssm start-session --target i-<REDACTED_DB_PASSWORD>b9<REDACTED_DB_PASSWORD>dcecaeadf43a2

# In SSM session
mysqldump -u REDACTED_DB_USER -p gigsdb > backup-pre-v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>-$(date +%Y%m%d).sql

# Upload to S3 (create bucket if needed)
aws s3 cp backup-pre-v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>-*.sql s3://wtc-backups/
exit
```

**Expected:** Database backup uploaded to S3

---

### Stage 1: Frontend Deployment

**Deploy to S3:**

```bash
cd gigfinder-app

# Build
REACT_APP_API_BASE=https://api.whatsthecraic.run.place \
  NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=1<REDACTED_DB_PASSWORD>24" \
  npm run build --legacy-peer-deps

# Deploy to S3
aws s3 sync build/ s3://wtc-ui-385<REDACTED_DB_PASSWORD>17713886-eu-west-1/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E2HRBT<REDACTED_DB_PASSWORD>I8G9WPY \
  --paths "/*"
```

**Verify:**

```bash
# Wait for invalidation to complete (check AWS console)
# Visit production site
curl -I https://whatsthecraic.run.place
```

**Expected:** Status 2<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>, site loads

**Test:**
- [ ] Visit https://whatsthecraic.run.place
- [ ] Dashboard loads
- [ ] No console errors
- [ ] Search works

**Rollback Plan:** Redeploy previous S3 version if issues

---

### Stage 2: Backend Services Deployment

**Deploy ML Service:**

```bash
cd ml-service

# Build
docker build -t whatsthecraic/ml-service .

# Tag
docker tag whatsthecraic/ml-service \
  385<REDACTED_DB_PASSWORD>17713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/ml-service:v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>

# Push to ECR
aws ecr get-login-password --region eu-west-1 | \
  docker login --username AWS --password-stdin \
  385<REDACTED_DB_PASSWORD>17713886.dkr.ecr.eu-west-1.amazonaws.com

docker push 385<REDACTED_DB_PASSWORD>17713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/ml-service:v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>

# Deploy to k8s
kubectl set image deployment/ml-service \
  ml-service=385<REDACTED_DB_PASSWORD>17713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/ml-service:v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD> \
  -n whatsthecraic

kubectl rollout status deployment/ml-service -n whatsthecraic
```

**Verify:**

```bash
curl https://api.whatsthecraic.run.place/v1/model/info
```

**Expected:** Returns model version and metrics

**Rollback:** `kubectl rollout undo deployment/ml-service -n whatsthecraic`

**Repeat for other services if updated:**
- events-service
- auth-service
- aggregator

---

### Stage 3: Configuration Updates

**Update GitHub Actions secret:**

Via GitHub UI:
- Settings → Secrets and variables → Actions
- Update `EC2_INSTANCE_ID` to `i-<REDACTED_DB_PASSWORD>77f139e3295<REDACTED_DB_PASSWORD>6bf5`

**Deploy ML retraining cron:**

```bash
kubectl apply -f k8s/ml-retrain-cronjob.yaml -n whatsthecraic
kubectl get cronjobs -n whatsthecraic
```

**Expected:** Cron job created

---

### Stage 4: Post-Deployment Verification

**Smoke test production:**

- [ ] Visit https://whatsthecraic.run.place
- [ ] Sign up new user
- [ ] Connect Spotify
- [ ] View personalized feed
- [ ] Test "Fans Like You" section
- [ ] Test explainability modal
- [ ] Save/hide events → verify feedback sent
- [ ] Visit https://whatsthecraic.run.place/admin/ml
- [ ] Verify model info displays

**Monitor metrics:**

```bash
# Check CloudWatch metrics
# Check Prometheus
curl https://api.whatsthecraic.run.place/metrics | grep ml_
```

**Expected:** No errors, metrics looking healthy

---

### Stage 5: Monitoring & Cleanup

**Set up CloudWatch alarms:**

- ML prediction latency >5<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms
- Error rate >1%
- Model training failures

**Cleanup git worktrees:**

```bash
git worktree remove /tmp/wtc-worktrees/worktree-backend-api
git worktree remove /tmp/wtc-worktrees/worktree-ml-intelligence
git worktree remove /tmp/wtc-worktrees/worktree-frontend-core
git worktree remove /tmp/wtc-worktrees/worktree-visual-media
git worktree remove /tmp/wtc-worktrees/worktree-admin-devops

rm -rf /tmp/wtc-worktrees
```

**Merge dev to master:**

```bash
git checkout master
git merge dev/phase-1-4-complete
git push origin master
```

**Delete dev branch:**

```bash
git branch -d dev/phase-1-4-complete
git push origin --delete dev/phase-1-4-complete
```

**Update documentation:**

- Update README.md with new features
- Update docs/ops-runbook.md
- Create docs/ML_FEATURES.md

---

### Deployment Sign-Off

**Master Checklist:**
- [ ] Frontend deployed to S3 + CloudFront invalidated
- [ ] Backend services deployed to k8s
- [ ] Database migrations applied (if needed)
- [ ] GitHub Actions updated
- [ ] ML retraining cron configured
- [ ] Production smoke tests passing
- [ ] Monitoring/alerts configured
- [ ] Documentation updated
- [ ] Cleanup complete
- [ ] Dev branch merged to master

---

## Success Criteria

**Technical:**
- ✅ All 4 phases complete (~2<REDACTED_DB_PASSWORD> tasks)
- ✅ React Error #31 fixed
- ✅ ML service integrated with frontend
- ✅ Rich images everywhere
- ✅ Mixcloud integration complete
- ✅ Admin ML dashboard built
- ✅ TLS certificates valid
- ✅ All tests passing
- ✅ ML prediction latency <2<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms p95
- ✅ Frontend deployed to CloudFront
- ✅ Backend services deployed to k8s

**User Experience:**
- ✅ Platform feels premium
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

## Rollback Plan

If critical issues discovered in production:

**Frontend rollback:**
```bash
# Redeploy previous S3 version
aws s3 sync s3://wtc-ui-385<REDACTED_DB_PASSWORD>17713886-eu-west-1-backup/ \
  s3://wtc-ui-385<REDACTED_DB_PASSWORD>17713886-eu-west-1/ --delete
aws cloudfront create-invalidation --distribution-id E2HRBT<REDACTED_DB_PASSWORD>I8G9WPY --paths "/*"
```

**Backend rollback:**
```bash
kubectl rollout undo deployment/ml-service -n whatsthecraic
kubectl rollout undo deployment/events-service -n whatsthecraic
```

**Database rollback:**
```bash
# Restore from backup
aws s3 cp s3://wtc-backups/backup-pre-v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>-*.sql .
mysql -h 172.31.3<REDACTED_DB_PASSWORD>.66 -u REDACTED_DB_USER -p gigsdb < backup-pre-v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>-*.sql
```

---

**End of Implementation Plan**
