# Quenchr — Project Memory

## What Is This?

An app that helps people **clean their social media algorithms** of sexually provocative content (thirst traps, IG models, OnlyFans promoters, gooner material). Nothing like this exists — apps like Quittr handle the habit/accountability side, but nothing actually fixes the feed itself. Users can't scroll in public, at work, or around family without anxiety because their algorithm is poisoned.

## The Product

**Two deliverables:**
1. **React Native mobile app** (iOS + Android) — guided cleanup, feed auditing, gamification
2. **Chrome browser extension** — real-time NSFW detection + content filtering on web versions

**MVP platforms:** Instagram + TikTok (hardest but biggest need — no APIs available)
**Future platforms:** Twitter/X, Reddit, YouTube (these have usable APIs for bulk unfollow/unsub)

## The Hook — Feed Audit

The viral "how long before a thirst trap" challenge proves the problem exists. We build this INTO the app:
- User screenshots their Explore/FYP → on-device ML scans and scores it
- Generates a **Feed Score** (0-100, lower = cleaner)
- "Your Instagram Explore is 47% thirst traps" → shareable card = viral loop
- Then the app guides them through cleaning it with daily tasks + gamification

## Monetization — Freemium

| Feature | Free | Pro ($6.99/mo) |
|---------|------|-----------------|
| Platforms | 1 | All 5 |
| Feed Audits | 1/week | Unlimited |
| Daily Tasks | 3/day | Unlimited |
| Daily Challenges | 1/day | 3/day + weekly |
| Browser Extension | No | Yes |
| Feed Score History | Last 3 | Full history + trends |
| Leaderboard | View only | Participate |

Paywall triggers: after first audit result, adding 2nd platform, hitting daily task limit, accessing extension, after 7-day streak.

## Tech Stack

- **Mobile:** React Native + Expo (SDK 55, managed workflow with Dev Client, Expo Router, EAS Build)
- **State Management:** Zustand
- **Backend:** Supabase (Postgres + Auth + Edge Functions + Realtime)
- **Browser Extension:** TypeScript + Manifest V3 + NSFWJS (TensorFlow.js)
- **NSFW Detection:** NSFWJS + TensorFlow.js on-device for mobile + extension (MobileNet v2, ~6MB)
- **Monorepo:** Turborepo + pnpm workspaces
- **Payments:** RevenueCat (mobile) + Stripe (extension/web)

## Project Structure

