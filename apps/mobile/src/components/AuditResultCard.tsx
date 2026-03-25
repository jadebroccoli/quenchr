import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { getFeedHealthInfo, getAuditBreakdown } from '@quenchr/shared';
import type { FeedAudit } from '@quenchr/shared';
import { colors, type as typ, radius, spacing } from '../tokens';

interface Props {
  audit: FeedAudit;
  onStartCleanup: () => void;
  compact?: boolean;
}

export function AuditResultCard({ audit, onStartCleanup, compact = false }: Props) {
  const health = getFeedHealthInfo(audit.feed_score);
  const breakdown = getAuditBreakdown(audit);

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={onStartCleanup}>
        <View style={styles.compactLeft}>
          <Text style={[styles.compactScore, { color: health.color }]}>
            {health.score}
          </Text>
          <View>
            <Text style={styles.compactLabel}>{health.label}</Text>
            <Text style={styles.compactPlatform}>{audit.platform}</Text>
          </View>
        </View>
        <View style={styles.cleanupCTA}>
          <Text style={styles.cleanupCTAText}>Clean up</Text>
          <Text style={styles.arrow}>→</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      {/* Score section */}
      <View style={styles.scoreSection}>
        <Text style={[styles.scoreValue, { color: health.color }]}>
          {health.score}
        </Text>
        <Text style={[styles.scoreLabel, { color: health.color }]}>
          {health.label}
        </Text>
        <Text style={styles.platformText}>
          {audit.platform === 'instagram' ? '📸' : '🎵'}{' '}
          {audit.platform.charAt(0).toUpperCase() + audit.platform.slice(1)}
        </Text>
      </View>

      {/* Breakdown bars */}
      <View style={styles.breakdownSection}>
        <Text style={styles.breakdownTitle}>Breakdown</Text>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Suggestive</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${breakdown.suggestivePercent}%`,
                  backgroundColor: colors.red,
                },
              ]}
            />
          </View>
          <Text style={styles.breakdownPercent}>{breakdown.suggestivePercent}%</Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Explicit</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${breakdown.explicitPercent}%`,
                  backgroundColor: colors.red,
                },
              ]}
            />
          </View>
          <Text style={styles.breakdownPercent}>{breakdown.explicitPercent}%</Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Sexy</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${breakdown.sexyPercent}%`,
                  backgroundColor: colors.gold,
                },
              ]}
            />
          </View>
          <Text style={styles.breakdownPercent}>{breakdown.sexyPercent}%</Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Clean</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${breakdown.cleanPercent}%`,
                  backgroundColor: colors.brown,
                },
              ]}
            />
          </View>
          <Text style={styles.breakdownPercent}>{breakdown.cleanPercent}%</Text>
        </View>
      </View>

      {/* Cleanup CTA */}
      <TouchableOpacity style={styles.cleanupButton} onPress={onStartCleanup}>
        <Text style={styles.cleanupButtonEmoji}>🧹</Text>
        <View style={styles.cleanupButtonContent}>
          <Text style={styles.cleanupButtonTitle}>Start a Cleanup Session</Text>
          <Text style={styles.cleanupButtonSubtitle}>
            Personalized tasks to fix your algorithm
          </Text>
        </View>
        <Text style={styles.cleanupArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.char2,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  scoreSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  scoreValue: {
    ...typ.bigNum,
    fontSize: 64,
    lineHeight: 64,
  },
  scoreLabel: {
    ...typ.h3,
    fontSize: 18,
    marginTop: 4,
  },
  platformText: {
    ...typ.body,
    color: colors.lt3,
    marginTop: 8,
  },
  breakdownSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  breakdownTitle: {
    ...typ.label,
    color: colors.lt4,
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownLabel: {
    ...typ.body,
    color: colors.lt3,
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
  breakdownPercent: {
    ...typ.btnSm,
    color: colors.lt,
    width: 36,
    textAlign: 'right',
  },
  cleanupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.brown,
    padding: 18,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: radius.btn,
  },
  cleanupButtonEmoji: {
    fontSize: 24,
  },
  cleanupButtonContent: {
    flex: 1,
  },
  cleanupButtonTitle: {
    ...typ.btn,
    fontSize: 16,
    color: colors.lt,
  },
  cleanupButtonSubtitle: {
    ...typ.bodySmall,
    color: colors.lt2,
    marginTop: 2,
  },
  cleanupArrow: {
    fontSize: 20,
    color: colors.lt,
    fontWeight: '700',
  },

  // Compact variant
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.char2,
    borderRadius: radius.stat,
    padding: 16,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactScore: {
    ...typ.statNum,
    fontSize: 32,
    lineHeight: 32,
  },
  compactLabel: {
    ...typ.body,
    color: colors.lt,
    fontWeight: '600',
  },
  compactPlatform: {
    ...typ.bodySmall,
    color: colors.lt3,
    textTransform: 'capitalize',
  },
  cleanupCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brown,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  cleanupCTAText: {
    ...typ.btnSm,
    color: colors.lt,
  },
  arrow: {
    ...typ.btnSm,
    fontSize: 14,
    color: colors.lt,
  },
});
