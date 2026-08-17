import SwiftUI
import SpasiBohCore

/// What the learner has actually done (§103).
///
/// Per-skill rather than one number: an item can be strong on recognition and
/// weak on production, and a single figure hides exactly the gap worth working
/// on.
struct StatisticsView: View {
    @Environment(AppSettings.self) private var settings
    @Environment(ProgressModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    private var direction: Direction { settings.direction ?? .itToRu }
    private var ui: Language { direction.native }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        summaryGrid
                        skillBreakdown
                        history
                    }
                    .padding(18)
                }
            }
            .navigationTitle(S.statistics(ui))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(S.close(ui)) { dismiss() }
                }
            }
        }
    }

    private var summaryGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            StatTile(symbol: "flame.fill", value: "\(model.streak())", label: S.streak(ui), tint: Theme.accent)
            StatTile(symbol: "trophy.fill", value: "\(model.progress.bestStreak)", label: S.bestStreak(ui), tint: .yellow)
            StatTile(symbol: "sparkles", value: "\(model.progress.xp)", label: S.totalXP(ui), tint: .cyan)
            StatTile(symbol: "book.fill", value: "\(startedCount)", label: S.itemsStarted(ui), tint: Theme.correct)
            StatTile(symbol: "checkmark.seal.fill", value: "\(masteredCount)", label: S.itemsMastered(ui), tint: Theme.correct)
            StatTile(symbol: "exclamationmark.triangle.fill", value: "\(model.mistakeCount(for: direction))",
                     label: S.toReview(ui), tint: Theme.wrong)
        }
    }

    private var scopes: [ItemScope] {
        Set(model.progress.keys(in: direction).map(\.itemScope)).sorted { $0.itemID < $1.itemID }
    }

    private var startedCount: Int { scopes.count }

    private var masteredCount: Int {
        scopes.filter { model.progress.mastery(of: $0) >= 0.85 }.count
    }

    private var skillBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(S.perSkill(ui))
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)

            ForEach(Skill.allCases, id: \.self) { skill in
                let states = model.progress.keys(in: direction)
                    .filter { $0.skill == skill }
                    .map { model.progress[$0] }
                    .filter { $0.seenCount > 0 }
                let average = states.isEmpty ? 0 : states.reduce(0.0) { $0 + $1.mastery } / Double(states.count)

                VStack(alignment: .leading, spacing: 5) {
                    HStack {
                        Text(S.skillName(skill)(ui))
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.textPrimary)
                        Spacer()
                        Text(states.isEmpty ? "—" : "\(Int(average * 100))%")
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(Theme.textSecondary)
                    }
                    MasteryBar(value: average, tint: tint(for: average))
                }
                .accessibilityElement(children: .combine)
            }
        }
        .cardSurface()
    }

    private func tint(for value: Double) -> Color {
        if value >= 0.85 { return Theme.correct }
        if value >= 0.5 { return Theme.accent }
        return Theme.wrong
    }

    private var history: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(S.sessionHistory(ui))
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)

            if model.progress.sessions.isEmpty {
                Text(S.noSessionsYet(ui))
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
            } else {
                ForEach(model.progress.sessions.prefix(20)) { session in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.finishedAt.formatted(date: .abbreviated, time: .shortened))
                                .font(.subheadline)
                                .foregroundStyle(Theme.textPrimary)
                            Text("\(session.correct)/\(session.answered) · \(session.direction == .itToRu ? "IT→RU" : "RU→IT")")
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Text("+\(session.xpEarned)")
                            .font(.subheadline.weight(.semibold).monospacedDigit())
                            .foregroundStyle(Theme.accent)
                    }
                    .padding(.vertical, 6)
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .cardSurface()
    }
}
