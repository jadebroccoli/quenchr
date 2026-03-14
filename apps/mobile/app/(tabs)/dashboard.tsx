import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { useAuditStore } from '../../src/stores/audit-store';
import { useCleanupStore } from '../../src/stores/cleanup-store';
import { getFeedHealthInfo, getAuditBreakdown } from '@quenchr/shared';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const currentAudit = useAuditStore((s) => s.currentAudit);
  const streak = useCleanupStore((s) => s.streak);
  const tasksCompletedToday = useCleanupStore((s) => s.tasksCompletedToday);
  const challenges = useCleanupStore((s) => s.challenges);
  const challengesDone = challenges.filter((c) => c.completed).length;

  const feedHealth = currentAudit ? getFeedHealthInfo(currentAudit.feed_score) : null;
  const breakdown = currentAudit ? getAuditBreakdown(currentAudit) : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>
          Hey{user?.display_name ? `, ${user.display_name}` : ''}
        </Text>
        <Text style={styles.subtitle}>Here's your feed health overview</Text>

        {/* Feed Score Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Feed Score</Text>
          {feedHealth && breakdown ? (
            <>
              <Text style={[styles.scoreValue, { color: feedHealth.color }]}>
                {feedHealth.score}
              </Text>
              <Text style={[styles.scoreLabel, { color: feedHealth.color }]}>
                {feedHealth.label}
              </Text>

              {/* Mini breakdown */}
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownValue}>{breakdown.suggestivePercent}%</Text>
                  <Text style={styles.breakdownLabel}>Suggestive</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, { color: '#22C55E' }]}>
                    {breakdown.cleanPercent}%
                  </Text>
                  <Text style={styles.breakdownLabel}>Clean</Text>
                </View>
              </View>

              {/* Cleanup CTA */}
              <TouchableOpacity
                style={styles.cleanupCTA}
                onPress={() => router.push('/(tabs)/cleanup')}
              >
                <Text style={styles.cleanupCTAText}>Start a Cleanup Session →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.emptyState}
              onPress={() => router.push('/(tabs)/audit')}
            >
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>
                Run your first Feed Audit to see how clean your algorithm is
              </Text>
              <View style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Start Audit</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Streak Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Streak</Text>
          <View style={styles.streakRow}>
            <View style={styles.streakItem}>
              <Text style={styles.streakValue}>{streak?.current_streak ?? 0}</Text>
              <Text style={styles.streakLabel}>Current</Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakItem}>
              <Text style={styles.streakValue}>{streak?.longest_streak ?? 0}</Text>
              <Text style={styles.streakLabel}>Best</Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakItem}>
              <Text style={styles.streakValue}>{streak?.total_points ?? 0}</Text>
              <Text style={styles.streakLabel}>Points</Text>
            </View>
          </View>
        </View>

        {/* Today's Progress */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Progress</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{tasksCompletedToday}</Text>
              <Text style={styles.statLabel}>Tasks Done</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{challengesDone}</Text>
              <Text style={styles.statLabel}>Challenges</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(tabs)/audit')}
          >
            <Text style={styles.quickActionEmoji}>🔍</Text>
            <Text style={styles.quickActionText}>New Audit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(tabs)/cleanup')}
          >
            <Text style={styles.quickActionEmoji}>🧹</Text>
            <Text style={styles.quickActionText}>Cleanup</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(tabs)/challenges')}
          >
            <Text style={styles.quickActionEmoji}>🏆</Text>
            <Text style={styles.quickActionText}>Challenges</Text>
          </TouchableOpacity>
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
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: '800',
    textAlign: 'center',
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },

  // Breakdown
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 0,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  breakdownDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#334155',
  },

  // Cleanup CTA
  cleanupCTA: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  cleanupCTAText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Streak
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  streakLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  streakDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#334155',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6366F1',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
