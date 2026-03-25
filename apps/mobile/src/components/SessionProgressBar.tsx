import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import type { CleanupPriority } from '@quenchr/shared';
import { getPhaseInfo } from '@quenchr/shared';
import { colors, type as typ, radius, spacing } from '../tokens';

interface Props {
  currentStep: number;
  totalSteps: number;
  currentPriority: CleanupPriority;
}

export function SessionProgressBar({ currentStep, totalSteps, currentPriority }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const phase = getPhaseInfo(currentPriority);

  useEffect(() => {
    Animated.spring(progress, {
      toValue: (currentStep + 1) / totalSteps,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  }, [currentStep, totalSteps]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.phaseLabel}>
          {phase.emoji} {phase.title}
        </Text>
        <Text style={styles.stepCounter}>
          {currentStep + 1} of {totalSteps}
        </Text>
      </View>
      <Text style={styles.phaseSubtitle}>{phase.subtitle}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
        {/* Step markers */}
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.marker,
              {
                left: `${((i + 1) / totalSteps) * 100}%`,
              },
              i < currentStep && styles.markerCompleted,
              i === currentStep && styles.markerActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.pagePad,
    paddingVertical: 16,
    backgroundColor: colors.char2,
    borderBottomWidth: 1,
    borderBottomColor: colors.char4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  phaseLabel: {
    ...typ.btn,
    fontSize: 16,
    color: colors.lt,
  },
  stepCounter: {
    ...typ.body,
    fontWeight: '600',
    color: colors.gold,
  },
  phaseSubtitle: {
    ...typ.body,
    color: colors.lt3,
    marginBottom: 12,
  },
  track: {
    height: 6,
    backgroundColor: colors.char4,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  marker: {
    position: 'absolute',
    top: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.lt4,
    marginLeft: -5,
  },
  markerCompleted: {
    backgroundColor: colors.brown,
  },
  markerActive: {
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.lt,
  },
});
