import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { PLATFORMS, NSFW_THRESHOLDS, calculateFeedScore } from '@quenchr/shared';
import type { Platform, FeedAudit, ClassificationResult, AuditImageResult, AIInsightsResult, AIInsightsStatus } from '@quenchr/shared';
import { createFeedAudit } from '@quenchr/supabase-client';
import { useAuditStore } from '../../src/stores/audit-store';
import { useAuthStore } from '../../src/stores/auth-store';
import { useSubscriptionStore } from '../../src/stores/subscription-store';
import { initializeModel, isModelLoaded, scanImages } from '../../src/services/nsfw-classifier';
import { selectFlaggedFrames, analyzeWithAI } from '../../src/services/ai-insights';
import { ScanningProgressView } from '../../src/components/ScanningProgressView';
import { AuditResultsView } from '../../src/components/AuditResultsView';
import { LiveScanView } from '../../src/components/LiveScanView';

const PLATFORM_OPTIONS: { key: Platform; emoji: string }[] = [
  { key: 'instagram', emoji: '📸' },
  { key: 'tiktok', emoji: '🎵' },
];

// ── Shared Helper ──
// Used by both screenshot and live scan modes after classification completes.

async function processClassificationResults(
  imageResults: AuditImageResult[],
  allClassifications: ClassificationResult[],
  selectedPlatform: Platform,
  frameUris: string[],
  callbacks: {
    setImageResults: (results: AuditImageResult[]) => void;
    addAudit: (audit: FeedAudit) => void;
    setScreenState: (state: 'input' | 'scanning' | 'results') => void;
    setAIInsightsStatus: (status: AIInsightsStatus) => void;
    setAIInsightsResult: (result: AIInsightsResult | null) => void;
    setAIInsightsError: (error: string | null) => void;
  }
) {
  const { setImageResults, addAudit, setScreenState } = callbacks;

  // Calculate score using shared scoring function
  const feedScore = calculateFeedScore(allClassifications);

  // Count categories for the FeedAudit record
  const nsfwCount = allClassifications.filter(
    (c) =>
      ['porn', 'hentai'].includes(c.category) &&
      c.confidence >= NSFW_THRESHOLDS.suggestive
  ).length;
  const sexyCount = allClassifications.filter(
    (c) => c.category === 'sexy' && c.confidence >= NSFW_THRESHOLDS.suggestive
  ).length;
  const neutralCount = allClassifications.length - nsfwCount - sexyCount;

  // Store image-level results in store
  setImageResults(imageResults);

  // Persist to Supabase
  let auditId: string | undefined;
  const userId = useAuthStore.getState().user?.id;
  if (userId) {
    const { data } = await createFeedAudit({
      user_id: userId,
      platform: selectedPlatform,
      total_scanned: allClassifications.length,
      nsfw_detected: nsfwCount,
      sexy_detected: sexyCount,
      neutral_detected: neutralCount,
      feed_score: feedScore,
    });

    if (data) {
      addAudit(data as FeedAudit);
      auditId = (data as FeedAudit).id;
    }
  } else {
    // No auth — create a local-only audit for display
    const localAudit: FeedAudit = {
      id: Date.now().toString(),
      user_id: '',
      platform: selectedPlatform,
      total_scanned: allClassifications.length,
      nsfw_detected: nsfwCount,
      sexy_detected: sexyCount,
      neutral_detected: neutralCount,
      feed_score: feedScore,
      created_at: new Date().toISOString(),
    };
    addAudit(localAudit);
    auditId = localAudit.id;
  }

  // Show results immediately
  setScreenState('results');

  // Phase 2C: Kick off AI analysis for Pro users (fire-and-forget)
  const isPro = useSubscriptionStore.getState().isPro();
  if (isPro) {
    const flaggedFrames = selectFlaggedFrames(imageResults);
    if (flaggedFrames.length > 0) {
      callbacks.setAIInsightsStatus('loading');

      analyzeWithAI(flaggedFrames, frameUris, selectedPlatform, feedScore, auditId)
        .then((result) => callbacks.setAIInsightsResult(result))
        .catch((err) => {
          console.warn('[audit] AI analysis failed:', err);
          callbacks.setAIInsightsError(
            err instanceof Error ? err.message : 'AI analysis failed'
          );
        });
    }
  }
}