```
quenchr/
├── apps/
│   ├── mobile/              # React Native (Expo SDK 55)
│   │   ├── app/             # Expo Router file-based routing
│   │   │   ├── (auth)/      # login.tsx, signup.tsx, onboarding.tsx
│   │   │   ├── (tabs)/      # dashboard, audit, cleanup, challenges, profile
│   │   │   ├── _layout.tsx  # Root layout (auth listener)
│   │   │   └── index.tsx    # Entry redirect (auth check)
│   │   └── src/
│   │       ├── stores/      # Zustand (auth, audit, cleanup, subscription)
│   │       ├── components/  # SessionProgressBar, CleanupStepView, SessionCompleteView, AuditResultCard, ScanningProgressView, AuditResultsView, ShareableScoreCard, LiveScanView, AIInsightsSection
│   │       ├── services/    # nsfw-classifier.ts, screen-capture.ts, ai-insights.ts
│   │       ├── types/       # Type declarations for native modules
│   │       └── hooks/       # useCleanupInit, useChallengesInit (data-fetching)
│   │
│   └── extension/           # Chrome extension (Phase 6)
│
├── packages/
│   ├── shared/              # Types, constants, scoring algo, challenge templates, recommendation engine, badges, levels
│   └── supabase-client/     # Typed Supabase client + all query functions
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   # 8 tables + RLS + trigger
│   │   ├── 002_ai_insights.sql      # ai_insights table
│   │   ├── 003_cleanup_progress_unique.sql  # unique constraint fix
│   │   └── 004_user_challenges_unique.sql  # prevent duplicate daily assignments
│   └── seed.sql             # 12 cleanup tasks + 12 challenges
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Database Schema (8 tables)

- **users** — id, email, display_name, subscription_tier, onboarding_complete
- **user_platforms** — which platforms each user is tracking
- **feed_audits** — audit snapshots (total_scanned, nsfw/sexy/neutral counts, feed_score)
- **cleanup_tasks** — task templates with instruction_steps (jsonb), deep_links, points
- **user_cleanup_progress** — tracks which tasks each user completed
- **streaks** — current_streak, longest_streak, total_points
- **challenges** — challenge templates with action_type, target_count, points
- **user_challenges** — assigned challenges with progress tracking

All tables have RLS policies. Auto-creates user profile + streak row on auth signup via trigger.

## Current Status — Live Scan + Model Fixes Applied, Needs Device Retest 🔧

### EAS Build + Device Testing ✅
- App successfully building and running on physical Android device via EAS Dev Client
- **7 EAS build attempts** to get it working — key fixes:
  - Git repo must be at monorepo root (not just `apps/mobile/`)
  - `.npmrc` with `node-linker=hoisted` required for pnpm on EAS
  - `metro.config.js` with `watchFolders` + `nodeModulesPaths` for monorepo
  - `babel.config.js` with `react-native-reanimated/plugin`
  - All deps updated to SDK 55 compatible versions (13 packages)
  - `expo-camera@~55.0.9` added to override transitive dep from tfjs-react-native
- **Runtime fixes applied:**
  - `database.types.ts` converted from UTF-16 → UTF-8 (Supabase CLI on Windows outputs UTF-16)
  - AsyncStorage added to Supabase client for RN auth persistence (no `localStorage` in RN)
  - Auto media library permission request on Feed Audit screen mount
  - `expo-image-picker` plugin added to `app.json` for Android photo permissions

### Live Scan — RESTORED with react-native-nitro-screen-recorder v0.6.3
- v0.6.2+ explicitly updated to RN 0.83.1 + Expo SDK 55 (the old version was pre-0.6.2, targeting RN 0.81.x)
- `screen-capture.ts` rewritten with real `startGlobalRecording`/`stopGlobalRecording` + `expo-video-thumbnails` frame extraction
- Live Scan toggle re-enabled in `audit.tsx`, LiveScanView import restored
- Stale type declaration file `src/types/react-native-nitro-screen-recorder.d.ts` deleted (was overriding real types)
- Expo config plugin added to `app.json` (camera/mic permissions disabled — not needed for screen recording)
- **EAS build SUCCEEDED** — APK ready: `https://expo.dev/artifacts/eas/udmAMuLDu3UZ4wgrztUzmo.apk`
- Build URL: https://expo.dev/accounts/jadebroccoli/projects/quenchr/builds/e47980b4-8fee-431f-b683-033ca12f3a72

### Device Testing Results (2026-03-24)
Two bugs found during device testing, both fixed (JS-only, no new EAS build needed):

**Bug 1: NSFWJS model 404** — `https://nsfwjs.com/quant_nsfw_mobilenet/model.json` is DEAD (nsfwjs.com took the CDN down due to hotlinkers). Both Screenshot and Live Scan modes fail because the model can't load.
- **Fix:** Changed from remote URL to bundled model loading: `nsfwjs.load('MobileNetV2', { size: 224 })` — the model ships inside the `nsfwjs` npm package as `.min.js` files with base64-encoded weights. Zero network dependency now.
- File: `apps/mobile/src/services/nsfw-classifier.ts` line 33+55

**Bug 2: Live Scan frame extraction hangs** — Recording works (MediaProjection permission dialog appears, recording starts/stops successfully), but "Extracting frames..." state hangs forever.
- **Root cause:** `react-native-nitro-screen-recorder` returns absolute paths (e.g. `/data/data/.../recording.mp4`) but `expo-video-thumbnails` needs `file://` URIs. The `getThumbnailAsync` call hangs silently instead of erroring.
- **Fix:** Added `ensureFileUri()` helper to normalize paths to `file://` URIs. Also added 10s per-frame timeout via `withTimeout()` so extraction can't hang forever. Increased `settledTimeMs` from 500→1000ms for more reliable video finalization. Added console logging throughout.
- File: `apps/mobile/src/services/screen-capture.ts`

**Status:** Fixes committed & pushed (commit `700e01d`). Needs device retest — just reload JS bundle via dev client (shake → Reload), no new APK install needed.

### EAS / GitHub Config
- **GitHub repo:** `jadebroccoli/quenchr` (PAT: `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`)
- **EAS project ID:** `edddd098-860c-4bae-8b59-56363582d446`
- **Supabase project URL:** `https://eppabyjffqxvkammskuq.supabase.co`
- **Latest APK:** `https://expo.dev/artifacts/eas/udmAMuLDu3UZ4wgrztUzmo.apk` (build e47980b4, includes Live Scan)
- **EAS build profiles:** development (APK), development-device, preview, production
- Each profile needs `"node": "22.12.0"` and `"pnpm": "9.15.0"`

