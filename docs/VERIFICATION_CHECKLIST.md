# Wave 3: Comprehensive Verification Checklist

**Branch:** `dev/phase-1-4-complete`
**Date:** 2<REDACTED_DB_PASSWORD>26-<REDACTED_DB_PASSWORD>2-16
**Status:** Ready for Manual Verification

---

## Automated Verification ✅ COMPLETE

- [x] **Security Scan:** No exposed secrets found
- [x] **Frontend Build:** Successful (314.83 kB main.js, 6.48 kB CSS)
- [x] **Code Integration:** All 3 agents merged cleanly
- [x] **Import Verification:** ML components properly wired

**Build Warnings (Non-Breaking):**
- 9 ESLint warnings (unused variables, useEffect dependencies)
- Minor cleanup recommended but not blocking deployment

---

## Manual Verification Required

### Phase 2: Smoke Testing (Browser Required)

**Prerequisites:**
```bash
# Start local development server
cd gigfinder-app
npm start
```

#### Test 1: Unauthenticated User Flow
- [ ] Visit http://localhost:3<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>
- [ ] Verify: Dashboard defaults to "Search" mode (not "For You")
- [ ] Search for "Dublin" → returns events
- [ ] Event cards show images (Spotify, Ticketmaster, or gradient placeholders)
- [ ] Source badges visible on cards
- [ ] No console errors in browser DevTools

#### Test 2: Authentication Flow
- [ ] Sign up new user
- [ ] Log in successfully
- [ ] Navigate to Dashboard
- [ ] Spotify connection widget visible
- [ ] Click "Connect Spotify" → OAuth redirect works
- [ ] After Spotify connect: Top genres/artists display
- [ ] No console errors

#### Test 3: ML-Powered Features
- [ ] Dashboard shows "For You" feed (after auth)
- [ ] "Fans Like You Also Saved" section appears
- [ ] Click "Why This?" button → ExplainabilityModal opens
- [ ] Modal shows rank reasons and match scores
- [ ] TasteProfilePanel displays radar chart of genres
- [ ] EventDensityHeatMap shows event density by day
- [ ] No errors in console

#### Test 4: Feedback & Interaction
- [ ] Save an event → Check browser Network tab (POST /v1/feedback expected)
- [ ] Hide an event → Check Network tab (POST /v1/feedback expected)
- [ ] Click event card → Check Network tab (click tracking expected)
- [ ] Thumbs up on event → Feedback sent (Network tab)
- [ ] Thumbs down on event → Feedback sent (Network tab)
- [ ] No JavaScript errors

#### Test 5: Visual & Media
- [ ] Event cards show rich images (not all gradient placeholders)
- [ ] DJ pages show real artist photos from Spotify/Mixcloud
- [ ] Mixcloud "Listen" or "Play" buttons appear on DJ pages
- [ ] Click Mixcloud button → player embeds correctly
- [ ] Player controls work (play, pause, volume)
- [ ] Images load quickly (check sessionStorage cache in DevTools)

#### Test 6: Admin Dashboard
- [ ] Navigate to http://localhost:3<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>/admin/ml
- [ ] Requires admin role (redirect if not admin)
- [ ] Model health widget shows version, metrics, latency
- [ ] A/B experiment results display (if available)
- [ ] "Manual Retrain" button visible
- [ ] Click retrain → triggers POST /v1/model/retrain
- [ ] No console errors

#### Test 7: Mobile Responsiveness
- [ ] Open DevTools → Toggle device toolbar (Cmd+Shift+M)
- [ ] Test iPhone SE (375px): Cards stack vertically, images scale
- [ ] Test iPad (768px): 2-column grid works, carousels scroll
- [ ] Test Desktop (1<REDACTED_DB_PASSWORD>24px+): Full 3-4 column layout
- [ ] Hero section responsive on all sizes
- [ ] No horizontal overflow or broken layouts

---

### Phase 3: Performance Testing

**ML Prediction Latency:**
```bash
# Test ML recommendations endpoint
curl -X POST http://localhost:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>4/v1/recommendations \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "city": "Dublin", "limit": 2<REDACTED_DB_PASSWORD>}' \
  -w "\nTime: %{time_total}s\n"
```

**Expected:** < <REDACTED_DB_PASSWORD>.2s (2<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms)

- [ ] ML prediction latency < 2<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms

**Feed Personalization Latency:**
```bash
# Get auth token from browser (DevTools → Application → localStorage → token)
TOKEN="<your-token-here>"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>/v1/users/me/feed \
  -w "\nTime: %{time_total}s\n"
```

**Expected:** < <REDACTED_DB_PASSWORD>.3s (3<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms)

- [ ] Feed latency < 3<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>ms

---

### Phase 4: Visual QA

