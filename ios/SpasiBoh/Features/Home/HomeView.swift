import SwiftUI
import SpasiBohCore

/// Home (§16).
///
/// Shows where the learner is, then gets out of the way. The primary action is
/// one button; free-training modes sit below it for when the daily session is
/// done or the learner wants something specific.
struct HomeView: View {
    @Environment(AppSettings.self) private var settings
    @Environment(ProgressModel.self) private var model

    @State private var route: Route?

    private enum Route: Hashable, Identifiable {
        case session(TrainingMode)
        case scenarios
        case collection
        case statistics
        case settings

        var id: String {
            switch self {
            case .session(let mode): "session-\(mode.rawValue)"
            case .scenarios: "scenarios"
            case .collection: "collection"
            case .statistics: "statistics"
            case .settings: "settings"
            }
        }
    }

    private var direction: Direction { settings.direction ?? .itToRu }
    private var ui: Language { direction.native }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        header
                        statsRow
                        continueButton
                        freeTraining
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 32)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        route = .settings
                    } label: {
                        Label(S.settings(ui), systemImage: "gearshape")
                            .labelStyle(.iconOnly)
                    }
                }
            }
            .fullScreenCover(item: $route) { destination in
                switch destination {
                case .session(let mode): SessionView(mode: mode)
                case .scenarios: ScenarioListView()
                case .collection: CollectionView()
                case .statistics: StatisticsView()
                case .settings: SettingsView()
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("SpasiBoh!")
                .font(.system(size: 34, weight: .heavy, design: .rounded))
                .foregroundStyle(Theme.textPrimary)
            HStack(spacing: 8) {
                Text("\(direction.native.flag) → \(direction.target.flag)")
                    .accessibilityHidden(true)
                Text(directionLabel)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.textSecondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(directionLabel)
        }
        .padding(.top, 8)
    }

    private var directionLabel: String {
        switch direction {
        case .itToRu: "Italiano → Русский"
        case .ruToIt: "Русский → Italiano"
        }
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            StatTile(
                symbol: "flame.fill",
                value: "\(model.streak())",
                label: S.streak(ui),
                tint: Theme.accent
            )
            StatTile(
                symbol: "book.fill",
                value: "\(Int(model.vocabularyMastery(for: direction) * 100))%",
                label: S.words(ui),
                tint: Theme.correct
            )
            StatTile(
                symbol: "sparkles",
                value: "\(model.progress.xp)",
                label: "XP",
                tint: .cyan
            )
        }
    }

    private var continueButton: some View {
        Button {
            route = .session(.daily)
        } label: {
            HStack {
                Text(model.progress.sessions.isEmpty ? S.startSession(ui) : S.continueSession(ui))
                    .font(.system(size: 17, weight: .heavy, design: .rounded))
                Spacer(minLength: 8)
                Image(systemName: "arrow.right")
            }
            .foregroundStyle(Theme.background)
            .padding(.vertical, 18)
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
        }
        .buttonStyle(.plain)
        .frame(minHeight: Theme.tapTarget)
    }

    private var freeTraining: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(S.freeTraining(ui))
                .font(.headline)
                .foregroundStyle(Theme.textSecondary)
                .padding(.top, 6)

            ForEach(entries) { entry in
                Button {
                    route = entry.route
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: entry.symbol)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Theme.accent)
                            .frame(width: 28)
                        Text(entry.title(ui))
                            .font(.body.weight(.medium))
                            .foregroundStyle(Theme.textPrimary)
                        Spacer(minLength: 0)
                        if let badge = entry.badge, badge > 0 {
                            Text("\(badge)")
                                .font(.caption.weight(.bold).monospacedDigit())
                                .foregroundStyle(Theme.background)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Theme.accent, in: Capsule())
                        }
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.textTertiary)
                    }
                    .cardSurface(padding: 14)
                    .frame(minHeight: Theme.tapTarget)
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
            }
        }
    }

    private var entries: [HomeEntry] {
        let warmup: HomeEntry = switch direction {
        case .itToRu: HomeEntry(id: "warmup", symbol: "textformat.abc", title: S.modeWarmupRU, route: .session(.warmup))
        case .ruToIt: HomeEntry(id: "warmup", symbol: "waveform", title: S.modeWarmupIT, route: .session(.warmup))
        }
        return [
            warmup,
            HomeEntry(id: "vocab", symbol: "book", title: S.modeVocabulary, route: .session(.vocabulary)),
            HomeEntry(id: "listening", symbol: "ear", title: S.modeListening, route: .session(.listening)),
            HomeEntry(id: "pronunciation", symbol: "mic", title: S.modePronunciation, route: .session(.pronunciation)),
            HomeEntry(id: "translation", symbol: "arrow.left.arrow.right", title: S.modeTranslation, route: .session(.translation)),
            HomeEntry(id: "sentences", symbol: "text.alignleft", title: S.modeSentences, route: .session(.sentences)),
            HomeEntry(id: "scenarios", symbol: "map", title: S.modeScenarios, route: .scenarios),
            HomeEntry(
                id: "mistakes", symbol: "exclamationmark.triangle", title: S.modeMistakes,
                route: .session(.mistakes), badge: model.mistakeCount(for: direction)
            ),
            HomeEntry(id: "collection", symbol: "sparkles", title: S.modeCollection, route: .collection),
            HomeEntry(id: "stats", symbol: "chart.bar", title: S.modeStats, route: .statistics),
        ]
    }

    private struct HomeEntry: Identifiable {
        let id: String
        let symbol: String
        let title: Copy
        let route: Route
        var badge: Int?
    }
}

struct StatTile: View {
    let symbol: String
    let value: String
    let label: String
    let tint: Color

    var body: some View {
        VStack(spacing: 5) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(tint)
            Text(value)
                .font(.system(size: 21, weight: .bold, design: .rounded))
                .foregroundStyle(Theme.textPrimary)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }
}

#Preview {
    HomeView()
        .environment(AppSettings.load())
        .environment(ProgressModel.preview())
}
