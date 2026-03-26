# Quenchr — Project Status (March 25, 2026)

## Tech Stack
- React Native + Expo SDK 55, Expo Router, TypeScript, Zustand
- NSFWJS + TensorFlow.js (on-device quick scan), Claude Haiku 4.5 (AI-enhanced scan via Edge Function)
- Supabase (Postgres, Auth, Edge Functions, RLS)
- Turborepo + pnpm monorepo
- Fonts: DM Serif Display + DM Sans (@expo-google-fonts)
- Design: cream/brown aesthetic per `quenchr-design-spec.md`

## Build Info
- **Latest APK**: `https://expo.dev/artifacts/eas/udmAMuLDu3UZ4wgrztUzmo.apk`
- **EAS Build**: `e47980b4-8fee-431f-b683-033ca12f3a72`
- **Dev server**: `npx expo start --dev-client --port 8082` from `apps/mobile`
- **Supabase project**: `eppabyjffqxvkammskuq`
- **Edge Functions**: deployed with `--no-verify-jwt` (functions handle auth internally)
- Note: most changes are JS-only (no new APK needed), but RevenueCat + push notifications will require a new EAS build

---

## DONE

### Core Features
- [x] **Feed Audit — Screenshots mode**: pick images → NSFWJS grid classification → Feed Score
- [x] **Feed Audit — Live Scan mode**: screen recording via `react-native-nitro-screen-recorder` → frame extraction → classification
- [x] **Haiku AI scan pipeline**: NSFWJS runs first (fast, on-device), then Haiku 4.5 re-scans ALL frames for Pro users → updates score + breakdown with AI-enhanced results
- [x] **AI Insights**: Claude Haiku vision API analyzes flagged frames → content types, account types, recommendations (Edge Function deployed + ANTHROPIC_API_KEY set)
- [x] **Feed Score calculation**: 0-100 scale with health badges (Pure Feed, Almost Clean, Getting Better, etc.)
- [x] **Score history sparkline**: SVG line chart on Dashboard showing score over time (fetches last 20 audits)
- [x] **Shareable score card**: react-native-view-shot PNG generation
- [x] **Cleanup sessions**: 12 guided tasks (6 Instagram, 6 TikTok) with instruction steps + deep links
- [x] **Gamification**: streaks (current + longest), 7 badges, 5 levels, 12 challenges, points system
- [x] **Auth**: email/password signup + login via Supabase Auth
- [x] **Onboarding intro slides**: 3 swipeable screens with humor copy, AsyncStorage flag to show once
- [x] **Platform picker onboarding**: Instagram / TikTok selection after signup

### Design Overhaul (cream/brown aesthetic)
- [x] **Design tokens**: `apps/mobile/src/tokens/` — colors, typography, spacing, radius
- [x] **Shared UI components**: `apps/mobile/src/components/ui/` — PageHeader, SectionDivider, CardLight, CardDark, PrimaryButton, SecondaryButton, PillGroup, StatRow, ProgressBar, ScoreRing, ScoreHistory, Dropzone, AuditBanner, QuenchrLogo
- [x] **Fonts**: DM Serif Display (400) + DM Sans (400, 500, 600, 700) loaded via expo-font
- [x] **Branding assets**: extracted to `apps/mobile/assets/branding/quenchr-logos/`
- [x] **Bottom tab navigator**: char background, SVG stroke icons, DM Sans uppercase labels, Android nav bar padding (32px)
- [x] **Dashboard screen**: cream bg, ScoreRing, dark streak StatRow, Today's Progress mini grid
- [x] **Audit screen**: PillGroup selectors, dark how-it-works card, brown Start Recording button
- [x] **Cleanup screen**: restyled with design tokens
- [x] **Challenges screen**: restyled with design tokens
- [x] **Profile screen**: avatar, level card, badges grid, settings gear icon
- [x] **Auth screens**: login + signup restyled with QuenchrLogo, cream inputs, brown buttons
- [x] **LiveScanView**: restyled with design tokens (pulsing red dot, serif timer, brown buttons)
- [x] **Settings screen**: gear icon on Profile → dev mode toggle, account section, sign out

### Infrastructure
- [x] **Supabase**: 8 tables with RLS policies, 4 migrations applied, seed data (12 tasks + 12 challenges)
- [x] **Edge Functions**: `ai-feed-analysis` + `haiku-scan` deployed and active (--no-verify-jwt)
- [x] **ANTHROPIC_API_KEY**: set in Supabase secrets
- [x] **RevenueCat**: SDK imported with native module guard (try/catch for dev builds without it)
- [x] **Paywall screen**: `app/paywall.tsx` exists, modal presentation from bottom
- [x] **Dev mode toggle**: settings store → `isPro` returns true when dev mode is on

### Bug Fixes Applied
- [x] NSFWJS model 404 → switched to jsDelivr CDN
- [x] Bundled model loading failure → Metro can't do dynamic imports from node_modules
- [x] stopGlobalRecording returning no file → retrieveLastGlobalRecording polling fallback
- [x] Frame extraction hang → file:// URI normalization + 10s per-frame timeout
- [x] Edge Functions 401 → redeployed with --no-verify-jwt
- [x] Orphaned recordings → forceStopIfRecording() on LiveScanView mount
- [x] Recording state desync → stopScreenRecording allows stopping from idle state
- [x] expo-navigation-bar crash → removed import, use app.json navigationBarColor instead
- [x] RevenueCat EventEmitter crash → try/catch guard around require('react-native-purchases')
- [x] Tab bar hidden behind Android system nav → 32px bottom padding

