import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  PLATFORMS,
  generateCleanupSession,
  getSessionSummary,
  getAuditBreakdown,
  getFeedHealthInfo,
  computeStreakUpdate,
} from '@quenchr/shared';
import type { Platform, CleanupSessionStep, FeedAudit } from '@quenchr/shared';
import { completeCleanupTask, updateStreak, updateChallengeProgress } from '@quenchr/supabase-client';
import { useAuthStore } from '../../src/stores/auth-store';
import { useAuditStore } from '../../src/stores/audit-store';
import { useCleanupStore } from '../../src/stores/cleanup-store';
import { useSubscriptionStore } from '../../src/stores/subscription-store';
import { useCleanupInit } from '../../src/hooks/useCleanupInit';
import { SessionProgressBar } from '../../src/components/SessionProgressBar';
import { CleanupStepView } from '../../src/components/CleanupStepView';
import { SessionCompleteView } from '../../src/components/SessionCompleteView';
import { colors, type as typ, spacing, radius } from '../../src/tokens';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { PillGroup } from '../../src/components/ui/PillGroup';
import { AuditBanner } from '../../src/components/ui/AuditBanner';
import { CardLight } from '../../src/components/ui/CardLight';
import { CardDark } from '../../src/components/ui/CardDark';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';

type ScreenState = 'launcher' | 'session' | 'complete';

const PRIORITY_COLORS: Record<string, string> = {
  critical: colors.red,
  high: colors.gold,
  medium: colors.cream4,
  maintenance: colors.cream3,
};

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
];

