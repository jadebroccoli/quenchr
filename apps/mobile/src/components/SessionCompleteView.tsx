import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { getFeedHealthInfo } from '@quenchr/shared';

interface Props {
  earnedPoints: number;
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  feedScore: number | null;
  onRescan: () => void;
  onDone: () => void;
}

export function SessionCompleteView({
  earnedPoints,
  totalSteps,
  completedSteps,
  skippedSteps,
  feedScore,
  onRescan,
  onDone,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pointsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(pointsAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const feedHealth = feedScore !== null ? getFeedHealthInfo(feedScore) : null;

  return (
    <View style={styles.container}>
      {/* Celebration emoji */}
      <Animated.Text
        style={[
          styles.celebrationEmoji,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {completedSteps === totalSteps ? '🎉' : '👏'}
      </Animated.Text>

      <Text style={styles.title}>
        {completedSteps === totalSteps ? 'Session Complete!' : 'Session Done!'}
      </Text>

      <Text style={styles.subtitle}>
        {completedSteps === totalSteps
          ? "You crushed every step. Your algorithm is learning."
          : `You completed ${completedSteps} of ${totalSteps} steps. Every bit counts.`}
      </Text>

      {/* Points earned */}
      <Animated.View
        style={[
          styles.pointsCard,
          {
            opacity: pointsAnim,
            transform: [
              {
                translateY: pointsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.pointsLabel}>Points Earned</Text>
        <Text style={styles.pointsValue}>+{earnedPoints}</Text>
      </Animated.View>

      {/* Stats grid */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completedSteps}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        {skippedSteps > 0 && (
          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.skippedValue]}>{skippedSteps}</Text>
            <Text style={styles.statLabel}>Skipped</Text>
          </View>
        )}
        {feedHealth && (
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: feedHealth.color }]}>
              {feedHealth.score}
            </Text>
            <Text style={styles.statLabel}>Feed Score</Text>
          </View>
        )}
      </View>

      {/* Re-scan suggestion */}
      <View style={styles.rescanCard}>
        <Text style={styles.rescanEmoji}>📊</Text>
        <Text style={styles.rescanText}>
          Re-scan your feed in 2-3 days to see your improvement!
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.rescanButton} onPress={onRescan}>
          <Text style={styles.rescanButtonText}>New Audit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneButton} onPress={onDone}>
          <Text style={styles.doneButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  celebrationEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  pointsCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  pointsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A5B4FC',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#6366F1',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#22C55E',
  },
  skippedValue: {
    color: '#F97316',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rescanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  rescanEmoji: {
    fontSize: 24,
  },
  rescanText: {
    flex: 1,
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  rescanButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  rescanButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  doneButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
