import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, Platform as RNPlatform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { PLATFORMS } from '@quenchr/shared';
import type { Platform, FeedAudit, AIInsightsResult, AIInsightsStatus } from '@quenchr/shared';
import { createFeedAudit, updateFeedAudit } from '@quenchr/supabase-client';
import { useAuditStore } from '../../src/stores/audit-store';
import { useAuthStore } from '../../src/stores/auth-store';
import { useSubscriptionStore } from '../../src/stores/subscription-store';
import { analyzeWithAI, type FlaggedFrame } from '../../src/services/ai-insights';
import { scanWithHaiku } from '../../src/services/haiku-scan';
import type { HaikuScanResult, HaikuFrameClassification } from '../../src/services/haiku-scan';
import { ScanningProgressView } from '../../src/components/ScanningProgressView';
import { AuditResultsView } from '../../src/components/AuditResultsView';
import { LiveScanView } from '../../src/components/LiveScanView';
import { ScanHistoryList } from '../../src/components/ScanHistoryList';
import { PanicOverlay } from '../../src/components/PanicOverlay';
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

// ── Shared Helper: Haiku-only scan pipeline ──

async function runHaikuScan(
  frameUris: string[],
  selectedPlatform: Platform,
  callbacks: {
    addAudit: (audit: FeedAudit) => void;
    setScreenState: (state: 'input' | 'scanning' | 'results') => void;
    setScanProgress: (progress: { phase: 'uploading' | 'analyzing' | 'complete'; percentComplete: number } | null) => void;
    setAIInsightsStatus: (status: AIInsightsStatus) => void;
    setAIInsightsResult: (result: AIInsightsResult | null) => void;
    setAIInsightsError: (error: string | null) => void;
    setHaikuScanStatus: (status: 'idle' | 'scanning' | 'done' | 'error') => void;
    setCurrentAudit: (audit: FeedAudit | null) => void;
  }
) {
  // Phase 1: Uploading frames to Haiku
  callbacks.setScanProgress({ phase: 'uploading', percentComplete: 10 });
  callbacks.setHaikuScanStatus('scanning');

  // Phase 2: Haiku analysis
  callbacks.setScanProgress({ phase: 'analyzing', percentComplete: 30 });

  const haikuResult = await scanWithHaiku(frameUris, selectedPlatform);

  if (haikuResult.total_frames === 0) {
    throw new Error('AI scan returned no results. Please try again.');
  }

  callbacks.setScanProgress({ phase: 'analyzing', percentComplete: 80 });

  // Use overall_score (average suggestive intensity 0-100 across all frames).
  // suggestive_percent was just a binary frame count that stayed ~18% due to
  // duplicate/transition frames diluting the ratio.
  const haikuScore = haikuResult.overall_score;
  const haikuCounts = haikuResult.category_counts;
  const totalFrames = haikuResult.total_frames;

  // Persist to DB
  let auditId: string | undefined;
  const userId = useAuthStore.getState().user?.id;

  if (userId) {
    const { data, error: insertError } = await createFeedAudit({
      user_id: userId,
      platform: selectedPlatform,
      total_scanned: totalFrames,
      nsfw_detected: haikuCounts.explicit,
      sexy_detected: haikuCounts.suggestive,
      neutral_detected: haikuCounts.clean + haikuCounts.mild,
      feed_score: haikuScore,
      scan_type: 'haiku',
    });
    if (insertError) {
      // Surface insert failures instead of swallowing them. Previously a
      // missing DB column caused every INSERT to return { data: null }
      // silently, which made the UI render zero-fallback stats cards
      // while AI Insights still populated from a different store slice
      // — a ghost-success state that was hell to diagnose.
      console.error('[audit] createFeedAudit failed:', insertError);
    }
    if (data) {
      callbacks.addAudit(data as FeedAudit);
      auditId = (data as FeedAudit).id;
    }
  } else {
    const localAudit: FeedAudit = {
      id: Date.now().toString(),
      user_id: '',
      platform: selectedPlatform,
      total_scanned: totalFrames,
      nsfw_detected: haikuCounts.explicit,
      sexy_detected: haikuCounts.suggestive,
      neutral_detected: haikuCounts.clean + haikuCounts.mild,
      feed_score: haikuScore,
      scan_type: 'haiku',
      created_at: new Date().toISOString(),
    };
    callbacks.addAudit(localAudit);
    auditId = localAudit.id;
  }

  callbacks.setScanProgress({ phase: 'complete', percentComplete: 100 });
  callbacks.setHaikuScanStatus('done');
  callbacks.setScreenState('results');

  // Trigger AI Insights on flagged frames (async, non-blocking)
  const flaggedClassifications = haikuResult.classifications.filter(
    (c: HaikuFrameClassification) =>
      c.category === 'suggestive' || c.category === 'explicit' || c.suggestive_score > 0.3
  );

  if (flaggedClassifications.length > 0) {
    callbacks.setAIInsightsStatus('loading');

    const flaggedFrames: FlaggedFrame[] = flaggedClassifications.slice(0, 5).map((f) => ({
      image_index: f.frame_index,
      suggestive_percentage: f.suggestive_score * 100,
    }));

    analyzeWithAI(flaggedFrames, frameUris, selectedPlatform, haikuScore, auditId, true)
      .then(async (result) => {
        callbacks.setAIInsightsResult(result);

        // Recompute the feed score DETERMINISTICALLY after AI has flagged
        // false positives. We ignore AI's own adjusted_feed_score — the
        // model's self-scoring was inconsistent (42 for a clearly heavy feed).
        // Instead, strip the frames the AI marked as false positives from
        // the original classifications and re-run the exact formula the
        // edge function uses. Same math on both sides of the AI pass.
        const falsePositiveIndices = new Set(
          (result.frame_insights ?? [])
            .filter((fi) => fi.is_false_positive)
            .map((fi) => fi.frame_index)
        );
        const filtered = haikuResult.classifications.filter(
          (c) => !falsePositiveIndices.has(c.frame_index)
        );
        const recomputed = computeHaikuScore(filtered);

        if (auditId) {
          try {
            // Update DB but do NOT rely on its return payload — Supabase's
            // update().select().single() has been inconsistent for us (it
            // came back with total_scanned=0 which nuked the stats cards).
            // Instead we merge locally using the state we already know.
            await updateFeedAudit(auditId, { feed_score: recomputed });
            const current = useAuditStore.getState().currentAudit;
            if (current && current.id === auditId) {
              callbacks.setCurrentAudit({ ...current, feed_score: recomputed });
            }
          } catch (err) {
            console.warn('[audit] failed to persist recomputed score:', err);
          }
        }
      })
      .catch((err) => {
        console.warn('[audit] AI analysis failed:', err);
        callbacks.setAIInsightsError(err instanceof Error ? err.message : 'AI analysis failed');
      });
  }
}

