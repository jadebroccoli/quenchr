import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, type as typ } from '../../tokens';

interface Props {
  score: number | null; // null = empty state
  size?: number;
}

export function ScoreRing({ score, size = 110 }: Props) {
  const strokeWidth = 7;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = score !== null ? Math.min(score / 100, 1) : 0;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.cream3}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Fill */}
        {score !== null && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.brown}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        )}
      </Svg>
      <View style={styles.center}>
        <Text style={styles.number}>{score !== null ? score : '\u2014'}</Text>
        <Text style={styles.label}>{score !== null ? 'SCORE' : 'NO SCORE YET'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
  },
  number: {
    ...typ.scoreNum,
    color: colors.ink,
  },
  label: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 8,
    letterSpacing: 2,
    color: colors.ink3,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
