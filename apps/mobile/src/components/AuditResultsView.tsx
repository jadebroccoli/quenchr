import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  getFeedHealthInfo,
  getAuditBreakdown,
  PLATFORMS,
} from '@quenchr/shared';
import { useAuditStore } from '../stores/audit-store';
import { useSubscriptionStore } from '../stores/subscription-store';
import { ScoreSparkline } from './ui/ScoreSparkline';
import { ShareableScoreCard, type ShareableScoreCardHandle } from './ShareableScoreCard';
import { AIInsightsSection } from './AIInsightsSection';
// AI insights retry is not supported — user must run a new scan
import { colors, type as typ, radius, spacing } from '../tokens';

interface Props {
  onNewAudit: () => void;
  onStartCleanup: () => void;
}

export function AuditResultsView({ onNewAudit, onStartCleanup }: Props) {
  const router = useRouter();
  const {
    currentAudit, aiInsights, imageResults, lastCompletedImageResults,
    haikuScanStatus, setAIInsightsStatus, setAIInsightsResult, setAIInsightsError,
    isViewingHistory, exitHistoryView,
  } = useAuditStore();
  const effectiveImageResults = imageResults ?? lastCompletedImageResults;
  const isPro = useSubscriptionStore((s) => s.proAccess);

  const isHaikuEnhanced = (currentAudit as any)?.scan_type === 'haiku' || haikuScanStatus === 'done';

  const scoreAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bar1Anim = useRef(new Animated.Value(0)).current;
  const bar2Anim = useRef(new Animated.Value(0)).current;
  const bar3Anim = useRef(new Animated.Value(0)).current;
  const bar4Anim = useRef(new Animated.Value(0)).current;
  const shareCardRef = useRef<ShareableScoreCardHandle>(null);

  const audit = currentAudit;
  const breakdown = audit ? getAuditBreakdown(audit) : null;
  // Raw score from Haiku. When AI insights finish, they return an adjusted_feed_score
  // that corrects false positives. Use the adjusted score for everything the user sees
  // so the headline, badge, and number all agree with the AI narrative.
  const feedScore = audit?.feed_score ?? 0;
  const adjustedScore = aiInsights.result?.adjusted_feed_score ?? feedScore;
  const health = getFeedHealthInfo(adjustedScore);

  const platformLabel = audit ? PLATFORMS[audit.platform].label : '';
  const pageName = audit?.platform === 'instagram' ? 'Explore' : 'For You Page';

  useEffect(() => {
    // Staggered animation sequence
    Animated.sequence([
      // 1. Score counts up
      Animated.timing(scoreAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false,
      }),
      // 2. Health badge + hook text fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // 3. Bars animate in with stagger
      Animated.stagger(150, [
        Animated.spring(bar1Anim, { toValue: 1, tension: 40, friction: 10, useNativeDriver: false }),
        Animated.spring(bar2Anim, { toValue: 1, tension: 40, friction: 10, useNativeDriver: false }),
        Animated.spring(bar3Anim, { toValue: 1, tension: 40, friction: 10, useNativeDriver: false }),
        Animated.spring(bar4Anim, { toValue: 1, tension: 40, friction: 10, useNativeDriver: false }),
      ]),
    ]).start();
  }, []);

  // Interpolated score number — animates to raw score first, then snaps to
  // adjusted score when AI insights arrive (AnimatedScoreText handles the snap)
  const displayScore = scoreAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, feedScore],
  });

  const historyDate = isViewingHistory && audit?.created_at
    ? new Date(audit.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Back bar — only shown when reviewing a past audit */}
      {isViewingHistory && (
        <TouchableOpacity style={styles.backBar} onPress={exitHistoryView} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>
            {historyDate ? `Scan from ${historyDate}` : 'Back to History'}
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score counter */}
        <AnimatedScoreText value={displayScore} targetScore={adjustedScore} color={health.color} />

        {/* Haiku scanning indicator */}
        {haikuScanStatus === 'scanning' && (
          <Text style={styles.haikuScanningText}>AI is double-checking...</Text>
        )}

        {/* AI-Enhanced badge */}
        {isHaikuEnhanced && (
          <View style={styles.aiEnhancedBadge}>
            <Text style={styles.aiEnhancedText}>Powered by Quenchr AI</Text>
          </View>
        )}

        {/* Health badge */}
        <Animated.View style={[styles.badgeRow, { opacity: fadeAnim }]}>
          <View style={[styles.badge, { backgroundColor: health.color + '20' }]}>
            <Text style={[styles.badgeText, { color: health.color }]}>{health.label}</Text>
          </View>
        </Animated.View>

        {/* Hook text — the viral moment */}
        <Animated.Text style={[styles.hookText, { opacity: fadeAnim }]}>
          Your {platformLabel} {pageName} is{' '}
          <Text style={{ color: health.color }}>
            {adjustedScore}% thirst traps
          </Text>
        </Animated.Text>

        {/* Breakdown bars */}
        {breakdown && (
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Breakdown</Text>

            <BreakdownBar
              label="Explicit"
              percent={breakdown.explicitPercent}
              color={colors.red}
              anim={bar1Anim}
            />
            <BreakdownBar
              label="Suggestive"
              percent={breakdown.sexyPercent}
              color={colors.gold}
              anim={bar2Anim}
            />
            <BreakdownBar
              label="Clean"
              percent={breakdown.cleanPercent}
              color={colors.green}
              anim={bar3Anim}
            />
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{audit?.total_scanned ?? 0}</Text>
            <Text style={styles.statLabel}>Frames</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.red }]}>
              {(audit?.nsfw_detected ?? 0) + (audit?.sexy_detected ?? 0)}
            </Text>
            <Text style={styles.statLabel}>Flagged</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.green }]}>
              {audit?.neutral_detected ?? 0}
            </Text>
            <Text style={styles.statLabel}>Clean</Text>
          </View>
        </View>

        {/* AI Insights — Pro feature (shown when we have results or are loading/have frame data) */}
        {(effectiveImageResults || aiInsights.status === 'loading' || aiInsights.status === 'success' || aiInsights.status === 'error') && (
          <View style={{ width: '100%' }}>
            <AIInsightsSection
              aiInsights={aiInsights}
              isPro={isPro}
              onUpgrade={() => router.push('/paywall')}
              onRetry={() => {
                // Retry not supported without original frame URIs — prompt new scan
                setAIInsightsError('Please run a new audit to retry AI analysis.');
              }}
            />
          </View>
        )}

        {/* Share button */}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => shareCardRef.current?.share()}
        >
          <Text style={styles.shareButtonText}>Share Your Score</Text>
        </TouchableOpacity>

        {/* Action buttons */}
        <View style={styles.actions}>
          {isViewingHistory ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={exitHistoryView}>
              <Text style={styles.secondaryButtonText}>← Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.secondaryButton} onPress={onNewAudit}>
              <Text style={styles.secondaryButtonText}>New Audit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={onStartCleanup}>
            <Text style={styles.primaryButtonText}>Start Cleanup</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Off-screen shareable card */}
      {audit && <ShareableScoreCard ref={shareCardRef} audit={audit} />}
    </SafeAreaView>
  );
}

