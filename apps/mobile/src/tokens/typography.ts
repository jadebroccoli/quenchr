import { TextStyle } from 'react-native';

// Fonts: DM Serif Display (400) + DM Sans (400, 500, 600, 700)
// Loaded via @expo-google-fonts

export const type = {
  // DM Serif Display — headings, big numbers, card titles on dark
  h1: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 38, lineHeight: 38 } as TextStyle,
  h2: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 26, lineHeight: 30 } as TextStyle,
  h3: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 20, lineHeight: 24 } as TextStyle,
  bigNum: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 52, lineHeight: 52 } as TextStyle,
  statNum: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 30, lineHeight: 30 } as TextStyle,
  scoreNum: { fontFamily: 'DMSerifDisplay_400Regular', fontSize: 26, lineHeight: 26 } as TextStyle,

  // DM Sans — everything else
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' } as TextStyle,
  label: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' } as TextStyle,
  body: { fontFamily: 'DMSans_500Medium', fontSize: 13, lineHeight: 19 } as TextStyle,
  bodySmall: { fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 17 } as TextStyle,
  caption: { fontFamily: 'DMSans_600SemiBold', fontSize: 10, letterSpacing: 0.6 } as TextStyle,
  btn: { fontFamily: 'DMSans_700Bold', fontSize: 14 } as TextStyle,
  btnSm: { fontFamily: 'DMSans_700Bold', fontSize: 13 } as TextStyle,
  pillText: { fontFamily: 'DMSans_700Bold', fontSize: 13 } as TextStyle,
  navLabel: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase' } as TextStyle,
} as const;
