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

interface Props {
  step: CleanupSessionStep;
  stepIndex: number;
  onComplete: () => void;
  onSkip: () => void;
  saving?: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  maintenance: '#94A3B8',
};

export function CleanupStepView({ step, stepIndex, onComplete, onSkip, saving }: Props) {
  const [showingInstructions, setShowingInstructions] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in on mount
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

  // Timer
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

  const priorityColor = PRIORITY_COLORS[step.priority] || '#94A3B8';
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
          <Text style={styles.metaText}>
            ~{step.estimatedMinutes} min
          </Text>
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
          <Text style={styles.chevron}>{showingInstructions ? '▲' : '▼'}</Text>
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
            <Text style={styles.openAppEmoji}>
              {step.task.platform === 'instagram' ? '📸' : '🎵'}
            </Text>
            <Text style={styles.openAppText}>
              Open {step.task.platform === 'instagram' ? 'Instagram' : 'TikTok'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.doneButton, saving && { opacity: 0.6 }]}
          onPress={handleComplete}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
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
    padding: 24,
    gap: 16,
  },
  reasonCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
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
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonText: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  taskCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
  },
  pointsBadge: {
    backgroundColor: '#1E1B4B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pointsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
  },
  taskDescription: {
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
    fontVariant: ['tabular-nums'],
  },
  instructionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  instructionsToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  chevron: {
    fontSize: 12,
    color: '#6366F1',
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
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 22,
    paddingTop: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  openAppButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
  },
  openAppEmoji: {
    fontSize: 18,
  },
  openAppText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  doneButton: {
    flex: 1,
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#64748B',
  },
});
