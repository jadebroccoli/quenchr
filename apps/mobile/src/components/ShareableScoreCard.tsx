import { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { getFeedHealthInfo, getAuditBreakdown, PLATFORMS } from '@quenchr/shared';
import type { FeedAudit } from '@quenchr/shared';

export interface ShareableScoreCardHandle {
  share: () => Promise<void>;
}

interface Props {
  audit: FeedAudit;
}

export const ShareableScoreCard = forwardRef<ShareableScoreCardHandle, Props>(
  function ShareableScoreCard({ audit }, ref) {
    const viewShotRef = useRef<ViewShot>(null);

    const health = getFeedHealthInfo(audit.feed_score);
    const breakdown = getAuditBreakdown(audit);
    const platform = PLATFORMS[audit.platform];
    const pageName = audit.platform === 'instagram' ? 'Explore' : 'For You Page';

    useImperativeHandle(ref, () => ({
      share: async () => {
        try {
          const uri = await captureRef(viewShotRef, {
            format: 'png',
            quality: 1,
          });
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share your Feed Score',
          });
        } catch (err) {
          console.warn('[ShareableScoreCard] Share failed:', err);
        }
      },
    }));

    return (
      <View style={styles.offscreen} pointerEvents="none">
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
          <View style={styles.card}>
            {/* Branding */}
            <Text style={styles.brand}>Quenchr</Text>

            {/* Platform */}
            <Text style={styles.platform}>{platform.label}</Text>

            {/* Score */}
            <Text style={[styles.score, { color: health.color }]}>{audit.feed_score}</Text>
            <View style={[styles.badge, { backgroundColor: health.color + '20' }]}>
              <Text style={[styles.badgeText, { color: health.color }]}>{health.label}</Text>
            </View>

            {/* Hook line */}
            <Text style={styles.hook}>
              My {platform.label} {pageName} is{'\n'}
              <Text style={{ color: health.color }}>
                {breakdown.suggestivePercent}% thirst traps
              </Text>
            </Text>

            {/* Mini breakdown */}
            <View style={styles.miniBreakdown}>
              <MiniBar label="Suggestive" percent={breakdown.suggestivePercent} color="#EF4444" />
              <MiniBar label="Clean" percent={breakdown.cleanPercent} color="#22C55E" />
            </View>

            {/* Footer */}
            <Text style={styles.footer}>Scanned with Quenchr</Text>
          </View>
        </ViewShot>
      </View>
    );
  }
);

function MiniBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <View style={styles.miniBarRow}>
      <Text style={styles.miniBarLabel}>{label}</Text>
      <View style={styles.miniBarTrack}>
        <View style={[styles.miniBarFill, { width: `${Math.max(percent, 2)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.miniBarPercent, { color }]}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  card: {
    width: 360,
    paddingVertical: 40,
    paddingHorizontal: 32,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    gap: 12,
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  platform: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  score: {
    fontSize: 80,
    fontWeight: '900',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hook: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    lineHeight: 26,
    marginTop: 8,
  },
  miniBreakdown: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  miniBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniBarLabel: {
    fontSize: 12,
    color: '#94A3B8',
    width: 70,
  },
  miniBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  miniBarPercent: {
    fontSize: 12,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  footer: {
    fontSize: 12,
    color: '#475569',
    marginTop: 16,
    fontWeight: '600',
  },
});