### Build Checklist (for next EAS build)
1. `git add` + `git commit` + `git push` all changes
2. `cd apps/mobile && npx eas-cli build --platform android --profile development --non-interactive`
3. Download APK → install on device → `npx expo start --dev-client`

---

## Completed Phases

### Phase 1 — Foundation ✅
- [x] Turborepo monorepo with pnpm workspaces (4 packages linked)
- [x] Expo project with Expo Router (file-based routing)
- [x] Shared package: all TypeScript types, platform constants, Feed Score calculation, streak logic, challenge templates
- [x] Supabase client package: typed client, all CRUD query functions (users, platforms, audits, tasks, streaks, challenges)
- [x] Database migration SQL with 8 tables, indexes, RLS policies, and signup trigger
- [x] Seed data: 12 cleanup tasks (6 Instagram, 6 TikTok) + 12 challenges
- [x] 4 Zustand stores: auth-store, audit-store, cleanup-store, subscription-store
- [x] Auth flow: Login screen, Signup screen (Supabase email auth)
- [x] Onboarding: Platform picker (select which platforms to clean)
- [x] Tab navigator: 5 tabs (Dashboard, Audit, Cleanup, Challenges, Profile)
- [x] Dashboard, Audit, Cleanup, Challenges, Profile screens — all built with full UI
- [x] Session-based cleanup flow (launcher → guided session → celebration) with recommendation engine

### Phase 2 — Feed Audit ML ✅
- [x] NSFWJS + TensorFlow.js integration (on-device MobileNet v2, ~6MB model)
- [x] Grid segmentation pipeline (3x4 = 12 regions per screenshot)
- [x] `nsfw-classifier.ts` service: model loading, classification, progress tracking
- [x] `ScanningProgressView` — full-screen animated progress UI
- [x] `AuditResultsView` — animated score reveal, health badge, breakdown bars
- [x] `ShareableScoreCard` — off-screen rendered shareable PNG via react-native-view-shot + expo-sharing
- [x] 3-state audit screen flow (input → scanning → results)
- [x] Supabase persistence for audit results

### Phase 2B — Expo Dev Client + Live Screen Recording ✅ (pending device test)
- [x] Switched from Expo Go to Expo Dev Client (`expo-dev-client`)
- [x] `eas.json` with development, preview, production build profiles
- [x] `react-native-nitro-screen-recorder@0.6.3` + `react-native-nitro-modules@0.33.8` — global screen recording (MediaProjection + ReplayKit)
- [x] `screen-capture.ts` service: `startGlobalRecording`/`stopGlobalRecording` + frame extraction via `expo-video-thumbnails`
- [x] `LiveScanView.tsx` component: idle → recording (pulsing dot + timer) → extracting states
- [x] Mode toggle on audit screen (Screenshots | Live Scan) — **re-enabled**
- [x] Shared `processClassificationResults()` helper — both modes use same pipeline
- [x] AppState listener for detecting return from social media apps
- [x] Expo config plugin for nitro-screen-recorder in `app.json`
- [ ] **PENDING:** Device testing after EAS build completes

### Phase 2C — Claude Haiku AI Insights (Pro Feature) ✅
- [x] AI Insights types: `ContentType`, `AccountType`, `FrameInsight`, `AIInsightsResult`, etc. in shared package
- [x] `AI_INSIGHTS_CONFIG` constants + `hasAIInsights` added to tier limits
- [x] Database migration `002_ai_insights.sql` — `ai_insights` table with JSONB + RLS
- [x] Supabase Edge Function `ai-feed-analysis/index.ts` — auth verification, Pro gate, Claude Haiku vision call, JSON parsing, DB persistence
- [x] `ai-insights.ts` service: frame selection, base64 conversion, Edge Function invocation
- [x] Audit store: `aiInsights` state with status/result/error + setters + resetScan integration
- [x] `AIInsightsSection.tsx` component: 4 states (loading shimmer, success with breakdown/recs, error + retry, locked/free CTA)
- [x] Integrated into `AuditResultsView` between stats row and share button
- [x] Fire-and-forget async AI trigger in `processClassificationResults()` — basic results show instantly, AI loads behind shimmer
- [x] Zero new TypeScript errors introduced

