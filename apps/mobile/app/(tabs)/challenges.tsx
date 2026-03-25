import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PLATFORMS, POINTS, computeStreakUpdate } from '@quenchr/shared';
import type { Challenge, UserChallenge } from '@quenchr/shared';
import { updateChallengeProgress, updateStreak } from '@quenchr/supabase-client';
import { useAuthStore } from '../../src/stores/auth-store';
import { useCleanupStore } from '../../src/stores/cleanup-store';
import { useSubscriptionStore } from '../../src/stores/subscription-store';
import { useChallengesInit } from '../../src/hooks/useChallengesInit';
import { colors, type as typ, spacing, radius } from '../../src/tokens';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { CardDark } from '../../src/components/ui/CardDark';
import { SecondaryButton } from '../../src/components/ui/SecondaryButton';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { ProgressBar } from '../../src/components/ui/ProgressBar';

type ChallengeWithTemplate = UserChallenge & { challenge: Challenge };

export default function ChallengesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { loading, error, refetch } = useChallengesInit();

  const challenges = useCleanupStore((s) => s.challenges);
  const setChallenges = useCleanupStore((s) => s.setChallenges);
  const streak = useCleanupStore((s) => s.streak);
  const setStreak = useCleanupStore((s) => s.setStreak);
  const isPro = useSubscriptionStore((s) => s.isPro());

  const completedCount = challenges.filter((c) => c.completed).length;
  const allDone = challenges.length > 0 && completedCount === challenges.length;

  async function handleProgress(uc: ChallengeWithTemplate) {
    if (uc.completed || !user) return;

    if (uc.challenge.is_premium && !isPro) {
      router.push('/paywall');
      return;
    }

    const newProgress = Math.min(uc.progress + 1, uc.challenge.target_count);
    const isNowComplete = newProgress >= uc.challenge.target_count;

    // 1. Persist progress to Supabase
    const { error: progErr } = await updateChallengeProgress(uc.id, newProgress, isNowComplete);
    if (progErr) {
      Alert.alert('Error', 'Could not save progress. Check your connection.');
      return;
    }

    // 2. If just completed, award points + update streak
    if (isNowComplete) {
      const streakData = computeStreakUpdate(streak, POINTS.challengeComplete);
      const { error: streakErr } = await updateStreak(user.id, streakData);
      if (!streakErr) {
        setStreak(
          streak
            ? { ...streak, ...streakData }
            : { id: Date.now().toString(), user_id: user.id, ...streakData }
        );
      }
      Alert.alert('Challenge Complete!', `+${POINTS.challengeComplete} points earned!`);
    }

    // 3. Update local store
    setChallenges(
      challenges.map((c) =>
        c.id === uc.id
          ? {
              ...c,
              progress: newProgress,
              completed: isNowComplete,
              completed_at: isNowComplete ? new Date().toISOString() : null,
            }
          : c
      )
    );
  }

  // ── Not authenticated ──
  if (!user && !loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <Text style={styles.centeredTitle}>Sign in to see challenges</Text>
          <Text style={styles.centeredSubtitle}>
            Complete daily challenges to earn bonus points and build your streak
          </Text>
          <PrimaryButton label="Sign In" onPress={() => router.push('/(auth)/login')} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.brown} />
          <Text style={styles.centeredSubtitle}>Loading challenges...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <Text style={[styles.centeredTitle, { color: colors.red }]}>
            Something went wrong
          </Text>
          <Text style={styles.centeredSubtitle}>{error}</Text>
          <PrimaryButton label="Try Again" onPress={refetch} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          eyebrow="Daily"
          title="Challenges."
          subtitle={`${completedCount} of ${challenges.length} completed. Not great, not terrible.`}
        />

        {/* All done banner */}
        {allDone && (
          <View style={styles.section}>
            <CardDark>
              <Text style={styles.allDoneText}>
                All challenges complete! Come back tomorrow for new ones.
              </Text>
            </CardDark>
          </View>
        )}

        {challenges.map((uc) => {
          const challenge = uc.challenge;
          if (!challenge) return null;

          const isComplete = uc.completed;
          const progressPct = uc.progress / challenge.target_count;

          return (
            <View key={uc.id} style={styles.section}>
              <CardDark style={isComplete ? styles.cardComplete : undefined}>
                {/* Title row */}
                <View style={styles.cardTitleRow}>
                  <Text style={styles.challengeTitle}>
                    {isComplete ? '\u2713 ' : ''}{challenge.title}
                  </Text>
                  {challenge.is_premium && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proText}>PRO</Text>
                    </View>
                  )}
                </View>

                {/* Platform tag */}
                {challenge.platform && (
                  <Text style={styles.platformTag}>
                    {PLATFORMS[challenge.platform as keyof typeof PLATFORMS]?.label}
                  </Text>
                )}

                {/* Points badge */}
                <View style={styles.pointsBadge}>
                  <Text style={styles.pointsText}>+{challenge.points} pts</Text>
                </View>

                {/* Body copy */}
                <Text style={styles.challengeDesc}>{challenge.description}</Text>

                {/* Progress bar */}
                <ProgressBar progress={progressPct} variant="dark" style={{ marginTop: 4 }} />
                <Text style={styles.progressCount}>
                  {uc.progress}/{challenge.target_count}
                </Text>

                {/* CTA button */}
                {!isComplete && (
                  <SecondaryButton
                    label="I did this! (+1)"
                    onPress={() => handleProgress(uc as ChallengeWithTemplate)}
                    style={{ marginTop: 4 }}
                  />
                )}
              </CardDark>
            </View>
          );
        })}

        {/* Empty state if no challenges */}
        {challenges.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>More to unlock.</Text>
            <Text style={styles.emptyBody}>Improve your score to reveal new challenges.</Text>
            <Text style={styles.emptyBody}>Or just keep being a mystery.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: spacing.pagePad,
    marginBottom: spacing.sectionGap,
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
  centeredSubtitle: {
    ...typ.body,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 4,
  },

  // All done banner
  allDoneText: {
    ...typ.body,
    color: colors.lt2,
    textAlign: 'center',
  },

  // Challenge cards
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
    color: colors.lt4,
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
    color: colors.lt4,
    marginTop: 6,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: spacing.pagePad,
    gap: 4,
  },
  emptyTitle: {
    ...typ.h3,
    color: colors.ink,
    marginBottom: 8,
  },
  emptyBody: {
    ...typ.body,
    color: colors.ink3,
    textAlign: 'center',
  },
});
