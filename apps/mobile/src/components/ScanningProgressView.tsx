import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuditStore } from '../stores/audit-store';
import { colors, type as typ, radius, spacing } from '../tokens';

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
    backgroundColor: colors.cream,
  },
  content: {
    flex: 1,
    padding: spacing.pagePad,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sectionGap,
  },
  scanIcon: {
    fontSize: 72,
    marginBottom: 8,
  },
  title: {
    ...typ.h2,
    color: colors.ink,
    textAlign: 'center',
  },
  phaseLabel: {
    ...typ.body,
    color: colors.ink3,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: colors.cream3,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brown,
    borderRadius: 4,
  },
  percentText: {
    ...typ.bigNum,
    fontSize: 40,
    lineHeight: 40,
    color: colors.brown,
  },
  regionCounter: {
    ...typ.body,
    color: colors.ink4,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cream2,
    borderRadius: radius.stat,
    padding: 14,
    marginTop: 24,
    width: '100%',
  },
  privacyIcon: {
    fontSize: 20,
  },
  privacyText: {
    flex: 1,
    ...typ.body,
    color: colors.ink3,
    lineHeight: 18,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: {
    ...typ.btn,
    color: colors.ink4,
  },
});