### Phase 3 — Wire Cleanup to Supabase ✅
- [x] Migration `003_cleanup_progress_unique.sql` — unique constraint on `(user_id, task_id)` for correct upsert behavior
- [x] Fixed `completeCleanupTask()` — added `{ onConflict: 'user_id,task_id' }` to prevent duplicate rows
- [x] Fixed `getStreak()` — changed `.single()` to `.maybeSingle()` for safety
- [x] Added `getTasksCompletedToday(userId)` — server-side daily limit enforcement via count query
- [x] Added `computeStreakUpdate()` to `scoring.ts` — streak continuation/reset logic reusing `isStreakActive()`
- [x] Reconciled `seed.sql` — updated points to match gameplay-tested values, added deep links (`instagram://explore`), improved instruction step wording, kept all 12 tasks
- [x] Created `useCleanupInit` hook — fetches 6 queries in parallel (both platforms tasks + progress + streak + challenges + daily count), hydrates cleanup store
- [x] Updated `CleanupStepView` — `saving` prop with ActivityIndicator on Done button + disabled state
- [x] Rewrote `cleanup.tsx` — deleted 164 lines of hardcoded `ALL_TASKS`, wired to Supabase store, `handleStepComplete` now persists to Supabase (task completion + streak update), loading/error/no-auth states
- [x] Zero new TypeScript errors introduced (9 pre-existing)

### Phase 4 — Gamification ✅
- [x] Migration `004_user_challenges_unique.sql` — unique constraint on `(user_id, challenge_id, assigned_date)` to prevent duplicate daily assignments
- [x] Added `getAllChallenges(includePremium)` query — fetch challenge templates from DB
- [x] Added `assignDailyChallenges(userId, challengeIds)` query — insert user_challenges rows
- [x] Added `selectDailyChallenges()` to shared `challenges.ts` — Fisher-Yates shuffle, platform-aware random selection
- [x] Created `badges.ts` in shared package — `evaluateBadges()` evaluates all 7 badges against user data (streak, audits, task count)
- [x] Added `LEVELS` constant (5 levels: Beginner→Master, 0-1000+ pts) + `getLevel()` function to scoring.ts
- [x] Created `useChallengesInit` hook — fetches today's challenges, auto-assigns if none exist (1 for free, 3 for pro), stores in cleanup store
- [x] Rewrote `challenges.tsx` — deleted mock data, wired to Supabase via useChallengesInit, "I did this!" progress button, challenge completion awards 25 pts via streak update, loading/error/no-auth/all-done states
- [x] Updated `profile.tsx` — dynamic badge unlocks (locked=0.4 opacity, unlocked=full + checkmark), level card with progress bar, reads audits from audit store
- [x] Updated `dashboard.tsx` — replaced hardcoded "0" challenges with dynamic count from cleanup store
- [x] Updated `cleanup.tsx` — auto-increments matching platform challenges when cleanup task completed (fire-and-forget)
- [x] Zero genuinely new TypeScript errors (1 new follows pre-existing `database.types.ts → never` pattern)

### What's Done But Not Originally Tracked:
- [x] First EAS build working (development profile, Android APK)
- [x] Migrations 001-004 applied to Supabase
- [x] Seed data loaded
- [x] App running on physical Android device via Dev Client
- [x] Auth flow working (Supabase email/password with AsyncStorage persistence)

### What's NOT built yet:
- [ ] **Live Scan device RE-test** — model URL fix + frame extraction fix applied (JS-only), needs reload + retest on device
- [ ] Deploy Edge Function + set `ANTHROPIC_API_KEY` secret (need `supabase functions deploy ai-feed-analysis`)
- [ ] Email confirmation disabled in Supabase for dev testing (Dashboard → Auth → Email → disable "Confirm email")

## What's Next

### Phase 4: Gamification — Challenges, Badges, Dashboard (Week 4-5)

The challenges screen (`challenges.tsx`) is 10% done — UI renders 3 hardcoded challenges with a manual "+1 Progress" button. No Supabase, no persistence, progress resets on reload. The dashboard has a hardcoded "Challenges = 0" count. Profile shows all 7 badges permanently locked (opacity 0.4). Supabase already has the tables (`challenges`, `user_challenges`) and queries (`getTodayChallenges`, `updateChallengeProgress`).

#### 4A: Supabase Edge Function — Daily Challenge Assignment

**File:** `supabase/functions/assign-daily-challenges/index.ts` — NEW

Edge Function that runs on app launch (or scheduled via cron):
1. Check if user already has challenges assigned for today (`user_challenges.assigned_date = today`)
2. If not, select challenges from the `challenges` table:
   - Free users: 1 random non-premium challenge matching their platforms
   - Pro users: 3 challenges (mix of platform-specific + cross-platform)
3. Insert rows into `user_challenges` with `assigned_date = today`, `progress = 0`, `completed = false`
4. Return assigned challenges

