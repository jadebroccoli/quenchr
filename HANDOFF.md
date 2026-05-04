# Quenchr / FeedCleanse — Dev Handoff

_Last updated: 2026-04-30_

---

## Stack

- **React Native** + Expo SDK 55, Expo Router, TypeScript
- **Zustand** for client state (auth, audit, subscription, settings)
- **Supabase** — Postgres + Auth + Edge Functions (Deno), migrated to the new **`sb_publishable_*` / `sb_secret_*`** API key format
- **EAS Build + EAS Submit** for iOS (TestFlight) and Android (Play Store)
- **RevenueCat** — integrated but not yet wired to real payments

---

## Repo layout

```
feedcleanse/
├── apps/mobile/
│   ├── app/              ← Expo Router screens + _layout.tsx
│   ├── src/
│   │   ├── components/   ← UI (AuditResultsView, LiveScanView, ScanHistoryList, …)
│   │   ├── services/     ← haiku-scan.ts, ai-insights.ts, screen-capture.ts
│   │   └── stores/       ← Zustand stores (auth, audit, subscription, settings)
│   └── eas.json
├── packages/
│   ├── shared/           ← types, recommendations, scoring helpers
│   └── supabase-client/  ← shared Supabase client (AsyncStorage, autoRefresh)
└── supabase/
    ├── config.toml       ← verify_jwt=false for both functions (see below)
    ├── migrations/
    └── functions/
        ├── haiku-scan/       ← Classifier (Claude Haiku vision)
        └── ai-feed-analysis/ ← Narrative + recommendations (dry-humor register)
```

---

## Current app version

| Platform | Version | Build |
|----------|---------|-------|
| iOS      | 0.1.0   | 8 (building now — commit 74159dc) |
| Android  | 0.1.0   | versionCode 9 (building now) |

`eas.json` has `autoIncrement: true` on preview profiles so build numbers bump automatically.

Build IDs (2026-04-16):
- iOS: `3eae6e2f-d39c-4b46-a2af-d2dc2ff383ba`
- Android: `51d252bb-fef5-47e2-bd89-06dd994fa351`

---

## Features shipped

### Scan flow
- **Screenshot scan** — user picks images from library, base64 + sent to `haiku-scan`
- **Live scan** — records screen, extracts up to 30 frames evenly across duration, caps at **3 min** (auto-stops + proceeds to analysis)
- **`haiku-scan`** — classifies each frame with Claude Haiku 4.5, returns per-frame data + overall_score
- **`ai-feed-analysis`** — second pass over flagged frames for false-positive detection, narrative summary, recommendations. Returns `adjusted_feed_score` which overrides Haiku's raw score on the results screen

### Scoring pipeline (server-side, `haiku-scan`)
- Per-frame `suggestive_score` is **clamped to its category band** (clean 0-15, mild 16-35, suggestive 36-65, explicit 66-100). Original unclamped score preserved in `_raw_score` for diagnostics.
- Final score = `hardPrev * 1.2 + hardIntensity * 0.3 + softPrev * 0.1` (no presenceBonus — the flat +15 was inflating scores for mostly-clean feeds)
- `adjusted_feed_score` from `ai-feed-analysis` overrides this on the results screen and in the DB

### Classifier prompt tuning (`haiku-scan`)
- Removed "Be STRICT / default to scoring HIGHER when uncertain" — was causing gender bias (flagging any woman on screen as a thirst trap)
- Removed the "fully-clothed woman posing → at least 40" anchor — same bias issue
- New principle: **intent and framing, not appearance**. A woman in a fitted outfit talking to camera = clean. A bikini close-up where the body is the explicit subject = suggestive.
- OF promos, lingerie, explicit content floors unchanged

### AI narrative (`ai-feed-analysis`)
- Added platform-context block: for TikTok FYP / Instagram Explore, content is algorithm-served (not followed). Prompt now bans "unfollow" for these surfaces and replaces it with platform-correct actions:
  - TikTok: long-press → "Not Interested" / "Don't Recommend this Creator"
  - Instagram Explore: three-dot → "Not Interested" / "Hide posts from [account]"

### Diagnostics
- **Client (`haiku-scan.ts`)**: raw `fetch` (not `functions.invoke`) with loud `console.log` of token source, prefix, response status, body preview. Error messages tagged `[no-token]` or `[401 from edge: ...]` so the in-app alert tells us which code path fired without tethering.
- **Server (`haiku-scan/index.ts`)**: logs full `score breakdown` summary + separate `frames: [...]` line with every frame's `{ idx, cat, score, raw, type }` for calibration analysis.

### Scan History
- `ScanHistoryList.tsx`, `ScoreSparkline.tsx`, `AuditResultsView.tsx`

