import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuditStore } from '../stores/audit-store';

export function ScanningProgressView() {
  const { scanProgress, resetScan } = useAuditStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Pulsing scan icon
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Animate progress bar
  useEffect(() => {
    const percent = scanProgress?.percentComplete ?? 0;
    Animated.spring(progressAnim, {
      toValue: percent / 100,
      tension: 40,
      friction: 10,
      useNativeDriver: false,
    }).start();
  }, [scanProgress?.percentComplete]);

  const phaseLabel = getPhaseLabel(scanProgress);
  const percent = scanProgress?.percentComplete ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Pulsing scan icon */}
        <Animated.Text style={[styles.scanIcon, { transform: [{ scale: pulseAnim }] }]}>
          🔍
        </Animated.Text>

        <Text style={styles.title}>Scanning Your Feed</Text>
        <Text style={styles.phaseLabel}>{phaseLabel}</Text>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <Text style={styles.percentText}>{percent}%</Text>

        {/* Region counter */}
        {scanProgress && scanProgress.phase === 'classifying' && (
          <Text style={styles.regionCounter}>
            Region {scanProgress.currentRegion} of {scanProgress.totalRegions}
          </Text>
        )}

        {/* Privacy note */}
        <View style={styles.privacyCard}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            All analysis happens on your device. No images are uploaded.
          </Text>
        </View>

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelButton} onPress={resetScan}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function getPhaseLabel(progress: ReturnType<typeof useAuditStore.getState>['scanProgress']): string {
  if (!progress) return 'Preparing...';

  switch (progress.phase) {
    case 'initializing':
      return 'Loading AI model...';
    case 'segmenting':
      return `Preparing image ${progress.currentImage} of ${progress.totalImages}...`;
    case 'classifying':
      return `Scanning image ${progress.currentImage} of ${progress.totalImages}...`;
    case 'complete':
      return 'Analysis complete!';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scanIcon: {
    fontSize: 72,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  phaseLabel: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  percentText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#6366F1',
  },
  regionCounter: {
    fontSize: 13,
    color: '#64748B',
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    width: '100%',
  },
  privacyIcon: {
    fontSize: 20,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
  },
});
