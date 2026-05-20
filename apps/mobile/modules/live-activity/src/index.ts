/**
 * JS bridge for the iOS Dynamic Island Live Activity.
 *
 * All functions are no-ops on Android — the floating overlay handles that platform.
 * Safe to call unconditionally; the stubs return undefined without throwing.
 */

import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

// Lazy-load so Android never resolves the iOS-only native module.
const NativeLiveActivity = Platform.OS === 'ios'
  ? requireNativeModule('LiveActivity')
  : null;

/**
 * Start a Live Activity for the given platform scan.
 * Shows the Quenchr pill in the Dynamic Island immediately.
 * Resolves to the activity ID string, or null if Live Activities
 * are disabled by the user or the device is on iOS < 16.2.
 */
export async function startLiveActivity(platform: string): Promise<string | null> {
  return NativeLiveActivity?.startActivity(platform) ?? null;
}

/**
 * Push a score + flagged count update to the Live Activity.
 * Call after each burst cycle (every ~25 s on iOS, though iOS doesn't
 * do burst recording — this fires when the user returns to Quenchr
 * and taps Stop & Analyze).
 */
export async function updateLiveActivity(
  score: number,
  flaggedCount: number,
): Promise<void> {
  await NativeLiveActivity?.updateActivity(Math.round(score), flaggedCount);
}

/**
 * End the Live Activity and remove the pill from the Dynamic Island.
 * Call when recording stops.
 */
export async function endLiveActivity(): Promise<void> {
  await NativeLiveActivity?.endActivity();
}
