import Testing
import Foundation
@testable import SpasiBohCore

@Suite("Mastery and scheduling")
struct MasteryTests {

    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    private func answer(
        _ correct: Bool,
        skill: Skill = .recognition,
        at date: Date? = nil,
        type: String = "recognition",
        selfAssessed: Bool = false
    ) -> AnswerOutcome {
        AnswerOutcome(
            key: ProgressKey(direction: .itToRu, kind: .concept, itemID: "food_water", skill: skill),
            correct: correct,
            exerciseType: type,
            answeredAt: date ?? now,
            selfAssessed: selfAssessed
        )
    }

    @Test("A new item starts at zero mastery")
    func newItem() {
        let state = SkillState()
        #expect(state.isNew)
        #expect(Mastery.computeMastery(state) == 0)
        #expect(Mastery.level(0, seenCount: 0) == .new)
    }

    @Test("First correct answer schedules one day out")
    func firstCorrect() {
        let state = Mastery.apply(answer(true), to: SkillState())
        #expect(state.seenCount == 1)
        #expect(state.correctCount == 1)
        #expect(state.streak == 1)
        #expect(state.box == 1)
        #expect(state.intervalDays == 1)
        #expect(state.ease == 2.6)
        #expect(state.nextReviewAt == now.addingTimeInterval(86_400))
    }

    @Test("Intervals grow 1 → 3 → multiplicative")
    func intervalGrowth() {
        var state = SkillState()
        state = Mastery.apply(answer(true), to: state)
        #expect(state.intervalDays == 1)
        state = Mastery.apply(answer(true), to: state)
        #expect(state.intervalDays == 3)
        state = Mastery.apply(answer(true), to: state)
        // box 3: round(3 * ease). ease is 2.8 by now (2.5 + 0.1 × 3, capped).
        #expect(state.intervalDays == (3 * state.ease).rounded())
        #expect(state.box == 3)
    }

    @Test("Interval never exceeds the cap")
    func intervalCap() {
        var state = SkillState()
        for _ in 0..<40 { state = Mastery.apply(answer(true), to: state) }
        #expect(state.intervalDays <= SkillState.maxIntervalDays)
    }

    @Test("A miss reschedules within the same session, not tomorrow")
    func missRelearnsToday() {
        // This is the mechanism behind "no lives" (§18): getting it wrong buys
        // another attempt in ~8 minutes, not a lockout.
        var state = SkillState()
        state = Mastery.apply(answer(true), to: state)
        state = Mastery.apply(answer(false), to: state)
        #expect(state.streak == 0)
        #expect(state.intervalDays == 0)
        #expect(state.nextReviewAt == now.addingTimeInterval(SkillState.relearnDelay))
        #expect(state.wrongCount == 1)
    }

    @Test("A miss drops two boxes, not all the way to zero")
    func missDropsTwoBoxes() {
        // A lapse on a well-known item is not the same as never having learned
        // it, so the item keeps some of its progress.
        var state = SkillState()
        for _ in 0..<4 { state = Mastery.apply(answer(true), to: state) }
        #expect(state.box == 4)
        state = Mastery.apply(answer(false), to: state)
        #expect(state.box == 2)
    }

    @Test("Ease stays inside its bounds")
    func easeBounds() {
        var state = SkillState()
        for _ in 0..<20 { state = Mastery.apply(answer(true), to: state) }
        #expect(state.ease == SkillState.maxEase)
        for _ in 0..<20 { state = Mastery.apply(answer(false), to: state) }
        #expect(state.ease == SkillState.minEase)
    }

    @Test("Three correct answers do not equal mastery")
    func luckIsNotMastery() {
        // The confidence damper exists so a short lucky run cannot mark an item
        // known. 3/3 is encouraging, not mastery.
        var state = SkillState()
        for _ in 0..<3 { state = Mastery.apply(answer(true), to: state) }
        #expect(state.accuracy == 1.0)
        #expect(!state.isMastered)
        #expect(state.mastery < 0.85)
    }

    @Test("Sustained correct answers do reach mastery")
    func sustainedCorrectReachesMastery() {
        var state = SkillState()
        var date = now
        for _ in 0..<8 {
            state = Mastery.apply(answer(true, at: date), to: state)
            date = state.nextReviewAt
        }
        #expect(state.isMastered)
        #expect(Mastery.level(state.mastery, seenCount: state.seenCount) == .mastered)
    }

    @Test("An item with misses and a broken streak counts as weak")
    func weakDetection() {
        var state = SkillState()
        state = Mastery.apply(answer(true), to: state)
        state = Mastery.apply(answer(false), to: state)
        #expect(state.isWeak)
    }

    @Test("Self-assessed answers change nothing")
    func selfAssessedIsNotEvidence() {
        // An unverified "I said it right" must not move the schedule.
        let before = Mastery.apply(answer(true), to: SkillState())
        let after = Mastery.apply(answer(true, selfAssessed: true), to: before)
        #expect(after == before)
    }

    @Test("Recent exercise types are remembered, most recent first, and capped")
    func recentTypes() {
        var state = SkillState()
        for type in ["a", "b", "c", "d", "e"] {
            state = Mastery.apply(answer(true, type: type), to: state)
        }
        #expect(state.recentExerciseTypes.first == "e")
        #expect(state.recentExerciseTypes.count == SkillState.recentTypeMemory)
    }