Alternatively: do this client-side in a hook (simpler for MVP, no Edge Function needed — just query existing challenges and auto-assign if none exist today).

#### 4B: Wire Challenges Screen to Supabase

**File:** `apps/mobile/app/(tabs)/challenges.tsx` — REWRITE

1. Delete hardcoded `DAILY_CHALLENGES` array and `MockChallenge` type
2. Create `useChallengesInit` hook (or extend `useCleanupInit`) to:
   - Call `getTodayChallenges(userId)` on mount
   - Auto-assign if no challenges for today (call assignment logic)
   - Hydrate `cleanup-store.challenges`
3. Replace local `useState` progress with `updateChallengeProgress()` Supabase calls
4. Award points on challenge completion → `computeStreakUpdate()` + `updateStreak()`
5. Add loading/error states (same pattern as cleanup.tsx Phase 3)
6. Show "Come back tomorrow" state when today's challenges are all done

#### 4C: Auto-Tracking Challenge Progress

The hard part: challenges like "Tap Not Interested on 5 posts" can't be tracked automatically because Instagram/TikTok have no APIs. Options:

**Option A (MVP — manual confirmation):** Keep the progress button but label it "I did this" with a count. User self-reports. Simpler, honest about limitations.

**Option B (better — tie to cleanup tasks):** When a user completes a cleanup task of type `not_interested`, automatically increment any active challenge with `action_type = 'not_interested'`. Wire `handleStepComplete()` in `cleanup.tsx` to also check and update matching challenges.

**Option C (future — extension-driven):** Browser extension detects actual "Not Interested" clicks and syncs to Supabase, incrementing challenge progress server-side.

Recommended: **Option B** for MVP (tie to cleanup tasks), upgrade to **Option C** when extension ships.

#### 4D: Badge Unlock System

**File:** `packages/shared/src/badges.ts` — NEW

Define unlock conditions for each of the 7 badges:
```
first_audit    → user has ≥1 feed_audits row
streak_7       → streaks.longest_streak ≥ 7
streak_30      → streaks.longest_streak ≥ 30
score_under_20 → any feed_audits.feed_score ≤ 20
score_under_5  → any feed_audits.feed_score ≤ 5
tasks_50       → COUNT(user_cleanup_progress) ≥ 50
platform_mastered → completed all non-premium tasks for one platform
```

**File:** `apps/mobile/app/(tabs)/profile.tsx` — EDIT

Replace static 0.4 opacity badges with dynamic unlock check:
- Fetch user stats on mount (audits count, streak, task count, etc.)
- Evaluate each badge condition → set opacity to 1.0 for unlocked badges
- Show earned date for unlocked badges
- Animate badge unlock if it just happened this session

#### 4E: Dashboard Wiring

**File:** `apps/mobile/app/(tabs)/dashboard.tsx` — EDIT

1. Replace hardcoded `challenges: 0` with `useCleanupStore((s) => s.challenges)` count of completed today
2. Optionally add a "Feed Score History" mini-chart (sparkline):
   - Query `getFeedAudits(userId)` to get last N scores
   - Render with `react-native-svg` or simple View-based bars
   - Free users see last 3, Pro users see full history

#### 4F: Points & Level Display

The `Streak` table already tracks `total_points`. Map points to levels on the profile:
```
0-99      → Level 1: "Polluted Feed"
100-499   → Level 2: "Cleaning Up"
500-999   → Level 3: "Getting Better"
1000-2499 → Level 4: "Almost Clean"
2500+     → Level 5: "Pure Feed"
```

Display on profile screen as a progress bar toward next level.

#### Files Summary (Phase 4)

| # | File | Action |
|---|------|--------|
| 1 | `supabase/functions/assign-daily-challenges/index.ts` or client-side hook | NEW — daily challenge assignment |
| 2 | `apps/mobile/app/(tabs)/challenges.tsx` | REWRITE — delete hardcoded data, wire to Supabase |
| 3 | `apps/mobile/src/hooks/useChallengesInit.ts` | NEW — data-fetching + auto-assignment |
| 4 | `apps/mobile/app/(tabs)/cleanup.tsx` | EDIT — auto-increment matching challenge progress on task complete |
| 5 | `packages/shared/src/badges.ts` | NEW — badge unlock condition evaluators |
| 6 | `apps/mobile/app/(tabs)/profile.tsx` | EDIT — dynamic badge unlocks + level display |
| 7 | `apps/mobile/app/(tabs)/dashboard.tsx` | EDIT — wire challenges count + optional score history chart |

