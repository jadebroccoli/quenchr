import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import type { CleanupSessionStep } from '@quenchr/shared';
import { getPhaseInfo } from '@quenchr/shared';
import { colors, type as typ, radius, spacing } from '../tokens';

interface Props {
  step: CleanupSessionStep;
  stepIndex: number;
  onComplete: () => void;
  onSkip: () => void;
  saving?: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: colors.red,
  high: colors.gold,
  medium: colors.cream4,
  maintenance: colors.cream3,
};

export function CleanupStepView({ step, stepIndex, onComplete, onSkip, saving }: Props) {
  const [showingInstructions, setShowingInstructions] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowingInstructions(false);
    setElapsedSeconds(0);
    setTimerActive(false);
  }, [stepIndex]);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function handleOpenApp() {
    if (step.task.deep_link) {
      Linking.openURL(step.task.deep_link).catch(() => {
        Alert.alert('Cannot open app', 'Make sure the app is installed on your device.');
      });
    }
    setTimerActive(true);
  }

  function handleComplete() {
    setTimerActive(false);
    onComplete();
  }

  const priorityColor = PRIORITY_COLORS[step.priority] || colors.cream4;
  const phase = getPhaseInfo(step.priority);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Priority badge + reason */}
      <View style={styles.reasonCard}>
        <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '20' }]}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={[styles.priorityText, { color: priorityColor }]}>
            {step.priority.charAt(0).toUpperCase() + step.priority.slice(1)} Priority
          </Text>
        </View>
        <Text style={styles.reasonText}>{step.reason}</Text>
      </View>

      {/* Task card */}
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle}>{step.task.title}</Text>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsText}>+{step.task.points} pts</Text>
          </View>
        </View>
        <Text style={styles.taskDescription}>{step.task.description}</Text>

        {/* Estimated time */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>~{step.estimatedMinutes} min</Text>
          {timerActive && (
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          )}
        </View>

        {/* Instructions (expandable) */}
        <TouchableOpacity
          style={styles.instructionsToggle}
          onPress={() => setShowingInstructions(!showingInstructions)}
        >
          <Text style={styles.instructionsToggleText}>
            {showingInstructions ? 'Hide' : 'Show'} step-by-step instructions
          </Text>
          <Text style={styles.chevron}>{showingInstructions ? '\u25B2' : '\u25BC'}</Text>
        </TouchableOpacity>

        {showingInstructions && (
          <View style={styles.instructionsList}>
            {step.task.instruction_steps.map((instruction) => (
              <View key={instruction.step} style={styles.instructionRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{instruction.step}</Text>
                </View>
                <Text style={styles.instructionText}>{instruction.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {step.task.deep_link && (
          <TouchableOpacity style={styles.openAppButton} onPress={handleOpenApp}>
            <Text style={styles.openAppText}>
              Open {step.task.platform === 'instagram' ? 'Instagram' : 'TikTok'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.doneButton, saving && { opacity: 0.5 }]}
          onPress={handleComplete}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.lt} size="small" />
          ) : (
            <Text style={styles.doneButtonText}>Done</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Skip link */}
      <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
        <Text style={styles.skipText}>Skip this step</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.pagePad,
    gap: 14,
  },
  reasonCard: {
    backgroundColor: colors.char2,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    gap: 8,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    ...typ.caption,
    textTransform: 'uppercase',
  },
  reasonText: {
    ...typ.body,
    color: colors.lt2,
  },
  taskCard: {
    backgroundColor: colors.char2,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    gap: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  taskTitle: {
    ...typ.h3,
    color: colors.lt,
    flex: 1,
  },
  pointsBadge: {
    backgroundColor: colors.gold + '20',
    borderRadius: radius.badge,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pointsText: {
    ...typ.btnSm,
    color: colors.gold,
  },
  taskDescription: {
    ...typ.body,
    color: colors.lt3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaText: {
    ...typ.caption,
    color: colors.lt4,
  },
  timerText: {
    ...typ.h3,
    color: colors.gold,
    fontVariant: ['tabular-nums'],
  },
  instructionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.char4,
  },
  instructionsToggleText: {
    ...typ.btnSm,
    color: colors.brown3,
  },
  chevron: {
    fontSize: 10,
    color: colors.brown3,
  },
  instructionsList: {
    gap: 12,
    paddingTop: 4,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.char4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typ.btnSm,
    color: colors.lt,
  },
  instructionText: {
    flex: 1,
    ...typ.body,
    color: colors.lt2,
    paddingTop: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  openAppButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.brown3,
    borderRadius: radius.btn,
    padding: 14,
  },
  openAppText: {
    ...typ.btn,
    color: colors.brown,
  },
  doneButton: {
    flex: 1,
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    ...typ.btn,
    color: colors.lt,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    ...typ.body,
    color: colors.ink4,
  },
});