/**
 * Deterministic feed-score recalculator — MUST stay in lockstep with the
 * formula in supabase/functions/haiku-scan/index.ts. Used to rescore after
 * the AI insights pass strips false-positive frames.
 *
 * Weighting:
 *   hardPrev (1.2x)   — % of frames that are suggestive+explicit
 *   hardIntensity (0.5x) — avg score of hard flags (36/66 floors apply)
 *   softPrev (0.3x)   — % of frames that are mild
 *   presenceBonus (+15) — any hard flag at all adds 15 baseline points
 */
function computeHaikuScore(classifications: HaikuFrameClassification[]): number {
  const total = classifications.length;
  if (total === 0) return 0;
  const hard = classifications.filter(
    (c) => c.category === 'suggestive' || c.category === 'explicit'
  );
  const soft = classifications.filter((c) => c.category === 'mild');
  const hardPrev = (hard.length / total) * 100;
  const softPrev = (soft.length / total) * 100;
  const hardIntensity =
    hard.length > 0
      ? hard.reduce((sum, c) => sum + c.suggestive_score, 0) / hard.length
      : 0;
  const presenceBonus = hard.length > 0 ? 15 : 0;
  return Math.min(
    100,
    Math.max(
      0,
      Math.round(hardPrev * 1.2 + hardIntensity * 0.5 + softPrev * 0.3 + presenceBonus)
    )
  );
}

export default function AuditScreen() {
  const router = useRouter();
  const {
    selectedPlatform, setSelectedPlatform,
    scanning, screenState, setScreenState,
    setScanning, setScanProgress, setScanError,
    addAudit, resetScan,
    auditMode, setAuditMode,
    setAIInsightsStatus, setAIInsightsResult, setAIInsightsError,
    setHaikuScanStatus, setCurrentAudit,
    currentAudit, fetchLatestAudit,
    auditHistory, fetchAuditHistory, viewAudit,
  } = useAuditStore();

  const user = useAuthStore((s) => s.user);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [panicVisible, setPanicVisible] = useState(false);

  // Load the latest audit from DB so results survive navigation
  useEffect(() => {
    if (user?.id) {
      if (!currentAudit) fetchLatestAudit(user.id);
      fetchAuditHistory(user.id);
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
    await startScan(screenshots);
  }

  async function handleFramesExtracted(frameUris: string[]) {
    await startScan(frameUris);
  }

  async function startScan(frameUris: string[]) {
    setScreenState('scanning');
    setScanning(true);
    setScanError(null);
    try {
      await runHaikuScan(frameUris, selectedPlatform, {
        addAudit, setScreenState, setScanProgress,
        setAIInsightsStatus, setAIInsightsResult, setAIInsightsError,
        setHaikuScanStatus, setCurrentAudit,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan failed';
      setScanError(message);
      setScreenState('input');
      // Quota / subscription errors → paywall instead of generic alert
      const isQuotaError = message.toLowerCase().includes('free tier') ||
        message.toLowerCase().includes('upgrade to pro') ||
        message.toLowerCase().includes('1 ai-powered scan');
      if (isQuotaError) {
        router.push('/paywall');
      } else {
        Alert.alert('Scan Failed', `Something went wrong: ${message}\n\nPlease try again.`);
      }
    } finally {
      setScanning(false);
    }
  }

  function handleNewAudit() { resetScan(); setScreenshots([]); }
  function handleStartCleanup() { router.push('/(tabs)/cleanup'); }

  if (screenState === 'scanning') return <ScanningProgressView />;
  if (screenState === 'results') return <AuditResultsView onNewAudit={handleNewAudit} onStartCleanup={handleStartCleanup} />;

  const pageName = selectedPlatform === 'instagram' ? 'Explore page' : 'For You Page';

  return (
    <View style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['top']}>
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
              const isPro = useSubscriptionStore.getState().proAccess;
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

          {/* Scan history */}
          {auditHistory.length > 0 && (
            <ScanHistoryList audits={auditHistory} onSelect={viewAudit} />
          )}
        </View>
      </ScrollView>
      </SafeAreaView>

      {/* Panic FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setPanicVisible(true)} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>🛑</Text>
      </TouchableOpacity>

      <PanicOverlay visible={panicVisible} onDismiss={() => setPanicVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  safeInner: { flex: 1 },
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
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 22,
  },
});
