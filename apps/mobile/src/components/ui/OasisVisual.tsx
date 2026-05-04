import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { colors, type as typ, radius } from '../../tokens';

// ── Stage config ──

const STAGE_IMAGES = {
  1: require('../../../assets/oasis/stage-1-wasteland.png'),
  2: require('../../../assets/oasis/stage-2-sandy-desert.png'),
  3: require('../../../assets/oasis/stage-3-budding.png'),
  4: require('../../../assets/oasis/stage-4-growing-oasis.png'),
  5: require('../../../assets/oasis/stage-5-thriving-oasis.png'),
} as const;

const STAGE_LABELS: Record<number, string> = {
  1: 'Wasteland',
  2: 'Desert',
  3: 'Budding',
  4: 'Growing Oasis',
  5: 'Thriving Oasis',
};

/** Score thresholds → stage (score is 0–100, lower = cleaner) */
function scoreToStage(score: number | null): 1 | 2 | 3 | 4 | 5 {
  if (score === null || score >= 70) return 1;
  if (score >= 50) return 2;
  if (score >= 30) return 3;
  if (score >= 15) return 4;
  return 5;
}

// ── Component ──

interface Props {
  /** Current feed score (0–100). Null = no scan yet → Wasteland. */
  feedScore: number | null;
}

const AnimatedImage = Animated.createAnimatedComponent(
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native').Image,
);

export function OasisVisual({ feedScore }: Props) {
  const stage = scoreToStage(feedScore);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevStageRef = useRef(stage);

  // Crossfade when stage changes
  useEffect(() => {
    if (prevStageRef.current === stage) return;
    prevStageRef.current = stage;

    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [stage]);

  return (
    <View style={styles.container}>
      <AnimatedImage
        source={STAGE_IMAGES[stage]}
        style={[styles.image, { opacity: fadeAnim }]}
        resizeMode="cover"
      />

      {/* Stage label pill — bottom-left overlay */}
      <View style={styles.labelRow}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{STAGE_LABELS[stage]}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 2,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.char2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  labelRow: {
    position: 'absolute',
    bottom: 10,
    left: 10,
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pillText: {
    ...typ.label,
    color: '#fff',
    fontSize: 11,
  },
});
