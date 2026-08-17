import SwiftUI
import SpasiBohCore

/// First launch (§12).
///
/// Deliberately bilingual in itself: the learner has not chosen a UI language
/// yet, so the question is asked in both, and each option is written in the
/// language it selects. No login, no email, no account.
struct OnboardingView: View {
    @Environment(AppSettings.self) private var settings
    @State private var appeared = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer(minLength: 40)

                VStack(spacing: 10) {
                    Text("SpasiBoh!")
                        .font(.system(size: 52, weight: .heavy, design: .rounded))
                        .foregroundStyle(Theme.textPrimary)
                    Text("Italiano ↔ Русский")
                        .font(.system(size: 19, weight: .medium, design: .rounded))
                        .foregroundStyle(Theme.accent)
                }
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 12)

                Spacer(minLength: 32)

                VStack(spacing: 6) {
                    Text("Cosa vuoi imparare?")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("Что хочешь выучить?")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.textSecondary)
                }
                .multilineTextAlignment(.center)

                Spacer(minLength: 28)

                VStack(spacing: 14) {
                    // Each card is written in the language it selects, so it is
                    // readable to exactly the learner who should pick it.
                    LanguageChoiceCard(
                        flag: "🇷🇺",
                        title: "Русский",
                        subtitle: "Imparo il russo — l'app sarà in italiano"
                    ) { choose(.itToRu) }

                    LanguageChoiceCard(
                        flag: "🇮🇹",
                        title: "Italiano",
                        subtitle: "Учу итальянский — приложение будет на русском"
                    ) { choose(.ruToIt) }
                }
                .padding(.horizontal, 20)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 20)

                Spacer(minLength: 20)

                Text("Puoi cambiare dopo · Можно изменить позже")
                    .font(.footnote)
                    .foregroundStyle(Theme.textTertiary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 16)
            }
        }
        .task {
            withAnimation(.easeOut(duration: 0.45)) { appeared = true }
        }
    }

    private func choose(_ direction: Direction) {
        withAnimation(.snappy) { settings.direction = direction }
    }
}

private struct LanguageChoiceCard: View {
    let flag: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Text(flag)
                    .font(.system(size: 40))
                    // Emoji is decoration here; the label carries the meaning.
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundStyle(Theme.textPrimary)
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .multilineTextAlignment(.leading)
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .foregroundStyle(Theme.textTertiary)
            }
            .cardSurface()
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(subtitle)")
        .accessibilityAddTraits(.isButton)
    }
}

#Preview {
    OnboardingView()
        .environment(AppSettings.load())
}
