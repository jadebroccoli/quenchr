import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, Platform as RNPlatform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { PLATFORMS, NSFW_THRESHOLDS, calculateFeedScore } from '@quenchr/shared';
import type { Platform, FeedAudit, ClassificationResult, AuditImageResult, AIInsightsResult, AIInsightsStatus } from '@quenchr/shared';
import { createFeedAudit, updateFeedAudit } from '@quenchr/supabase-client';
import { useAuditStore } from '../../src/stores/audit-store';
import { useAuthStore } from '../../src/stores/auth-store';
import { useSubscriptionStore } from '../../src/stores/subscription-store';
import { initializeModel, isModelLoaded, scanImages } from '../../src/services/nsfw-classifier';
import { selectFlaggedFrames, analyzeWithAI } from '../../src/services/ai-insights';
import { scanWithHaiku } from '../../src/services/haiku-scan';
import type { HaikuScanResult } from '../../src/services/haiku-scan';
import { ScanningProgressView } from '../../src/components/ScanningProgressView';
import { AuditResultsView } from '../../src/components/AuditResultsView';
import { LiveScanView } from '../../src/components/LiveScanView';
import { colors, type as typ, spacing, radius } from '../../src/tokens';
import {
  PageHeader,
  SectionDivider,
  CardLight,
  CardDark,
  PillGroup,
  PrimaryButton,
  Dropzone,
} from '../../src/components/ui';

// ── Shared Helper ──

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
    setHaikuScanStatus: (status: 'idle' | 'scanning' | 'done' | 'error') => void;
    setCurrentAudit: (audit: FeedAudit | null) => void;
  }
) {
  const { setImageResults, addAudit, setScreenState } = callbacks;

  const feedScore = calculateFeedScore(allClassifications);

  const nsfwCount = allClassifications.filter(
    (c) => ['porn', 'hentai'].includes(c.category) && c.confidence >= NSFW_THRESHOLDS.suggestive
  ).length;
  const sexyCount = allClassifications.filter(
    (c) => c.category === 'sexy' && c.confidence >= NSFW_THRESHOLDS.suggestive
  ).length;
  const neutralCount = allClassifications.length - nsfwCount - sexyCount;

  setImageResults(imageResults);

  const isPro = useSubscriptionStore.getState().isPro();

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
      scan_type: 'nsfwjs',
    });
    if (data) {
      addAudit(data as FeedAudit);
      auditId = (data as FeedAudit).id;
    }
  } else {
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

  setScreenState('results');

  // Run Haiku AI scan for Pro users — refines the NSFWJS score
  if (isPro) {
    callbacks.setHaikuScanStatus('scanning');

    scanWithHaiku(frameUris, selectedPlatform)
      .then(async (haikuResult: HaikuScanResult) => {
        // Override the feed score with Haiku's more accurate score
        const haikuScore = haikuResult.overall_score;

        // Update the audit record in Supabase
        if (auditId && userId) {
          const { data: updatedAudit } = await updateFeedAudit(auditId, {
            feed_score: haikuScore,
            scan_type: 'haiku',
          });
          if (updatedAudit) {
            callbacks.setCurrentAudit(updatedAudit as FeedAudit);
          }
        } else {
          // Local-only: update the current audit directly
          const currentAudit = useAuditStore.getState().currentAudit;
          if (currentAudit) {
            callbacks.setCurrentAudit({
              ...currentAudit,
              feed_score: haikuScore,
              scan_type: 'haiku',
            } as FeedAudit);
          }
        }

        callbacks.setHaikuScanStatus('done');

        // Also run AI insights on flagged frames
        const flaggedFrames = selectFlaggedFrames(imageResults);
        if (flaggedFrames.length > 0) {
          callbacks.setAIInsightsStatus('loading');
          analyzeWithAI(flaggedFrames, frameUris, selectedPlatform, haikuScore, auditId)
            .then((result) => callbacks.setAIInsightsResult(result))
            .catch((err) => {
              console.warn('[audit] AI analysis failed:', err);
              callbacks.setAIInsightsError(err instanceof Error ? err.message : 'AI analysis failed');
            });
        }
      })
      .catch((err) => {
        console.warn('[audit] Haiku scan failed, falling back to NSFWJS results:', err);
        callbacks.setHaikuScanStatus('error');

        // Fall back: still run AI insights with NSFWJS score
        const flaggedFrames = selectFlaggedFrames(imageResults);
        if (flaggedFrames.length > 0) {
          callbacks.setAIInsightsStatus('loading');
          analyzeWithAI(flaggedFrames, frameUris, selectedPlatform, feedScore, auditId)
            .then((result) => callbacks.setAIInsightsResult(result))
            .catch((aiErr) => {
              console.warn('[audit] AI analysis failed:', aiErr);
              callbacks.setAIInsightsError(aiErr instanceof Error ? aiErr.message : 'AI analysis failed');
            });
        }
      });
  }
}

