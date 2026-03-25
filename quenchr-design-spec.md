# Quenchr — Design System & Build Spec

## Stack Assumption
React Native + Expo, file-based routing via Expo Router, `@shopify/restyle` or plain `StyleSheet`. All values below are RN-compatible.

---

## Color Tokens

```js
// tokens/colors.ts
export const colors = {
  // Cream surfaces
  cream:  '#F4EEE2',  // page background
  cream2: '#EBE3D2',  // card background
  cream3: '#D8CDB8',  // mini card / bar track
  cream4: '#B8AC96',  // borders

  // Ink — for use on cream surfaces ONLY
  ink:  '#1A1710',    // headings, primary text
  ink2: '#3D3829',    // body text, descriptions
  ink3: '#6B6354',    // labels, captions, muted
  ink4: '#9A9186',    // placeholders

  // Brown — CTAs and interactive elements on cream
  brown:  '#3D2810',  // button fill, pill fill (selected), primary CTA
  brown2: '#5C3D1A',  // pill border (unselected)
  brown3: '#7A5530',  // dropzone border, secondary accents

  // Charcoal — dark cards and nav
  char:  '#191714',   // bottom nav background
  char2: '#222018',   // dark card background
  char3: '#2E2B22',   // dark card secondary surface
  char4: '#3C382D',   // dark card borders, step number fill

  // Light — for use on charcoal surfaces ONLY
  lt:  '#F4EEE2',     // primary text on dark
  lt2: '#C8C1B0',     // secondary text on dark
  lt3: '#8A8275',     // muted text on dark
  lt4: '#524E44',     // very muted / nav inactive

  // Accents
  gold: '#C4922A',    // points, streak numbers
  red:  '#B83F3F',    // errors, critical priority, sign out
}
```

---

## Typography

```js
// tokens/typography.ts
// Fonts: DM Serif Display (400) + DM Sans (400, 500, 600, 700)
// Load via expo-font or @expo-google-fonts

export const type = {
  // DM Serif Display — headings, big numbers, card titles on dark
  h1:        { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 38, lineHeight: 38 },
  h2:        { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 26, lineHeight: 30 },
  h3:        { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 20, lineHeight: 24 },
  bigNum:    { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 52, lineHeight: 52 },
  statNum:   { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 30, lineHeight: 30 },
  scoreNum:  { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 26, lineHeight: 26 },

  // DM Sans — everything else
  eyebrow:   { fontFamily: 'DMSans_700Bold', fontSize: 9,  letterSpacing: 1.4, textTransform: 'uppercase' },
  label:     { fontFamily: 'DMSans_700Bold', fontSize: 9,  letterSpacing: 1.5, textTransform: 'uppercase' },
  body:      { fontFamily: 'DMSans_500Medium', fontSize: 13, lineHeight: 19 },
  bodySmall: { fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 17 },
  caption:   { fontFamily: 'DMSans_600SemiBold', fontSize: 10, letterSpacing: 0.6 },
  btn:       { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  btnSm:     { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  pillText:  { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  navLabel:  { fontFamily: 'DMSans_700Bold', fontSize: 9,  letterSpacing: 0.8, textTransform: 'uppercase' },
}
```

---

## Spacing & Radius

```js
// tokens/spacing.ts
export const spacing = {
  pagePad:    22,   // horizontal page padding
  cardPad:    18,   // card internal padding
  cardGap:    10,   // gap between cards
  sectionGap: 16,   // gap after rule divider
}

export const radius = {
  card:   18,
  pill:   12,
  btn:    14,
  mini:   14,
  badge:  13,
  stat:   12,
  avatar: 999,
}
```

---

## Component Specs

### Pills (platform / mode selector)

```
Unselected:
  background: transparent
  border: 1.5px solid brown2 (#5C3D1A)
  text color: brown (#3D2810)
  borderRadius: 12

Selected:
  background: brown (#3D2810)
  border: 1.5px solid brown (#3D2810)
  text color: lt (#F4EEE2)
```

### Primary Button (on cream)

