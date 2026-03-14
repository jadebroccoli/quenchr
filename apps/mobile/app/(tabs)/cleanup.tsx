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

type ScreenState = 'launcher' | 'session' | 'complete';

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
      Alert.alert(
        'Daily Limit Reached',
        'Upgrade to Pro for unlimited daily cleanup tasks.',
        [{ text: 'OK' }]
      );
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
      <SafeAreaView style={styles.container}>
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
      <SafeAreaView style={styles.container}>
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
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredState}>
          <Text style={styles.centeredEmoji}>🔒</Text>
          <Text style={styles.centeredTitle}>Sign in to start cleaning</Text>
          <Text style={styles.centeredSubtitle}>
            Create an account to get personalized cleanup plans and track your progress
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
          <Text style={styles.centeredSubtitle}>Loading cleanup tasks...</Text>
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

  // ── Launcher view (default) ──
  const feedHealth = currentAudit ? getFeedHealthInfo(currentAudit.feed_score) : null;
  const breakdown = currentAudit ? getAuditBreakdown(currentAudit) : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Cleanup Session</Text>
        <Text style={styles.subtitle}>
          {tasksCompletedToday}/{limits.tasksPerDay === Infinity ? '∞' : limits.tasksPerDay} tasks today
        </Text>

        {/* Platform tabs */}
        <View style={styles.tabRow}>
          {(['instagram', 'tiktok'] as Platform[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.tab, selectedPlatform === p && styles.tabActive]}
              onPress={() => setSelectedPlatform(p)}
            >
              <Text style={styles.tabEmoji}>
                {p === 'instagram' ? '📸' : '🎵'}
              </Text>
              <Text style={[styles.tabText, selectedPlatform === p && styles.tabTextActive]}>
                {PLATFORMS[p].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Audit result banner (if exists for this platform) */}
        {currentAudit && currentAudit.platform === selectedPlatform && feedHealth && breakdown && (
          <View style={styles.auditBanner}>
            <View style={styles.auditBannerTop}>
              <View>
                <Text style={styles.auditBannerLabel}>Your Feed Score</Text>
                <Text style={[styles.auditBannerScore, { color: feedHealth.color }]}>
                  {feedHealth.score}
                </Text>
              </View>
              <View style={[styles.healthBadge, { backgroundColor: feedHealth.color + '20' }]}>
                <Text style={[styles.healthBadgeText, { color: feedHealth.color }]}>
                  {feedHealth.label}
                </Text>
              </View>
            </View>
            <Text style={styles.auditBannerDetail}>
              {breakdown.suggestivePercent}% suggestive content detected
            </Text>
          </View>
        )}

        {/* No audit CTA */}
        {(!currentAudit || currentAudit.platform !== selectedPlatform) && (
          <TouchableOpacity
            style={styles.noAuditCard}
            onPress={() => router.push('/(tabs)/audit')}
          >
            <Text style={styles.noAuditEmoji}>🔍</Text>
            <View style={styles.noAuditContent}>
              <Text style={styles.noAuditTitle}>Run an Audit First</Text>
              <Text style={styles.noAuditSubtitle}>
                Get a personalized cleanup plan based on your actual feed
              </Text>
            </View>
            <Text style={styles.noAuditArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Session preview card */}
        <View style={styles.sessionPreview}>
          <Text style={styles.sessionPreviewTitle}>Your Cleanup Plan</Text>
          <Text style={styles.sessionPreviewSubtitle}>
            {sessionSummary.totalSteps} steps · ~{sessionSummary.totalMinutes} min · {sessionSummary.totalPoints} pts
          </Text>

          {/* Priority breakdown */}
          <View style={styles.priorityList}>
            {sessionSummary.stepsByPriority.critical && (
              <View style={styles.priorityRow}>
                <View style={[styles.priorityDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.priorityLabel}>
                  {sessionSummary.stepsByPriority.critical} Settings Change{sessionSummary.stepsByPriority.critical > 1 ? 's' : ''}
                </Text>
                <Text style={styles.priorityTag}>Critical</Text>
              </View>
            )}
            {sessionSummary.stepsByPriority.high && (
              <View style={styles.priorityRow}>
                <View style={[styles.priorityDot, { backgroundColor: '#F97316' }]} />
                <Text style={styles.priorityLabel}>
                  {sessionSummary.stepsByPriority.high} Algorithm Training Task{sessionSummary.stepsByPriority.high > 1 ? 's' : ''}
                </Text>
                <Text style={styles.priorityTag}>High</Text>
              </View>
            )}
            {sessionSummary.stepsByPriority.medium && (
              <View style={styles.priorityRow}>
                <View style={[styles.priorityDot, { backgroundColor: '#EAB308' }]} />
                <Text style={styles.priorityLabel}>
                  {sessionSummary.stepsByPriority.medium} Unfollow/Review Task{sessionSummary.stepsByPriority.medium > 1 ? 's' : ''}
                </Text>
                <Text style={styles.priorityTag}>Medium</Text>
              </View>
            )}
            {sessionSummary.stepsByPriority.maintenance && (
              <View style={styles.priorityRow}>
                <View style={[styles.priorityDot, { backgroundColor: '#94A3B8' }]} />
                <Text style={styles.priorityLabel}>
                  {sessionSummary.stepsByPriority.maintenance} Maintenance Task{sessionSummary.stepsByPriority.maintenance > 1 ? 's' : ''}
                </Text>
                <Text style={styles.priorityTag}>Low</Text>
              </View>
            )}
          </View>
        </View>

        {/* Start button */}
        <TouchableOpacity style={styles.startButton} onPress={startSession}>
          <Text style={styles.startButtonText}>Start Cleanup Session</Text>
          <Text style={styles.startButtonSub}>
            ~{sessionSummary.totalMinutes} min · {sessionSummary.totalPoints} points
          </Text>
        </TouchableOpacity>

        {/* Tips section */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>How it works</Text>
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
        </View>
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

  // Centered states (loading, error, no-auth)
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

  // Platform tabs
  tabRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tabActive: {
    borderColor: '#6366F1',
    backgroundColor: '#1E1B4B',
  },
  tabEmoji: {
    fontSize: 18,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#F8FAFC',
  },

  // Audit banner
  auditBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  auditBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auditBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  auditBannerScore: {
    fontSize: 36,
    fontWeight: '800',
  },
  healthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  healthBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  auditBannerDetail: {
    fontSize: 13,
    color: '#94A3B8',
  },

  // No audit CTA
  noAuditCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  noAuditEmoji: {
    fontSize: 28,
  },
  noAuditContent: {
    flex: 1,
  },
  noAuditTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  noAuditSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  noAuditArrow: {
    fontSize: 20,
    color: '#6366F1',
    fontWeight: '700',
  },

  // Session preview
  sessionPreview: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  sessionPreviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sessionPreviewSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  priorityList: {
    gap: 10,
    marginTop: 4,
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
    flex: 1,
    fontSize: 14,
    color: '#CBD5E1',
  },
  priorityTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Start button
  startButton: {
    backgroundColor: '#6366F1',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  startButtonSub: {
    color: '#C7D2FE',
    fontSize: 13,
    marginTop: 4,
  },

  // Tips
  tipsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#334155',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    overflow: 'hidden',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
});