export default function AuditScreen() {
  const router = useRouter();
  const {
    selectedPlatform, setSelectedPlatform,
    scanning, screenState, setScreenState,
    setScanning, setScanProgress, setImageResults,
    setModelReady, setScanError, addAudit, resetScan,
    auditMode, setAuditMode,
    setAIInsightsStatus, setAIInsightsResult, setAIInsightsError,
    setHaikuScanStatus, setCurrentAudit,
    currentAudit, fetchLatestAudit,
  } = useAuditStore();

  const user = useAuthStore((s) => s.user);
  const [screenshots, setScreenshots] = useState<string[]>([]);

  // Load the latest audit from DB so results survive navigation
  useEffect(() => {
    if (user?.id && !currentAudit) {
      fetchLatestAudit(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      if (RNPlatform.OS !== 'web') {
        const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!isModelLoaded()) {
      initializeModel()
        .then(() => setModelReady(true))
        .catch(() => {});
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
      if (!isModelLoaded()) {
        setScanProgress({
          phase: 'initializing', currentImage: 0, totalImages: screenshots.length,
          currentRegion: 0, totalRegions: screenshots.length * NSFW_THRESHOLDS.gridColumns * NSFW_THRESHOLDS.gridRows,
          percentComplete: 0,
        });
        await initializeModel();
        setModelReady(true);
      }
      const { imageResults, allClassifications } = await scanImages(screenshots, (p) => setScanProgress(p));
      await processClassificationResults(imageResults, allClassifications, selectedPlatform, screenshots, {
        setImageResults, addAudit, setScreenState, setAIInsightsStatus, setAIInsightsResult, setAIInsightsError,
        setHaikuScanStatus, setCurrentAudit,
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

  async function handleFramesExtracted(frameUris: string[]) {
    setScreenState('scanning');
    setScanning(true);
    setScanError(null);
    try {
      if (!isModelLoaded()) {
        setScanProgress({
          phase: 'initializing', currentImage: 0, totalImages: frameUris.length,
          currentRegion: 0, totalRegions: frameUris.length * NSFW_THRESHOLDS.gridColumns * NSFW_THRESHOLDS.gridRows,
          percentComplete: 0,
        });
        await initializeModel();
        setModelReady(true);
      }
      const { imageResults, allClassifications } = await scanImages(frameUris, (p) => setScanProgress(p));
      await processClassificationResults(imageResults, allClassifications, selectedPlatform, frameUris, {
        setImageResults, addAudit, setScreenState, setAIInsightsStatus, setAIInsightsResult, setAIInsightsError,
        setHaikuScanStatus, setCurrentAudit,
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

  function handleNewAudit() { resetScan(); setScreenshots([]); }
  function handleStartCleanup() { resetScan(); router.push('/(tabs)/cleanup'); }

  if (screenState === 'scanning') return <ScanningProgressView />;
  if (screenState === 'results') return <AuditResultsView onNewAudit={handleNewAudit} onStartCleanup={handleStartCleanup} />;

  const pageName = selectedPlatform === 'instagram' ? 'Explore page' : 'For You Page';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="Forensics"
          title="Feed Audit."
          subtitle="Screenshot your Explore or FYP. We'll do the rest."
        />
        <SectionDivider />

        <View style={styles.body}>
          {/* Platform pills */}
          <PillGroup
            options={[
              { value: 'instagram' as Platform, label: 'Instagram' },
              { value: 'tiktok' as Platform, label: 'TikTok' },
            ]}
            selected={selectedPlatform}
            onSelect={(platform) => {
              // Gate 2nd platform behind Pro
              const isPro = useSubscriptionStore.getState().isPro();
              if (platform !== selectedPlatform && !isPro) {
                // Allow the first platform they pick, gate subsequent switches
                const audits = useAuditStore.getState().audits;
                if (audits.length > 0) {
                  router.push('/paywall');
                  return;
                }
              }
              setSelectedPlatform(platform);
            }}
          />

          {/* Mode pills */}
          <PillGroup
            options={[
              { value: 'screenshots' as const, label: 'Screenshots' },
              { value: 'livescan' as const, label: 'Live Scan' },
            ]}
            selected={auditMode}
            onSelect={setAuditMode}
          />

          {auditMode === 'livescan' ? (
            <LiveScanView
              platform={selectedPlatform}
              onFramesExtracted={handleFramesExtracted}
              onCancel={() => setAuditMode('screenshots')}
            />
          ) : (
            <>
              {/* How it works */}
              <CardLight>
                <Text style={styles.cardTitle}>How it works</Text>
                <View style={styles.stepList}>
                  <Text style={styles.step}>1. Open {PLATFORMS[selectedPlatform].label}</Text>
                  <Text style={styles.step}>2. Scroll naturally. We'll pretend to believe you.</Text>
                  <Text style={styles.step}>3. Take 3-5 screenshots as you scroll</Text>
                  <Text style={styles.step}>4. Come back here and select them</Text>
                </View>
              </CardLight>

              {/* Dropzone / preview */}
              <Dropzone
                title={screenshots.length > 0
                  ? `${screenshots.length} screenshot${screenshots.length > 1 ? 's' : ''} selected`
                  : 'Select Screenshots'}
                subtitle="Tap to pick from your gallery"
                onPress={pickImages}
              />

              {screenshots.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
                  {screenshots.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.previewImage} />
                  ))}
                </ScrollView>
              )}

              <PrimaryButton
                label={scanning ? 'Scanning...' : 'Scan My Feed'}
                onPress={runAudit}
                disabled={scanning || screenshots.length === 0}
                loading={scanning}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { paddingBottom: 100 },
  body: { paddingHorizontal: spacing.pagePad, gap: 12 },
  cardTitle: {
    ...typ.btnSm,
    color: colors.ink,
    marginBottom: 10,
  },
  stepList: { gap: 6 },
  step: { ...typ.body, color: colors.ink2 },
  previewRow: { flexDirection: 'row' },
  previewImage: { width: 90, height: 160, borderRadius: radius.pill, marginRight: 8 },
});
