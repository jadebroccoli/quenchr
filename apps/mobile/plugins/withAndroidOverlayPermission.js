/**
 * Expo config plugin: adds SYSTEM_ALERT_WINDOW to AndroidManifest.xml.
 *
 * This is required for the floating live-scan overlay.
 * The permission is "special" on Android 6+ — the user must grant it through
 * Settings → Special App Access → Display over other apps rather than a runtime
 * dialog. Our JS code (live-overlay-module) handles the deep-link prompt.
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSION = 'android.permission.SYSTEM_ALERT_WINDOW';

module.exports = function withAndroidOverlayPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const alreadyAdded = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === PERMISSION,
    );

    if (!alreadyAdded) {
      manifest['uses-permission'].push({
        $: { 'android:name': PERMISSION },
      });
    }

    return config;
  });
};
