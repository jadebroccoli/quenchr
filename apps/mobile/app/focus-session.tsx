/**
 * Scroll-Free Focus Session
 *
 * Three states: picker → active → complete
 *
 * Timer is based on wall-clock (session.endsAt) so it
 * survives background/foreground transitions correctly.
 * A local notification fires at endsAt if the app is backgrounded.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useFocusStore, type FocusSession } from '../src/stores/focus-store';
import { useAuditStore } from '../src/stores/audit-store';
import { OasisVisual } from '../src/components/ui/OasisVisual';
import { colors, type as typ, radius, spacing } from '../src/tokens';

// ── Config ──

const DURATIONS = [
  {
    minutes: 15,
    label: 'Quick Break',
    desc: 'A short reset — clear your head',
    emoji: '🌱',
    points: 30,
  },
  {
    minutes: 30,
    label: 'Half Hour',
    desc: 'Enough to build some real momentum',
    emoji: '🌿',
    points: 60,
  },
  {
    minutes: 60,
    label: 'Full Hour',
    desc: 'A proper scroll-free block',
    emoji: '🌴',
    points: 120,
  },
  {
    minutes: 90,
    label: 'Deep Focus',
    desc: 'For when you mean business',
    emoji: '🏆',
    points: 180,
  },
] as const;

const QUOTES = [
  "The algorithm is waiting.\nYou're not.",
  "Clean feeds are built in\nmoments like this.",
  "Every minute counts toward\nyour Oasis.",
  "You're in control.\nKeep it that way.",
  "Your feed doesn't deserve\nyour attention right now.",
];

type SessionState = 'picker' | 'active' | 'complete';

// ── Helpers ──

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function scheduleNotification(
  endsAt: number,
  durationMinutes: number,
): Promise<string | null> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Session complete 🌴',
        body: `Your ${durationMinutes}-minute scroll-free session is done. Your Oasis is growing.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt) },
    });
  } catch {
    return null;
  }
}

async function cancelNotification(id: string | null) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

// ── Component ──

export default function FocusSessionScreen() {
  const { activeSession, startSession, completeSession, abandonSession } = useFocusStore();
  const feedScore = useAuditStore((s) => s.currentAudit?.feed_score ?? null);

  const [screenState, setScreenState] = useState<SessionState>(
    activeSession ? 'active' : 'picker',
  );
  const [selectedMinutes, setSelectedMinutes] = useState(30);
  const [msRemaining, setMsRemaining] = useState(
    activeSession ? Math.max(0, activeSession.endsAt - Date.now()) : 0,
  );
  const [completedSession, setCompletedSession] = useState<FocusSession | null>(null);
  const [quoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ── Timer tick ──
  const tick = useCallback(() => {
    const session = useFocusStore.getState().activeSession;
    if (!session) return;
    const remaining = session.endsAt - Date.now();
    if (remaining <= 0) {
      setMsRemaining(0);
      stopTimer();
      setCompletedSession(session);
      completeSession();
      setScreenState('complete');
    } else {
      setMsRemaining(remaining);
    }
  }, []);

  function startTimer() {
    stopTimer();
    intervalRef.current = setInterval(tick, 500);
  }

  function stopTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  // Resume timer correctly when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        // Just woke up — let tick recalculate
        if (screenState === 'active') tick();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [screenState, tick]);

  // Start/stop timer based on screen state
  useEffect(() => {
    if (screenState === 'active') {
      startTimer();
    } else {
      stopTimer();
    }
    return stopTimer;
  }, [screenState]);

  // Sync remaining time when resuming an existing active session on mount
  useEffect(() => {
    if (activeSession && screenState === 'active') {
      setMsRemaining(Math.max(0, activeSession.endsAt - Date.now()));
    }
  }, []);

  // ── Actions ──

  async function handleStart() {
    const now = Date.now();
    const endsAt = now + selectedMinutes * 60 * 1000;
    const notificationId = await scheduleNotification(endsAt, selectedMinutes);
    const session: FocusSession = {
      id: now.toString(),
      startedAt: now,
      durationMinutes: selectedMinutes,
      endsAt,
      notificationId,
    };
    await startSession(session);
    setMsRemaining(selectedMinutes * 60 * 1000);
    setScreenState('active');
  }

  async function handleAbandon() {
    Alert.alert(
      'End session?',
      "You'll lose credit for this session. Your oasis doesn't grow from half-measures.",
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'End it',
          style: 'destructive',
          onPress: async () => {
            const session = useFocusStore.getState().activeSession;
            await cancelNotification(session?.notificationId ?? null);
            await abandonSession();
            setScreenState('picker');
          },
        },
      ],
    );
  }

  function handleDone() {
    router.replace('/(tabs)/focus');
  }

  // ── Progress calculations ──
  const session = activeSession;
  const totalMs = session ? session.durationMinutes * 60 * 1000 : 0;
  const progress = totalMs > 0 ? 1 - msRemaining / totalMs : 0;
  const progressPct = Math.min(100, Math.round(progress * 100));

  const selectedConfig = DURATIONS.find((d) => d.minutes === selectedMinutes) ?? DURATIONS[1];
  const completedConfig = completedSession
    ? DURATIONS.find((d) => d.minutes === completedSession.durationMinutes) ?? DURATIONS[1]
    : DURATIONS[1];

  // ── Render: Picker ──

  if (screenState === 'picker') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.pickerScroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.pickerTitle}>Scroll-Free Session</Text>
          <Text style={styles.pickerSub}>
            Lock in. No Instagram. No TikTok. Just you.
          </Text>

          {/* Duration cards */}
          <View style={styles.durationGrid}>
            {DURATIONS.map((d) => {
              const selected = d.minutes === selectedMinutes;
              return (
                <TouchableOpacity
                  key={d.minutes}
                  style={[styles.durationCard, selected && styles.durationCardSelected]}
                  onPress={() => setSelectedMinutes(d.minutes)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.durationEmoji}>{d.emoji}</Text>
                  <Text style={[styles.durationMins, selected && styles.durationMinsSelected]}>
                    {d.minutes}m
                  </Text>
                  <Text style={[styles.durationLabel, selected && styles.durationLabelSelected]}>
                    {d.label}
                  </Text>
                  <Text style={[styles.durationDesc, selected && styles.durationDescSelected]}>
                    {d.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Oasis preview */}
          <View style={styles.oasisPreviewWrap}>
            <OasisVisual feedScore={feedScore} />
          </View>
          <Text style={styles.oasisCaption}>
            Complete sessions to grow your Oasis.
          </Text>

          {/* Start button */}
          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>
              Start {selectedMinutes}-Minute Session
            </Text>
          </TouchableOpacity>
          <Text style={styles.pointsCaption}>
            +{selectedConfig.points} pts on completion
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: Active ──

  if (screenState === 'active' && session) {
    return (
      <SafeAreaView style={styles.activeSafe} edges={['top', 'bottom']}>
        <View style={styles.activeContainer}>
          {/* Progress bar at top */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressPct}>{progressPct}% complete</Text>

          {/* Duration badge */}
          <View style={styles.durationBadge}>
            <Text style={styles.durationBadgeText}>
              {session.durationMinutes}-MINUTE SESSION
            </Text>
          </View>

          {/* Timer */}
          <Text style={styles.timerDisplay}>{formatTime(msRemaining)}</Text>
          <Text style={styles.timerLabel}>remaining</Text>

          {/* Oasis */}
          <View style={styles.activeOasisWrap}>
            <OasisVisual feedScore={feedScore} />
          </View>

          {/* Quote */}
          <Text style={styles.quote}>{QUOTES[quoteIndex % QUOTES.length]}</Text>

          {/* Abandon */}
          <TouchableOpacity onPress={handleAbandon} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
            <Text style={styles.abandonText}>End session early</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Complete ──

  return (
    <SafeAreaView style={styles.activeSafe} edges={['top', 'bottom']}>
      <View style={styles.completeContainer}>
        <Text style={styles.completedEmoji}>{completedConfig.emoji}</Text>
        <Text style={styles.completeHeadline}>Session complete.</Text>
        <Text style={styles.completeSub}>
          {completedSession?.durationMinutes ?? selectedMinutes} minutes, scroll-free. That's real.
        </Text>

        <View style={styles.rewardRow}>
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardPoints}>+{completedConfig.points}</Text>
            <Text style={styles.rewardPtsLabel}>POINTS</Text>
          </View>
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardPoints}>{completedSession?.durationMinutes ?? selectedMinutes}m</Text>
            <Text style={styles.rewardPtsLabel}>FOCUS TIME</Text>
          </View>
        </View>

        {/* Oasis */}
        <View style={styles.completeOasisWrap}>
          <OasisVisual feedScore={feedScore} />
        </View>
        <Text style={styles.oasisCaption}>
          Keep going. Your Oasis grows with you.
        </Text>

        <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  // ── Picker ──
  safe: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  pickerScroll: {
    paddingHorizontal: spacing.pagePad,
    paddingBottom: 40,
  },
  backBtn: {
    marginTop: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  backText: {
    ...typ.body,
    color: colors.ink3,
  },
  pickerTitle: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 32,
    color: colors.ink,
    marginBottom: 8,
    marginTop: 8,
  },
  pickerSub: {
    ...typ.body,
    color: colors.ink3,
    marginBottom: 28,
  },

  // Duration grid (2x2)
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  durationCard: {
    width: '47%',
    backgroundColor: colors.cream2,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  durationCardSelected: {
    backgroundColor: colors.char,
    borderColor: colors.gold,
  },
  durationEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  durationMins: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
    color: colors.ink,
    lineHeight: 32,
  },
  durationMinsSelected: {
    color: colors.gold,
  },
  durationLabel: {
    ...typ.btn,
    color: colors.ink,
    marginTop: 2,
  },
  durationLabelSelected: {
    color: colors.lt,
  },
  durationDesc: {
    ...typ.caption,
    color: colors.ink3,
    marginTop: 4,
  },
  durationDescSelected: {
    color: colors.lt3,
  },

  oasisPreviewWrap: {
    width: '100%',
    marginBottom: 10,
  },
  oasisCaption: {
    ...typ.caption,
    color: colors.ink3,
    textAlign: 'center',
    marginBottom: 24,
  },
  startBtn: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  startBtnText: {
    ...typ.btn,
    color: colors.lt,
  },
  pointsCaption: {
    ...typ.caption,
    color: colors.ink3,
    textAlign: 'center',
  },

  // ── Active ──
  activeSafe: {
    flex: 1,
    backgroundColor: colors.char,
  },
  activeContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 24,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: colors.char4,
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  progressPct: {
    ...typ.caption,
    color: colors.lt4,
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  durationBadge: {
    backgroundColor: colors.char4,
    borderRadius: radius.badge,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  durationBadgeText: {
    ...typ.label,
    color: colors.lt3,
    letterSpacing: 1,
  },
  timerDisplay: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 72,
    color: colors.lt,
    lineHeight: 80,
    letterSpacing: -2,
    marginBottom: 4,
  },
  timerLabel: {
    ...typ.caption,
    color: colors.lt4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 24,
  },
  activeOasisWrap: {
    width: '100%',
    marginBottom: 20,
  },
  quote: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 18,
    color: colors.lt3,
    textAlign: 'center',
    lineHeight: 26,
    flex: 1,
    textAlignVertical: 'center',
    marginBottom: 20,
  },
  abandonText: {
    ...typ.caption,
    color: colors.lt4,
    textDecorationLine: 'underline',
  },

  // ── Complete ──
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 40,
  },
  completedEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  completeHeadline: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 36,
    color: colors.lt,
    marginBottom: 10,
    textAlign: 'center',
  },
  completeSub: {
    ...typ.body,
    color: colors.lt3,
    textAlign: 'center',
    marginBottom: 28,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  rewardBadge: {
    backgroundColor: colors.char4,
    borderRadius: radius.card,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    minWidth: 100,
  },
  rewardPoints: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 32,
    color: colors.gold,
    lineHeight: 36,
  },
  rewardPtsLabel: {
    ...typ.label,
    color: colors.lt4,
    fontSize: 10,
    marginTop: 2,
  },
  completeOasisWrap: {
    width: '100%',
    marginBottom: 10,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  doneBtnText: {
    ...typ.btn,
    color: colors.lt,
  },
});
