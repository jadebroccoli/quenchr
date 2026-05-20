/**
 * Live scan real-time analyzer.
 *
 * Runs two things in parallel while the screen is recording:
 *
 * 1. BURST CYCLE (Android only):
 *    Every BURST_INTERVAL_MS, stops the current recording, extracts 5 frames,
 *    immediately restarts recording, then sends those frames to Haiku. Results
 *    accumulate in the audit store as `livePartialClassifications` + `liveScore`.
 *    Android MediaProjection doesn't re-prompt on restart — seamless for users.
 *    iOS ReplayKit would show the picker on restart, so we skip this on iOS.
 *
 * 2. NOTIFICATION OVERLAY (both platforms):
 *    A persistent local notification that sits over Instagram/TikTok the whole
 *    time, updating after each burst with the current live score. Users see it
 *    without having to switch back to Quenchr.
 *    Android: sticky (stays until dismissed or cleared). iOS: standard alert.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  stopScreenRecording,
  startScreenRecording,
  extractFrames,
  getRecordingDuration,
} from './screen-capture';
import { scanWithHaiku } from './haiku-scan';
import { useAuditStore } from '../stores/audit-store';
import type { HaikuFrameClassification } from './haiku-scan';
import {
  startOverlay,
  updateOverlay,
  stopOverlay,
} from 'live-overlay-module';

// ── Constants ──────────────────────────────────────────────────────────────────

/** How often to burst-analyze on Android (ms). 25 s = ~2 s gap each cycle, fine for sampling. */
const BURST_INTERVAL_MS = 25_000;
/** Frames to extract per burst — keep small so Haiku returns fast (~3s RTT). */
const BURST_FRAMES = 5;
/** Notification identifier — must be stable to replace rather than stack. */
const NOTIF_ID = 'quenchr-live-scan';

// ── Module-level state ────────────────────────────────────────────────────────

let _burstInterval: ReturnType<typeof setInterval> | null = null;
let _isBursting = false;
let _platform = 'instagram';
let _totalClassified: HaikuFrameClassification[] = [];
let _notifShowing = false;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Start the live analyzer.
 * Call this immediately after `startScreenRecording()` resolves.
 */
export async function startLiveAnalysis(platform: string): Promise<void> {
  _platform = platform;
  _totalClassified = [];
  _isBursting = false;

  useAuditStore.getState().resetLivePartial();

  // Show the initial "scanning" notification
  await _postNotification(null, 0);

  // Android: show the floating overlay pill immediately (pending state)
  if (Platform.OS === 'android') {
    startOverlay(-1, 0);
  }

  // Android only: kick off periodic burst cycle
  if (Platform.OS === 'android') {
    _burstInterval = setInterval(() => {
      if (!_isBursting) {
        _runBurst().catch((err) =>
          console.warn('[live-analyzer] burst error:', err),
        );
      }
    }, BURST_INTERVAL_MS);
  }
}

/**
 * Stop the live analyzer and clear the notification.
 * Call this before (or at the same time as) `stopScreenRecording()`.
 */
export async function stopLiveAnalysis(): Promise<void> {
  if (_burstInterval) {
    clearInterval(_burstInterval);
    _burstInterval = null;
  }
  _isBursting = false;

  await _clearNotification();
  if (Platform.OS === 'android') stopOverlay();
}

/**
 * Return all classifications accumulated during burst cycles.
 * These are merged into the final Haiku result for display.
 */
export function getLiveClassifications(): HaikuFrameClassification[] {
  return [..._totalClassified];
}

// ── Burst cycle ────────────────────────────────────────────────────────────────

async function _runBurst(): Promise<void> {
  _isBursting = true;
  const recordingDuration = getRecordingDuration();

  // Don't burst until there's at least 5 seconds of recording to work with
  if (recordingDuration < 5) {
    _isBursting = false;
    return;
  }

  let restartNeeded = false;
  try {
    // 1. Stop recording — saves the video to a temp file
    const videoPath = await stopScreenRecording();
    restartNeeded = true;

    // 2. Extract a handful of evenly-spaced frames
    const intervalMs = Math.max(1000, Math.floor((recordingDuration * 1000) / BURST_FRAMES));
    const frameUris = await extractFrames(videoPath, intervalMs, BURST_FRAMES);

    // 3. Restart recording immediately — the ~2s gap is undetectable in feed sampling
    await startScreenRecording();
    restartNeeded = false;

    if (frameUris.length === 0) return;

    // 4. Send to Haiku (async — doesn't block next burst)
    const result = await scanWithHaiku(frameUris, _platform as any);

    // 5. Merge results — shift frame indices so they don't collide with prior bursts
    const offset = _totalClassified.length;
    const shifted: HaikuFrameClassification[] = result.classifications.map((c) => ({
      ...c,
      frame_index: c.frame_index + offset,
    }));

    _totalClassified = [..._totalClassified, ...shifted];

    // 6. Update store (drives the live UI in LiveScanView)
    const store = useAuditStore.getState();
    store.addLiveClassifications(shifted);
    store.setLiveScore(result.overall_score);

    // 7. Update notification + floating overlay
    const flaggedCount = _totalClassified.filter(
      (c) => c.category === 'suggestive' || c.category === 'explicit',
    ).length;
    await _postNotification(result.overall_score, flaggedCount);
    updateOverlay(result.overall_score, flaggedCount);

  } catch (err) {
    console.warn('[live-analyzer] burst cycle failed:', err);
    // If we stopped recording but failed to restart, recover
    if (restartNeeded) {
      try {
        await startScreenRecording();
      } catch {
        console.warn('[live-analyzer] failed to restart recording after burst error');
      }
    }
  } finally {
    _isBursting = false;
  }
}

// ── Notification overlay ───────────────────────────────────────────────────────

async function _postNotification(score: number | null, flaggedCount: number): Promise<void> {
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;

    const title = score !== null
      ? `Quenchr: Score ${score} · ${flaggedCount} flagged`
      : 'Quenchr: Recording your feed...';

    const body = score !== null
      ? `${flaggedCount > 0 ? '⚠️ ' : '✅ '}Tap to see what\'s been flagged so far`
      : 'Come back to Quenchr when you\'re done scrolling';

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID,
      content: {
        title,
        body,
        data: { type: 'live-scan' },
        // Android: keep notification sticky so it persists over other apps
        ...(Platform.OS === 'android' && {
          sticky: true,
          priority: Notifications.AndroidNotificationPriority.LOW,
        }),
      },
      trigger: null, // fire immediately
    });

    _notifShowing = true;
  } catch (err) {
    // Notifications unavailable or permission denied — not fatal
    console.warn('[live-analyzer] notification failed:', err);
  }
}

async function _clearNotification(): Promise<void> {
  if (!_notifShowing) return;
  try {
    await Notifications.dismissNotificationAsync(NOTIF_ID);
    _notifShowing = false;
  } catch {}
}