---

### Phase 5: Paywall + Polish (Week 5-6)

The subscription store works (`useSubscriptionStore` with `tier`, `isPro()`, `limits`) and is checked throughout the app (cleanup task limits, challenge counts, AI insights gate). But it's always `'free'` because there's no payment flow. Profile has a mock "Upgrade to Pro" button that shows an alert.

#### 5A: RevenueCat Integration

**Files:**
- `apps/mobile/src/services/revenue-cat.ts` — NEW: RevenueCat SDK initialization, offering fetch, purchase flow, restore purchases
- `apps/mobile/app/_layout.tsx` — EDIT: Initialize RevenueCat on app launch, sync subscription status to `useSubscriptionStore.setTier()`
- `packages/supabase-client/src/queries.ts` — EDIT: Add `updateSubscriptionTier(userId, tier)` to persist tier to Supabase `users` table

**Flow:**
1. App launch → `Purchases.configure({ apiKey })` → check current entitlements
2. If user has active entitlement → `setTier('pro')`
3. On purchase → `Purchases.purchasePackage(offering)` → update store + Supabase
4. On restore → `Purchases.restorePurchases()` → same sync

**RevenueCat Dashboard Setup (manual):**
- Create project, add iOS App Store + Google Play Store apps
- Create entitlement "pro_access"
- Create offering "default" with monthly ($6.99) + annual ($49.99) packages
- Set up App Store Connect / Play Console products

#### 5B: Paywall Modal

**File:** `apps/mobile/src/components/PaywallModal.tsx` — NEW

Full-screen modal with:
1. Feature comparison table (Free vs Pro — matches the table in `memory.md`)
2. Price display ($6.99/mo or $49.99/yr — "Save 40%")
3. Purchase buttons (monthly / annual)
4. Restore purchases link
5. Close button
6. Legal links (Terms, Privacy)

#### 5C: Paywall Trigger Points

Wire `PaywallModal` at these existing trigger points:
- **After first audit result** → `AuditResultsView` shows modal after score reveal
- **Adding 2nd platform** → `onboarding.tsx` platform picker triggers when selecting >1
- **Hitting daily task limit** → `cleanup.tsx` `handleStepComplete()` already shows Alert, replace with modal
- **Accessing AI Insights** → `AIInsightsSection` locked state already has "Upgrade to Pro" CTA
- **After 7-day streak** → Dashboard shows congratulations + upgrade prompt
- **Challenges daily limit** → `challenges.tsx` when trying to access 2nd/3rd challenge on free

#### 5D: Push Notifications

**Dependencies:** `expo-notifications`

**File:** `apps/mobile/src/services/notifications.ts` — NEW

Notification types:
1. **Daily reminder** (configurable time, default 9am): "Time to clean your feed! Your streak is at 5 days"
2. **Streak-at-risk** (8pm if no activity today): "Don't lose your 12-day streak! Complete one task to keep it going"
3. **Weekly recap** (Sunday evening): "This week: 15 tasks done, score improved 62→48"
4. **Challenge reminder** (afternoon if uncompleted): "You still have 2 challenges left today"

**Implementation:**
- Request notification permission in onboarding (last step)
- Schedule local notifications via `expo-notifications` (no server push needed for MVP)
- Store user preferences in `users` table (notifications_enabled, reminder_time)
- Recalculate/reschedule on each app launch

#### 5E: Onboarding Polish

**File:** `apps/mobile/app/(auth)/onboarding.tsx` — EDIT

Current onboarding: just a platform picker. Add 3-4 intro slides before:
1. "Your feed is poisoned" — problem statement with stat graphic
2. "Audit → Cleanup → Maintain" — how the app works (3-step visual)
3. "Pick your platforms" — existing platform picker
4. "Enable notifications?" — permission request

Use `react-native-reanimated` or simple `FlatList` with pagination dots.

#### 5F: App Store Assets

Not code — manual work:
- App icon (multiple sizes)
- Screenshots (6.7" iPhone, 6.5" iPhone, 12.9" iPad, phone + 7" tablet for Android)
- Feature graphic (Google Play)
- App Store description + keywords
- Privacy policy + Terms of Service URLs

#### Files Summary (Phase 5)