```
background:     brown (#3D2810)
text:           lt (#F4EEE2)
borderRadius:   14
paddingVertical: 14
font:           DMSans_700Bold 14px
```

### Secondary Button (on dark card)

```
background: cream (#F4EEE2)
text:       brown (#3D2810)
border:     1.5px solid brown3 (#7A5530)
borderRadius: 12–14
```

### Card — Light

```
background:   cream2 (#EBE3D2)
border:       0.5px solid cream3 (#D8CDB8)
borderRadius: 18
padding:      18
// All text uses ink / ink2 / ink3 / ink4 palette
```

### Card — Dark

```
background:   char2 (#222018)
borderRadius: 18
padding:      18
// All text uses lt / lt2 / lt3 / lt4 palette
```

### Stat Row (inside dark card)

```
Layout:     3-column grid, 1px char4 (#3C382D) gaps
Cell bg:    char2 (#222018)
Number:     DMSerifDisplay 30px, color lt (#F4EEE2)
Label:      DMSans 10px, color lt3 (#8A8275)
Gold accent on points number: gold (#C4922A)
```

### Section Divider

```
height:          1
background:      cream3 (#D8CDB8)
marginHorizontal: 22
marginBottom:    16
```

### Bottom Nav

```
background:   char (#191714)
height:       82 (includes home indicator space)
paddingBottom: 16
icon:         18×18 stroke, color lt4 inactive / lt active
label:        DMSans_700Bold 9px uppercase, letterSpacing 0.8
```

### Score Ring (Dashboard)

```
SVG circle
  radius: 46, strokeWidth: 7
  track:  cream3 (#D8CDB8)
  fill:   brown (#3D2810) — stroke-dasharray animated on mount

Center number: DMSerifDisplay 26px, color ink (#1A1710)
Center label:  DMSans_700Bold 8px uppercase, color ink3, letterSpacing 2
Empty state:   show em dash (—) with "NO SCORE YET" label
```

### Dropzone (screenshot upload)

```
border:        1.5px dashed brown3 (#7A5530)
borderRadius:  14
paddingVertical: 26
align:         center
icon stroke:   brown3 (#7A5530)
title:         DMSans_700Bold 13px, brown (#3D2810)
subtitle:      DMSans_500Medium 11px, brown3 (#7A5530)
```

### Progress Bar

```
height:       4
track (light): cream3 (#D8CDB8)
track (dark):  char4 (#3C382D)
fill:          gold (#C4922A)
borderRadius:  2
```

### Audit Banner ("Run an Audit First")

```
background:   cream2 (#EBE3D2)
border:       1px solid cream4 (#B8AC96)
borderRadius: 14
padding:      13
icon:         search, stroke ink2
title:        DMSans_700Bold 13px, ink (#1A1710)
subtitle:     DMSans_500Medium 11px, ink2 (#3D3829)
chevron:      ink3
```

---

## Screen Inventory

| Screen | Tab | Eyebrow | H1 | Subtitle |
|---|---|---|---|---|
| Dashboard | Home | "Quenchr" | "Your feed, on trial." | "Here's where things stand. Brace yourself." |
| Audit | Audit | "Forensics" | "Feed Audit." | "Screenshot your Explore or FYP. We'll do the rest." |
| Cleanup | Cleanup | "Remediation" | "Cleanup Session." | "0 of 3 tasks done today. Let's fix that." |
| Challenges | Challenges | "Daily" | "Challenges." | "0 of 1 completed. Not great, not terrible." |
| Profile | Me | "You" | "Redemption Arc." | *(none — let the H1 breathe)* |

### Page Layout Pattern (every screen)

```
1. Page header
     paddingHorizontal: 22
     paddingTop: 26
     paddingBottom: 16
     — eyebrow (9px uppercase, ink3)
     — H1 (DMSerifDisplay 38px, ink)
     — subtitle (DMSans 13px, ink2)

2. Horizontal rule divider
     height: 1, cream3, marginHorizontal: 22, marginBottom: 16

3. Scrollable content
     paddingHorizontal: 22
     paddingBottom: 82 (clears nav)
```

---

## Screen-by-Screen Notes

### Dashboard

