/**
 * ScoreSparkline
 * Mini SVG line chart showing feed score history over time.
 * Uses react-native-svg (already installed).
 *
 * Lower score = cleaner feed = better.
 * The line trends downward as the user makes progress — that's the win.
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import type { FeedAudit } from '@quenchr/shared';
import { colors, type as typ } from '../../tokens';

interface Props {
  audits: FeedAudit[];
  width?: number;
  height?: number;
}

const PAD_X = 12;
const PAD_Y = 10;

export function ScoreSparkline({ audits, width = 320, height = 72 }: Props) {
  // Need at least 2 points to draw a line
  if (audits.length < 2) return null;

  // Audits come in newest-first — reverse to show oldest→newest left→right
  const ordered = [...audits].reverse().slice(-10); // max 10 points

  const scores = ordered.map((a) => a.feed_score);
  const first = scores[0];
  const last = scores[scores.length - 1];
  const delta = Math.round(first - last); // positive = feed got cleaner

  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_Y * 2;

  // Map score (0-100) to Y — inverted: low score (clean) = bottom, high score = top
  const toX = (i: number) =>
    PAD_X + (i / (ordered.length - 1)) * innerW;

  const toY = (score: number) =>
    PAD_Y + ((score / 100) * innerH);

  // Build SVG path
  const points = scores.map((s, i) => ({ x: toX(i), y: toY(s) }));
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  // Area fill path (line + close at bottom)
  const areaPath =
    linePath +
    ` L${points[points.length - 1].x.toFixed(1)},${(PAD_Y + innerH).toFixed(1)}` +
    ` L${points[0].x.toFixed(1)},${(PAD_Y + innerH).toFixed(1)} Z`;

  // Line color: gold if getting worse, brown if improving/flat
  const lineColor = delta >= 3 ? colors.brown : delta <= -3 ? colors.red : colors.gold;
  const lastScore = last;
  const lastDotColor =
    lastScore >= 70 ? colors.red : lastScore >= 40 ? colors.gold : colors.brown;

  // Delta label
  const deltaLabel =
    delta > 0 ? `↓ ${delta} pts cleaner` : delta < 0 ? `↑ ${Math.abs(delta)} pts worse` : 'Holding steady';
  const deltaColor = delta > 0 ? colors.brown : delta < 0 ? colors.red : colors.gold;

  return useMemo(() => (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>YOUR LAST {ordered.length} SCANS</Text>
        <Text style={[styles.delta, { color: deltaColor }]}>{deltaLabel}</Text>
      </View>

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.18" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Background */}
        <Rect x={0} y={0} width={width} height={height} fill={colors.char2} rx={8} />

        {/* Area fill */}
        <Path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <Path
          d={linePath}
          stroke={lineColor}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots for each data point */}
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isLast ? 4 : 2.5}
              fill={isLast ? lastDotColor : colors.char4}
              stroke={isLast ? lastDotColor : lineColor}
              strokeWidth={isLast ? 2 : 1}
            />
          );
        })}
      </Svg>

      {/* Score axis labels */}
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>
          {ordered[0]?.created_at
            ? new Date(ordered[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : ''}
        </Text>
        <Text style={styles.axisLabel}>Today</Text>
      </View>
    </View>
  ), [audits.length, width]);
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    ...typ.label,
    color: colors.ink3,
    fontSize: 10,
  },
  delta: {
    ...typ.label,
    fontSize: 11,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisLabel: {
    ...typ.caption,
    color: colors.ink3,
    fontSize: 10,
  },
});
