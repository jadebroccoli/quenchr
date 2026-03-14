import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { getFeedHealthInfo, getAuditBreakdown } from '@quenchr/shared';
import type { FeedAudit } from '@quenchr/shared';

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
                  backgroundColor: '#EF4444',
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
                  backgroundColor: '#DC2626',
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
                  backgroundColor: '#F97316',
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
                  backgroundColor: '#22C55E',
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
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
  },
  scoreSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  platformText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  breakdownSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#94A3B8',
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
  breakdownPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    width: 36,
    textAlign: 'right',
  },
  cleanupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#6366F1',
    padding: 18,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
  },
  cleanupButtonEmoji: {
    fontSize: 24,
  },
  cleanupButtonContent: {
    flex: 1,
  },
  cleanupButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cleanupButtonSubtitle: {
    fontSize: 12,
    color: '#C7D2FE',
    marginTop: 2,
  },
  cleanupArrow: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Compact variant
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactScore: {
    fontSize: 32,
    fontWeight: '800',
  },
  compactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  compactPlatform: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'capitalize',
  },
  cleanupCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cleanupCTAText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  arrow: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
