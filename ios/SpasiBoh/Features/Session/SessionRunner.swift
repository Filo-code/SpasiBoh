import Foundation
import SwiftUI
import SpasiBohCore

/// Drives one session: which question is showing, what was answered, what is
/// still owed.
///
/// The queue is mutable because a wrong answer **requeues the exercise at the
/// back** rather than ending anything. That is what "no lives, mistakes just
/// come back" (§18) means in practice, and it has to live here rather than in
/// the scheduler — the 8-minute relearn interval is longer than a session.
@MainActor
@Observable
final class SessionRunner {
    enum Phase: Equatable {
        case answering
        /// Answer submitted, feedback showing, waiting for "next".
        case feedback(correct: Bool, detail: String?)
        case finished
    }

    let mode: TrainingMode
    let direction: Direction
    private(set) var queue: [Exercise]
    private(set) var index = 0
    private(set) var phase: Phase = .answering

    private(set) var answered = 0
    private(set) var correct = 0
    private(set) var xpEarned = 0
    private(set) var missedItems: Set<String> = []
    let startedAt: Date

    /// Exercises requeued after a miss, so one item cannot ping-pong forever.
    private var requeueCount: [String: Int] = [:]
    private static let maxRequeues = 1

    init(session: Session, now: Date = Date()) {
        self.mode = session.mode
        self.direction = session.direction
        self.queue = session.exercises
        self.startedAt = now
    }

    var current: Exercise? {
        index < queue.count ? queue[index] : nil
    }

    /// Progress through the *original* length, not the requeued one — a bar
    /// that slides backwards every time you make a mistake is demoralising and
    /// also just wrong.
    var progress: Double {
        guard !queue.isEmpty else { return 1 }
        return min(1, Double(index) / Double(queue.count))
    }

    var isEmpty: Bool { queue.isEmpty }

    /// Fold in an answer. Returns the outcome so the caller can persist it —
    /// the runner deliberately owns no storage.
    func submit(
        correct isCorrect: Bool,
        detail: String? = nil,
        selfAssessed: Bool = false,
        now: Date = Date()
    ) -> AnswerOutcome? {
        guard case .answering = phase, let exercise = current else { return nil }

        phase = .feedback(correct: isCorrect, detail: detail)
        guard !selfAssessed else { return nil }

        answered += 1
        if isCorrect {
            correct += 1
        } else {
            missedItems.insert(exercise.key.itemID)
            let seen = requeueCount[exercise.id, default: 0]
            if seen < Self.maxRequeues {
                requeueCount[exercise.id] = seen + 1
                queue.append(exercise)
            }
        }

        return AnswerOutcome(
            key: exercise.key,
            correct: isCorrect,
            exerciseType: exercise.kind.rawValue,
            answeredAt: now,
            selfAssessed: false
        )
    }

    func addXP(_ amount: Int) { xpEarned += amount }

    func advance() {
        index += 1
        phase = index < queue.count ? .answering : .finished
    }

    /// Skipping is allowed and is recorded as a miss — pretending a skipped
    /// item was never shown would let the learner quietly avoid the hard ones
    /// forever while the mastery figure kept rising.
    func skip(now: Date = Date()) -> AnswerOutcome? {
        let outcome = submit(correct: false, detail: nil, now: now)
        return outcome
    }

    func record(now: Date = Date()) -> SessionRecord {
        SessionRecord(
            id: UUID().uuidString,
            direction: direction,
            startedAt: startedAt,
            finishedAt: now,
            answered: answered,
            correct: correct,
            xpEarned: xpEarned
        )
    }

    var accuracy: Double {
        answered == 0 ? 0 : Double(correct) / Double(answered)
    }
}