### Auth
- Email/password via Supabase Auth. Session persisted via AsyncStorage.
- `_layout.tsx` gates rendering on `onAuthStateChange`'s `INITIAL_SESSION` event (not `getSession()`), preventing AsyncStorage hydration race conditions.

### Subscription
- `free | trial | pro` tiers. RevenueCat configured, paywall not processing real payments yet.

---

## The session-expiry saga — RESOLVED

**Symptom** (build 3 through build 7): every scan failed with `"Session expired. Please log out and log back in, then try again."`

**What we *thought* the bug was**: AsyncStorage hydration race — `getSession()` returning null before storage loaded. Spent multiple builds on client-side session fixes. **None worked.**

**Actual root cause**: the Supabase project was migrated to the new `sb_publishable_*` key format. Supabase's edge function **gateway `verify_jwt`** rejected every token with:

```
"sb_error_code": "UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM"
```

…meaning the JWT algorithm the gateway expected didn't match what the migrated project issues. Rejection happened at the gateway **before** our function code ran, which is why Logs tab was empty and function-side `supabase.auth.getUser(token)` was never the issue.

**Fix**: `supabase/config.toml` with `verify_jwt = false` for both functions, then redeploy. Our functions already validate JWTs manually via `supabase.auth.getUser(token)` with the service-role key, which works across algorithms. Gateway verification is redundant.

**Lesson for future debugging**: if Supabase "Logs" tab is empty but "Invocations" shows 401s, the gateway is rejecting before function code runs. Check `sb_error_code` in the invocation metadata.

---

## Pending tasks

### High priority
- [ ] **Classifier calibration** — continue tuning haiku-scan prompt. Current direction: less aggressive, intent/framing-based. Deploy with `supabase functions deploy haiku-scan --no-verify-jwt`
- [ ] **RevenueCat paywall** — wire RC purchases to set `subscription_tier` in DB
- [ ] **`trial_started_at` DB column** — server-side trial expiry instead of AsyncStorage

### Medium priority
- [ ] **Consider the legacy-keys migration** — project currently has BOTH publishable/secret AND legacy anon/service_role active. Don't click "Disable JWT-based API keys" until you've verified `SUPABASE_SERVICE_ROLE_KEY` in Edge Function Secrets works after migrating to the new `sb_secret_*` value.
- [ ] **App Store screenshots** — needed before public release

### Low priority
- [ ] **AuditResultsView copy** — "AI is double-checking..." still references old double-scan flow
- [ ] **Update to Supabase CLI v2.90.0** (currently v2.78.1, functions logs subcommand missing)

---

## Edge functions

### `haiku-scan` (v12+)
- Validates JWT via `supabase.auth.getUser(token)` with service role
- Free tier: 1 scan/week (pro/trial unlimited)
- Dev mode header `x-quenchr-dev-mode: true` bypasses quota
- Batches frames in groups of 5, sends to Claude Haiku 4.5 vision
- Clamps per-frame scores to category bands (see "Scoring pipeline" above)
- Returns per-frame classifications + overall_score

### `ai-feed-analysis` (v16+)
- Same auth + quota logic
- System prompt (in `buildSystemPrompt`) is **dry-humor register** with explicit rules:
  - NEVER mention "Haiku", "Claude", "Anthropic", "GPT", "model", "classifier", etc.
  - NEVER reference numeric score in the summary paragraph (UI shows it already)
  - Warm roast tone, specific and concrete, never mean or moralizing
- Returns `adjusted_feed_score` which the client now writes back to `feed_audits.feed_score` so the big number on the results screen matches the narrative

**Deploy command** (important: `--no-verify-jwt` flag):
```bash
supabase functions deploy haiku-scan --no-verify-jwt
supabase functions deploy ai-feed-analysis --no-verify-jwt
```

---

## DB migrations

- `005_purge_legacy_audits.sql` — deleted 7 pre-Haiku audit rows with `total_scanned > 30`. Those polluted score history/sparkline with numbers from the old NSFWJS-every-frame pipeline.

---

## EAS / deployment

- `eas.json` has `ascAppId: "6761809573"` in submit profiles (bypasses Apple interactive auth)
- iOS: `eas submit --platform ios --latest` or `--id <build-id>`
- Android: AAB uploaded manually to Play Console → Internal Testing

---

## Environment variables

`apps/mobile/.env`:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — currently `sb_publishable_5xXDQ...` (new format)
- `EXPO_PUBLIC_RC_IOS_API_KEY`
- `EXPO_PUBLIC_RC_ANDROID_API_KEY`

Supabase Edge Function secrets:
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL` (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` — currently still the **legacy** service_role JWT. Don't rotate to `sb_secret_*` without testing both functions still work.
