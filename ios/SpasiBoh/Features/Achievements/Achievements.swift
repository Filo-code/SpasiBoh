import Foundation
import SpasiBohCore

/// A thing worth being told you did.
struct Achievement: Identifiable, Sendable {
    let id: String
    let symbol: String
    let title: Copy
    let detail: Copy
    /// Evaluated against progress, not tracked incrementally — a counter that
    /// has to be kept in sync with the thing it counts eventually drifts, and
    /// recomputing over a few thousand records is instant.
    let isEarned: @Sendable (LearnerProgress, Direction) -> Bool
}

enum Achievements {

    static let all: [Achievement] = [
        Achievement(
            id: "first_session", symbol: "flag.checkered",
            title: Copy(it: "Primo passo", ru: "Первый шаг"),
            detail: Copy(it: "Hai finito la prima sessione.", ru: "Первая сессия завершена."),
            isEarned: { progress, _ in !progress.sessions.isEmpty }
        ),
        Achievement(
            id: "streak_3", symbol: "flame",
            title: Copy(it: "Tre giorni", ru: "Три дня"),
            detail: Copy(it: "Tre giorni di fila.", ru: "Три дня подряд."),
            isEarned: { progress, _ in progress.bestStreak >= 3 }
        ),
        Achievement(
            id: "streak_7", symbol: "flame.fill",
            title: Copy(it: "Una settimana", ru: "Неделя"),
            detail: Copy(it: "Sette giorni di fila.", ru: "Семь дней подряд."),
            isEarned: { progress, _ in progress.bestStreak >= 7 }
        ),
        Achievement(
            id: "alphabet", symbol: "textformat.abc",
            title: Copy(it: "Alfabeto", ru: "Алфавит"),
            detail: Copy(it: "Riscaldamento completato.", ru: "Разминка пройдена."),
            isEarned: { progress, direction in
                let warmups = progress.keys(in: direction).filter { $0.kind == .warmup }
                let scopes = Set(warmups.map(\.itemScope))
                guard scopes.count >= 20 else { return false }
                return scopes.allSatisfy { progress.mastery(of: $0) >= 0.6 }
            }
        ),
        Achievement(
            id: "words_50", symbol: "book",
            title: Copy(it: "Cinquanta parole", ru: "Пятьдесят слов"),
            detail: Copy(it: "50 parole a buon livello.", ru: "50 слов на хорошем уровне."),
            isEarned: { progress, direction in knownConcepts(progress, direction) >= 50 }
        ),
        Achievement(
            id: "words_200", symbol: "books.vertical",
            title: Copy(it: "Duecento parole", ru: "Двести слов"),
            detail: Copy(it: "200 parole a buon livello.", ru: "200 слов на хорошем уровне."),
            isEarned: { progress, direction in knownConcepts(progress, direction) >= 200 }
        ),
        Achievement(
            id: "speaker", symbol: "mic",
            title: Copy(it: "Ci hai messo la voce", ru: "Голос в деле"),
            detail: Copy(it: "25 esercizi di pronuncia superati.", ru: "25 упражнений на произношение."),
            isEarned: { progress, direction in
                progress.keys(in: direction)
                    .filter { $0.skill == .pronunciation }
                    .reduce(0) { $0 + progress[$1].correctCount } >= 25
            }
        ),
        Achievement(
            id: "both_ways", symbol: "arrow.left.arrow.right",
            title: Copy(it: "Nei due sensi", ru: "В обе стороны"),
            detail: Copy(it: "Hai studiato in entrambe le direzioni.", ru: "Ты учился в обе стороны."),
            isEarned: { progress, _ in
                Direction.allCases.allSatisfy { !progress.keys(in: $0).isEmpty }
            }
        ),
        Achievement(
            id: "perfect_session", symbol: "star.circle",
            title: Copy(it: "Senza errori", ru: "Без ошибок"),
            detail: Copy(it: "Una sessione intera senza sbagliare.", ru: "Целая сессия без ошибок."),
            isEarned: { progress, direction in
                progress.sessions.contains { $0.direction == direction && $0.answered >= 10 && $0.correct == $0.answered }
            }
        ),
        Achievement(
            id: "scenario", symbol: "map",
            title: Copy(it: "Nel mondo reale", ru: "В реальном мире"),
            detail: Copy(it: "Hai completato una situazione reale.", ru: "Пройдена реальная ситуация."),
            isEarned: { progress, direction in
                progress.keys(in: direction).contains { $0.itemID.hasPrefix("scenario_") }
            }
        ),
    ]

    private static func knownConcepts(_ progress: LearnerProgress, _ direction: Direction) -> Int {
        Set(
            progress.keys(in: direction)
                .filter { $0.kind == .concept }
                .map(\.itemScope)
        )
        .filter { progress.mastery(of: $0) >= 0.6 }
        .count
    }

    /// Award anything newly earned. Called at the end of a session.
    @MainActor
    static func evaluate(model: ProgressModel, direction: Direction, session: SessionRunner?) {
        for achievement in all where achievement.isEarned(model.progress, direction) {
            if model.progress.achievements[achievement.id] == nil {
                model.award(achievement: achievement.id)
                Haptics.milestone()
            }
        }
    }
}
