/**
 * Mindful Moment — Friction Pause + Personalized Interruption
 *
 * Opened via deep link:  quenchr://mindful?platform=instagram
 *                        quenchr://mindful?platform=tiktok
 *
 * iOS Shortcuts setup: Create an Automation that triggers
 * "When [Instagram / TikTok] is opened" → Action: "Open URLs"
 * → URL: quenchr://mindful?platform=instagram
 *
 * The "Open anyway" button is locked for FRICTION_DELAY_MS so
 * the user is forced to sit with at least one breath before bypassing.
 */

import { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Linking,
  BackHandler,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuditStore } from '../src/stores/audit-store';
import { useMindfulStore } from '../src/stores/mindful-store';
import { getFeedHealthInfo } from '@quenchr/shared';
import { OasisVisual } from '../src/components/ui/OasisVisual';
import { colors, type as typ, radius } from '../src/tokens';

// ── Config ──

/** How long (ms) before "Open anyway" unlocks. Creates real friction. */
const FRICTION_DELAY_MS = 5000;

const PLATFORM_URLS: Record<string, string> = {
  instagram: 'instagram://',
  tiktok: 'tiktok://',
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

// Smart default messages keyed to feed health
const DEFAULT_MESSAGES: Record<string, string> = {
  high:   "Your feed scored {score}. Every scroll is a vote for more of the same.",
  medium: "You're making progress — score {score} and dropping.\nDon't set yourself back.",
  low:    "Your feed is almost clean at {score}.\nHold the line.",
  none:   "You opened Quenchr for a reason.\nTake a breath first.",
};

// ── Breathing ──

type BreathPhase = 'inhale' | 'hold' | 'exhale';
const PHASES: BreathPhase[] = ['inhale', 'hold', 'exhale'];
const PHASE_DURATION: Record<BreathPhase, number> = { inhale: 4000, hold: 4000, exhale: 4000 };
const PHASE_LABELS: Record<BreathPhase, string> = {
  inhale: 'Breathe in',
  hold:   'Hold',
  exhale: 'Breathe out',
};

// ── Component ──

export default function MindfulScreen() {
  const { platform } = useLocalSearchParams<{ platform?: string }>();

  const currentAudit = useAuditStore((s) => s.currentAudit);
  const { personalMessage, recordPause } = useMindfulStore();

  const feedScore = currentAudit?.feed_score ?? null;
  const health = feedScore !== null ? getFeedHealthInfo(feedScore) : null;

  const platformKey = (platform ?? 'instagram').toLowerCase();
  const platformLabel = PLATFORM_LABELS[platformKey] ?? 'the app';
  const platformUrl = PLATFORM_URLS[platformKey] ?? 'instagram://';

  // Determine display message
  const rawDefault =
    feedScore === null
      ? DEFAULT_MESSAGES.none
      : feedScore >= 60
      ? DEFAULT_MESSAGES.high
      : feedScore >= 30
      ? DEFAULT_MESSAGES.medium
      : DEFAULT_MESSAGES.low;

  const displayMessage = (personalMessage.trim() || rawDefault).replace(
    '{score}',
    String(feedScore ?? ''),
  );

  // Friction delay — lock "Open anyway" for FRICTION_DELAY_MS
  const [unlocked, setUnlocked] = useState(false);
  const [countdown, setCountdown] = useState(Math.ceil(FRICTION_DELAY_MS / 1000));

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, Math.ceil((FRICTION_DELAY_MS - elapsed) / 1000));
      setCountdown(remaining);
      if (elapsed >= FRICTION_DELAY_MS) {
        setUnlocked(true);
        clearInterval(interval);
      }
    }, 250);
    return () => clearInterval(interval);
  }, []);

  // Breathing animation
  const circleAnim = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    runPhase(0);
    return () => {
      if (loopRef.current) clearTimeout(loopRef.current);
      if (animRef.current) animRef.current.stop();
    };
  }, []);

  function runPhase(idx: number) {
    const p = PHASES[idx % PHASES.length];
    setPhase(p);
    const toValue = p === 'exhale' ? 0 : 1;
    const anim = Animated.timing(circleAnim, {
      toValue,
      duration: PHASE_DURATION[p],
      easing: p === 'hold' ? Easing.linear : Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) loopRef.current = setTimeout(() => runPhase(idx + 1), 100);
    });
  }

  const circleSize = circleAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 160] });
  const circleOpacity = circleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.65] });

  // ── Actions ──

  async function handlePass() {
    await recordPause(true);
    if (router.canGoBack()) {
      router.back();
    } else if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      // iOS: just go to dashboard — Shortcut opened the app so there's no "back"
      router.replace('/(tabs)/dashboard');
    }
  }

  async function handleOpenAnyway() {
    if (!unlocked) return;
    await recordPause(false);
    try {
      const canOpen = await Linking.canOpenURL(platformUrl);
      if (canOpen) {
        await Linking.openURL(platformUrl);
      }
    } catch {}
    // Dismiss Quenchr after a brief delay so the other app comes to front
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else if (Platform.OS === 'android') BackHandler.exitApp();
      else router.replace('/(tabs)/dashboard');
    }, 300);
  }

  // ── Render ──

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Oasis thumbnail */}
        <View style={styles.oasisWrap}>
          <OasisVisual feedScore={feedScore} />
        </View>

        {/* Score chip */}
        {health && feedScore !== null && (
          <View
            style={[
              styles.scorePill,
              { backgroundColor: health.color + '20', borderColor: health.color + '50' },
            ]}
          >
            <Text style={[styles.scorePillText, { color: health.color }]}>
              Feed score {feedScore} · {health.label}
            </Text>
          </View>
        )}

        {/* Message */}
        <Text style={styles.message}>{displayMessage}</Text>

        {/* Breathing circle */}
        <View style={styles.circleWrap}>
          <Animated.View
            style={[
              styles.circle,
              { width: circleSize, height: circleSize, opacity: circleOpacity },
            ]}
          />
          <View style={styles.dot} />
        </View>
        <Text style={styles.phaseLabel}>{PHASE_LABELS[phase]}</Text>
        <Text style={styles.phaseSub}>4 · 4 · 4 breathing</Text>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.passBtn}
            onPress={handlePass}
            activeOpacity={0.85}
          >
            <Text style={styles.passBtnText}>I'll pass for now 🌱</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleOpenAnyway}
            disabled={!unlocked}
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
          >
            <Text style={[styles.openAnywayText, !unlocked && styles.openAnywayLocked]}>
              {unlocked
                ? `Open ${platformLabel} anyway →`
                : `Opening in ${countdown}s…`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.char,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
  },

  // Oasis
  oasisWrap: {
    width: '100%',
    marginBottom: 20,
  },

  // Score pill
  scorePill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 24,
  },
  scorePillText: {
    ...typ.label,
    fontSize: 12,
  },

  // Message
  message: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.lt,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 40,
  },

  // Breathing circle
  circleWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.brown,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.lt,
  },
  phaseLabel: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.lt,
    marginBottom: 6,
  },
  phaseSub: {
    ...typ.caption,
    color: colors.lt4,
    letterSpacing: 1,
    marginBottom: 48,
  },

  // Actions
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  passBtn: {
    width: '100%',
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 16,
    alignItems: 'center',
  },
  passBtnText: {
    ...typ.btn,
    color: colors.lt,
  },
  openAnywayText: {
    ...typ.body,
    color: colors.lt3,
  },
  openAnywayLocked: {
    color: colors.lt4,
  },
});
