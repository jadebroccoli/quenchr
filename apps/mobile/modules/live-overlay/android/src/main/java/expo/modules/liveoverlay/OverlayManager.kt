package expo.modules.liveoverlay

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Manages a single floating pill window drawn above all other apps.
 *
 * The pill sits in the top-right corner by default and is draggable.
 * Color is score-aware: brown (pending) → green → amber → red.
 *
 * Thread safety: all WindowManager calls are posted to the main thread.
 */
object OverlayManager {

  private val mainThread = Handler(Looper.getMainLooper())
  private var windowManager: WindowManager? = null
  private var rootView: LinearLayout? = null
  private var scoreLabel: TextView? = null
  private var subLabel: TextView? = null
  private var dot: View? = null
  private var params: WindowManager.LayoutParams? = null

  // ── Public API ──────────────────────────────────────────────────────────────

  fun start(context: Context, score: Int, flaggedCount: Int) {
    mainThread.post {
      if (rootView != null) {
        applyScore(score, flaggedCount)
        return@post
      }

      val wm = context.applicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      windowManager = wm

      // Build the pill layout
      val pill = buildPill(context, score, flaggedCount)
      val lp = buildLayoutParams()
      params = lp

      // Drag support: user can reposition the pill anywhere on screen
      var dragStartX = 0; var dragStartY = 0
      var touchStartX = 0f; var touchStartY = 0f

      pill.setOnTouchListener { _, event ->
        when (event.action) {
          MotionEvent.ACTION_DOWN -> {
            dragStartX = lp.x; dragStartY = lp.y
            touchStartX = event.rawX; touchStartY = event.rawY
            true
          }
          MotionEvent.ACTION_MOVE -> {
            lp.x = dragStartX + (touchStartX - event.rawX).toInt()
            lp.y = dragStartY + (event.rawY - touchStartY).toInt()
            wm.updateViewLayout(pill, lp)
            true
          }
          else -> false
        }
      }

      rootView = pill
      wm.addView(pill, lp)
    }
  }

  fun update(score: Int, flaggedCount: Int) {
    mainThread.post { applyScore(score, flaggedCount) }
  }

  fun stop() {
    mainThread.post {
      rootView?.let {
        try { windowManager?.removeView(it) } catch (e: Exception) { /* already removed */ }
      }
      rootView = null
      scoreLabel = null
      subLabel = null
      dot = null
      windowManager = null
      params = null
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private fun buildPill(context: Context, score: Int, flaggedCount: Int): LinearLayout {
    val color = scoreColor(score)

    // Outer pill container
    val pill = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(context, 12), dp(context, 8), dp(context, 14), dp(context, 8))
      background = pillBackground(color)
      elevation = dp(context, 6).toFloat()
    }

    // Colored status dot
    val d = View(context).apply {
      layoutParams = LinearLayout.LayoutParams(dp(context, 8), dp(context, 8)).apply {
        rightMargin = dp(context, 6)
      }
      background = dotBackground()
    }
    dot = d

    // Vertical text column: big score + small sub-label
    val textCol = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
    }

    val scoreTv = TextView(context).apply {
      text = if (score < 0) "—" else score.toString()
      textSize = 15f
      typeface = Typeface.DEFAULT_BOLD
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
    }
    scoreLabel = scoreTv

    val subTv = TextView(context).apply {
      text = subText(score, flaggedCount)
      textSize = 9f
      setTextColor(Color.parseColor("#CCE8E0D8"))
      gravity = Gravity.CENTER
      letterSpacing = 0.05f
    }
    subLabel = subTv

    textCol.addView(scoreTv)
    textCol.addView(subTv)

    pill.addView(d)
    pill.addView(textCol)

    return pill
  }

  private fun buildLayoutParams(): WindowManager.LayoutParams {
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }

    return WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.END
      x = 16   // right margin
      y = 120  // top offset (below status bar + some breathing room)
    }
  }

  private fun applyScore(score: Int, flaggedCount: Int) {
    val root = rootView ?: return
    val color = scoreColor(score)

    scoreLabel?.text = if (score < 0) "—" else score.toString()
    subLabel?.text = subText(score, flaggedCount)

    // Animate background color transition
    (root.background as? GradientDrawable)?.setColor(color)
    dot?.let { (it.background as? GradientDrawable)?.setColor(dotColor(score)) }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Brown = pending, green = safe, amber = moderate, red = heavy */
  private fun scoreColor(score: Int): Int = when {
    score < 0   -> Color.parseColor("#CC5C3D2E") // brown, semi-transparent
    score >= 60 -> Color.parseColor("#CCE05252") // red
    score >= 30 -> Color.parseColor("#CCD4A017") // amber
    else        -> Color.parseColor("#CC2D6A4F") // dark green
  }

  private fun dotColor(score: Int): Int = when {
    score < 0   -> Color.parseColor("#FFE8D8C0")
    score >= 60 -> Color.parseColor("#FFFF9090")
    score >= 30 -> Color.parseColor("#FFFFD080")
    else        -> Color.parseColor("#FF90EE90")
  }

  private fun subText(score: Int, flaggedCount: Int): String = when {
    score < 0          -> "SCANNING"
    flaggedCount == 0  -> "CLEAN"
    flaggedCount == 1  -> "1 FLAGGED"
    else               -> "$flaggedCount FLAGGED"
  }

  private fun pillBackground(color: Int) = GradientDrawable().apply {
    setColor(color)
    cornerRadius = 50f
  }

  private fun dotBackground() = GradientDrawable().apply {
    shape = GradientDrawable.OVAL
    setColor(Color.parseColor("#80FFFFFF"))
    setSize(8, 8)
  }

  private fun dp(context: Context, value: Int): Int {
    return (value * context.resources.displayMetrics.density).toInt()
  }
}