| # | File | Action |
|---|------|--------|
| 1 | `apps/mobile/src/services/revenue-cat.ts` | NEW — RevenueCat SDK wrapper |
| 2 | `apps/mobile/app/_layout.tsx` | EDIT — RevenueCat init + subscription sync |
| 3 | `apps/mobile/src/components/PaywallModal.tsx` | NEW — full paywall UI |
| 4 | `apps/mobile/app/(tabs)/cleanup.tsx` | EDIT — replace daily limit Alert with PaywallModal |
| 5 | `apps/mobile/src/components/AuditResultsView.tsx` | EDIT — post-audit paywall trigger |
| 6 | `apps/mobile/src/services/notifications.ts` | NEW — local push notifications |
| 7 | `apps/mobile/app/(auth)/onboarding.tsx` | EDIT — add intro slides + notification permission |

---

### Phase 6: Browser Extension (Week 6-8)

The `apps/extension/` directory exists but is empty. This is a Pro-only Chrome extension that provides real-time NSFW detection and content filtering on the web versions of Instagram, TikTok, Twitter, Reddit, and YouTube.

#### 6A: Extension Scaffolding

**Files:**
- `apps/extension/manifest.json` — Manifest V3 with permissions: `activeTab`, `storage`, host permissions for social media domains
- `apps/extension/src/background.ts` — Service worker: manages state, communicates with content scripts
- `apps/extension/src/popup/` — Popup UI (React or vanilla HTML): toggle on/off, session stats, login
- `apps/extension/tsconfig.json` + `package.json` — TypeScript + build tooling (esbuild or webpack)

#### 6B: NSFWJS Content Pipeline

**File:** `apps/extension/src/classifier.ts` — NEW

Reuse the same NSFWJS model from the mobile app:
1. Load MobileNet v2 model (~6MB) on extension install/startup
2. Content script sends image URLs/blobs to background worker via `chrome.runtime.sendMessage`
3. Background classifies → returns result
4. Content script applies blur overlay to flagged images

**Optimization:** Cache classification results by image URL hash to avoid re-scanning on scroll-back.

#### 6C: Content Scripts (per platform)

**Files:**
- `apps/extension/src/content/instagram.ts` — MutationObserver on `article` elements, image extraction from `<img>` tags in feed/explore/reels
- `apps/extension/src/content/tiktok.ts` — MutationObserver on video thumbnails and preview images
- `apps/extension/src/content/common.ts` — Shared overlay injection logic (blur filter + Quenchr badge)

**Core loop:**
1. `MutationObserver` detects new DOM nodes (infinite scroll adds content)
2. Extract `<img>` and `<video poster>` sources
3. Send to background for classification
4. If flagged → inject CSS blur overlay (`filter: blur(20px)`) + small badge
5. User can click badge to reveal or mark "Not Interested"

#### 6D: Auto "Not Interested" (Rate-Limited)

**File:** `apps/extension/src/content/auto-actions.ts` — NEW

Optional (user-toggled) feature:
- When a flagged post is detected, simulate "Not Interested" click
- **Rate-limited:** Max 1 action per 30 seconds to avoid detection/ban
- Uses platform-specific selectors to find and click the menu → "Not Interested" option
- Log each action for challenge progress tracking

⚠️ **Risk:** Platforms may detect automated clicks. Ship as opt-in with clear disclaimer.

#### 6E: Popup UI

**File:** `apps/extension/src/popup/popup.html` + `popup.ts` — NEW

Small popup when clicking extension icon:
- Session stats: "Blocked 12 images this session"
- Total stats: "247 images blocked all-time"
- Toggle switches: Enable/disable per site, auto-actions on/off
- Login/link to Quenchr account (Supabase auth via popup OAuth flow)
- "Open Quenchr App" deep link

#### 6F: Supabase Sync

**File:** `apps/extension/src/services/sync.ts` — NEW

Sync extension stats back to Supabase:
- `extension_sessions` table (new migration): session_id, user_id, platform, images_scanned, images_blocked, actions_taken, started_at, ended_at
- Batch sync every 5 minutes or on popup close
- Increment challenge progress for `action_type = 'not_interested'` when auto-actions fire
- Stats visible on mobile app dashboard

#### 6G: Build & Submit

- Build pipeline: esbuild/webpack → bundle content scripts + background + popup
- Test on Chrome Canary with `--load-extension` flag
- Chrome Web Store Developer account ($5 one-time)
- Store listing: screenshots, description, privacy policy
- Review process: 1-3 business days

#### Files Summary (Phase 6)

