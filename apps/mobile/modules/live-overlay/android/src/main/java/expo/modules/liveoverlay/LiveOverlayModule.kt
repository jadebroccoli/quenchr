package expo.modules.liveoverlay

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LiveOverlayModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LiveOverlay")

    /**
     * Returns true if the SYSTEM_ALERT_WINDOW permission has been granted.
     * On Android < 6 (API 23) the permission is always granted at install time.
     */
    Function("canDrawOverlays") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        // reactContext may be null during init — treat as "not granted" if so
        appContext.reactContext?.let { Settings.canDrawOverlays(it) } ?: false
      } else {
        true
      }
    }

    /**
     * Deep-links the user to the "Display over other apps" settings page for
     * this package. Call this when canDrawOverlays() returns false.
     */
    Function("requestPermission") {
      appContext.reactContext?.let { context ->
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}")
        ).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
      }
    }

    /**
     * Show the floating overlay pill. Call immediately after recording starts.
     * score = -1 means "pending" (no burst result yet) — shows "—" in the pill.
     */
    Function("startOverlay") { score: Int, flaggedCount: Int ->
      appContext.reactContext?.let { context ->
        OverlayManager.start(context, score, flaggedCount)
      }
    }

    /**
     * Update the score + flagged count in the floating pill.
     * Safe to call from any thread — OverlayManager posts to the main thread.
     */
    Function("updateOverlay") { score: Int, flaggedCount: Int ->
      OverlayManager.update(score, flaggedCount)
    }

    /**
     * Remove the floating overlay. Call when recording stops.
     */
    Function("stopOverlay") {
      OverlayManager.stop()
    }
  }
}
