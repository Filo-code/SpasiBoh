import SwiftUI
import UIKit

/// The one loud button on a screen.
struct PrimaryButtonStyle: ButtonStyle {
    var tint: Color = Theme.accent

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 17, weight: .heavy, design: .rounded))
            .foregroundStyle(Theme.background)
            .padding(.vertical, 16)
            .padding(.horizontal, 22)
            .frame(maxWidth: .infinity, minHeight: Theme.tapTarget)
            .background(tint, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
            .opacity(configuration.isPressed ? 0.82 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(Theme.textPrimary)
            .padding(.vertical, 12)
            .padding(.horizontal, 16)
            .frame(minHeight: Theme.tapTarget)
            .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 12))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

/// Haptics for answers and milestones.
///
/// Deliberately restrained: a buzz on every tap is noise, and noise gets the
/// whole app muted. Only outcomes vibrate.
@MainActor
enum Haptics {
    private static let notifier = UINotificationFeedbackGenerator()

    static func answer(correct: Bool) {
        notifier.notificationOccurred(correct ? .success : .warning)
    }

    static func milestone() {
        notifier.notificationOccurred(.success)
    }
}

/// A horizontal mastery bar.
struct MasteryBar: View {
    let value: Double
    var tint: Color = Theme.accent
    var height: CGFloat = 8

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.surfaceRaised)
                Capsule()
                    .fill(tint)
                    .frame(width: max(0, min(1, value)) * geometry.size.width)
            }
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityValue("\(Int(value * 100))%")
    }
}
