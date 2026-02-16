# Frontend Build Instructions

## Prerequisites

- Node.js v16+ installed
- npm v8+ installed
- Git access to `frontend-core` branch

## Build Steps

### 1. Navigate to Frontend Directory

```bash
cd /tmp/wtc-worktrees/worktree-frontend-core/gigfinder-app
```

### 2. Install Dependencies

```bash
npm install --legacy-peer-deps
```

**Note:** `--legacy-peer-deps` flag is required for React 19 compatibility with older peer dependencies.

### 3. Set Environment Variables

Create `.env.production` file:

```bash
cat > .env.production <<EOF
REACT_APP_API_BASE=https://api.whatsthecraic.run.place
REACT_APP_AUTH_BASE=https://auth.whatsthecraic.run.place
REACT_APP_TICKETMASTER_KEY=your_key_here
EOF
```

Or set inline during build:

```bash
REACT_APP_API_BASE=https://api.whatsthecraic.run.place npm run build --legacy-peer-deps
```

### 4. Build Production Bundle

```bash
npm run build --legacy-peer-deps
```

**Expected Output:**
```
Creating an optimized production build...
Compiled successfully.

File sizes after gzip:

  123.45 kB  build/static/js/main.abc123.js
  45.67 kB   build/static/css/main.def456.css
  ...

The project was built assuming it is hosted at /.
You can control this with the homepage field in your package.json.

The build folder is ready to be deployed.
```

### 5. Verify Build

```bash
ls -lh build/
ls -lh build/static/js/
ls -lh build/static/css/
```

Should see:
- `build/index.html` - Main HTML entry point
- `build/static/js/main.*.js` - Bundled JavaScript
- `build/static/css/main.*.css` - Bundled CSS
- `build/static/media/` - Image assets

### 6. Test Build Locally (Optional)

```bash
npx serve -s build -l 3000
```

Open browser to `http://localhost:3000` and verify:
- ✅ Dashboard loads without errors
- ✅ Hero section displays with ML match badge
- ✅ "This Weekend" carousel appears
- ✅ "Trending Near You" section loads
- ✅ Search defaults to "Search" mode when not logged in
- ✅ All ML components render correctly

---

## Deployment (DO NOT RUN YET - Wave 3 Only)

**These commands are for Wave 3 Admin & DevOps Agent only:**

### S3 Deployment

```bash
# DO NOT RUN - Example only
aws s3 sync build/ s3://your-bucket-name/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

---

## Troubleshooting

### Error: "Cannot find module 'react'"

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Error: "Peer dependency conflict"

**Solution:** Always use `--legacy-peer-deps` flag:
```bash
npm install --legacy-peer-deps
npm run build --legacy-peer-deps
```

### Error: "Module not found: Can't resolve '../services/mlAPI'"

**Cause:** mlAPI.js not present (should be added by ML Intelligence Agent in Wave 1)

**Solution:**
```bash
# Verify mlAPI.js exists
ls -l gigfinder-app/src/services/mlAPI.js

# Verify ML components exist
ls -l gigfinder-app/src/components/ml/
```

### Error: "getBestImage is not defined"

**Cause:** imageUtils missing

**Solution:**
```bash
# Verify imageUtils exists
ls -l gigfinder-app/src/utils/imageUtils.js
```

### Build succeeds but Dashboard blank

**Cause:** API_BASE environment variable not set

**Solution:**
```bash
# Rebuild with correct env vars
REACT_APP_API_BASE=https://api.whatsthecraic.run.place npm run build --legacy-peer-deps
```

---

## Build Performance

### Expected Build Time
- **Clean build:** 60-120 seconds
- **Incremental build:** 10-30 seconds

### Bundle Size Targets
- **Total JS:** < 500 kB (gzipped)
- **Total CSS:** < 100 kB (gzipped)
- **Main bundle:** < 200 kB (gzipped)

### Optimization Tips

1. **Code Splitting:** React.lazy() for routes
2. **Image Optimization:** Use WebP format for hero images
3. **Tree Shaking:** Remove unused lodash/moment functions
4. **CDN:** Offload images to CloudFront
5. **Compression:** Enable Brotli on CloudFront

---

## Wave 2 Changes Summary

### New Features in Build
- Premium ML-powered Dashboard with hero section
- This Weekend carousel (Fri-Sun events)
- Trending Near You section
- Because You Like [Genre] personalization
- Enhanced search flow (defaults to Search for unauth users)
- All ML components integrated

### Dependencies Added
- Framer Motion (already in package.json)
- ML API client (mlAPI.js)
- ML UI components (ExplainabilityModal, TasteProfilePanel, FeedbackButtons, EventDensityHeatMap)

### Files Modified
- `src/pages/Dashboard.jsx` (+385 lines)
- `src/pages/CombinedGigs.jsx` (modified mode logic)
- `docs/agent-coordination.md` (updated status)

---

## Next Steps After Build

1. ✅ Verify build completes without errors
2. ✅ Test locally with `npx serve -s build`
3. ✅ Check all premium sections render
4. ✅ Verify ML API integration (requires backend running)
5. ✅ Test mobile responsiveness (375px, 768px, 1024px)
6. ⏳ Deploy to S3 (Wave 3)
7. ⏳ Invalidate CloudFront cache (Wave 3)
8. ⏳ Run smoke tests on production URL (Wave 3)

---

## Contacts

- **Frontend Core Agent:** Wave 2 development complete
- **ML Intelligence Agent:** Wave 1 - mlAPI.js ready
- **Backend & API Agent:** Wave 1 - aggregator proxies ready
- **Admin & DevOps Agent:** Wave 3 - handles deployment

---

## Build Checklist

Before building:
- [ ] Wave 1 complete (ML components exist)
- [ ] node_modules installed (`--legacy-peer-deps`)
- [ ] Environment variables set (REACT_APP_API_BASE)
- [ ] Git status clean (all changes committed)

After building:
- [ ] Build completes without errors
- [ ] Build folder created (`build/`)
- [ ] Bundle sizes reasonable (< 500 kB total)
- [ ] Local test passes (`npx serve -s build`)
- [ ] Dashboard renders correctly
- [ ] Search defaults to Search mode when not logged in
- [ ] ML sections appear (when backend running)

---

**Last Updated:** 2026-02-16
**Status:** Ready for build verification ✅
**Next Agent:** Admin & DevOps (Wave 3)
