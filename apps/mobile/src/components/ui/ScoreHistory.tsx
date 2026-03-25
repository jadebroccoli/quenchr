import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import { colors, type as typ } from '../../tokens';

export interface ScoreHistoryEntry {
  score: number;
  date: string;
}

interface ScoreHistoryProps {
  data: ScoreHistoryEntry[];
}

const CHART_HEIGHT = 80;
const DOT_RADIUS = 3;
const PADDING_X = 8;
const PADDING_Y = 12;

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ScoreHistory({ data }: ScoreHistoryProps) {
  if (data.length === 0) {
    return null;
  }

  const dateRange =
    data.length > 1
      ? `${formatShortDate(data[0].date)} \u2014 ${formatShortDate(data[data.length - 1].date)}`
      : formatShortDate(data[0].date);

  if (data.length === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.singleDotWrap}>
          <Svg width="100%" height={CHART_HEIGHT}>
            <Circle
              cx="50%"
              cy={CHART_HEIGHT / 2}
              r={DOT_RADIUS + 1}
              fill={colors.brown}
            />
          </Svg>
        </View>
        <Text style={styles.hint}>Run more audits to see trends</Text>
        <Text style={styles.dateRange}>{dateRange}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SparklineSvg data={data} />
      <Text style={styles.dateRange}>{dateRange}</Text>
    </View>
  );
}

function SparklineSvg({ data }: { data: ScoreHistoryEntry[] }) {
  const scores = data.map((d) => d.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;

  const [layoutWidth, setLayoutWidth] = React.useState(0);

  const drawableWidth = layoutWidth - PADDING_X * 2;
  const drawableHeight = CHART_HEIGHT - PADDING_Y * 2;

  const points = data.map((d, i) => {
    const x = PADDING_X + (drawableWidth / (data.length - 1)) * i;
    const y = PADDING_Y + drawableHeight - ((d.score - minScore) / range) * drawableHeight;
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Polygon for the filled area: line points + bottom-right + bottom-left
  const fillPoints =
    polylinePoints +
    ` ${points[points.length - 1].x},${CHART_HEIGHT - PADDING_Y}` +
    ` ${points[0].x},${CHART_HEIGHT - PADDING_Y}`;

  return (
    <View
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
      style={styles.svgWrap}
    >
      {layoutWidth > 0 && (
        <Svg width={layoutWidth} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.brown} stopOpacity={0.1} />
              <Stop offset="1" stopColor={colors.brown} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Polygon points={fillPoints} fill="url(#fillGrad)" />
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.brown}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={DOT_RADIUS}
              fill={colors.brown}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  svgWrap: {
    width: '100%',
    height: CHART_HEIGHT,
  },
  singleDotWrap: {
    width: '100%',
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    ...typ.caption,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 4,
  },
  dateRange: {
    ...typ.caption,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 6,
  },
});
