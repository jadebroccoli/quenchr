import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { useAuditStore } from '../../src/stores/audit-store';
import { useCleanupStore } from '../../src/stores/cleanup-store';
import { getFeedHealthInfo, getAuditBreakdown } from '@quenchr/shared';
import { colors, type as typ, spacing, radius } from '../../src/tokens';
import {
  PageHeader,
  SectionDivider,
  CardLight,
  CardDark,
  PrimaryButton,
  ScoreRing,
  ScoreHistory,
} from '../../src/components/ui';
import { BadgeShelf } from '../../src/components/ui/BadgeShelf';
import { computeUnlockedBadges, BADGES } from '../../src/utils/badges';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const currentAudit = useAuditStore((s) => s.currentAudit);
  const auditHistory = useAuditStore((s) => s.auditHistory);
  const fetchAuditHistory = useAuditStore((s) => s.fetchAuditHistory);
  const fetchLatestAudit = useAuditStore((s) => s.fetchLatestAudit);
  const tasksCompletedToday = useCleanupStore((s) => s.tasksCompletedToday);
  const challenges = useCleanupStore((s) => s.challenges);
  const challengesDone = challenges.filter((c) => c.completed).length;

  const feedHealth = currentAudit ? getFeedHealthInfo(currentAudit.feed_score) : null;
  const breakdown = currentAudit ? getAuditBreakdown(currentAudit) : null;

  const unlockedBadges = useMemo(() => computeUnlockedBadges(auditHistory), [auditHistory]);

  useEffect(() => {
    if (user?.id) {
      fetchAuditHistory(user.id);
      if (!currentAudit) {
        fetchLatestAudit(user.id);
      }
    }
  }, [user?.id]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="Quenchr"
          title="Your feed, on trial."
          subtitle="Here's where things stand. Brace yourself."
        />
        <SectionDivider />

        <View style={styles.body}>
          {/* Feed Score Card */}
          <CardLight>
            <Text style={styles.eyebrow}>FEED SCORE</Text>
            <View style={styles.scoreCenter}>
              <ScoreRing score={feedHealth ? feedHealth.score : null} />
            </View>
            {feedHealth && breakdown ? (
              <>
                <Text style={styles.scoreDescription}>
                  {feedHealth.label} — {breakdown.suggestivePercent}% suggestive content detected
                </Text>
                {auditHistory.length > 0 && (
                  <ScoreHistory data={[...auditHistory].reverse().map((a) => ({ score: a.feed_score, date: a.created_at }))} />
                )}
                <PrimaryButton
                  label="Start Cleanup Session"
                  onPress={() => router.push('/(tabs)/cleanup')}
                  style={{ marginTop: 14 }}
                />
              </>
            ) : (
              <>
                <Text style={styles.emptyText}>
                  Unscored. Like your moral compass, apparently. Run an audit to find out how bad it actually is.
                </Text>
                <PrimaryButton
                  label="Start Audit"
                  onPress={() => router.push('/(tabs)/audit')}
                  style={{ marginTop: 14 }}
                />
              </>
            )}
          </CardLight>

          {/* Badges */}
          <CardDark>
            <Text style={styles.eyebrowDark}>BADGES</Text>
            <Text style={styles.badgeSub}>
              {unlockedBadges.size} of {BADGES.length} earned
            </Text>
            <BadgeShelf unlockedIds={unlockedBadges} />
          </CardDark>

          {/* Today's Progress */}
          <CardLight>
            <Text style={styles.eyebrow}>TODAY'S PROGRESS</Text>
            <View style={styles.miniGrid}>
              <View style={styles.miniCell}>
                <Text style={styles.miniValue}>{tasksCompletedToday}</Text>
                <Text style={styles.miniLabel}>Tasks Done</Text>
              </View>
              <View style={styles.miniCell}>
                <Text style={[styles.miniValue, { color: colors.gold }]}>{challengesDone}</Text>
                <Text style={styles.miniLabel}>Challenges</Text>
              </View>
            </View>
          </CardLight>
        </View>
      </ScrollView>

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

  // Eyebrows
  eyebrow: {
    ...typ.label,
    color: colors.ink3,
    marginBottom: 14,
  },
  eyebrowDark: {
    ...typ.label,
    color: colors.lt3,
  },

  // Score
  scoreCenter: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  scoreDescription: {
    ...typ.body,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 10,
  },
  emptyText: {
    ...typ.body,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 10,
  },

  // Badges
  badgeSub: {
    ...typ.caption,
    color: colors.lt3,
    marginBottom: 14,
    marginTop: -6,
  },

  // Mini grid (Today's Progress)
  miniGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  miniCell: {
    flex: 1,
    backgroundColor: colors.cream3,
    borderRadius: radius.mini,
    paddingVertical: 14,
    alignItems: 'center',
  },
  miniValue: {
    ...typ.statNum,
    color: colors.ink,
  },
  miniLabel: {
    ...typ.caption,
    color: colors.ink3,
    marginTop: 4,
    textTransform: 'uppercase',
  },

});
