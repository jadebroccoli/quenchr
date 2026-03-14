import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import type { AIInsightsResult, ContentType, AccountType } from '@quenchr/shared';
import type { AIInsightsState } from '../stores/audit-store';

// ── Content type display labels ──

const CONTENT_TYPE_LABELS: Record<ContentType, { label: string; emoji: string }> = {
  thirst_trap: { label: 'Thirst Traps', emoji: '🔥' },
  fitness: { label: 'Fitness', emoji: '💪' },
  onlyfans_promo: { label: 'OnlyFans Promo', emoji: '🔗' },
  dating_ad: { label: 'Dating Ads', emoji: '💕' },
  swimwear_beach: { label: 'Beach/Swimwear', emoji: '🏖️' },
  lingerie: { label: 'Lingerie', emoji: '👙' },
  dance_trend: { label: 'Dance Trends', emoji: '💃' },
  provocative_selfie: { label: 'Provocative Selfies', emoji: '🤳' },
  suggestive_meme: { label: 'Suggestive Memes', emoji: '😏' },
  other_suggestive: { label: 'Other Suggestive', emoji: '⚠️' },
};

// ── Props ──

interface Props {
  aiInsights: AIInsightsState;
  isPro: boolean;
  onRetry?: () => void;
  onUpgrade?: () => void;
}

export function AIInsightsSection({ aiInsights, isPro, onRetry, onUpgrade }: Props) {
  // Free user → show locked teaser
  if (!isPro) {
    return <LockedState onUpgrade={onUpgrade} />;
  }

  // Pro user → show based on status
  switch (aiInsights.status) {
    case 'idle':
      return null; // No flagged frames or not triggered yet
    case 'loading':
      return <LoadingState />;
    case 'error':
      return <ErrorState error={aiInsights.error} onRetry={onRetry} />;
    case 'success':
      return aiInsights.result ? <SuccessState result={aiInsights.result} /> : null;
  }
}

// ── Loading State (shimmer) ──

function LoadingState() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.sparkle}>✨</Text>
        <Text style={styles.headerText}>AI Insights</Text>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      </View>

      {/* Shimmer bars */}
      {[0.85, 0.6, 0.75].map((width, i) => (
        <Animated.View
          key={i}
          style={[
            styles.shimmerBar,
            { width: `${width * 100}%`, opacity: shimmerOpacity },
          ]}
        />
      ))}

      <Text style={styles.loadingText}>Analyzing your feed with AI...</Text>
    </View>
  );
}

// ── Success State ──

function SuccessState({ result }: { result: AIInsightsResult }) {
  // Sort content types by count (descending)
  const contentEntries = Object.entries(result.content_type_summary)
    .filter(([, count]) => (count ?? 0) > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0)) as [ContentType, number][];

  const maxCount = contentEntries.length > 0 ? contentEntries[0][1] : 1;

  return (
    <View style={[styles.card, styles.successCard]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sparkle}>✨</Text>
        <Text style={styles.headerText}>AI Insights</Text>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      </View>

      {/* Summary */}
      <Text style={styles.summaryText}>{result.summary}</Text>

      {/* Content Type Breakdown */}
      {contentEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content Breakdown</Text>
          {contentEntries.map(([type, count]) => {
            const info = CONTENT_TYPE_LABELS[type];
            const barWidth = Math.max(10, (count / maxCount) * 100);
            return (
              <View key={type} style={styles.barRow}>
                <Text style={styles.barEmoji}>{info.emoji}</Text>
                <Text style={styles.barLabel}>{info.label}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barWidth}%` }]} />
                </View>
                <Text style={styles.barCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* False Positives */}
      {result.false_positive_count > 0 && (
        <View style={styles.falsePositiveRow}>
          <Text style={styles.fpIcon}>✅</Text>
          <Text style={styles.fpText}>
            {result.false_positive_count} false positive{result.false_positive_count > 1 ? 's' : ''} corrected
          </Text>
          {result.adjusted_feed_score != null && (
            <Text style={styles.fpScore}>
              Adjusted score: {result.adjusted_feed_score}
            </Text>
          )}
        </View>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {result.recommendations
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 3)
            .map((rec, i) => (
              <View key={i} style={styles.recCard}>
                <View style={styles.recNumber}>
                  <Text style={styles.recNumberText}>{i + 1}</Text>
                </View>
                <View style={styles.recContent}>
                  <Text style={styles.recTitle}>{rec.title}</Text>
                  <Text style={styles.recDesc}>{rec.description}</Text>
                </View>
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

// ── Error State ──

function ErrorState({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  return (
    <View style={[styles.card, styles.errorCard]}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorText}>
        {error ?? 'AI analysis failed. Your basic results are unaffected.'}
      </Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Locked State (free users) ──

function LockedState({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <View style={[styles.card, styles.lockedCard]}>
      <Text style={styles.lockIcon}>🔒</Text>
      <Text style={styles.lockedTitle}>AI Insights</Text>
      <Text style={styles.lockedDesc}>
        Get deeper analysis of your feed — content type identification, false positive correction, and personalized cleanup recommendations.
      </Text>
      <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
        <Text style={styles.upgradeText}>Upgrade to Pro</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  successCard: {
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  errorCard: {
    backgroundColor: '#7F1D1D',
    alignItems: 'center',
    gap: 10,
  },
  lockedCard: {
    alignItems: 'center',
    gap: 10,
    opacity: 0.85,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sparkle: {
    fontSize: 18,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
  },
  proBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  // Loading shimmer
  shimmerBar: {
    height: 12,
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },

  // Summary
  summaryText: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  // Content type bars
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barEmoji: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  barLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    width: 120,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  barCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    width: 24,
    textAlign: 'right',
  },

  // False positives
  falsePositiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F2A1E',
    borderRadius: 10,
    padding: 12,
  },
  fpIcon: {
    fontSize: 16,
  },
  fpText: {
    fontSize: 13,
    color: '#4ADE80',
    fontWeight: '600',
    flex: 1,
  },
  fpScore: {
    fontSize: 12,
    color: '#86EFAC',
  },

  // Recommendations
  recCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
  },
  recNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recContent: {
    flex: 1,
    gap: 2,
  },
  recTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  recDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },

  // Error
  errorIcon: {
    fontSize: 28,
  },
  errorText: {
    fontSize: 13,
    color: '#FCA5A5',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#991B1B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FCA5A5',
  },

  // Locked
  lockIcon: {
    fontSize: 32,
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  lockedDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  upgradeButton: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
