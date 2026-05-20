import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Score helpers

private func scoreColor(_ score: Int) -> Color {
    switch score {
    case ..<0:    return Color(red: 0.36, green: 0.24, blue: 0.18) // brown  — pending
    case 0..<30:  return Color(red: 0.18, green: 0.42, blue: 0.31) // green  — clean
    case 30..<60: return Color(red: 0.83, green: 0.63, blue: 0.09) // amber  — moderate
    default:      return Color(red: 0.88, green: 0.32, blue: 0.32) // red    — heavy
    }
}

private func scoreText(_ score: Int) -> String {
    score < 0 ? "—" : "\(score)"
}

private func statusText(_ score: Int, _ flaggedCount: Int) -> String {
    if score < 0 { return "SCANNING" }
    if flaggedCount == 0 { return "CLEAN" }
    return flaggedCount == 1 ? "1 FLAGGED" : "\(flaggedCount) FLAGGED"
}

// MARK: - Lock Screen / Notification banner

struct LockScreenView: View {
    let state: QuenchrAttributes.ContentState

    var body: some View {
        HStack(spacing: 14) {
            // Score circle
            ZStack {
                Circle()
                    .fill(scoreColor(state.score).opacity(0.15))
                    .frame(width: 46, height: 46)
                Text(scoreText(state.score))
                    .font(.system(size: 19, weight: .bold, design: .rounded))
                    .foregroundColor(scoreColor(state.score))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Quenchr · \(state.platform.capitalized)")
                    .font(.caption.bold())
                    .foregroundColor(.secondary)
                Text(statusText(state.score, state.flaggedCount))
                    .font(.subheadline.bold())
                    .foregroundColor(.primary)
                if state.score >= 0 && state.flaggedCount > 0 {
                    Text("\(state.flaggedCount) item\(state.flaggedCount == 1 ? "" : "s") flagged in this session")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            Image(systemName: "eye.fill")
                .font(.title3)
                .foregroundColor(scoreColor(state.score))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

// MARK: - Dynamic Island expanded regions

private struct LeadingView: View {
    let state: QuenchrAttributes.ContentState

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(scoreColor(state.score))
                .frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 0) {
                Text(scoreText(state.score))
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .monospacedDigit()
                Text(statusText(state.score, state.flaggedCount))
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundColor(.white.opacity(0.65))
                    .kerning(0.4)
            }
        }
        .padding(.leading, 6)
    }
}

private struct TrailingView: View {
    let state: QuenchrAttributes.ContentState

    var body: some View {
        VStack(alignment: .trailing, spacing: 3) {
            if state.score < 0 {
                ProgressView()
                    .progressViewStyle(.circular)
                    .scaleEffect(0.6)
                    .tint(.white.opacity(0.5))
            } else if state.flaggedCount > 0 {
                Label("\(state.flaggedCount)", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption.bold())
                    .foregroundColor(.orange)
            } else {
                Label("Clean", systemImage: "checkmark.circle.fill")
                    .font(.caption.bold())
                    .foregroundColor(Color(red: 0.3, green: 0.8, blue: 0.5))
            }
            Text(state.platform.capitalized)
                .font(.system(size: 8))
                .foregroundColor(.white.opacity(0.4))
        }
        .padding(.trailing, 6)
    }
}

// MARK: - Widget

struct QuenchrLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: QuenchrAttributes.self) { context in
            // Lock screen / StandBy / Notification banner
            LockScreenView(state: context.state)
                .background(Color(.systemBackground))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    LeadingView(state: context.state)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TrailingView(state: context.state)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.score < 0
                        ? "Scanning your \(context.state.platform.capitalized) feed…"
                        : "\(context.state.flaggedCount) item\(context.state.flaggedCount == 1 ? "" : "s") flagged · open Quenchr for breakdown")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.55))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 6)
                        .padding(.bottom, 4)
                }
            } compactLeading: {
                Image(systemName: "eye.fill")
                    .font(.caption.bold())
                    .foregroundColor(scoreColor(context.state.score))
            } compactTrailing: {
                Text(scoreText(context.state.score))
                    .font(.caption2.bold())
                    .foregroundColor(.white)
                    .monospacedDigit()
            } minimal: {
                Image(systemName: "eye.fill")
                    .font(.caption2)
                    .foregroundColor(scoreColor(context.state.score))
            }
            .widgetURL(URL(string: "quenchr://live"))
            .keylineTint(scoreColor(context.state.score))
        }
    }
}
