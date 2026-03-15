/**
 * Screen capture service — STUBBED for MVP.
 *
 * react-native-nitro-screen-recorder was removed because it breaks EAS builds.
 * Live scan (screen recording) is a V2 feature. These stubs keep the rest of
 * the codebase compiling without the native module.
 */

export type RecordingStatus = 'idle' | 'requesting_permission' | 'recording' | 'stopping' | 'extracting';

export interface FrameExtractionProgress {
  currentFrame: number;
  totalFrames: number;
  percentComplete: number;
}

export function getStatus(): RecordingStatus {
  return 'idle';
}

export async function requestRecordingPermission(): Promise<boolean> {
  return false;
}

export async function startScreenRecording(): Promise<void> {
  throw new Error('Screen recording is not available in this build.');
}

export async function stopScreenRecording(): Promise<string> {
  throw new Error('Screen recording is not available in this build.');
}

export function getRecordingDuration(): number {
  return 0;
}

export async function extractFrames(
  _uri: string,
  _intervalMs = 2000,
  _maxFrames = 30,
  _onProgress?: (progress: FrameExtractionProgress) => void,
): Promise<string[]> {
  return [];
}

export async function cleanupRecording(): Promise<void> {
  // No-op
}
