import ActivityKit
import Foundation

/// Shared ActivityAttributes type for Quenchr Live Scan.
///
/// This struct is compiled into BOTH the widget extension target and the main
/// app target (via the native module). iOS matches them at runtime by type name,
/// so both copies must be byte-for-byte identical.
public struct QuenchrAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Current feed health score. -1 = scanning (no burst result yet).
        public var score: Int
        /// Number of frames classified as suggestive or explicit so far.
        public var flaggedCount: Int
        /// "instagram" | "tiktok" | "youtube" etc. Shown in the lock screen view.
        public var platform: String
    }

    /// Wall-clock time the scan started — used for elapsed-time displays.
    public var startedAt: Date
    /// Platform name captured at start time (also stored in ContentState for rendering).
    public var platform: String
}
