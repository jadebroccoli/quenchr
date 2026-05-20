/**
 * JS bridge for the Android SYSTEM_ALERT_WINDOW floating overlay.
 *
 * All functions are no-ops on iOS — the Live Activity handles that platform.
 * Always gate calls behind Platform.OS === 'android' at the call site if
 * you want to be explicit, but the stubs mean it's safe to call unconditionally.
 */

import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

// Lazy-load so iOS never tries to resolve the native module
const NativeOverlay = Platform.OS === 'android'
  ? requireNativeModule('LiveOverlay')
  : null;

/**
 * Returns true if SYSTEM_ALERT_WINDOW has been granted.
 * Always true on Android < 6. Always false on iOS (module not loaded).
 */
export function canDrawOverlays(): boolean {
  return NativeOverlay?.canDrawOverlays() ?? false;
}

/**
 * Deep-links the user to the "Display over other apps" settings page.
 * The user flips the toggle and returns to the app.
 * Call this when canDrawOverlays() returns false.
 */
export function requestOverlayPermission(): void {
  NativeOverlay?.requestPermission();
}

/**
 * Show the floating score pill over other apps.
 * Pass score = -1 while waiting for the first burst result ("—" state).
 */
export function startOverlay(score: number, flaggedCount: number): void {
  NativeOverlay?.startOverlay(score < 0 ? -1 : Math.round(score), flaggedCount);
}

/**
 * Update the pill's score and flagged count after each burst.
 */
export function updateOverlay(score: number, flaggedCount: number): void {
  NativeOverlay?.updateOverlay(Math.round(score), flaggedCount);
}

/**
 * Remove the floating pill. Call when recording stops.
 */
export function stopOverlay(): void {
  NativeOverlay?.stopOverlay();
}
