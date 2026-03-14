import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import type { CleanupPriority } from '@quenchr/shared';
import { getPhaseInfo } from '@quenchr/shared';

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
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  phaseLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  phaseSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  track: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  marker: {
    position: 'absolute',
    top: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#475569',
    marginLeft: -5,
  },
  markerCompleted: {
    backgroundColor: '#22C55E',
  },
  markerActive: {
    backgroundColor: '#6366F1',
    borderWidth: 2,
    borderColor: '#F8FAFC',
  },
});