| # | File | Action |
|---|------|--------|
| 1 | `apps/extension/manifest.json` | NEW — Manifest V3 config |
| 2 | `apps/extension/src/background.ts` | NEW — service worker |
| 3 | `apps/extension/src/classifier.ts` | NEW — NSFWJS model loading + classification |
| 4 | `apps/extension/src/content/instagram.ts` | NEW — Instagram content script |
| 5 | `apps/extension/src/content/tiktok.ts` | NEW — TikTok content script |
| 6 | `apps/extension/src/content/common.ts` | NEW — shared overlay/blur logic |
| 7 | `apps/extension/src/content/auto-actions.ts` | NEW — rate-limited auto "Not Interested" |
| 8 | `apps/extension/src/popup/` | NEW — popup UI (stats, toggles, login) |
| 9 | `apps/extension/src/services/sync.ts` | NEW — Supabase sync for stats + challenges |
| 10 | `supabase/migrations/004_extension_sessions.sql` | NEW — extension_sessions table |

## Key Product Decisions

- **Screen recording for Feed Audit (V2)** — User strongly prefers MediaProjection (Android) / ReplayKit (iOS) for live scanning while scrolling, over the screenshot approach. Screenshot is MVP, screen recording is the target.
- **No content blurring** — The app only needs to FLAG thirst content, not blur it. The goal is diagnosis + cleanup guidance, not real-time filtering (that's what the extension does).
- **Session-based cleanup, not task lists** — After audit, users get a personalized "Cleanup Session" (like a doctor's treatment plan) with tasks sorted by impact: Settings changes (critical) → Not Interested blitz (high) → Unfollow review (medium) → History clearing (maintenance). One task shown at a time, not a wall of checkboxes.
- **Cleanup Session = workout, not homework** — Progress bar, timers, points per step, celebration screen. Uses the same psychology that made feeds addictive in the first place.

## Key Technical Decisions

- **Instagram/TikTok have NO usable APIs** — zero endpoints for unfollow, "not interested", or feed access. The app uses guided manual cleanup (step-by-step instructions + deep links) instead of automation.
- **On-device ML only** — all NSFW classification happens on the user's device. No images sent to any server. Privacy is a feature.
- **Browser extension is Pro-only** — this is the highest-value feature and the strongest conversion lever.
- **Accessibility Services (Android) rejected** — Google Play Store rejects these since Oct 2025. Not viable for distribution.
- **Proxy/MITM rejected** — Certificate pinning defeats it, high ToS risk, poor UX.

## Competitive Landscape

| App | What it does | Gap |
|-----|-------------|-----|
| Quittr | Habit tracking for porn/masturbation | Doesn't fix the algorithm |
| Fortify | Recovery program + accountability | Doesn't fix the algorithm |
| Brainbuddy | CBT-based porn addiction recovery | Doesn't fix the algorithm |
| Unhook | Removes YouTube recommendations | YouTube only, no NSFW detection |
| NSFW Filter (ext) | Blurs NSFW images in Chrome | Extension only, no mobile, no cleanup guidance |
| **Quenchr** | **Audits + cleans the algorithm itself** | **This is the gap we fill** |

## How to Run

```bash
# 1. Add your Supabase credentials
cp apps/mobile/.env.example apps/mobile/.env
# Edit .env with your SUPABASE_URL and SUPABASE_ANON_KEY

# 2. Run the migrations in your Supabase dashboard (SQL Editor)
# Paste contents of supabase/migrations/001_initial_schema.sql
# Then paste supabase/migrations/002_ai_insights.sql
# Then paste supabase/migrations/003_cleanup_progress_unique.sql
# Then paste supabase/seed.sql for sample data

# 2b. Deploy Edge Function + set API key
supabase functions deploy ai-feed-analysis
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# 3. Build the dev client (first time only)
cd apps/mobile
eas build --profile development --platform android  # or ios

# 4. Install the APK on your device, then:
npx expo start --dev-client
```

## Key Dependencies

- `@tensorflow/tfjs`, `@tensorflow/tfjs-react-native`, `nsfwjs` — on-device NSFW classification
- `expo-gl` — WebGL backend for TensorFlow.js
- `expo-image-manipulator` — image cropping for grid segmentation
- `expo-video-thumbnails` — frame extraction from screen recordings
- `expo-image-picker` — photo library access for screenshot selection
- `expo-dev-client` — custom development builds (replaces Expo Go)
- `react-native-view-shot` — capture shareable score cards as PNG
- `expo-sharing` — native share sheet for score cards
- `@react-native-async-storage/async-storage` — Supabase auth persistence in React Native
- `react-native-reanimated@4.2.1` — animations (SDK 55 compatible version)
- `react-native-nitro-modules@0.33.9`, `react-native-nitro-screen-recorder@0.6.3` — cross-app screen recording (MediaProjection + ReplayKit)
