/**
 * Screen capture service — powered by react-native-nitro-screen-recorder.
 *
 * Uses Global Recording (MediaProjection on Android, ReplayKit on iOS)
 * to record the screen while the user scrolls their social media feed,
 * then extracts frames via expo-video-thumbnails for NSFW classification.
 */

import {
  startGlobalRecording,
  stopGlobalRecording,
  retrieveLastGlobalRecording,
  clearCache,
} from 'react-native-nitro-screen-recorder';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';

// ── Types ──

export type RecordingStatus = 'idle' | 'requesting_permission' | 'recording' | 'stopping' | 'extracting';

export interface FrameExtractionProgress {
  currentFrame: number;
  totalFrames: number;
  percentComplete: number;
}

// ── Internal State ──

let _status: RecordingStatus = 'idle';
let _recordingStartTime: number | null = null;
let _lastVideoPath: string | null = null;
let _recordingError: string | null = null;

// ── Helpers ──

/**
 * Ensure a path is a proper file:// URI.
 * Nitro screen recorder returns absolute paths on Android (e.g. /data/data/…/recording.mp4)
 * but expo-video-thumbnails expects a file:// URI on some devices.
 */
function ensureFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  if (path.startsWith('/')) return `file://${path}`;
  return path;
}

/**
 * Wrap a promise with a timeout. Rejects with TimeoutError if the promise
 * doesn't resolve within `ms` milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${label} took longer than ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ── Public API ──

export function getStatus(): RecordingStatus {
  return _status;
}

/**
 * Screen recording permission is handled by the OS when recording starts:
 * - Android: MediaProjection shows its own system permission dialog
 * - iOS: ReplayKit shows the broadcast picker
 *
 * We always return true here — the actual permission prompt happens inside
 * startScreenRecording(). If the user denies, startScreenRecording will throw.
 */
export async function requestRecordingPermission(): Promise<boolean> {
  return true;
}

/**
 * Start global screen recording (records all apps, not just ours).
 * On Android this triggers the MediaProjection permission dialog.
 * On iOS this shows the ReplayKit broadcast picker.
 */
export async function startScreenRecording(): Promise<void> {
  if (_status === 'recording') {
    throw new Error('Already recording');
  }

  _status = 'requesting_permission';
  _recordingError = null;

  try {
    startGlobalRecording({
      options: { enableMic: false },
      onRecordingError: (error) => {
        console.error('[screen-capture] Recording error:', error.message);
        _recordingError = error.message;
        _status = 'idle';
        _recordingStartTime = null;
      },
    });

    _status = 'recording';
    _recordingStartTime = Date.now();
  } catch (err) {
    _status = 'idle';
    _recordingStartTime = null;
    throw err;
  }
}

/**
 * Helper: wait for `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stop recording and return the video file URI.
 *
 * Android's MediaProjection can be slow to finalize the video file.
 * `stopGlobalRecording` may return undefined even though the file exists.
 * We retry with `retrieveLastGlobalRecording()` as a fallback.
 */
export async function stopScreenRecording(): Promise<string> {
  if (_status !== 'recording') {
    throw new Error('Not currently recording');
  }

  _status = 'stopping';

  try {
    // Give the encoder extra time to flush on Android
    const settledMs = Platform.OS === 'android' ? 2000 : 1000;
    let file = await stopGlobalRecording({ settledTimeMs: settledMs });

    // Fallback: if stopGlobalRecording didn't return a file, poll retrieveLastGlobalRecording
    if (!file) {
      console.warn('[screen-capture] stopGlobalRecording returned no file, polling retrieveLastGlobalRecording...');
      for (let attempt = 0; attempt < 5; attempt++) {
        await sleep(1000);
        file = retrieveLastGlobalRecording();
        if (file) {
          console.log(`[screen-capture] Retrieved file on attempt ${attempt + 1}`);
          break;
        }
        console.log(`[screen-capture] Attempt ${attempt + 1}: no file yet...`);
      }
    }

    if (!file) {
      throw new Error('Recording stopped but no file was returned. The video encoder may have failed to finalize.');
    }

    console.log('[screen-capture] Recording saved:', file.path, 'size:', file.size, 'duration:', file.duration);

    _lastVideoPath = file.path;
    _status = 'idle';
    _recordingStartTime = null;

    return file.path;
  } catch (err) {
    _status = 'idle';
    _recordingStartTime = null;
    throw err;
  }
}

/**
 * Get the current recording duration in seconds.
 * Returns 0 if not recording.
 */
export function getRecordingDuration(): number {
  if (_recordingStartTime === null) return 0;
  return Math.floor((Date.now() - _recordingStartTime) / 1000);
}

/**
 * Extract frames from a recorded video at regular intervals.
 *
 * Uses expo-video-thumbnails to grab frames every `intervalMs` milliseconds.
 * On Android, frames snap to nearest keyframe (close enough for feed scanning).
 *
 * @param videoPath - Path to the video file (from stopScreenRecording)
 * @param intervalMs - Time between frames in ms (default 2000 = every 2 seconds)
 * @param maxFrames - Maximum number of frames to extract (default 30)
 * @param onProgress - Progress callback
 * @returns Array of frame image URIs
 */
export async function extractFrames(
  videoPath: string,
  intervalMs = 2000,
  maxFrames = 30,
  onProgress?: (progress: FrameExtractionProgress) => void,
): Promise<string[]> {
  _status = 'extracting';
  const frameUris: string[] = [];

  // Normalize the path to a file:// URI
  const videoUri = ensureFileUri(videoPath);
  console.log('[screen-capture] Extracting frames from:', videoUri);

  // Per-frame timeout — 10s should be plenty for a single thumbnail extraction.
  // If it takes longer, the video is likely in an unsupported format or path is wrong.
  const FRAME_TIMEOUT_MS = 10_000;

  try {
    let timeMs = 0;
    let consecutiveErrors = 0;

    while (frameUris.length < maxFrames && consecutiveErrors < 3) {
      try {
        const { uri: frameUri } = await withTimeout(
          VideoThumbnails.getThumbnailAsync(videoUri, {
            time: timeMs,
            quality: Platform.OS === 'android' ? 0.7 : 0.8,
          }),
          FRAME_TIMEOUT_MS,
          `frame at ${timeMs}ms`,
        );

        frameUris.push(frameUri);
        consecutiveErrors = 0;

        console.log(`[screen-capture] Frame ${frameUris.length} extracted at ${timeMs}ms`);

        onProgress?.({
          currentFrame: frameUris.length,
          totalFrames: maxFrames,
          percentComplete: Math.min((frameUris.length / maxFrames) * 100, 100),
        });
      } catch (err) {
        // Past end of video, timeout, or extraction error
        consecutiveErrors++;
        console.warn(`[screen-capture] Frame extraction failed at ${timeMs}ms (consecutive: ${consecutiveErrors}):`, err);
      }

      timeMs += intervalMs;
    }

    console.log(`[screen-capture] Extraction complete: ${frameUris.length} frames`);
  } finally {
    _status = 'idle';
  }

  return frameUris;
}

/**
 * Clean up cached recording files to free storage.
 */
export async function cleanupRecording(): Promise<void> {
  clearCache();
  _lastVideoPath = null;
  _recordingError = null;
}
