import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import type { AIInsightsResult, ContentType, AccountType } from '@quenchr/shared';
import type { AIInsightsState } from '../stores/audit-store';
import { colors, type as typ, radius, spacing } from '../tokens';

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
            // Guard: skip any content type the AI returned that isn't in our map
            if (!info) return null;
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

      {/* False positive row intentionally removed — internal mechanics stay internal */}

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
        Get a plain-language breakdown of what's actually in your feed and exactly what to do about it.
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
    backgroundColor: colors.char2,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    gap: 14,
  },
  successCard: {
    borderWidth: 1,
    borderColor: colors.gold,
  },
  errorCard: {
    backgroundColor: colors.red + '30',
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
    ...typ.btn,
    fontSize: 16,
    color: colors.lt,
    flex: 1,
  },
  proBadge: {
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proBadgeText: {
    ...typ.label,
    fontSize: 10,
    color: colors.lt,
  },

  // Loading shimmer
  shimmerBar: {
    height: 12,
    backgroundColor: colors.char4,
    borderRadius: 6,
  },
  loadingText: {
    ...typ.body,
    color: colors.lt4,
    textAlign: 'center',
  },

  // Summary
  summaryText: {
    ...typ.body,
    color: colors.lt2,
    lineHeight: 20,
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionTitle: {
    ...typ.label,
    color: colors.lt3,
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
    ...typ.bodySmall,
    color: colors.lt2,
    width: 120,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.char,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 4,
  },
  barCount: {
    ...typ.btnSm,
    color: colors.lt,
    width: 24,
    textAlign: 'right',
  },

  // False positives
  falsePositiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brown + '20',
    borderRadius: 10,
    padding: 12,
  },
  fpIcon: {
    fontSize: 16,
  },
  fpText: {
    ...typ.body,
    color: colors.brown3,
    fontWeight: '600',
    flex: 1,
  },
  fpScore: {
    ...typ.bodySmall,
    color: colors.brown2,
  },

  // Recommendations
  recCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.char,
    borderRadius: 10,
    padding: 12,
  },
  recNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recNumberText: {
    ...typ.caption,
    fontSize: 12,
    color: colors.lt,
  },
  recContent: {
    flex: 1,
    gap: 2,
  },
  recTitle: {
    ...typ.btnSm,
    color: colors.lt,
  },
  recDesc: {
    ...typ.bodySmall,
    color: colors.lt3,
    lineHeight: 16,
  },

  // Error
  errorIcon: {
    fontSize: 28,
  },
  errorText: {
    ...typ.body,
    color: colors.red,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: colors.red + '30',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryText: {
    ...typ.btnSm,
    color: colors.red,
  },

  // Locked
  lockIcon: {
    fontSize: 32,
  },
  lockedTitle: {
    ...typ.btn,
    fontSize: 16,
    color: colors.lt,
  },
  lockedDesc: {
    ...typ.body,
    color: colors.lt3,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  upgradeButton: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    paddingVertical: 10,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  upgradeText: {
    ...typ.btn,
    color: colors.lt,
  },
});