---

## TODO — Immediate Priority

### Scoring / Accuracy
- [ ] **Score display is broken**: shows "0" even when 18% or 34% suggestive. The `feed_score` in DB and the big number on results screen are out of sync. Need to audit how `getFeedHealthInfo()` maps the percentage to the displayed score.
- [ ] **NSFWJS is too lenient**: even with threshold at 0.2, modern thirst traps aren't being caught. Consider: (a) lowering threshold further, (b) making Haiku the primary scanner for ALL users (not just Pro), or (c) accepting NSFWJS as "fast estimate" and always running Haiku as the real scan.
- [ ] **Audit results not persisting across navigation**: leaving the results screen (e.g., to toggle dev mode in Settings) loses the scan results. Need to persist current audit in Zustand more robustly, or cache frame URIs so AI analysis can re-run.

### Monetization
- [ ] **RevenueCat dashboard setup**: create products in Google Play Console first, then link in RC
  - `quenchr_pro_monthly` — $7.99/month
  - `quenchr_pro_annual` — $59.99/year
  - Entitlement: `pro`
- [ ] **Paywall trigger points** (6 locations):
  1. Post-first-audit → locked AI insights preview
  2. 2nd platform select → paywall
  3. AI Insights section → blurred preview + "Unlock with Pro"
  4. Daily cleanup task limit (after 1 free task) → paywall
  5. Challenge limits (1 free challenge) → paywall
  6. Profile "Go Pro" card → paywall
- [ ] **Native paywall UI**: design assets in `quenchr-paywall.zip` (extracted to `/tmp/paywall-extract/quenchr-handoff/`). Using native paywall first, then switching to RevenueCat paywalls later.

### Polish / Retention
- [ ] **Copy/personality pass**: level names, badge names, achievement descriptions, screen subtitles, empty states, error messages — all need dry, self-aware humor
- [ ] **Push notifications**: streak-at-risk alerts, daily cleanup reminders, weekly recaps (needs `expo-notifications` — requires new EAS build)
- [ ] **AuditResultsView styling**: still has old purple/green colors in some elements. Needs full cream/brown restyle.
- [ ] **CleanupStepView styling**: progress bar and "Done" button still use old green/purple colors

### Store Launch
- [ ] **Google Play Console**: create app listing, upload signed AAB
- [ ] **App Store Connect**: create app listing (need Apple Developer account)
- [ ] **Production EAS build**: set up production profile, build AAB + IPA
- [ ] **App icon + splash screen**: use Quenchr logo assets
- [ ] **Store screenshots + descriptions + keywords**

---

## TODO — Future (Phase 6+)

- [ ] **Browser extension**: Chrome extension scaffold exists at `apps/extension/` (empty). Real-time content filtering on web. Stripe payments.
- [ ] **Feed Score history mini-chart improvements**: animated line on mount, tap to see individual scores
- [ ] **Challenge auto-increment**: tie to cleanup task completion
- [ ] **Deep links for social media actions**: open specific Instagram/TikTok settings pages
- [ ] **Analytics integration**
- [ ] **GitHub Actions**: automated builds on push

---

## File Structure Reference

```
apps/mobile/app/
  (auth)/         login.tsx, signup.tsx, intro.tsx, onboarding.tsx
  (tabs)/         dashboard.tsx, audit.tsx, cleanup.tsx, challenges.tsx, profile.tsx
  _layout.tsx     Root layout (fonts, auth listener, RevenueCat init)
  index.tsx       Auth router (intro check → login or dashboard)
  paywall.tsx     Pro subscription paywall (modal)
  settings.tsx    Dev mode toggle, account settings

apps/mobile/src/
  components/ui/  PageHeader, CardLight, CardDark, PrimaryButton, SecondaryButton,
                  PillGroup, StatRow, ProgressBar, ScoreRing, ScoreHistory,
                  Dropzone, AuditBanner, QuenchrLogo
  components/     AuditResultsView, LiveScanView, ScanningProgressView,
                  CleanupStepView, SessionCompleteView, AIInsightsSection,
                  ShareableScoreCard
  services/       nsfw-classifier.ts, screen-capture.ts, haiku-scan.ts, ai-insights.ts
  stores/         auth-store.ts, audit-store.ts, cleanup-store.ts,
                  subscription-store.ts, settings-store.ts
  tokens/         colors.ts, typography.ts, spacing.ts, index.ts
  hooks/          useCleanupInit.ts, useChallengesInit.ts

packages/
  shared/         Types, Feed Score algorithm, challenge templates, badges, levels
  supabase-client/ Typed client + all DB queries

supabase/
  functions/      ai-feed-analysis/, haiku-scan/
  migrations/     004 migrations applied
  seed.sql        12 tasks + 12 challenges
```
