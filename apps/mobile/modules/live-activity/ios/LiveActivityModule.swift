import ActivityKit
import ExpoModulesCore
import Foundation

public class LiveActivityModule: Module {
    // Hold a reference to the running activity so we can update/end it.
    // Stored as Any? to avoid compile errors on iOS < 16.2 where Activity<> is unavailable.
    private var _activity: Any?

    @available(iOS 16.2, *)
    private var activity: Activity<QuenchrAttributes>? {
        get { _activity as? Activity<QuenchrAttributes> }
        set { _activity = newValue }
    }

    public func definition() -> ModuleDefinition {
        Name("LiveActivity")

        // ── startActivity(platform) ───────────────────────────────────────────
        // Creates a new Live Activity for the given platform.
        // Returns the activity ID string, or nil on iOS < 16.2.
        AsyncFunction("startActivity") { (platform: String) -> String? in
            guard #available(iOS 16.2, *) else { return nil }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }

            // End any existing activity cleanly before starting a new one.
            if let existing = self.activity {
                await existing.end(nil, dismissalPolicy: .immediate)
                self.activity = nil
            }

            let attributes = QuenchrAttributes(startedAt: Date(), platform: platform)
            let initialState = QuenchrAttributes.ContentState(
                score: -1,
                flaggedCount: 0,
                platform: platform
            )
            let content = ActivityContent(
                state: initialState,
                staleDate: Calendar.current.date(byAdding: .hour, value: 2, to: Date())
            )

            do {
                let newActivity = try Activity<QuenchrAttributes>.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
                self.activity = newActivity
                return newActivity.id
            } catch {
                // Live Activities may be disabled by user — not fatal
                print("[LiveActivityModule] request failed:", error.localizedDescription)
                return nil
            }
        }

        // ── updateActivity(score, flaggedCount) ───────────────────────────────
        // Pushes a new ContentState to the running Live Activity.
        AsyncFunction("updateActivity") { (score: Int, flaggedCount: Int) in
            guard #available(iOS 16.2, *), let current = self.activity else { return }

            let newState = QuenchrAttributes.ContentState(
                score: score,
                flaggedCount: flaggedCount,
                platform: current.content.state.platform
            )
            let content = ActivityContent(state: newState, staleDate: nil)
            await current.update(content)
        }

        // ── endActivity() ─────────────────────────────────────────────────────
        // Ends the Live Activity and removes the pill from the Dynamic Island.
        AsyncFunction("endActivity") {
            guard #available(iOS 16.2, *), let current = self.activity else { return }
            await current.end(nil, dismissalPolicy: .immediate)
            self.activity = nil
        }
    }
}
