import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getFeedHealthInfo,
  getAuditBreakdown,
  PLATFORMS,
} from '@quenchr/shared';
import { useAuditStore } from '../stores/audit-store';
import { useSubscriptionStore } from '../stores/subscription-store';
import { ShareableScoreCard, type ShareableScoreCardHandle } from './ShareableScoreCard';
import { AIInsightsSection } from './AIInsightsSection';
import { selectFlaggedFrames, analyzeWithAI } from '../services/ai-insights';

interface Props {
  onNewAudit: () => void;
  onStartCleanup: () => void;
}

export function AuditResultsView({ onNewAudit, onStartCleanup }: Props) {
  const { currentAudit, aiInsights, imageResults, setAIInsightsStatus, setAIInsightsResult, setAIInsightsError } = useAuditStore();
  const { tier } = useSubscriptionStore();
  const isPro = tier === 'pro';

  const scoreAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bar1Anim = useRef(new Animated.Value(0)).current;
  const bar2Anim = useRef(new Animated.Value(0)).current;
  const bar3Anim = useRef(new Animated.Value(0)).current;
  const bar4Anim = useRef(new Animated.Value(0)).current;
  const shareCardRef = useRef<ShareableScoreCardHandle>(null);

  const audit = currentAudit;
  const feedScore = audit?.feed_score ?? 0;
  const health = getFeedHealthInfo(feedScore);
  const breakdown = audit ? getAuditBreakdown(audit) : null;

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

  // Interpolated score number
  const displayScore = scoreAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, feedScore],
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score counter */}
        <AnimatedScoreText value={displayScore} color={health.color} />

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
            {breakdown?.suggestivePercent ?? 0}% thirst traps
          </Text>
        </Animated.Text>

        {/* Breakdown bars */}
        {breakdown && (
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Breakdown</Text>

            <BreakdownBar
              label="Suggestive"
              percent={breakdown.suggestivePercent}
              color="#EF4444"
              anim={bar1Anim}
            />
            <BreakdownBar
              label="Explicit"
              percent={breakdown.explicitPercent}
              color="#DC2626"
              anim={bar2Anim}
            />
            <BreakdownBar
              label="Sexy"
              percent={breakdown.sexyPercent}
              color="#F97316"
              anim={bar3Anim}
            />
            <BreakdownBar
              label="Clean"
              percent={breakdown.cleanPercent}
              color="#22C55E"
              anim={bar4Anim}
            />
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{audit?.total_scanned ?? 0}</Text>
            <Text style={styles.statLabel}>Regions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>
              {(audit?.nsfw_detected ?? 0) + (audit?.sexy_detected ?? 0)}
            </Text>
            <Text style={styles.statLabel}>Flagged</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#22C55E' }]}>
              {audit?.neutral_detected ?? 0}
            </Text>
            <Text style={styles.statLabel}>Clean</Text>
          </View>
        </View>

        {/* AI Insights — Pro feature */}
        <View style={{ width: '100%' }}>
          <AIInsightsSection
            aiInsights={aiInsights}
            isPro={isPro}
            onRetry={() => {
              // Retry AI analysis with existing data
              if (imageResults && currentAudit) {
                const flaggedFrames = selectFlaggedFrames(imageResults);
                if (flaggedFrames.length > 0) {
                  setAIInsightsStatus('loading');
                  // Note: frameUris aren't available here for retry — this is a known limitation.
                  // A full retry would need the original URIs stored. For now, show error state.
                  setAIInsightsError('Please run a new audit to retry AI analysis.');
                }
              }
            }}
          />
        </View>

        {/* Share button */}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => shareCardRef.current?.share()}
        >
          <Text style={styles.shareButtonText}>Share Your Score</Text>
        </TouchableOpacity>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onNewAudit}>
            <Text style={styles.secondaryButtonText}>New Audit</Text>
          </TouchableOpacity>
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

function AnimatedScoreText({ value, color }: { value: Animated.AnimatedInterpolation<number>; color: string }) {
  const textRef = useRef<Text>(null);

  useEffect(() => {
    const listenerId = value.addListener(({ value: v }) => {
      textRef.current?.setNativeProps({ text: String(Math.round(v)) });
    });
    return () => value.removeListener(listenerId);
  }, [value]);

  return (
    <Animated.Text
      ref={textRef as any}
      style={[styles.scoreText, { color }]}
    >
      0
    </Animated.Text>
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
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 24,
    alignItems: 'center',
    gap: 16,
    paddingBottom: 40,
  },
  scoreText: {
    fontSize: 72,
    fontWeight: '900',
    marginTop: 16,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hookText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  breakdownCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    fontSize: 13,
    color: '#CBD5E1',
    width: 80,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barPercent: {
    fontSize: 13,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shareButton: {
    width: '100%',
    backgroundColor: '#1E1B4B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  shareButtonText: {
    color: '#A5B4FC',
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
