import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { getFeedHealthInfo } from '@quenchr/shared';
import { colors, type as typ, radius, spacing } from '../tokens';

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
    padding: spacing.pagePad,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sectionGap,
  },
  celebrationEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    ...typ.h1,
    fontSize: 28,
    lineHeight: 32,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    ...typ.body,
    color: colors.ink3,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  pointsCard: {
    backgroundColor: colors.gold + '20',
    borderRadius: radius.card,
    paddingHorizontal: 32,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  pointsLabel: {
    ...typ.label,
    color: colors.gold,
    marginBottom: 4,
  },
  pointsValue: {
    ...typ.bigNum,
    fontSize: 40,
    lineHeight: 40,
    color: colors.gold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.char2,
    borderRadius: radius.stat,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    ...typ.statNum,
    color: colors.brown,
  },
  skippedValue: {
    color: colors.gold,
  },
  statLabel: {
    ...typ.label,
    color: colors.lt3,
    marginTop: 4,
  },
  rescanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cream2,
    borderRadius: radius.stat,
    padding: 16,
    width: '100%',
  },
  rescanEmoji: {
    fontSize: 24,
  },
  rescanText: {
    flex: 1,
    ...typ.body,
    color: colors.ink2,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    width: '100%',
    marginTop: 8,
  },
  rescanButton: {
    flex: 1,
    backgroundColor: colors.char4,
    borderRadius: radius.btn,
    padding: 16,
    alignItems: 'center',
  },
  rescanButtonText: {
    ...typ.btn,
    color: colors.lt,
  },
  doneButton: {
    flex: 1,
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    padding: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    ...typ.btn,
    color: colors.lt,
  },
});
