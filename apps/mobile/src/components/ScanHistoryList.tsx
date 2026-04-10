import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { getFeedHealthInfo, PLATFORMS } from '@quenchr/shared';
import type { FeedAudit } from '@quenchr/shared';
import { colors, type as typ, radius, spacing } from '../tokens';
import { ScoreSparkline } from './ui/ScoreSparkline';

interface Props {
  audits: FeedAudit[];
  onSelect: (audit: FeedAudit) => void;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Returns the score delta vs the NEXT item in the list (which is the previous scan). */
function getDelta(audits: FeedAudit[], index: number): number | null {
  if (index >= audits.length - 1) return null; // no previous scan to compare
  return audits[index + 1].feed_score - audits[index].feed_score; // positive = got cleaner
}

export function ScanHistoryList({ audits, onSelect }: Props) {
  const { width } = useWindowDimensions();
  const chartWidth = width - spacing.pagePad * 2;

  if (audits.length === 0) return null;

  // Show max 10 most recent (already sorted descending from store)
  const visible = audits.slice(0, 10);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>SCAN HISTORY</Text>

      {/* Score trend sparkline — only shown when there are 2+ scans */}
      {audits.length >= 2 && (
        <ScoreSparkline audits={audits} width={chartWidth} height={72} />
      )}

      {visible.map((audit, index) => {
        const health = getFeedHealthInfo(audit.feed_score);
        const platform = PLATFORMS[audit.platform as keyof typeof PLATFORMS];
        const totalFlagged = (audit.nsfw_detected ?? 0) + (audit.sexy_detected ?? 0);
        const isAI = audit.scan_type === 'haiku';
        const delta = getDelta(visible, index);

        return (
          <TouchableOpacity
            key={audit.id}
            style={styles.card}
            onPress={() => onSelect(audit)}
            activeOpacity={0.7}
          >
            <View style={styles.row}>
              {/* Score */}
              <Text style={[styles.score, { color: health.color }]}>
                {Math.round(audit.feed_score)}
              </Text>

              {/* Middle: platform + stats */}
              <View style={styles.info}>
                <Text style={styles.platformLabel}>
                  {platform?.label ?? audit.platform}
                </Text>
                <Text style={styles.stats}>
                  {audit.total_scanned} regions · {totalFlagged} flagged
                </Text>
              </View>

              {/* Right: date + scan type + delta */}
              <View style={styles.meta}>
                <Text style={styles.date}>
                  {formatRelativeDate(audit.created_at)}
                </Text>
                <View style={styles.pillRow}>
                  <View style={[styles.typePill, isAI && styles.typePillAI]}>
                    <Text style={[styles.typeText, isAI && styles.typeTextAI]}>
                      {isAI ? 'AI' : 'Quick'}
                    </Text>
                  </View>
                  {delta !== null && (
                    <View style={[
                      styles.deltaPill,
                      delta > 0 && styles.deltaPillGood,
                      delta < 0 && styles.deltaPillBad,
                    ]}>
                      <Text style={[
                        styles.deltaText,
                        delta > 0 && styles.deltaTextGood,
                        delta < 0 && styles.deltaTextBad,
                      ]}>
                        {delta > 0 ? `↓${Math.abs(Math.round(delta))}` : delta < 0 ? `↑${Math.abs(Math.round(delta))}` : '→'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sectionGap,
  },
  sectionHeader: {
    ...typ.label,
    color: colors.ink3,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.char,
    borderRadius: radius.card,
    paddingHorizontal: spacing.cardPad,
    paddingVertical: 14,
    marginBottom: spacing.cardGap,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  score: {
    ...typ.scoreNum,
    width: 46,
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  platformLabel: {
    ...typ.body,
    color: colors.lt,
  },
  stats: {
    ...typ.bodySmall,
    color: colors.lt3,
    marginTop: 2,
  },
  meta: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  date: {
    ...typ.bodySmall,
    color: colors.lt3,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  typePill: {
    backgroundColor: colors.char3,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typePillAI: {
    backgroundColor: colors.gold,
  },
  typeText: {
    ...typ.caption,
    color: colors.lt3,
  },
  typeTextAI: {
    color: colors.char,
  },
  deltaPill: {
    backgroundColor: colors.char3,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deltaPillGood: {
    backgroundColor: '#4E7A3E20',
  },
  deltaPillBad: {
    backgroundColor: colors.red + '20',
  },
  deltaText: {
    ...typ.caption,
    color: colors.lt3,
    fontSize: 10,
    fontWeight: '700',
  },
  deltaTextGood: {
    color: '#4E7A3E',
  },
  deltaTextBad: {
    color: colors.red,
  },
});
