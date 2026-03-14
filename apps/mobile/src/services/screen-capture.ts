import * as VideoThumbnails from 'expo-video-thumbnails';
import { File as ExpoFile } from 'expo-file-system';
import {
  startRecording as nitroStartRecording,
  stopRecording as nitroStopRecording,
  requestPermission as nitroRequestPermission,
} from 'react-native-nitro-screen-recorder';
// Types provided by src/types/react-native-nitro-screen-recorder.d.ts

// ── Types ──

export type RecordingStatus = 'idle' | 'requesting_permission' | 'recording' | 'stopping' | 'extracting';

export interface FrameExtractionProgress {
  currentFrame: number;
  totalFrames: number;
  percentComplete: number;
}

// ── Module State ──

let status: RecordingStatus = 'idle';
let videoUri: string | null = null;
let startedAt: number | null = null;

// ── Public API ──

export function getStatus(): RecordingStatus {
  return status;
}

/**
 * Request screen recording permission.
 * Android: triggers MediaProjection system dialog.
 * iOS: triggers ReplayKit broadcast picker.
 */
export async function requestRecordingPermission(): Promise<boolean> {
  try {
    status = 'requesting_permission';
    const granted = await nitroRequestPermission();
    status = 'idle';
    return granted;
  } catch {
    status = 'idle';
    return false;
  }
}

/**
 * Start screen recording. The OS shows a recording indicator.
 * User can then switch to another app (Instagram/TikTok).
 */
export async function startScreenRecording(): Promise<void> {
  if (status === 'recording') {
    throw new Error('Recording already in progress');
  }

  try {
    await nitroStartRecording({ enableAudio: false });
    status = 'recording';
    startedAt = Date.now();
  } catch (error) {
    status = 'idle';
    startedAt = null;
    throw error;
  }
}

/**
 * Stop screen recording and return the video file URI.
 */
export async function stopScreenRecording(): Promise<string> {
  if (status !== 'recording') {
    throw new Error('No recording in progress');
  }

  status = 'stopping';

  try {
    const result = await nitroStopRecording();
    videoUri = result.uri;
    status = 'idle';
    startedAt = null;
    return videoUri!;
  } catch (error) {
    status = 'idle';
    startedAt = null;
    throw error;
  }
}

/**
 * Get recording duration in seconds.
 */
export function getRecordingDuration(): number {
  if (status !== 'recording' || !startedAt) return 0;
  return Math.floor((Date.now() - startedAt) / 1000);
}

/**
 * Extract frames from a recorded video at regular intervals.
 * Returns an array of image URIs — same format as ImagePicker results,
 * ready to feed directly into scanImages().
 *
 * @param uri - Video file URI
 * @param intervalMs - Time between frames (default 2000ms)
 * @param maxFrames - Cap on frames extracted (default 30)
 * @param onProgress - Progress callback
 */
export async function extractFrames(
  uri: string,
  intervalMs = 2000,
  maxFrames = 30,
  onProgress?: (progress: FrameExtractionProgress) => void,
): Promise<string[]> {
  status = 'extracting';

  try {
    const durationMs = await getVideoDurationMs(uri);

    // Generate timestamps
    const timestamps: number[] = [];
    for (let t = 0; t < durationMs && timestamps.length < maxFrames; t += intervalMs) {
      timestamps.push(t);
    }

    // Ensure at least one frame
    if (timestamps.length === 0) {
      timestamps.push(0);
    }

    const totalFrames = timestamps.length;
    const frameUris: string[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      onProgress?.({
        currentFrame: i + 1,
        totalFrames,
        percentComplete: Math.round(((i + 1) / totalFrames) * 100),
      });

      try {
        const { uri: frameUri } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: timestamps[i],
          quality: 0.8,
        });
        frameUris.push(frameUri);
      } catch {
        // Timestamp may be past end of video — skip
        console.warn(`[screen-capture] Failed to extract frame at ${timestamps[i]}ms`);
      }
    }

    status = 'idle';
    return frameUris;
  } catch (error) {
    status = 'idle';
    throw error;
  }
}

/**
 * Delete the temporary video file after analysis.
 */
export async function cleanupRecording(): Promise<void> {
  if (videoUri) {
    try {
      const file = new ExpoFile(videoUri);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Silent cleanup failure is fine
    }
    videoUri = null;
  }
}

// ── Internal Helpers ──

/**
 * Determine video duration via binary search.
 * expo-video-thumbnails doesn't expose duration metadata,
 * so we probe with getThumbnailAsync at increasing timestamps.
 */
async function getVideoDurationMs(uri: string): Promise<number> {
  let low = 0;
  let high = 120_000; // Max 2 minutes

  // Quick check: does the video exist at all?
  try {
    await VideoThumbnails.getThumbnailAsync(uri, { time: 0 });
  } catch {
    return 0;
  }

  while (high - low > 2000) {
    const mid = Math.floor((low + high) / 2);
    try {
      await VideoThumbnails.getThumbnailAsync(uri, { time: mid });
      low = mid;
    } catch {
      high = mid;
    }
  }

  return low;
}