    @Test("Due only once the review date has passed")
    func dueness() {
        let state = Mastery.apply(answer(true), to: SkillState())
        #expect(!state.isDue(at: now))
        #expect(state.isDue(at: now.addingTimeInterval(86_400 + 1)))
    }

    @Test("A never-seen item is not due")
    func unseenIsNotDue() {
        // Unseen items belong in the "new" bucket, not the review queue.
        #expect(!SkillState().isDue(at: now))
    }

    // MARK: - The §27 requirement

    @Test("Recognition and recall are tracked independently")
    func directionsAreIndependent() {
        // Knowing вода → acqua says nothing about producing вода from acqua.
        var recognition = SkillState()
        var recall = SkillState()
        for _ in 0..<6 { recognition = Mastery.apply(answer(true, skill: .recognition), to: recognition) }
        for _ in 0..<6 { recall = Mastery.apply(answer(false, skill: .recall), to: recall) }

        #expect(recognition.mastery > 0.5)
        #expect(recall.mastery < 0.2)
        #expect(recognition.isMastered)
        #expect(recall.isWeak)
    }

    @Test("An item is not mastered on recognition alone")
    func aggregateResistsRecognitionOnly() {
        var recognition = SkillState()
        for _ in 0..<10 { recognition = Mastery.apply(answer(true, skill: .recognition), to: recognition) }
        let aggregate = Mastery.aggregate([.recognition: recognition])
        // Recognition is the easy half; on its own it must not read as mastery
        // of the concept.
        #expect(aggregate > 0)

        var recall = SkillState()
        for _ in 0..<10 { recall = Mastery.apply(answer(false, skill: .recall), to: recall) }
        let withWeakRecall = Mastery.aggregate([.recognition: recognition, .recall: recall])
        #expect(withWeakRecall < aggregate)
    }

    @Test("Unpractised skills do not drag the aggregate down")
    func aggregateIgnoresUnpractised() {
        var recognition = SkillState()
        for _ in 0..<6 { recognition = Mastery.apply(answer(true, skill: .recognition), to: recognition) }
        let only = Mastery.aggregate([.recognition: recognition])
        let padded = Mastery.aggregate([.recognition: recognition, .pronunciation: SkillState()])
        #expect(only == padded)
    }

    @Test("Aggregate of nothing is zero")
    func emptyAggregate() {
        #expect(Mastery.aggregate([:]) == 0)
        #expect(Mastery.aggregate([.recall: SkillState()]) == 0)
    }
}

@Suite("Seeded randomness")
struct RandomTests {

    @Test("The same seed produces the same sequence")
    func deterministic() {
        var a = SeededGenerator(seed: 42)
        var b = SeededGenerator(seed: 42)
        let left = (0..<20).map { _ in a.nextDouble() }
        let right = (0..<20).map { _ in b.nextDouble() }
        #expect(left == right)
    }

    @Test("Different seeds diverge")
    func differentSeeds() {
        var a = SeededGenerator(seed: 1)
        var b = SeededGenerator(seed: 2)
        #expect(a.nextDouble() != b.nextDouble())
    }

    @Test("String seeding is stable across processes")
    func stringSeeding() {
        // Must not use String.hashValue — Swift seeds its hasher randomly per
        // process, so that would give a different session on every launch.
        #expect(SeededGenerator.fnv1a("session-1") == SeededGenerator.fnv1a("session-1"))
        #expect(SeededGenerator.fnv1a("session-1") != SeededGenerator.fnv1a("session-2"))
    }

    @Test("Doubles stay in [0,1)")
    func doubleRange() {
        var gen = SeededGenerator(seed: 7)
        for _ in 0..<500 {
            let value = gen.nextDouble()
            #expect(value >= 0 && value < 1)
        }
    }

    @Test("Bounded integers stay in range")
    func intRange() {
        var gen = SeededGenerator(seed: 9)
        for _ in 0..<500 {
            let value = gen.nextInt(below: 10)
            #expect(value >= 0 && value < 10)
        }
        #expect(gen.nextInt(below: 0) == 0)
    }

    @Test("Shuffling permutes rather than losing elements")
    func shuffle() {
        var gen = SeededGenerator(seed: 3)
        let input = Array(1...20)
        let shuffled = input.shuffled(using: &gen)
        #expect(shuffled.sorted() == input)
        #expect(shuffled != input)
    }

    @Test("Sampling never returns more than it was asked for")
    func sample() {
        var gen = SeededGenerator(seed: 5)
        let input = Array(1...10)
        #expect(input.sample(3, using: &gen).count == 3)
        #expect(input.sample(0, using: &gen).isEmpty)
        #expect(input.sample(99, using: &gen).count == 10)
        #expect(Set(input.sample(4, using: &gen)).count == 4)  // no repeats
    }

    @Test("Weighted choice honours the weights")
    func weightedChoice() {
        var gen = SeededGenerator(seed: 11)
        let items = ["never", "always"]
        var alwaysCount = 0
        for _ in 0..<200 {
            let pick = items.weightedChoice(using: &gen) { $0 == "always" ? 1.0 : 0.0 }
            if pick == "always" { alwaysCount += 1 }
        }
        #expect(alwaysCount == 200)
    }

    @Test("Weighted choice reports all-zero weights instead of guessing")
    func weightedChoiceAllZero() {
        var gen = SeededGenerator(seed: 13)
        #expect([1, 2, 3].weightedChoice(using: &gen) { _ in 0 } == nil)
        #expect([Int]().weightedChoice(using: &gen) { _ in 1 } == nil)
    }
}
