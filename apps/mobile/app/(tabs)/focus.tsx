import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PLATFORMS, POINTS, computeStreakUpdate } from '@quenchr/shared';
import type { Challenge, UserChallenge } from '@quenchr/shared';
import { updateChallengeProgress, updateStreak } from '@quenchr/supabase-client';
import { useAuthStore } from '../../src/stores/auth-store';
import { useAuditStore } from '../../src/stores/audit-store';
import { useCleanupStore } from '../../src/stores/cleanup-store';
import { useSubscriptionStore } from '../../src/stores/subscription-store';
import { useFocusStore } from '../../src/stores/focus-store';
import { useChallengesInit } from '../../src/hooks/useChallengesInit';
import { computeCleanStreak } from '../../src/utils/scanStreak';
import { OasisVisual } from '../../src/components/ui/OasisVisual';
import { PanicOverlay } from '../../src/components/PanicOverlay';
import {
  PageHeader,
  SectionDivider,
  CardDark,
  StatRow,
  PrimaryButton,
  SecondaryButton,
  ProgressBar,
} from '../../src/components/ui';
import { colors, type as typ, spacing, radius } from '../../src/tokens';

type ChallengeWithTemplate = UserChallenge & { challenge: Challenge };

export default function FocusScreen() {
  const router = useRouter();
  const [panicVisible, setPanicVisible] = useState(false);
  const [oasisInfoVisible, setOasisInfoVisible] = useState(false);

  // Auth
  const user = useAuthStore((s) => s.user);

  // Audit / oasis
  const currentAudit = useAuditStore((s) => s.currentAudit);
  const auditHistory = useAuditStore((s) => s.auditHistory);
  const cleanStreak = useMemo(() => computeCleanStreak(auditHistory), [auditHistory]);

  // Focus sessions
  const activeSession = useFocusStore((s) => s.activeSession);
  const sessionsCompleted = useFocusStore((s) => s.sessionsCompleted);

  // Cleanup / challenges / streak
  const challenges = useCleanupStore((s) => s.challenges);
  const setChallenges = useCleanupStore((s) => s.setChallenges);
  const streak = useCleanupStore((s) => s.streak);
  const setStreak = useCleanupStore((s) => s.setStreak);
  const isPro = useSubscriptionStore((s) => s.proAccess);
  const { loading, error, refetch } = useChallengesInit();

  const completedCount = challenges.filter((c) => c.completed).length;
  const allDone = challenges.length > 0 && completedCount === challenges.length;

  // ── Challenge handlers ──

  async function handleProgress(uc: ChallengeWithTemplate) {
    if (uc.completed || !user) return;

    if (uc.challenge.is_premium && !isPro) {
      router.push('/paywall');
      return;
    }

    const newProgress = Math.min(uc.progress + 1, uc.challenge.target_count);
    const isNowComplete = newProgress >= uc.challenge.target_count;

    const { error: progErr } = await updateChallengeProgress(uc.id, newProgress, isNowComplete);
    if (progErr) {
      Alert.alert('Error', 'Could not save progress. Check your connection.');
      return;
    }

    if (isNowComplete) {
      const streakData = computeStreakUpdate(streak, POINTS.challengeComplete);
      const { error: streakErr } = await updateStreak(user.id, streakData);
      if (!streakErr) {
        setStreak(
          streak
            ? { ...streak, ...streakData }
            : { id: Date.now().toString(), user_id: user.id, ...streakData },
        );
      }
      Alert.alert('Challenge Complete!', `+${POINTS.challengeComplete} points earned!`);
    }

    setChallenges(
      challenges.map((c) =>
        c.id === uc.id
          ? {
              ...c,
              progress: newProgress,
              completed: isNowComplete,
              completed_at: isNowComplete ? new Date().toISOString() : null,
            }
          : c,
      ),
    );
  }

  // ── Not authenticated ──
  if (!user && !loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centeredState}>
          <Text style={styles.centeredTitle}>Sign in to use Focus</Text>
          <Text style={styles.centeredSub}>
            Track your oasis, run focus sessions, and complete daily challenges.
          </Text>
          <PrimaryButton label="Sign In" onPress={() => router.push('/(auth)/login')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="Focus"
          title="Take back your attention."
          subtitle="Your oasis grows every time you resist."
        />
        <SectionDivider />

        <View style={styles.body}>
          {/* ── Oasis + Streak ── */}
          <CardDark>
            <View style={styles.oasisHeader}>
              <Text style={styles.eyebrowDark}>YOUR OASIS</Text>
              <TouchableOpacity
                onPress={() => setOasisInfoVisible(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={styles.infoBtn}>
                  <Text style={styles.infoBtnText}>?</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.oasisWrapper}>
              <OasisVisual feedScore={currentAudit?.feed_score ?? null} />
            </View>

            {/* Clean Streak */}
            <View style={styles.cleanStreakRow}>
              <View style={styles.cleanStreakMain}>
                <Text style={styles.cleanStreakNum}>{cleanStreak.current}</Text>
                <View>
                  <Text style={styles.cleanStreakLabel}>CLEAN WEEKS</Text>
                  <Text style={styles.cleanStreakSub}>
                    Best: {cleanStreak.longest} week{cleanStreak.longest !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              {cleanStreak.current > 0 && <Text style={styles.fireEmoji}>🔥</Text>}
            </View>

            <StatRow
              items={[
                { value: streak?.current_streak ?? 0, label: 'Task Streak' },
                { value: streak?.longest_streak ?? 0, label: 'Best' },
                { value: streak?.total_points ?? 0, label: 'Points', gold: true },
              ]}
            />
          </CardDark>

          {/* ── Focus Session ── */}
          <CardDark>
            <Text style={styles.eyebrowDark}>FOCUS SESSION</Text>
            {activeSession ? (
              <>
                <Text style={styles.focusActiveHeadline}>Session in progress</Text>
                <Text style={styles.focusSub}>
                  {activeSession.durationMinutes}-min session running — stay strong.
                </Text>
                <TouchableOpacity
                  style={styles.focusBtn}
                  onPress={() => router.push('/focus-session')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.focusBtnText}>View Session →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.focusHeadline}>Go scroll-free.</Text>
                <Text style={styles.focusSub}>
                  Lock in for 15, 30, 60, or 90 minutes.{'\n'}
                  Your Oasis grows with every session.
                  {sessionsCompleted > 0 && `  · ${sessionsCompleted} completed`}
                </Text>
                <TouchableOpacity
                  style={styles.focusBtn}
                  onPress={() => router.push('/focus-session')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.focusBtnText}>Start Focus Session</Text>
                </TouchableOpacity>
              </>
            )}
          </CardDark>

          {/* ── Panic Button ── */}
          <CardDark>
            <Text style={styles.panicHeadline}>Caught mid-scroll?</Text>
            <Text style={styles.panicSub}>Tap to pause and reset.</Text>
            <TouchableOpacity
              style={styles.panicBtn}
              onPress={() => setPanicVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.panicBtnText}>Stop Scrolling</Text>
            </TouchableOpacity>
          </CardDark>

          {/* ── Challenges ── */}
          <View style={styles.challengesSection}>
            <Text style={styles.challengesHeader}>DAILY CHALLENGES</Text>
            {loading ? (
              <View style={styles.centeredMini}>
                <ActivityIndicator size="small" color={colors.brown} />
                <Text style={styles.centeredMiniText}>Loading challenges...</Text>
              </View>
            ) : error ? (
              <View style={styles.centeredMini}>
                <Text style={[styles.centeredMiniText, { color: colors.red }]}>
                  Couldn't load challenges
                </Text>
                <SecondaryButton label="Try Again" onPress={refetch} style={{ marginTop: 8 }} />
              </View>
            ) : (
              <>
                {allDone && (
                  <CardDark style={styles.allDoneCard}>
                    <Text style={styles.allDoneText}>
                      All done! Come back tomorrow for new ones.
                    </Text>
                  </CardDark>
                )}

                {challenges.length === 0 && (
                  <View style={styles.centeredMini}>
                    <Text style={styles.centeredMiniText}>
                      Improve your feed score to unlock challenges.
                    </Text>
                  </View>
                )}

                {challenges.map((uc) => {
                  const challenge = uc.challenge;
                  if (!challenge) return null;
                  const isComplete = uc.completed;
                  const progressPct = uc.progress / challenge.target_count;

                  return (
                    <CardDark
                      key={uc.id}
                      style={isComplete ? styles.cardComplete : undefined}
                    >
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.challengeTitle}>
                          {isComplete ? '✓ ' : ''}
                          {challenge.title}
                        </Text>
                        {challenge.is_premium && (
                          <View style={styles.proBadge}>
                            <Text style={styles.proText}>PRO</Text>
                          </View>
                        )}
                      </View>

                      {challenge.platform && (
                        <Text style={styles.platformTag}>
                          {PLATFORMS[challenge.platform as keyof typeof PLATFORMS]?.label}
                        </Text>
                      )}

                      <View style={styles.pointsBadge}>
                        <Text style={styles.pointsText}>+{challenge.points} pts</Text>
                      </View>

                      <Text style={styles.challengeDesc}>{challenge.description}</Text>

                      <ProgressBar
                        progress={progressPct}
                        variant="dark"
                        style={{ marginTop: 4 }}
                      />
                      <Text style={styles.progressCount}>
                        {uc.progress}/{challenge.target_count}
                      </Text>

                      {!isComplete && (
                        <SecondaryButton
                          label="I did this! (+1)"
                          onPress={() => handleProgress(uc as ChallengeWithTemplate)}
                          style={{ marginTop: 4 }}
                        />
                      )}
                    </CardDark>
                  );
                })}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <PanicOverlay visible={panicVisible} onDismiss={() => setPanicVisible(false)} />

      {/* Oasis info modal */}
      <Modal
        visible={oasisInfoVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOasisInfoVisible(false)}
      >
        <TouchableOpacity
          style={styles.infoOverlay}
          activeOpacity={1}
          onPress={() => setOasisInfoVisible(false)}
        >
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Your Oasis</Text>
            <Text style={styles.infoBody}>
              Your Oasis reflects your feed health. The cleaner your score, the more it
              flourishes — from barren wasteland to thriving oasis. Scan regularly to watch it
              grow.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    paddingBottom: 100,
  },
  body: {
    paddingHorizontal: spacing.pagePad,
    gap: spacing.cardGap,
  },

  // Centered states
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.pagePad,
    gap: 12,
  },
  centeredTitle: {
    ...typ.h3,
    color: colors.ink,
    textAlign: 'center',
  },
  centeredSub: {
    ...typ.body,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 4,
  },
  centeredMini: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  centeredMiniText: {
    ...typ.body,
    color: colors.ink3,
    textAlign: 'center',
  },

  // Section labels
  eyebrowDark: {
    ...typ.label,
    color: colors.lt3,
  },

  // Oasis card
  oasisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.lt3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    fontSize: 10,
    color: colors.lt3,
    fontWeight: '700',
    lineHeight: 13,
  },
  oasisWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  cleanStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.char4,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  cleanStreakMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cleanStreakNum: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 48,
    lineHeight: 52,
    color: colors.gold,
  },
  cleanStreakLabel: {
    ...typ.label,
    color: colors.lt2,
    fontSize: 11,
  },
  cleanStreakSub: {
    ...typ.caption,
    color: colors.lt3,
    marginTop: 2,
  },
  fireEmoji: {
    fontSize: 28,
  },

  // Focus session card
  focusHeadline: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.lt,
    marginBottom: 6,
    marginTop: 8,
  },
  focusActiveHeadline: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.gold,
    marginBottom: 6,
    marginTop: 8,
  },
  focusSub: {
    ...typ.body,
    color: colors.lt3,
    marginBottom: 20,
    lineHeight: 22,
  },
  focusBtn: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 14,
    alignItems: 'center',
  },
  focusBtnText: {
    ...typ.btn,
    color: colors.lt,
  },

  // Panic card
  panicHeadline: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.lt,
    marginBottom: 6,
  },
  panicSub: {
    ...typ.body,
    color: colors.lt3,
    marginBottom: 20,
  },
  panicBtn: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 14,
    alignItems: 'center',
  },
  panicBtnText: {
    ...typ.btn,
    color: colors.lt,
  },

  // Challenges section
  challengesSection: {
    gap: spacing.cardGap,
  },
  challengesHeader: {
    ...typ.label,
    color: colors.ink3,
    paddingTop: 4,
  },
  allDoneCard: {
    borderWidth: 1,
    borderColor: colors.gold,
  },
  allDoneText: {
    ...typ.body,
    color: colors.lt2,
    textAlign: 'center',
  },
  cardComplete: {
    borderWidth: 1,
    borderColor: colors.gold,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeTitle: {
    ...typ.h3,
    color: colors.lt,
    flex: 1,
  },
  proBadge: {
    backgroundColor: colors.gold,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proText: {
    ...typ.label,
    color: colors.char,
  },
  platformTag: {
    ...typ.label,
    color: colors.lt4 ?? colors.lt3,
    marginTop: 4,
  },
  pointsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold + '20',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  pointsText: {
    ...typ.caption,
    color: colors.gold,
  },
  challengeDesc: {
    ...typ.body,
    color: colors.lt3,
    marginTop: 8,
  },
  progressCount: {
    ...typ.caption,
    color: colors.lt4 ?? colors.lt3,
    marginTop: 6,
  },

  // Oasis info modal
  infoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  infoCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    padding: 24,
    width: '100%',
  },
  infoTitle: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
    color: colors.lt,
    marginBottom: 12,
  },
  infoBody: {
    ...typ.body,
    color: colors.lt3,
    lineHeight: 22,
  },
});