// ── Animated Score Display ──

function AnimatedScoreText({ value, targetScore, color }: { value: Animated.AnimatedInterpolation<number>; targetScore: number; color: string }) {
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const listenerId = value.addListener(({ value: v }) => {
      setDisplay(String(Math.round(v)));
    });
    return () => value.removeListener(listenerId);
  }, [value]);

  // Sync display when targetScore changes after animation completes
  // (e.g., Haiku overwrites the NSFWJS score)
  useEffect(() => {
    setDisplay(String(targetScore));
  }, [targetScore]);

  return (
    <Text style={[styles.scoreText, { color }]}>
      {display}
    </Text>
  );
}

// ── Breakdown Bar ──

function BreakdownBar({
  label,
  percent,
  color,
  anim,
}: {
  label: string;
  percent: number;
  color: string;
  anim: Animated.Value;
}) {
  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.max(percent, 2)}%`],
  });

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barPercent, { color }]}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.pagePad,
    paddingVertical: 12,
    backgroundColor: colors.cream2,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream3,
    gap: 8,
  },
  backArrow: {
    ...typ.body,
    color: colors.ink2,
    fontSize: 18,
    lineHeight: 20,
  },
  backText: {
    ...typ.body,
    color: colors.ink2,
  },
  content: {
    padding: spacing.pagePad,
    alignItems: 'center',
    gap: spacing.sectionGap,
    paddingBottom: 40,
  },
  scoreText: {
    ...typ.bigNum,
    fontSize: 72,
    lineHeight: 72,
    marginTop: 16,
  },
  haikuScanningText: {
    ...typ.bodySmall,
    color: colors.gold,
    textAlign: 'center',
    marginTop: -4,
  },
  aiEnhancedBadge: {
    backgroundColor: colors.gold + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.badge,
    borderWidth: 1,
    borderColor: colors.gold + '40',
  },
  aiEnhancedText: {
    ...typ.label,
    color: colors.gold,
    fontSize: 11,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.badge,
  },
  badgeText: {
    ...typ.eyebrow,
  },
  hookText: {
    ...typ.h3,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  breakdownCard: {
    width: '100%',
    backgroundColor: colors.char2,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    gap: 12,
  },
  breakdownTitle: {
    ...typ.label,
    color: colors.lt3,
    marginBottom: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    ...typ.bodySmall,
    color: colors.lt2,
    width: 80,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.char4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barPercent: {
    ...typ.btnSm,
    width: 40,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.char2,
    borderRadius: radius.stat,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    ...typ.statNum,
    color: colors.lt,
  },
  statLabel: {
    ...typ.label,
    color: colors.lt3,
    marginTop: 4,
  },
  shareButton: {
    width: '100%',
    backgroundColor: colors.gold + '20',
    borderRadius: radius.btn,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  shareButtonText: {
    ...typ.btn,
    color: colors.gold,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.char4,
    borderRadius: radius.btn,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typ.btn,
    color: colors.lt,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typ.btn,
    color: colors.lt,
  },
});
