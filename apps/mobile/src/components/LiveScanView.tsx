import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState, Alert, Animated, Easing } from 'react-native';
import { PLATFORMS } from '@quenchr/shared';
import type { Platform } from '@quenchr/shared';
import { useAuditStore } from '../stores/audit-store';
import {
  requestRecordingPermission,
  startScreenRecording,
  stopScreenRecording,
  extractFrames,
  getRecordingDuration,
  cleanupRecording,
} from '../services/screen-capture';
import { colors, type as typ, radius, spacing } from '../tokens';

interface Props {
  platform: Platform;
  onFramesExtracted: (frameUris: string[]) => void;
  onCancel: () => void;
}

export function LiveScanView({ platform, onFramesExtracted, onCancel }: Props) {
  const {
    liveScanState,
    setLiveScanState,
    recordingDurationSeconds,
    setRecordingDuration,
    setFrameExtractionProgress,
    frameExtractionProgress,
  } = useAuditStore();

  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const pageName = platform === 'instagram' ? 'Explore page' : 'For You Page';

  // Pulsing red dot animation during recording
  useEffect(() => {
    if (liveScanState !== 'recording') return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [liveScanState]);

  // Duration timer during recording
  useEffect(() => {
    if (liveScanState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingDuration(getRecordingDuration());
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [liveScanState]);

  // Detect when user comes back from another app
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && liveScanState === 'recording') {
        setRecordingDuration(getRecordingDuration());
      }
    });
    return () => sub.remove();
  }, [liveScanState]);

  const handleStartRecording = useCallback(async () => {
    setError(null);

    try {
      setLiveScanState('idle');
      const granted = await requestRecordingPermission();
      if (!granted) {
        Alert.alert('Permission Denied', 'Screen recording permission is required to scan your feed.');
        return;
      }

      await startScreenRecording();
      setLiveScanState('recording');
      setRecordingDuration(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      setError(message);
      setLiveScanState('idle');
    }
  }, []);

  const handleStopAndAnalyze = useCallback(async () => {
    try {
      setLiveScanState('stopping');
      const videoUri = await stopScreenRecording();

      setLiveScanState('extracting_frames');
      const frameUris = await extractFrames(
        videoUri,
        2000,
        30,
        (progress) => setFrameExtractionProgress({ current: progress.currentFrame, total: progress.totalFrames })
      );

      if (frameUris.length === 0) {
        setLiveScanState('idle');
        Alert.alert('No Frames', 'Could not extract frames from the recording. Try recording for a longer period.');
        return;
      }

      await cleanupRecording();
      setFrameExtractionProgress(null);
      onFramesExtracted(frameUris);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process recording';
      setError(message);
      setLiveScanState('idle');
    }
  }, [onFramesExtracted]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Recording state ──
  if (liveScanState === 'recording') {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.recordingHeader}>
          <Animated.View style={[styles.redDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.recordingLabel}>Recording</Text>
        </View>

        <Text style={styles.timer}>{formatDuration(recordingDurationSeconds)}</Text>

        <Text style={styles.recordingInstruction}>
          Switch to {PLATFORMS[platform].label} and scroll your {pageName}.{'\n'}
          Come back here when you're done.
        </Text>

        <TouchableOpacity style={styles.stopButton} onPress={handleStopAndAnalyze}>
          <Text style={styles.stopButtonText}>Stop & Analyze</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Extracting / stopping state ──
  if (liveScanState === 'stopping' || liveScanState === 'extracting_frames') {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.extractLabel}>
          {liveScanState === 'stopping' ? 'Finishing recording...' : 'Extracting frames...'}
        </Text>
        {frameExtractionProgress && (
          <Text style={styles.extractProgress}>
            Frame {frameExtractionProgress.current} of {frameExtractionProgress.total}
          </Text>
        )}
      </View>
    );
  }

  // ── Idle state (default) ──
  return (
    <View style={styles.idleContainer}>
      {/* Instructions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>How Live Scan works</Text>
        <View style={styles.stepList}>
          <Text style={styles.step}>1. Tap "Start Recording" below</Text>
          <Text style={styles.step}>2. Grant screen recording permission</Text>
          <Text style={styles.step}>3. Switch to {PLATFORMS[platform].label} and scroll your {pageName}</Text>
          <Text style={styles.step}>4. Come back and tap "Stop & Analyze"</Text>
        </View>
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Start button */}
      <TouchableOpacity style={styles.startButton} onPress={handleStartRecording}>
        <Text style={styles.startButtonText}>Start Recording</Text>
      </TouchableOpacity>

      {/* Privacy note */}
      <View style={styles.privacyCard}>
        <Text style={styles.privacyText}>
          Recording stays on device. Only extracted frames are analyzed — then deleted. We have enough problems of our own.
        </Text>
      </View>

      {/* Cancel link */}
      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelText}>Use screenshots instead</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shared layout for recording / extracting states
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 16,
  },

  // ── Recording state ──
  recordingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  redDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red,
  },
  recordingLabel: {
    ...typ.label,
    color: colors.red,
    fontSize: 14,
  },
  timer: {
    ...typ.bigNum,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  recordingInstruction: {
    ...typ.body,
    color: colors.ink3,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  stopButton: {
    backgroundColor: colors.red,
    borderRadius: radius.btn,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 16,
  },
  stopButtonText: {
    ...typ.btn,
    color: colors.lt,
  },

  // ── Extracting state ──
  extractLabel: {
    ...typ.body,
    color: colors.ink3,
  },
  extractProgress: {
    ...typ.caption,
    color: colors.ink4,
  },

  // ── Idle state ──
  idleContainer: {
    gap: 14,
  },
  card: {
    backgroundColor: colors.char2,
    borderRadius: radius.card,
    padding: spacing.cardPad,
  },
  cardTitle: {
    ...typ.h3,
    color: colors.lt,
    marginBottom: 12,
  },
  stepList: {
    gap: 8,
  },
  step: {
    ...typ.body,
    color: colors.lt2,
  },
  errorCard: {
    backgroundColor: colors.red + '15',
    borderWidth: 1,
    borderColor: colors.red + '40',
    borderRadius: radius.btn,
    padding: 14,
  },
  errorText: {
    ...typ.body,
    color: colors.red,
  },
  startButton: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  startButtonText: {
    ...typ.btn,
    color: colors.lt,
  },
  privacyCard: {
    backgroundColor: colors.char3,
    borderRadius: radius.btn,
    padding: 14,
  },
  privacyText: {
    ...typ.bodySmall,
    color: colors.lt3,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    ...typ.body,
    color: colors.ink4,
    fontFamily: 'DMSans_600SemiBold',
  },
});