- Feed Score card (light): score ring SVG + empty state copy + "Start Audit" brown button
- Streak card (dark): 3-column stat row, gold on Points
- Today's Progress card (light): 2-column mini grid, gold on Challenges number

### Audit

- Platform pills row: Instagram / TikTok
- Mode pills row: Screenshots / Live Scan
- **Screenshots mode:**
  - Light card with numbered how-it-works steps
  - Dropzone (dashed brown border)
  - "Scan My Feed" brown primary button
- **Live Scan mode:**
  - Dark card with numbered steps
  - Error strip (red tint, red text) — "Not currently recording"
  - "Start Recording" brown primary button
  - Privacy note strip (dark char3 background, lt3 text)

### Cleanup

- Platform pills: Instagram / TikTok
- Audit banner (dashed prompt to run audit first)
- Cleanup plan card (light): priority task rows with colored dots
  - Red dot → CRITICAL
  - Gold dot → HIGH
  - cream4 dot → MED
  - cream3 dot → LOW
- "Start Cleanup Session" brown primary button
- Metadata caption below button: "~20 MINUTES · 115 POINTS"
- How it works card (dark)

### Challenges

- Challenge card (dark):
  - Title: DMSerifDisplay 20px, lt
  - Platform tag: 9px uppercase, lt4
  - Points badge: gold tint bg, gold text
  - Body copy: DMSans 13px, lt3
  - Progress bar (dark track)
  - Completion count: 9px uppercase, lt4
  - CTA button: cream fill, brown text (secondary button style)
- Empty state below: serif "More to unlock." + two lines of muted copy

### Profile

- Avatar circle: char background, lt serif initial, 52×52
- User name: DMSerifDisplay 20px, ink
- Email: DMSans 12px, ink2
- FREE TIER badge: cream3 bg, brown text, 9px uppercase
- Level card (light):
  - Large number: DMSerifDisplay 52px, ink (e.g. "01")
  - Sub-label beside it: "Beginner Scroller", DMSans 13px, ink2
  - Gold progress bar + pts caption
- Stats card (dark): 3-column stat row
- Badges card (light): 3×2 grid, dimmed (opacity 0.3) until earned
- Upgrade card (dark): serif "Go Pro." headline + cream secondary button
- Sign Out: DMSans_700Bold 13px, red, centered

---

## Microcopy Reference

| Location | Copy |
|---|---|
| Dashboard score empty state | "Unscored. Like your moral compass, apparently. Run an audit to find out how bad it actually is." |
| Audit screenshots step 2 | "Scroll naturally. We'll pretend to believe you." |
| Live Scan privacy note | "Recording stays on device. Only extracted frames are analyzed — then deleted. We have enough problems of our own." |
| Cleanup sub-header | "0 of 3 tasks done today. Let's fix that." |
| Challenges sub-header | "0 of 1 completed. Not great, not terrible." |
| Challenges empty state line 1 | "More to unlock." |
| Challenges empty state line 2 | "Improve your score to reveal new challenges." |
| Challenges empty state line 3 | "Or just keep being a mystery." |
| Profile level sub-label | "Beginner Scroller" |

---

## Fonts — Installation

```bash
npx expo install @expo-google-fonts/dm-serif-display @expo-google-fonts/dm-sans expo-font
```

Required weights:
- `DMSerifDisplay_400Regular`
- `DMSans_400Regular`
- `DMSans_500Medium`
- `DMSans_600SemiBold`
- `DMSans_700Bold`

---

## Suggested Build Order

1. Token files — `colors.ts`, `typography.ts`, `spacing.ts`
2. Shared components:
   - `PillGroup`
   - `CardLight`
   - `CardDark`
   - `PrimaryButton`
   - `SecondaryButton`
   - `StatRow`
   - `SectionDivider`
   - `ProgressBar`
   - `ScoreRing`
   - `Dropzone`
   - `AuditBanner`
3. Bottom tab navigator with correct nav styling
4. Dashboard screen
5. Audit screen (screenshot + live scan modes)
6. Cleanup screen
7. Challenges screen
8. Profile screen
