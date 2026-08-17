import SwiftUI
import SpasiBohCore

/// Home (§16).
///
/// Shows where the learner is, then gets out of the way. The primary action is
/// one button; free-training modes sit below it for when the daily session is
/// done or the learner wants something specific.
struct HomeView: View {
    @Environment(AppSettings.self) private var settings

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
                        // Direction switching lives in Settings; flipping here
                        // keeps the scaffold navigable while that screen is
                        // still being built.
                        settings.direction = direction.flipped
                    } label: {
                        Label(
                            ui == .italian ? "Cambia direzione" : "Сменить направление",
                            systemImage: "arrow.left.arrow.right"
                        )
                        .labelStyle(.iconOnly)
                    }
                    .tint(Theme.accent)
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
        // Zeros are honest here: no progress has been recorded yet. These bind
        // to the real store once persistence lands.
        HStack(spacing: 10) {
            StatTile(symbol: "flame.fill", value: "0", label: ui == .italian ? "Serie" : "Серия", tint: Theme.accent)
            StatTile(symbol: "book.fill", value: "0%", label: ui == .italian ? "Parole" : "Слова", tint: Theme.correct)
            StatTile(symbol: "brain.head.profile", value: "0%", label: ui == .italian ? "Totale" : "Всего", tint: .cyan)
        }
    }

    private var continueButton: some View {
        Button {
            // Session flow not yet wired — see the report for what remains.
        } label: {
            HStack {
                Text(ui == .italian ? "CONTINUA SESSIONE" : "ПРОДОЛЖИТЬ СЕССИЮ")
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
            Text(ui == .italian ? "Allenamento libero" : "Свободная тренировка")
                .font(.headline)
                .foregroundStyle(Theme.textSecondary)
                .padding(.top, 6)

            ForEach(TrainingMode.modes(for: direction)) { mode in
                HStack(spacing: 14) {
                    Image(systemName: mode.symbol)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(width: 28)
                    Text(mode.title(ui))
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.textPrimary)
                    Spacer(minLength: 0)
                }
                .cardSurface(padding: 14)
                .frame(minHeight: Theme.tapTarget)
            }
        }
    }
}

private struct StatTile: View {
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

/// The free-training entries shown on Home.
///
/// The warm-up entry differs by direction because the two warm-ups teach
/// different problems — Cyrillic for one, Italian orthography for the other.
private struct TrainingMode: Identifiable {
    let id: String
    let symbol: String
    let it: String
    let ru: String

    func title(_ language: Language) -> String {
        language == .italian ? it : ru
    }

    static func modes(for direction: Direction) -> [TrainingMode] {
        let warmup: TrainingMode = switch direction {
        case .itToRu:
            TrainingMode(id: "warmup", symbol: "textformat.abc", it: "Alfabeto cirillico", ru: "Кириллица")
        case .ruToIt:
            TrainingMode(id: "warmup", symbol: "waveform", it: "Pronuncia italiana", ru: "Итальянское произношение")
        }
        return [
            warmup,
            TrainingMode(id: "vocab", symbol: "book", it: "Vocabolario", ru: "Словарь"),
            TrainingMode(id: "listening", symbol: "ear", it: "Ascolto", ru: "Аудирование"),
            TrainingMode(id: "pronunciation", symbol: "mic", it: "Pronuncia", ru: "Произношение"),
            TrainingMode(id: "translation", symbol: "arrow.left.arrow.right", it: "Traduzione", ru: "Перевод"),
            TrainingMode(id: "sentences", symbol: "text.alignleft", it: "Frasi", ru: "Фразы"),
            TrainingMode(id: "scenarios", symbol: "map", it: "Situazioni reali", ru: "Реальные ситуации"),
            TrainingMode(id: "mistakes", symbol: "exclamationmark.triangle", it: "I miei errori", ru: "Мои ошибки"),
            TrainingMode(id: "culture", symbol: "sparkles", it: "Collezione", ru: "Коллекция"),
            TrainingMode(id: "stats", symbol: "chart.bar", it: "Statistiche", ru: "Статистика"),
        ]
    }
}

#Preview {
    HomeView()
        .environment(AppSettings.load())
}
