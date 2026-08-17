import SwiftUI
import SpasiBohCore

/// Culture cards, language tips, idioms and achievements (§19, §64).
///
/// Everything here is unlocked by XP rather than bought or timed. The learner
/// earns it by studying, which is the only currency this app has.
struct CollectionView: View {
    @Environment(AppSettings.self) private var settings
    @Environment(ProgressModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var tab = Tab.culture

    private enum Tab: String, CaseIterable, Identifiable {
        case culture, tips, idioms, achievements
        var id: String { rawValue }
    }

    private var direction: Direction { settings.direction ?? .itToRu }
    private var ui: Language { direction.native }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                VStack(spacing: 12) {
                    Picker("", selection: $tab) {
                        Text(S.cultureCards(ui)).tag(Tab.culture)
                        Text(S.languageTips(ui)).tag(Tab.tips)
                        Text(S.idioms(ui)).tag(Tab.idioms)
                        Text(S.achievements(ui)).tag(Tab.achievements)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)

                    ScrollView {
                        VStack(spacing: 12) {
                            switch tab {
                            case .culture: cultureList
                            case .tips: tipList
                            case .idioms: idiomList
                            case .achievements: achievementList
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 30)
                    }
                }
            }
            .navigationTitle(S.collection(ui))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(S.close(ui)) { dismiss() }
                }
            }
        }
    }

    // MARK: - Lists

    private var cultureList: some View {
        ForEach(model.content.cultureCards(for: direction)) { card in
            LockableCard(
                locked: model.progress.xp < card.unlockXP,
                unlockXP: card.unlockXP,
                symbol: card.symbolName,
                title: card.title(ui),
                ui: ui
            ) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(card.body(ui))
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    // Sources are shown, not hidden: a cultural claim the
                    // learner cannot check is worth less than one they can.
                    Text("\(S.source(ui)): \(card.source)")
                        .font(.caption2)
                        .foregroundStyle(Theme.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .onAppear {
                if model.progress.xp >= card.unlockXP { model.unlock(cultureCard: card.id) }
            }
        }
    }

    private var tipList: some View {
        ForEach(model.content.tips(for: direction)) { tip in
            LockableCard(
                locked: model.progress.xp < tip.unlockXP,
                unlockXP: tip.unlockXP,
                symbol: "lightbulb",
                title: tip.title(ui),
                ui: ui
            ) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(tip.body(ui))
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if let example = tip.example {
                        Text(example(ui))
                            .font(.callout.weight(.medium))
                            .foregroundStyle(Theme.accent)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .onAppear {
                if model.progress.xp >= tip.unlockXP { model.unlock(tip: tip.id) }
            }
        }
    }

    private var idiomList: some View {
        ForEach(model.content.idioms(for: direction)) { idiom in
            VStack(alignment: .leading, spacing: 8) {
                Text(idiom.expression)
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundStyle(Theme.textPrimary)
                if let pronunciation = idiom.pronunciation {
                    Text(pronunciation)
                        .font(.footnote)
                        .foregroundStyle(Theme.textTertiary)
                }
                // The literal reading is kept precisely because it is
                // misleading — putting it next to the real meaning is the
                // teaching moment.
                labelled(S.literally(ui), idiom.literal(ui), muted: true)
                labelled(S.actuallyMeans(ui), idiom.meaning(ui))
                labelled(S.whenToUse(ui), idiom.usage(ui), muted: true)
                if let culturalNote = idiom.culturalNote {
                    Text(culturalNote(ui))
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .cardSurface()
        }
    }

    private func labelled(_ label: String, _ value: String, muted: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .foregroundStyle(Theme.textTertiary)
            Text(value)
                .font(.subheadline)
                .foregroundStyle(muted ? Theme.textSecondary : Theme.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var achievementList: some View {
        ForEach(Achievements.all) { achievement in
            let earned = model.progress.achievements[achievement.id] != nil
            HStack(spacing: 14) {
                Image(systemName: earned ? "\(achievement.symbol).fill" : achievement.symbol)
                    .font(.system(size: 22))
                    .foregroundStyle(earned ? Theme.accent : Theme.textTertiary)
                    .frame(width: 34)
                VStack(alignment: .leading, spacing: 3) {
                    Text(achievement.title(ui))
                        .font(.headline)
                        .foregroundStyle(earned ? Theme.textPrimary : Theme.textSecondary)
                    Text(achievement.detail(ui))
                        .font(.footnote)
                        .foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                if earned {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.correct)
                }
            }
            .cardSurface()
            .opacity(earned ? 1 : 0.6)
            .accessibilityElement(children: .combine)
        }
    }
}

/// A card that shows its title but hides its body until enough XP is earned.
///
/// Showing the title rather than a blank slot is deliberate: knowing what is
/// coming is the reason to keep going.
private struct LockableCard<Content: View>: View {
    let locked: Bool
    let unlockXP: Int
    let symbol: String
    let title: String
    let ui: Language
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: locked ? "lock.fill" : symbol)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(locked ? Theme.textTertiary : Theme.accent)
                Text(title)
                    .font(.headline)
                    .foregroundStyle(locked ? Theme.textSecondary : Theme.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            if locked {
                Text(S.unlockedAt.with(unlockXP)(ui))
                    .font(.footnote)
                    .foregroundStyle(Theme.textTertiary)
            } else {
                content()
            }
        }
        .cardSurface()
        .accessibilityElement(children: .combine)
    }
}