export default function AuditScreen() {
  const router = useRouter();
  const {
    selectedPlatform,
    setSelectedPlatform,
    scanning,
    screenState,
    setScreenState,
    setScanning,
    setScanProgress,
    setImageResults,
    setModelReady,
    setScanError,
    addAudit,
    resetScan,
    auditMode,
    setAuditMode,
    setAIInsightsStatus,
    setAIInsightsResult,
    setAIInsightsError,
  } = useAuditStore();

  const [screenshots, setScreenshots] = useState<string[]>([]);

  // Pre-load model on mount
  useEffect(() => {
    if (!isModelLoaded()) {
      initializeModel()
        .then(() => setModelReady(true))
        .catch(() => {
          // Silent fail — will retry when user presses scan
        });
    }
  }, []);

  async function pickImages() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });

    if (!result.canceled) {
      setScreenshots(result.assets.map((a) => a.uri));
    }
  }

  async function runAudit() {
    if (screenshots.length === 0) {
      Alert.alert('No screenshots', 'Take some screenshots of your feed first, then select them here.');
      return;
    }

    setScreenState('scanning');
    setScanning(true);
    setScanError(null);

    try {
      // Ensure model is ready
      if (!isModelLoaded()) {
        setScanProgress({
          phase: 'initializing',
          currentImage: 0,
          totalImages: screenshots.length,
          currentRegion: 0,
          totalRegions: screenshots.length * NSFW_THRESHOLDS.gridColumns * NSFW_THRESHOLDS.gridRows,
          percentComplete: 0,
        });
        await initializeModel();
        setModelReady(true);
      }

      // Run classification pipeline
      const { imageResults, allClassifications } = await scanImages(
        screenshots,
        (progress) => setScanProgress(progress)
      );

      // Use shared helper for score + persistence + AI analysis trigger
      await processClassificationResults(imageResults, allClassifications, selectedPlatform, screenshots, {
        setImageResults,
        addAudit,
        setScreenState,
        setAIInsightsStatus,
        setAIInsightsResult,
        setAIInsightsError,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan failed';
      setScanError(message);
      setScreenState('input');
      Alert.alert('Scan Failed', `Something went wrong: ${message}\n\nPlease try again.`);
    } finally {
      setScanning(false);
    }
  }

  // ── Live Scan: handle frames from LiveScanView ──

  async function handleFramesExtracted(frameUris: string[]) {
    setScreenState('scanning');
    setScanning(true);
    setScanError(null);

    try {
      // Ensure model is ready
      if (!isModelLoaded()) {
        setScanProgress({
          phase: 'initializing',
          currentImage: 0,
          totalImages: frameUris.length,
          currentRegion: 0,
          totalRegions: frameUris.length * NSFW_THRESHOLDS.gridColumns * NSFW_THRESHOLDS.gridRows,
          percentComplete: 0,
        });
        await initializeModel();
        setModelReady(true);
      }

      // Run same classification pipeline on extracted frames
      const { imageResults, allClassifications } = await scanImages(
        frameUris,
        (progress) => setScanProgress(progress)
      );

      // Use shared helper for score + persistence + AI analysis trigger
      await processClassificationResults(imageResults, allClassifications, selectedPlatform, frameUris, {
        setImageResults,
        addAudit,
        setScreenState,
        setAIInsightsStatus,
        setAIInsightsResult,
        setAIInsightsError,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan failed';
      setScanError(message);
      setScreenState('input');
      Alert.alert('Scan Failed', `Something went wrong: ${message}\n\nPlease try again.`);
    } finally {
      setScanning(false);
    }
  }

  function handleNewAudit() {
    resetScan();
    setScreenshots([]);
  }

  function handleStartCleanup() {
    resetScan();
    router.push('/(tabs)/cleanup');
  }

  // ── 3-State Routing ──

  if (screenState === 'scanning') {
    return <ScanningProgressView />;
  }

  if (screenState === 'results') {
    return <AuditResultsView onNewAudit={handleNewAudit} onStartCleanup={handleStartCleanup} />;
  }

  // ── Input State ──

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Feed Audit</Text>
        <Text style={styles.subtitle}>
          Screenshot your Explore/FYP and we'll score how clean your algorithm is.
        </Text>

        {/* Platform Picker */}
        <View style={styles.platformRow}>
          {PLATFORM_OPTIONS.map(({ key, emoji }) => (
            <TouchableOpacity
              key={key}
              style={[styles.platformChip, selectedPlatform === key && styles.platformChipActive]}
              onPress={() => setSelectedPlatform(key)}
            >
              <Text style={styles.platformEmoji}>{emoji}</Text>
              <Text style={[styles.platformLabel, selectedPlatform === key && styles.platformLabelActive]}>
                {PLATFORMS[key].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeChip, auditMode === 'screenshots' && styles.modeChipActive]}
            onPress={() => setAuditMode('screenshots')}
          >
            <Text style={styles.modeEmoji}>📱</Text>
            <Text style={[styles.modeLabel, auditMode === 'screenshots' && styles.modeLabelActive]}>
              Screenshots
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeChip, auditMode === 'livescan' && styles.modeChipActive]}
            onPress={() => setAuditMode('livescan')}
          >
            <Text style={styles.modeEmoji}>🔴</Text>
            <Text style={[styles.modeLabel, auditMode === 'livescan' && styles.modeLabelActive]}>
              Live Scan
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conditional Mode Content */}
        {auditMode === 'screenshots' ? (
          <>
            {/* Instructions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>How it works</Text>
              <View style={styles.stepList}>
                <Text style={styles.step}>1. Open {PLATFORMS[selectedPlatform].label}</Text>
                <Text style={styles.step}>
                  2. Go to your {selectedPlatform === 'instagram' ? 'Explore page' : 'For You Page'}
                </Text>
                <Text style={styles.step}>3. Take 3-5 screenshots as you scroll</Text>
                <Text style={styles.step}>4. Come back here and select them</Text>
              </View>
            </View>

            {/* Screenshot Picker */}
            <TouchableOpacity style={styles.pickerButton} onPress={pickImages}>
              <Text style={styles.pickerEmoji}>📱</Text>
              <Text style={styles.pickerText}>
                {screenshots.length > 0
                  ? `${screenshots.length} screenshot${screenshots.length > 1 ? 's' : ''} selected`
                  : 'Select Screenshots'}
              </Text>
            </TouchableOpacity>

            {/* Preview */}
            {screenshots.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
                {screenshots.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.previewImage} />
                ))}
              </ScrollView>
            )}

            {/* Scan Button */}
            <TouchableOpacity
              style={[styles.scanButton, (scanning || screenshots.length === 0) && styles.scanButtonDisabled]}
              onPress={runAudit}
              disabled={scanning || screenshots.length === 0}
            >
              <Text style={styles.scanButtonText}>
                {scanning ? 'Scanning...' : 'Scan My Feed'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <LiveScanView
            platform={selectedPlatform}
            onFramesExtracted={handleFramesExtracted}
            onCancel={() => setAuditMode('screenshots')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
  },
  platformRow: {
    flexDirection: 'row',
    gap: 12,
  },
  platformChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  platformChipActive: {
    borderColor: '#6366F1',
    backgroundColor: '#1E1B4B',
  },
  platformEmoji: {
    fontSize: 20,
  },
  platformLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  platformLabelActive: {
    color: '#F8FAFC',
  },

  // Mode toggle
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeChipActive: {
    borderColor: '#6366F1',
    backgroundColor: '#1E1B4B',
  },
  modeEmoji: {
    fontSize: 16,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  modeLabelActive: {
    color: '#F8FAFC',
  },

  // Instructions card
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  stepList: {
    gap: 8,
  },
  step: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 22,
  },

  // Screenshot picker
  pickerButton: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  pickerEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  pickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  previewRow: {
    flexDirection: 'row',
  },
  previewImage: {
    width: 100,
    height: 180,
    borderRadius: 8,
    marginRight: 8,
  },
  scanButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  scanButtonDisabled: {
    opacity: 0.4,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
