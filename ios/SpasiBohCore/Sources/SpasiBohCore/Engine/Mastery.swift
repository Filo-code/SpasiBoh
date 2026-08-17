import Foundation

/// Applies answers to scheduling state and computes mastery.
///
/// Pure and synchronous — no storage, no UI, no clock of its own. `now` is
/// always passed in, which is what makes the scheduling behaviour testable
/// without waiting 21 days.
public enum Mastery {

    /// Mastery is a blend of three things that can each be independently good
    /// or bad, damped by how much evidence we actually have.
    ///
    /// Accuracy alone is not enough: 3/3 on a brand-new item is not mastery,
    /// it is luck. The `confidence` multiplier is what stops a single lucky
    /// streak from marking something known.
    public static func computeMastery(_ state: SkillState) -> Double {
        guard state.seenCount > 0 else { return 0 }
        let accuracy = state.accuracy
        let streakFactor = min(Double(state.streak) / Double(SkillState.targetStreak), 1)
        let retention = min(state.intervalDays / SkillState.masteryIntervalDays, 1)
        let confidence = min(Double(state.seenCount) / Double(SkillState.minExposures), 1)
        let raw = (0.45 * accuracy + 0.25 * streakFactor + 0.30 * retention) * confidence
        return max(0, min(1, raw))
    }

    /// Fold one answer into a skill's state.
    public static func apply(
        _ outcome: AnswerOutcome,
        to state: SkillState
    ) -> SkillState {
        // Self-assessment is not evidence — record nothing.
        guard !outcome.selfAssessed else { return state }

        var next = state
        let now = outcome.answeredAt

        next.seenCount += 1
        next.lastSeenAt = now
        if next.firstSeenAt == nil { next.firstSeenAt = now }

        if outcome.correct {
            next.correctCount += 1
            next.streak += 1
            next.bestStreak = max(next.bestStreak, next.streak)
            next.ease = min(SkillState.maxEase, next.ease + 0.1)
            next.box = min(SkillState.maxBox, next.box + 1)
            next.perceivedDifficulty = max(0, next.perceivedDifficulty - 0.08)

            switch next.box {
            case 1: next.intervalDays = 1
            case 2: next.intervalDays = 3
            default:
                // Guard the zero case: an item promoted straight past box 2
                // with a 0-day interval would otherwise stay at 0 forever.
                let grown = (next.intervalDays * next.ease).rounded()
                next.intervalDays = min(SkillState.maxIntervalDays, grown > 0 ? grown : 1)
            }
            next.nextReviewAt = now.addingTimeInterval(next.intervalDays * 86_400)
        } else {
            next.wrongCount += 1
            next.streak = 0
            next.ease = max(SkillState.minEase, next.ease - 0.25)
            // Drop two boxes rather than resetting to zero: a lapse on a
            // well-known item is not the same as never having learned it.
            next.box = max(0, next.box - 2)
            next.intervalDays = 0
            next.perceivedDifficulty = min(1, next.perceivedDifficulty + 0.15)
            next.nextReviewAt = now.addingTimeInterval(SkillState.relearnDelay)
        }

        next.mastery = computeMastery(next)
        next.recentExerciseTypes = ([outcome.exerciseType] + next.recentExerciseTypes)
            .prefix(SkillState.recentTypeMemory)
            .map { $0 }
        return next
    }

    /// Roll per-skill states up into one number for an item.
    ///
    /// Only skills that have actually been practised count. Averaging in
    /// untouched skills as zero would make every item look permanently weak
    /// and would make the home-screen mastery figure meaningless.
    public static func aggregate(_ states: [Skill: SkillState]) -> Double {
        let practised = states.filter { $0.value.seenCount > 0 }
        guard !practised.isEmpty else { return 0 }
        let totalWeight = practised.keys.reduce(0.0) { $0 + $1.masteryWeight }
        guard totalWeight > 0 else { return 0 }
        let weighted = practised.reduce(0.0) { $0 + $1.key.masteryWeight * $1.value.mastery }
        return max(0, min(1, weighted / totalWeight))
    }

    /// Human-readable mastery bands, used for badges and filtering.
    public static func level(_ mastery: Double, seenCount: Int) -> MasteryLevel {
        if seenCount == 0 { return .new }
        if mastery < 0.3 { return .weak }
        if mastery < 0.6 { return .learning }
        if mastery < 0.85 { return .good }
        return .mastered
    }
}

public enum MasteryLevel: String, Codable, CaseIterable, Sendable, Hashable {
    case new, weak, learning, good, mastered
}
