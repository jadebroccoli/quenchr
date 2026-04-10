import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
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
  StatRow,
  ScoreRing,
  ScoreHistory,
} from '../../src/components/ui';
import { OasisVisual } from '../../src/components/ui/OasisVisual';
import { PanicOverlay } from '../../src/components/PanicOverlay';

export default function DashboardScreen() {
  const router = useRouter();
  const [panicVisible, setPanicVisible] = useState(false);
  const [oasisInfoVisible, setOasisInfoVisible] = useState(false);
  const user = useAuthStore((s) => s.user);
  const currentAudit = useAuditStore((s) => s.currentAudit);
  const auditHistory = useAuditStore((s) => s.auditHistory);
  const fetchAuditHistory = useAuditStore((s) => s.fetchAuditHistory);
  const fetchLatestAudit = useAuditStore((s) => s.fetchLatestAudit);
  const streak = useCleanupStore((s) => s.streak);
  const tasksCompletedToday = useCleanupStore((s) => s.tasksCompletedToday);
  const challenges = useCleanupStore((s) => s.challenges);
  const challengesDone = challenges.filter((c) => c.completed).length;

  const feedHealth = currentAudit ? getFeedHealthInfo(currentAudit.feed_score) : null;
  const breakdown = currentAudit ? getAuditBreakdown(currentAudit) : null;

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

          {/* Streak Card */}
          <CardDark>
            <View style={styles.streakHeader}>
              <Text style={styles.eyebrowDark}>STREAK</Text>
              <TouchableOpacity onPress={() => setOasisInfoVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View style={styles.infoBtn}>
                  <Text style={styles.infoBtnText}>?</Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.oasisWrapper}>
              <OasisVisual currentStreak={streak?.current_streak ?? 0} size={200} />
            </View>
            <StatRow
              items={[
                { value: streak?.current_streak ?? 0, label: 'Current' },
                { value: streak?.longest_streak ?? 0, label: 'Best' },
                { value: streak?.total_points ?? 0, label: 'Points', gold: true },
              ]}
            />
          </CardDark>

          {/* Panic Button Card */}
          <CardDark>
            <Text style={styles.panicHeadline}>Caught mid-scroll?</Text>
            <Text style={styles.panicSub}>Tap to pause and reset.</Text>
            <TouchableOpacity style={styles.panicBtn} onPress={() => setPanicVisible(true)} activeOpacity={0.85}>
              <Text style={styles.panicBtnText}>Stop Scrolling</Text>
            </TouchableOpacity>
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

      <PanicOverlay visible={panicVisible} onDismiss={() => setPanicVisible(false)} />

      <Modal visible={oasisInfoVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOasisInfoVisible(false)}>
        <TouchableOpacity style={styles.infoOverlay} activeOpacity={1} onPress={() => setOasisInfoVisible(false)}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Your Oasis</Text>
            <Text style={styles.infoBody}>
              It's a little bare right now, but the longer you keep up your streak, the more it grows and begins to fill with water.
            </Text>
            <Text style={styles.infoWip}>🎨 Art is currently WIP</Text>
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

  // Streak header row
  streakHeader: {
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
    marginBottom: 16,
  },
  infoWip: {
    ...typ.caption,
    color: colors.ink4,
  },

  // Oasis
  oasisWrapper: {
    alignItems: 'center',
    marginBottom: 8,
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