export default function CleanupScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { loading, error, refetch } = useCleanupInit();

  const tasks = useCleanupStore((s) => s.tasks);
  const progress = useCleanupStore((s) => s.progress);
  const streak = useCleanupStore((s) => s.streak);
  const { tasksCompletedToday, incrementTasksCompletedToday } = useCleanupStore();
  const setProgress = useCleanupStore((s) => s.setProgress);
  const setStreak = useCleanupStore((s) => s.setStreak);

  const currentAudit = useAuditStore((s) => s.currentAudit);
  const isPro = useSubscriptionStore((s) => s.isPro());
  const limits = useSubscriptionStore((s) => s.limits);

  const [screenState, setScreenState] = useState<ScreenState>('launcher');
  const [sessionSteps, setSessionSteps] = useState<CleanupSessionStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(
    currentAudit?.platform ?? 'instagram'
  );

  // Derive completed task IDs from Supabase progress data
  const completedTaskIds = useMemo(
    () => progress.filter((p) => p.completed).map((p) => p.task_id),
    [progress]
  );

  // Generate session from audit + Supabase tasks (previously used hardcoded ALL_TASKS)
  const availableSteps = useMemo(() => {
    if (tasks.length === 0) return [];

    if (currentAudit && currentAudit.platform === selectedPlatform) {
      return generateCleanupSession(currentAudit, tasks, completedTaskIds, isPro);
    }
    // No audit — show tasks with a default assumed-bad score
    const mockAudit: FeedAudit = {
      id: 'mock',
      user_id: user?.id ?? '',
      platform: selectedPlatform,
      total_scanned: 100,
      nsfw_detected: 20,
      sexy_detected: 30,
      neutral_detected: 50,
      feed_score: 50,
      created_at: new Date().toISOString(),
    };
    return generateCleanupSession(mockAudit, tasks, completedTaskIds, isPro);
  }, [currentAudit, selectedPlatform, isPro, tasks, completedTaskIds]);

  const sessionSummary = useMemo(() => getSessionSummary(availableSteps), [availableSteps]);

  function startSession() {
    if (availableSteps.length === 0) {
      Alert.alert('No tasks available', 'All cleanup tasks for this platform are complete!');
      return;
    }
    setSessionSteps(availableSteps);
    setCurrentStepIndex(0);
    setEarnedPoints(0);
    setCompletedCount(0);
    setSkippedCount(0);
    setScreenState('session');
  }

  async function handleStepComplete() {
    if (tasksCompletedToday >= limits.tasksPerDay && !isPro) {
      router.push('/paywall');
      return;
    }

    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to save your progress.');
      return;
    }

    const step = sessionSteps[currentStepIndex];
    setSaving(true);

    try {
      // 1. Persist task completion to Supabase
      const { error: taskErr } = await completeCleanupTask(user.id, step.task.id);
      if (taskErr) throw taskErr;

      // 2. Compute & persist streak update
      const streakData = computeStreakUpdate(streak, step.task.points);
      const { error: streakErr } = await updateStreak(user.id, streakData);
      if (streakErr) throw streakErr;

      // 3. Update local state
      setEarnedPoints((p) => p + step.task.points);
      setCompletedCount((c) => c + 1);
      incrementTasksCompletedToday();

      // 4. Append to local progress so completedTaskIds updates immediately
      setProgress([
        ...progress,
        {
          id: Date.now().toString(),
          user_id: user.id,
          task_id: step.task.id,
          completed: true,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ]);

      // 5. Update streak in store
      setStreak(
        streak
          ? { ...streak, ...streakData }
          : { id: Date.now().toString(), user_id: user.id, ...streakData }
      );

      // 6. Auto-increment matching challenges (best-effort)
      const activeChallenges = useCleanupStore.getState().challenges;
      const taskPlatform = step.task.platform;
      for (const uc of activeChallenges) {
        if (uc.completed) continue;
        const cp = uc.challenge?.platform;
        // Match: same platform, or cross-platform (null) challenge
        if (cp === taskPlatform || cp === null) {
          const newProg = Math.min(uc.progress + 1, uc.challenge.target_count);
          const isNowDone = newProg >= uc.challenge.target_count;
          // Fire-and-forget — don't block step completion on challenge update
          updateChallengeProgress(uc.id, newProg, isNowDone).catch(() => {});
        }
      }

      advanceStep();
    } catch (err) {
      console.error('Failed to save task completion:', err);
      Alert.alert(
        'Save Failed',
        'Your progress could not be saved. Check your connection and try again.',
        [
          { text: 'Retry', onPress: handleStepComplete },
          { text: 'Skip', onPress: () => advanceStep() },
        ]
      );
    } finally {
      setSaving(false);
    }
  }

  function handleStepSkip() {
    setSkippedCount((s) => s + 1);
    advanceStep();
  }

  function advanceStep() {
    if (currentStepIndex + 1 >= sessionSteps.length) {
      setScreenState('complete');
    } else {
      setCurrentStepIndex((i) => i + 1);
    }
  }

  function handleRescan() {
    setScreenState('launcher');
    router.push('/(tabs)/audit');
  }

  function handleDone() {
    setScreenState('launcher');
    router.push('/(tabs)/dashboard');
  }

  // ── Session view ──
  if (screenState === 'session' && sessionSteps.length > 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <SessionProgressBar
          currentStep={currentStepIndex}
          totalSteps={sessionSteps.length}
          currentPriority={sessionSteps[currentStepIndex].priority}
        />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <CleanupStepView
            step={sessionSteps[currentStepIndex]}
            stepIndex={currentStepIndex}
            onComplete={handleStepComplete}
            onSkip={handleStepSkip}
            saving={saving}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Complete view ──
  if (screenState === 'complete') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <SessionCompleteView
            earnedPoints={earnedPoints}
            totalSteps={sessionSteps.length}
            completedSteps={completedCount}
            skippedSteps={skippedCount}
            feedScore={currentAudit?.feed_score ?? null}
            onRescan={handleRescan}
            onDone={handleDone}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Not authenticated ──
  if (!user && !loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <Text style={styles.centeredTitle}>Sign in to start cleaning</Text>
          <Text style={styles.centeredSubtitle}>
            Create an account to get personalized cleanup plans and track your progress
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
          <Text style={styles.centeredSubtitle}>Loading cleanup tasks...</Text>
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

  // ── Launcher view (default) ──
  const feedHealth = currentAudit ? getFeedHealthInfo(currentAudit.feed_score) : null;
  const breakdown = currentAudit ? getAuditBreakdown(currentAudit) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          eyebrow="Remediation"
          title="Cleanup Session."
          subtitle={`${tasksCompletedToday} of ${limits.tasksPerDay === Infinity ? '...' : limits.tasksPerDay} tasks done today. Let's fix that.`}
        />

        {/* Platform pills */}
        <View style={styles.section}>
          <PillGroup
            options={PLATFORM_OPTIONS}
            selected={selectedPlatform}
            onSelect={setSelectedPlatform}
          />
        </View>

        {/* Audit result banner (if exists for this platform) */}
        {currentAudit && currentAudit.platform === selectedPlatform && feedHealth && breakdown && (
          <View style={styles.section}>
            <CardLight>
              <View style={styles.auditBannerTop}>
                <View>
                  <Text style={styles.auditLabel}>YOUR FEED SCORE</Text>
                  <Text style={[styles.auditScore, { color: feedHealth.color }]}>
                    {feedHealth.score}
                  </Text>
                </View>
                <View style={[styles.healthBadge, { backgroundColor: feedHealth.color + '20' }]}>
                  <Text style={[styles.healthBadgeText, { color: feedHealth.color }]}>
                    {feedHealth.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.auditDetail}>
                {breakdown.suggestivePercent}% suggestive content detected
              </Text>
            </CardLight>
          </View>
        )}

        {/* No audit CTA */}
        {(!currentAudit || currentAudit.platform !== selectedPlatform) && (
          <View style={styles.section}>
            <AuditBanner
              title="Run an Audit First"
              subtitle="Get a personalized cleanup plan based on your actual feed"
              onPress={() => router.push('/(tabs)/audit')}
            />
          </View>
        )}

        {/* Session preview card — cleanup plan */}
        <View style={styles.section}>
          <CardLight>
            <Text style={styles.planTitle}>Your Cleanup Plan</Text>
            <Text style={styles.planSubtitle}>
              {sessionSummary.totalSteps} steps · ~{sessionSummary.totalMinutes} min · {sessionSummary.totalPoints} pts
            </Text>

            <View style={styles.priorityList}>
              {sessionSummary.stepsByPriority.critical > 0 && (
                <View style={styles.priorityRow}>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS.critical }]} />
                  <Text style={styles.priorityLabel}>
                    {sessionSummary.stepsByPriority.critical} Settings Change{sessionSummary.stepsByPriority.critical > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.priorityTag}>Critical</Text>
                </View>
              )}
              {sessionSummary.stepsByPriority.high > 0 && (
                <View style={styles.priorityRow}>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS.high }]} />
                  <Text style={styles.priorityLabel}>
                    {sessionSummary.stepsByPriority.high} Algorithm Training Task{sessionSummary.stepsByPriority.high > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.priorityTag}>High</Text>
                </View>
              )}
              {sessionSummary.stepsByPriority.medium > 0 && (
                <View style={styles.priorityRow}>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS.medium }]} />
                  <Text style={styles.priorityLabel}>
                    {sessionSummary.stepsByPriority.medium} Unfollow/Review Task{sessionSummary.stepsByPriority.medium > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.priorityTag}>Medium</Text>
                </View>
              )}
              {sessionSummary.stepsByPriority.maintenance > 0 && (
                <View style={styles.priorityRow}>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS.maintenance }]} />
                  <Text style={styles.priorityLabel}>
                    {sessionSummary.stepsByPriority.maintenance} Maintenance Task{sessionSummary.stepsByPriority.maintenance > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.priorityTag}>Low</Text>
                </View>
              )}
            </View>
          </CardLight>
        </View>

        {/* Start button */}
        <View style={styles.section}>
          <PrimaryButton label="Start Cleanup Session" onPress={startSession} />
          <Text style={styles.metaCaption}>
            ~{sessionSummary.totalMinutes} MINUTES · {sessionSummary.totalPoints} POINTS
          </Text>
        </View>

        {/* How it works card */}
        <View style={styles.section}>
          <CardDark>
            <Text style={styles.howTitle}>How it works</Text>
            <View style={styles.tipRow}>
              <Text style={styles.tipNumber}>1</Text>
              <Text style={styles.tipText}>We show you one task at a time, starting with the highest impact</Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipNumber}>2</Text>
              <Text style={styles.tipText}>Tap "Open App" to jump directly to the right screen</Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipNumber}>3</Text>
              <Text style={styles.tipText}>Complete the task, come back, and mark it done</Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipNumber}>4</Text>
              <Text style={styles.tipText}>Re-scan your feed in a few days to see improvement</Text>
            </View>
          </CardDark>
        </View>
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

  // Centered states (loading, error, no-auth)
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

  // Audit banner inside CardLight
  auditBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auditLabel: {
    ...typ.label,
    color: colors.ink3,
    marginBottom: 4,
  },
  auditScore: {
    ...typ.bigNum,
  },
  healthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  healthBadgeText: {
    ...typ.caption,
  },
  auditDetail: {
    ...typ.body,
    color: colors.ink2,
    marginTop: 8,
  },

  // Cleanup plan card content
  planTitle: {
    ...typ.h3,
    color: colors.ink,
  },
  planSubtitle: {
    ...typ.body,
    color: colors.ink2,
    marginTop: 2,
  },
  priorityList: {
    gap: spacing.cardGap,
    marginTop: 14,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  priorityLabel: {
    ...typ.body,
    color: colors.ink,
    flex: 1,
  },
  priorityTag: {
    ...typ.label,
    color: colors.ink3,
  },

  // Meta caption below button
  metaCaption: {
    ...typ.caption,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 8,
    textTransform: 'uppercase',
  },

  // How it works card (dark)
  howTitle: {
    ...typ.h3,
    color: colors.lt,
    marginBottom: 14,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  tipNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.char4,
    textAlign: 'center',
    lineHeight: 24,
    ...typ.caption,
    color: colors.lt,
    overflow: 'hidden',
  },
  tipText: {
    ...typ.body,
    color: colors.lt3,
    flex: 1,
  },
});
