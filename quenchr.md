# Quenchr — Current Progress (March 24, 2026)

## What's Working End-to-End
- **Feed Audit** — Screenshots + Live Scan → NSFWJS classification → Feed Score (0-100)
- **Live Scan** — Screen recording via `react-native-nitro-screen-recorder`, frame extraction, NSFW classification
- **Cleanup tasks** — 12 guided tasks (6 Instagram, 6 TikTok) with deep links
- **Gamification** — Streaks, badges (7), levels (5), challenges (12), points
- **Auth** — Email/password signup + login via Supabase Auth
- **AI Insights** — Claude Haiku vision API via Supabase Edge Function (deployed + API key set)
- **All 5 tabs** — Dashboard, Audit, Cleanup, Challenges, Profile

## Design Overhaul — In Progress
Switching from dark navy theme → cream/brown aesthetic per `quenchr-design-spec.md`.

### Completed
- **Fonts installed**: DM Serif Display (400) + DM Sans (400, 500, 600, 700) via `@expo-google-fonts`
- **Branding assets extracted** to `apps/mobile/assets/branding/quenchr-logos/` (SVG icons + wordmarks)
- **Design tokens created** in `apps/mobile/src/tokens/`:
  - `colors.ts` — cream, ink, brown, charcoal, light, accents (gold, red)
  - `typography.ts` — h1-h3, bigNum, statNum, scoreNum, eyebrow, label, body, btn, nav
  - `spacing.ts` — pagePad (22), cardPad (18), cardGap (10), sectionGap (16) + radius tokens
- **Shared UI components** built in `apps/mobile/src/components/ui/`:
  - `PageHeader` — eyebrow + serif H1 + subtitle
  - `SectionDivider` — cream3 horizontal rule
  - `CardLight` — cream2 bg, cream3 border, r18
  - `CardDark` — char2 bg, r18
  - `PrimaryButton` — brown fill, cream text, r14
  - `SecondaryButton` — cream fill, brown text, brown3 border
  - `PillGroup` — generic selector pills (selected=brown fill, unselected=brown2 border)
  - `StatRow` — 3-column dark stat layout with gold accent option
  - `ProgressBar` — 4px height, gold fill, light/dark track variants
  - `ScoreRing` — SVG circle with animated dash, empty state em-dash
  - `Dropzone` — dashed brown3 border upload area
  - `AuditBanner` — "Run an Audit First" prompt card
- **Bottom tab navigator restyled** — char (#191714) background, SVG stroke icons (Home, Search, Broom, Trophy, User), DM Sans 9px uppercase labels, proper bottom padding for Android nav bar
- **Root layout updated** — font loading via `useFonts`, cream background, dark status bar
- **Dashboard screen restyled** — cream bg, PageHeader ("Your feed, on trial."), ScoreRing, dark streak card with StatRow, light "Today's Progress" card

### Remaining
- [ ] Remove `expo-navigation-bar` from package.json (causes native module error — just did this, needs pnpm install)
- [ ] Restyle Audit screen (platform pills, screenshot/live scan modes, dropzone)
- [ ] Restyle Cleanup screen (priority task rows, colored dots, dark how-it-works card)
- [ ] Restyle Challenges screen (dark challenge cards, gold points badge, progress bars)
- [ ] Restyle Profile screen (avatar, level card, badges grid, upgrade card, sign out)
- [ ] Build Settings screen with dev mode toggle (unlock Pro features for testing)
- [ ] Restyle auth screens (login, signup, onboarding)

## Key Fixes Applied This Session
1. **NSFWJS model 404** → Switched to jsDelivr CDN (`cdn.jsdelivr.net/gh/infinitered/nsfwjs@master/models/mobilenet_v2/`)
2. **stopGlobalRecording returning no file** → Added `retrieveLastGlobalRecording()` polling fallback (5 attempts, 1s apart)
3. **Frame extraction hang** → Normalized video path to `file://` URI + 10s per-frame timeout
4. **Bundled model loading failure** → Metro can't resolve dynamic `import()` in nsfwjs node_modules; reverted to URL-based loading

## Build Info
- **Latest APK**: `https://expo.dev/artifacts/eas/udmAMuLDu3UZ4wgrztUzmo.apk`
- **EAS Build**: `e47980b4-8fee-431f-b683-033ca12f3a72`
- **Dev server**: `npx expo start --dev-client --port 8082` from `apps/mobile`
- Note: design changes are JS-only (no new APK needed). But `expo-navigation-bar` removal + font packages will need a new EAS build eventually.

## Tech Stack
- React Native + Expo SDK 55, Expo Router, TypeScript, Zustand
- NSFWJS + TensorFlow.js (on-device), Claude Haiku (Edge Function)
- Supabase (Postgres, Auth, Edge Functions)
- Turborepo + pnpm monorepo
- Fonts: DM Serif Display + DM Sans (@expo-google-fonts)
