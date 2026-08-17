import SwiftUI

/// The SpasiBoh! look: dark, typographic, restrained.
///
/// Deliberately not Duolingo — no mascot, no gradients everywhere, no fake 3D.
/// The target-language text is the loudest thing on screen; everything else
/// stays quiet so the language is what you look at.
enum Theme {
    // Backgrounds, darkest first.
    static let background = Color(red: 0.05, green: 0.05, blue: 0.07)
    static let surface = Color(red: 0.10, green: 0.10, blue: 0.13)
    static let surfaceRaised = Color(red: 0.14, green: 0.14, blue: 0.18)

    // One warm accent, used sparingly so it still means something.
    static let accent = Color(red: 0.98, green: 0.55, blue: 0.20)
    static let accentMuted = Color(red: 0.98, green: 0.55, blue: 0.20).opacity(0.15)

    static let correct = Color(red: 0.30, green: 0.82, blue: 0.52)
    static let wrong = Color(red: 0.95, green: 0.38, blue: 0.40)

    static let textPrimary = Color.white
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.38)

    static let cornerRadius: CGFloat = 18
    static let tapTarget: CGFloat = 48   // §87 — never smaller than this
}

extension View {
    /// A standard raised card.
    func cardSurface(padding: CGFloat = 18) -> some View {
        self
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
    }
}

/// Large target-language text.
///
/// Uses `.rounded` for Cyrillic legibility at size and always allows the text
/// to shrink rather than truncate — Russian words are long, and a truncated
/// prompt is an unanswerable exercise.
struct TargetText: View {
    let text: String
    var size: CGFloat = 44

    var body: some View {
        Text(text)
            .font(.system(size: size, weight: .bold, design: .rounded))
            .foregroundStyle(Theme.textPrimary)
            .minimumScaleFactor(0.5)
            .lineLimit(3)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
    }
}