**Design Consistency:**
- [ ] Dashboard looks premium (hero section, carousels, trending sections)
- [ ] Color scheme consistent (emerald #<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>d67d accent)
- [ ] Typography clean (Inter font family)
- [ ] Border radius consistent (12-16px on cards)
- [ ] Animations smooth (Framer Motion transitions)
- [ ] Images high quality, no broken placeholders
- [ ] Dark theme applied consistently
- [ ] Hover states work correctly
- [ ] Loading states display properly

---

### Phase 5: Integration Testing

**End-to-End ML Pipeline:**

1. **Create Test User:**
   ```bash
   # Sign up via UI or API
   # Connect Spotify account
   ```

2. **Generate Training Data:**
   - [ ] Save 3 "House" genre events
   - [ ] Save 2 "Techno" genre events
   - [ ] Hide 1 "Pop" genre event
   - [ ] Click on 5 different events

3. **Verify Feedback Stored:**
   ```bash
   # Check database (if accessible)
   mysql -h localhost -u REDACTED_DB_USER -p gigsdb \
     -e "SELECT * FROM ml_feedback WHERE action='save' ORDER BY created_at DESC LIMIT 5;"
   ```
   - [ ] Feedback entries present in database

4. **Trigger Model Retrain:**
   ```bash
   curl -X POST http://localhost:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>4/v1/model/retrain
   ```
   - [ ] Retrain completes successfully
   - [ ] Returns new metrics

5. **Get Personalized Recommendations:**
   ```bash
   curl -X POST http://localhost:4<REDACTED_DB_PASSWORD><REDACTED_DB_PASSWORD>4/v1/recommendations \
     -H "Content-Type: application/json" \
     -d '{"user_id": <your-user-id>, "city": "Dublin", "limit": 2<REDACTED_DB_PASSWORD>}'
   ```
   - [ ] Recommendations returned
   - [ ] House/Techno events rank higher than Pop
   - [ ] `rank_reasons` include "genre_match" or "collaborative"

---

### Phase 6: Security & Data Validation

**Secret Scanning:**
- [x] No database passwords in code ✅
- [x] No GitHub tokens in code ✅
- [x] No API keys hardcoded ✅

**Environment Variables Check:**
```bash
# Verify .env is in .gitignore
cat .gitignore | grep ".env"
```
- [ ] .env file not tracked by git

**HTTPS Enforcement:**
```bash
# Check production API uses HTTPS
curl -I https://api.whatsthecraic.run.place/health
```
- [ ] Production API responds over HTTPS
- [ ] Returns valid SSL certificate

---

## Verification Sign-Off

**Master Checklist:**
- [x] Phase 1: Automated tests passing ✅
- [ ] Phase 2: Manual smoke tests passing
- [ ] Phase 3: Performance metrics acceptable
- [ ] Phase 4: Visual QA approved
- [ ] Phase 5: Integration tests passing
- [ ] Phase 6: Security checks passed

**Approval:**
- [ ] All checks above completed
- [ ] No critical issues found
- [ ] Ready to proceed to deployment

---

## Next Steps After Verification

Once all checklist items are ✅:

1. **Update coordination file:**
   ```bash
   # Mark verification complete in docs/agent-coordination.md
   ```

2. **Create git tag:**
   ```bash
   git tag -a v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>-ml-transformation -m "Phase 1-4 complete"
   git push origin v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>-ml-transformation
   ```

3. **Backup production database:**
   ```bash
   # Follow docs/DEPLOYMENT_RUNBOOK.md backup section
   ```

4. **Deploy frontend to S3:**
   ```bash
   # Use scripts/deploy-frontend.sh
   ./scripts/deploy-frontend.sh
   ```

5. **Deploy ML service to k8s:**
   ```bash
   # Use scripts/deploy-ml-service.sh
   ./scripts/deploy-ml-service.sh
   ```

6. **Monitor production:**
   - Check CloudWatch logs
   - Verify ML recommendations working
   - Monitor error rates
   - Test production site manually

---

## Rollback Plan

If issues found in production:

**Frontend Rollback:**
```bash
# Redeploy previous S3 version
aws s3 sync s3://wtc-ui-385<REDACTED_DB_PASSWORD>17713886-eu-west-1-backup/ \
  s3://wtc-ui-385<REDACTED_DB_PASSWORD>17713886-eu-west-1/ --delete
aws cloudfront create-invalidation --distribution-id E2HRBT<REDACTED_DB_PASSWORD>I8G9WPY --paths "/*"
```

**Backend Rollback:**
```bash
# Rollback k8s deployment
kubectl rollout undo deployment/ml-service -n whatsthecraic
kubectl rollout status deployment/ml-service -n whatsthecraic
```

**Database Rollback:**
```bash
# Restore from backup
mysql -u REDACTED_DB_USER -p gigsdb < backup-pre-v2.<REDACTED_DB_PASSWORD>.<REDACTED_DB_PASSWORD>-2<REDACTED_DB_PASSWORD>26<REDACTED_DB_PASSWORD>216.sql
```

---

**Documentation:** See `docs/DEPLOYMENT_RUNBOOK.md` for complete deployment procedures.
