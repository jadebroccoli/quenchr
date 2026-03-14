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
      Alert.alert('Pro Feature', 'Upgrade to Pro to access premium challenges.');
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
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredState}>
          <Text style={styles.centeredEmoji}>🔒</Text>
          <Text style={styles.centeredTitle}>Sign in to see challenges</Text>
          <Text style={styles.centeredSubtitle}>
            Complete daily challenges to earn bonus points and build your streak
          </Text>
          <TouchableOpacity
            style={styles.centeredButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.centeredButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.centeredSubtitle}>Loading challenges...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredState}>
          <Text style={styles.centeredEmoji}>⚠️</Text>
          <Text style={[styles.centeredTitle, { color: '#EF4444' }]}>
            Something went wrong
          </Text>
          <Text style={styles.centeredSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.centeredButton} onPress={refetch}>
            <Text style={styles.centeredButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Daily Challenges</Text>
        <Text style={styles.subtitle}>
          {completedCount}/{challenges.length} completed today
        </Text>

        {/* All done banner */}
        {allDone && (
          <View style={styles.allDoneBanner}>
            <Text style={styles.allDoneEmoji}>🎉</Text>
            <Text style={styles.allDoneText}>
              All challenges complete! Come back tomorrow for new ones.
            </Text>
          </View>
        )}

        {challenges.map((uc) => {
          const challenge = uc.challenge;
          if (!challenge) return null;

          const isComplete = uc.completed;
          const progressPct = (uc.progress / challenge.target_count) * 100;

          return (
            <View key={uc.id} style={[styles.card, isComplete && styles.cardComplete]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.challengeTitle}>
                    {isComplete ? '✓ ' : ''}{challenge.title}
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
              </View>

              <Text style={styles.challengeDesc}>{challenge.description}</Text>

              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressPct}%` },
                      isComplete && { backgroundColor: '#22C55E' },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {uc.progress}/{challenge.target_count}
                </Text>
              </View>

              {!isComplete && (
                <TouchableOpacity
                  style={styles.progressButton}
                  onPress={() => handleProgress(uc as ChallengeWithTemplate)}
                >
                  <Text style={styles.progressButtonText}>I did this! (+1)</Text>
                </TouchableOpacity>
              )}

              <View style={styles.rewardRow}>
                <Text style={[styles.rewardText, isComplete && { color: '#22C55E' }]}>
                  {isComplete ? 'Earned' : 'Reward'}: +{challenge.points} pts
                </Text>
              </View>
            </View>
          );
        })}

        {/* Empty state if no challenges */}
        {challenges.length === 0 && (
          <View style={styles.centeredState}>
            <Text style={styles.centeredEmoji}>🏆</Text>
            <Text style={styles.centeredTitle}>No challenges available</Text>
            <Text style={styles.centeredSubtitle}>
              Check back later for new daily challenges
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
  },

  // Centered states
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  centeredEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  centeredTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  centeredSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
  },
  centeredButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  centeredButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // All done banner
  allDoneBanner: {
    backgroundColor: '#14532D',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  allDoneEmoji: {
    fontSize: 28,
  },
  allDoneText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#86EFAC',
    lineHeight: 20,
  },

  // Challenge cards
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardComplete: {
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  cardHeader: {
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
  },
  proBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  platformTag: {
    fontSize: 12,
    color: '#64748B',
  },
  challengeDesc: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    minWidth: 30,
  },
  progressButton: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  progressButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
});
