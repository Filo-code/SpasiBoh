import Testing
import Foundation
@testable import SpasiBohCore

/// Shared fixtures. Loaded once — decoding 600 concepts per test is slow enough
/// to be noticeable and none of these tests mutate the content.
enum Fixtures {
    static let content: ContentStore = {
        do { return try ContentStore.load() }
        catch { fatalError("Bundled content failed to load: \(error)") }
    }()
    static let now = Date(timeIntervalSince1970: 1_700_000_000)
}

@Suite("Scheduler")
struct SchedulerTests {

    private let now = Fixtures.now

    private func scope(_ id: String, _ direction: Direction = .itToRu) -> ItemScope {
        ItemScope(direction: direction, kind: .concept, itemID: id)
    }

    private func answering(_ correct: Bool, _ scope: ItemScope, skill: Skill = .recognition,
                           times: Int = 1, at date: Date? = nil, into progress: inout LearnerProgress) {
        for _ in 0..<times {
            progress.record(AnswerOutcome(
                key: scope.key(skill), correct: correct,
                exerciseType: "recognition", answeredAt: date ?? now
            ))
        }
    }

    @Test("An untouched item is new")
    func newItem() {
        #expect(Scheduler.classify(scope("a"), progress: LearnerProgress(), now: now) == .new)
    }

    @Test("A correct answer parks the item until its review date")
    func restingAfterCorrect() {
        var progress = LearnerProgress()
        answering(true, scope("a"), into: &progress)
        #expect(Scheduler.classify(scope("a"), progress: progress, now: now) == .resting)
        // One day later it is due again.
        #expect(Scheduler.classify(scope("a"), progress: progress, now: now.addingTimeInterval(86_401)) == .due)
    }

    @Test("A missed item is due within the same session")
    func missedIsDueSoon() {
        var progress = LearnerProgress()
        answering(true, scope("a"), into: &progress)
        answering(false, scope("a"), into: &progress)
        // The 8-minute relearn delay means it comes back today, not tomorrow.
        #expect(Scheduler.classify(scope("a"), progress: progress, now: now.addingTimeInterval(600)) == .due)
    }

    @Test("A shaky item that is not yet due still counts as weak")
    func weakBucket() {
        var progress = LearnerProgress()
        answering(true, scope("a"), into: &progress)
        answering(false, scope("a"), into: &progress)
        answering(true, scope("a"), at: now.addingTimeInterval(600), into: &progress)
        // Correct answer scheduled it a day out, but the miss is still on record.
        let bucket = Scheduler.classify(scope("a"), progress: progress, now: now.addingTimeInterval(700))
        #expect(bucket == .weak)
    }

    @Test("New material is introduced in order, not at random")
    func newFollowsIntroductionOrder() {
        // The whole point of per-language frequency ranks: a beginner must meet
        // `sì` before `soltanto`.
        let scopes = (0..<100).map { scope("c\($0)") }
        let planned = Scheduler.plan(
            orderedScopes: scopes, progress: LearnerProgress(), now: now,
            count: 10, seed: "order"
        )
        #expect(planned.count == 10)
        let indices = planned.compactMap { item in scopes.firstIndex(of: item.scope) }
        #expect(indices.max()! < 20, "new items came from far down the list: \(indices)")
    }

    @Test("The same seed rebuilds the same plan")
    func deterministic() {
        let scopes = (0..<60).map { scope("c\($0)") }
        let a = Scheduler.plan(orderedScopes: scopes, progress: LearnerProgress(), now: now, count: 12, seed: "s")
        let b = Scheduler.plan(orderedScopes: scopes, progress: LearnerProgress(), now: now, count: 12, seed: "s")
        let c = Scheduler.plan(orderedScopes: scopes, progress: LearnerProgress(), now: now, count: 12, seed: "other")
        #expect(a == b)
        #expect(a != c)
    }

    @Test("Due items dominate once there is history")
    func mixFavoursDue() {
        var progress = LearnerProgress()
        let scopes = (0..<80).map { scope("c\($0)") }
        // 40 items answered a week ago: all long overdue.
        let longAgo = now.addingTimeInterval(-7 * 86_400)
        for s in scopes.prefix(40) { answering(true, s, at: longAgo, into: &progress) }

        let planned = Scheduler.plan(orderedScopes: scopes, progress: progress, now: now, count: 20, seed: "mix")
        let due = planned.filter { $0.bucket == .due }.count
        let new = planned.filter { $0.bucket == .new }.count
        // The mix asks for 50% due and 20% new. Nothing is weak or mastered
        // here, so those quotas go unfilled and backfill hands the slack to
        // due — reviewing what is owed beats padding with material the learner
        // has not earned yet.
        #expect(due >= 10, "due share was \(due)/20")
        #expect(new >= 4, "new share was \(new)/20")
    }

    @Test("A session is never short just because one bucket is empty")
    func backfill() {
        let scopes = (0..<30).map { scope("c\($0)") }
        let planned = Scheduler.plan(orderedScopes: scopes, progress: LearnerProgress(), now: now, count: 20, seed: "fill")
        #expect(planned.count == 20)
        #expect(Set(planned.map(\.id)).count == 20, "an item was scheduled twice")
    }

    @Test("Scheduling nothing yields nothing rather than crashing")
    func empty() {
        #expect(Scheduler.plan(orderedScopes: [], progress: LearnerProgress(), now: now, count: 5, seed: "x").isEmpty)
        #expect(Scheduler.plan(orderedScopes: [scope("a")], progress: LearnerProgress(), now: now, count: 0, seed: "x").isEmpty)
    }
}

@Suite("Exercise generation")
struct ExerciseFactoryTests {

    private let content = Fixtures.content
    private let now = Fixtures.now

    private func factory(speech: Bool = true) -> ExerciseFactory {
        ExerciseFactory(content: content, speechAvailable: speech)
    }

    @Test("Recognition shows the target language and answers in the native one")
    func recognitionDirections() throws {
        var gen = SeededGenerator(seed: 1)
        let concept = try #require(content.concept("privet"))
        let exercise = try #require(factory().conceptExercise(
            concept, direction: .itToRu, progress: LearnerProgress(), using: &gen, forcing: .recognition
        ))
        #expect(exercise.promptText == concept.ru.text)
        #expect(exercise.promptLanguage == .russian)
        #expect(exercise.options.allSatisfy { $0.language == .italian })
        #expect(exercise.options[try #require(exercise.correctOption)].text == concept.it.text)
    }

    @Test("The same content flips cleanly for the other learner")
    func recognitionFlips() throws {
        var gen = SeededGenerator(seed: 1)
        let concept = try #require(content.concept("privet"))
        let exercise = try #require(factory().conceptExercise(
            concept, direction: .ruToIt, progress: LearnerProgress(), using: &gen, forcing: .recognition
        ))
        #expect(exercise.promptText == concept.it.text)
        #expect(exercise.promptLanguage == .italian)
        #expect(exercise.options.allSatisfy { $0.language == .russian })
    }

    @Test("No option is visually marked as the correct one")
    func optionsGiveNothingAway() throws {
        // Attaching the transliteration to the right answer alone would make
        // every question answerable without reading a word of it.
        var gen = SeededGenerator(seed: 4)
        var progress = LearnerProgress()
        for concept in content.concepts.prefix(40) {
            for kind in [ExerciseKind.recognition, .recall, .listening] {
                guard let exercise = factory().conceptExercise(
                    concept, direction: .itToRu, progress: progress, using: &gen, forcing: kind
                ) else { continue }
                #expect(exercise.options.allSatisfy { $0.subtitle == nil })
                #expect(Set(exercise.options.map(\.text)).count == exercise.options.count)
            }
            progress.record(AnswerOutcome(key: ItemScope(direction: .itToRu, kind: .concept, itemID: concept.id)
                .key(.recognition), correct: true, exerciseType: "recognition", answeredAt: now))
        }
    }

    @Test("Multiple choice always has four distinct options and one right answer")
    func optionCount() throws {
        var gen = SeededGenerator(seed: 2)
        for concept in content.concepts.prefix(60) {
            guard let exercise = factory().conceptExercise(
                concept, direction: .itToRu, progress: LearnerProgress(), using: &gen, forcing: .recognition
            ) else { continue }
            #expect(exercise.options.count == 4)
            let correct = try #require(exercise.correctOption)
            #expect(exercise.isCorrect(option: correct))
            #expect(!exercise.isCorrect(option: (correct + 1) % 4))
        }
    }

    @Test("Spelling tiles are exactly the letters of the word")
    func spellingTiles() throws {
        var gen = SeededGenerator(seed: 3)
        let concept = try #require(content.concepts.first { $0.ru.text.count >= 5 })
        var progress = LearnerProgress()
        let scope = ItemScope(direction: .itToRu, kind: .concept, itemID: concept.id)
        // Spelling only unlocks once there is some recognition to build on.
        for _ in 0..<6 {
            progress.record(AnswerOutcome(key: scope.key(.recognition), correct: true,
                                          exerciseType: "recognition", answeredAt: now))
        }
        let exercise = try #require(factory().conceptExercise(
            concept, direction: .itToRu, progress: progress, using: &gen, forcing: .spelling
        ))
        #expect(exercise.blocks.sorted() == TextNormalization.spellingTiles(concept.ru.text).sorted())
        #expect(exercise.isCorrect(text: concept.ru.text))
        #expect(!exercise.isCorrect(text: String(concept.ru.text.dropLast())))
    }

    @Test("Assembling a sentence accepts the blocks in the right order only")
    func sentenceBuild() throws {
        var gen = SeededGenerator(seed: 5)
        let sentence = try #require(content.sentences.first { $0.wordCount(in: .russian) >= 3 })
        let exercise = try #require(factory().sentenceExercise(
            sentence, direction: .itToRu, progress: LearnerProgress(), using: &gen, forcing: .sentenceBuild
        ))
        let words = sentence.ru.text.split(whereSeparator: \.isWhitespace).map(String.init)
        #expect(exercise.isCorrect(text: words.joined(separator: " ")))
        #expect(!exercise.isCorrect(text: words.reversed().joined(separator: " ")))
        #expect(Set(words).isSubset(of: Set(exercise.blocks)))
    }

    @Test("Gap-fill blanks a real word, not a particle")
    func sentenceGap() throws {
        var gen = SeededGenerator(seed: 6)
        let sentence = try #require(content.sentences.first { $0.wordCount(in: .russian) >= 4 })
        let exercise = try #require(factory().sentenceExercise(
            sentence, direction: .itToRu, progress: LearnerProgress(), using: &gen, forcing: .sentenceGap
        ))
        #expect(exercise.promptText.contains("___"))
        let longest = sentence.ru.text.split(whereSeparator: \.isWhitespace).map(String.init)
            .max { $0.count < $1.count }
        #expect(exercise.options[try #require(exercise.correctOption)].text == longest)
    }

    @Test("Refused microphone permission removes speaking exercises entirely")
    func noSpeechNoPronunciation() {
        // Better than offering an exercise that cannot be completed (§90).
        var gen = SeededGenerator(seed: 7)
        let progress = LearnerProgress()
        var produced: Set<ExerciseKind> = []
        for concept in content.concepts.prefix(80) {
            if let exercise = factory(speech: false).conceptExercise(
                concept, direction: .itToRu, progress: progress, using: &gen
            ) {
                produced.insert(exercise.kind)
            }
        }
        #expect(!produced.contains(.pronunciation))
        #expect(!produced.isEmpty)
    }

    @Test("Harder formats take over as an item becomes known")
    func weightingProgresses() {
        // Recognition outweighs recall for a new item, and the order reverses
        // once the item is well known — that is the §28 progression.
        #expect(ExerciseFactory.weight(.recognition, mastery: 0) > ExerciseFactory.weight(.recall, mastery: 0))
        #expect(ExerciseFactory.weight(.recall, mastery: 1) > ExerciseFactory.weight(.recognition, mastery: 1))
        #expect(ExerciseFactory.weight(.recognition, mastery: 1) > 0, "recognition must never vanish")
    }

    @Test("Cyrillic warm-up uses confusable letters as distractors")
    func letterDistractors() throws {
        var gen = SeededGenerator(seed: 8)
        let letter = try #require(content.letters.first { !$0.confusableWith.isEmpty && $0.hasSound })
        let exercise = try #require(factory().warmupExercise(
            .letter(letter), direction: .itToRu, progress: LearnerProgress(), using: &gen, forcing: .letterRecognize
        ))
        let confusableUppercase = Set(content.letters.filter { letter.confusableWith.contains($0.id) }.map(\.upper))
        let shown = Set(exercise.options.map(\.text))
        #expect(!shown.intersection(confusableUppercase).isEmpty, "no hard distractor was used")
    }

    @Test("Answer checking is direction-aware, including the ё/е fold")
    func normalizationIsDirectionAware() throws {
        // Web V1 normalized both sides as Russian and skipped normalization in
        // the spelling exercise entirely, so ё failed there and passed elsewhere.
        var gen = SeededGenerator(seed: 9)
        let concept = try #require(content.concepts.first { $0.ru.text.contains("ё") })
        var progress = LearnerProgress()
        let scope = ItemScope(direction: .itToRu, kind: .concept, itemID: concept.id)
        for _ in 0..<6 {
            progress.record(AnswerOutcome(key: scope.key(.recognition), correct: true,
                                          exerciseType: "recognition", answeredAt: now))
        }
        let exercise = try #require(factory().conceptExercise(
            concept, direction: .itToRu, progress: progress, using: &gen, forcing: .spelling
        ))
        #expect(exercise.isCorrect(text: concept.ru.text.replacingOccurrences(of: "ё", with: "е")))
    }
}

@Suite("Session building")
struct SessionBuilderTests {

    private let builder = SessionBuilder(content: Fixtures.content)
    private let now = Fixtures.now

    @Test("A first daily session is full, and starts with the warm-up")
    func firstSession() {
        let session = builder.build(mode: .daily, direction: .itToRu, progress: LearnerProgress(), now: now)
        #expect(session.exercises.count >= 12, "only \(session.exercises.count) exercises")
        #expect(session.exercises.prefix(SessionBuilder.warmupLead).allSatisfy { $0.key.kind == .warmup })
    }

    @Test("Both directions build a usable session")
    func bothDirections() {
        for direction in Direction.allCases {
            let session = builder.build(mode: .daily, direction: direction, progress: LearnerProgress(), now: now)
            #expect(!session.isEmpty, "\(direction) produced nothing")
            #expect(session.exercises.allSatisfy { $0.key.direction == direction })
        }
    }

    @Test("The same day rebuilds the same session")
    func stableWithinADay() {
        let progress = LearnerProgress()
        let a = builder.build(mode: .daily, direction: .itToRu, progress: progress, now: now)
        let b = builder.build(mode: .daily, direction: .itToRu, progress: progress, now: now)
        #expect(a.exercises.map(\.id) == b.exercises.map(\.id))
    }

    @Test("Each training mode produces only its own formats")
    func modesAreHonest() {
        var progress = LearnerProgress()
        // Give the learner some history so harder formats unlock.
        for concept in Fixtures.content.concepts.prefix(50) {
            let scope = ItemScope(direction: .itToRu, kind: .concept, itemID: concept.id)
            for _ in 0..<4 {
                progress.record(AnswerOutcome(key: scope.key(.recognition), correct: true,
                                              exerciseType: "recognition", answeredAt: now))
            }
        }
        for mode in [TrainingMode.vocabulary, .listening, .pronunciation, .sentences] {
            let session = builder.build(mode: mode, direction: .itToRu, progress: progress, now: now)
            #expect(!session.isEmpty, "\(mode) produced nothing")
            let allowed = Set(mode.allowedKinds ?? ExerciseKind.allCases)
            #expect(session.exercises.allSatisfy { allowed.contains($0.kind) }, "\(mode) leaked a format")
        }
    }

    @Test("Mistake review shows only things actually missed, in this direction")
    func mistakesOnly() {
        var progress = LearnerProgress()
        let missed = Array(Fixtures.content.concepts.prefix(5))
        for concept in missed {
            let scope = ItemScope(direction: .itToRu, kind: .concept, itemID: concept.id)
            progress.record(AnswerOutcome(key: scope.key(.recognition), correct: false,
                                          exerciseType: "recognition", answeredAt: now))
        }
        // A miss in the *other* direction must not appear here.
        let otherScope = ItemScope(direction: .ruToIt, kind: .concept, itemID: Fixtures.content.concepts[80].id)
        progress.record(AnswerOutcome(key: otherScope.key(.recognition), correct: false,
                                      exerciseType: "recognition", answeredAt: now))

        let session = builder.build(mode: .mistakes, direction: .itToRu, progress: progress, now: now)
        #expect(!session.isEmpty)
        #expect(Set(session.exercises.map(\.key.itemID)).isSubset(of: Set(missed.map(\.id))))
    }

    @Test("Nothing missed means nothing to review")
    func mistakesEmpty() {
        let session = builder.build(mode: .mistakes, direction: .itToRu, progress: LearnerProgress(), now: now)
        #expect(session.isEmpty)
    }

    @Test("The warm-up steps aside once the script is known")
    func warmupRetires() {
        var progress = LearnerProgress()
        var date = now
        for scope in builder.warmupScopes(direction: .itToRu) {
            for skill in [Skill.recognition, .recall] {
                var state = SkillState()
                var at = date
                for _ in 0..<8 {
                    state = Mastery.apply(AnswerOutcome(key: scope.key(skill), correct: true,
                                                        exerciseType: "x", answeredAt: at), to: state)
                    at = state.nextReviewAt
                }
                progress[scope.key(skill)] = state
            }
            date = date.addingTimeInterval(1)
        }
        let session = builder.build(mode: .daily, direction: .itToRu, progress: progress, now: now)
        #expect(!session.exercises.contains { $0.key.kind == .warmup })
    }
}

@Suite("Progress bookkeeping")
struct LearnerProgressTests {

    private let now = Fixtures.now
    private let scope = ItemScope(direction: .itToRu, kind: .concept, itemID: "privet")

    @Test("Recording an answer earns XP only when it is right")
    func xp() {
        var progress = LearnerProgress()
        #expect(progress.record(AnswerOutcome(key: scope.key(.recall), correct: false,
                                              exerciseType: "recall", answeredAt: now)) == 0)
        #expect(progress.record(AnswerOutcome(key: scope.key(.recall), correct: true,
                                              exerciseType: "recall", answeredAt: now)) > 0)
    }

    @Test("Production is worth more XP than recognition")
    func xpFavoursHarderSkills() {
        var a = LearnerProgress(), b = LearnerProgress()
        let recognition = a.record(AnswerOutcome(key: scope.key(.recognition), correct: true,
                                                 exerciseType: "recognition", answeredAt: now))
        let recall = b.record(AnswerOutcome(key: scope.key(.recall), correct: true,
                                            exerciseType: "recall", answeredAt: now))
        #expect(recall > recognition)
    }

    @Test("A self-assessed answer earns nothing and records nothing")
    func selfAssessedIsFree() {
        var progress = LearnerProgress()
        #expect(progress.record(AnswerOutcome(key: scope.key(.pronunciation), correct: true,
                                              exerciseType: "pronunciation", answeredAt: now,
                                              selfAssessed: true)) == 0)
        #expect(progress[scope.key(.pronunciation)].seenCount == 0)
    }

    @Test("Studying on consecutive days builds a streak")
    func streak() {
        var progress = LearnerProgress()
        let day = 86_400.0
        progress.registerStudyDay(now)
        #expect(progress.currentStreak == 1)
        progress.registerStudyDay(now)                                  // same day again
        #expect(progress.currentStreak == 1)
        progress.registerStudyDay(now.addingTimeInterval(day))
        #expect(progress.currentStreak == 2)
        progress.registerStudyDay(now.addingTimeInterval(4 * day))      // skipped days
        #expect(progress.currentStreak == 1)
        #expect(progress.bestStreak == 2)
    }

    @Test("A broken streak reads as zero without being rewritten")
    func brokenStreakIsHonest() {
        var progress = LearnerProgress()
        progress.registerStudyDay(now)
        #expect(progress.effectiveStreak(on: now.addingTimeInterval(86_400)) == 1)
        #expect(progress.effectiveStreak(on: now.addingTimeInterval(3 * 86_400)) == 0)
        #expect(progress.currentStreak == 1, "the stored value must not be silently mutated on read")
    }

    @Test("Progress survives a round trip through JSON")
    func codableRoundTrip() throws {
        var progress = LearnerProgress()
        progress.record(AnswerOutcome(key: scope.key(.recall), correct: true,
                                      exerciseType: "recall", answeredAt: now))
        progress.registerStudyDay(now)
        progress.unlockedTips.insert("tip_stress")

        let data = try JSONEncoder().encode(progress)
        let restored = try JSONDecoder().decode(LearnerProgress.self, from: data)
        #expect(restored == progress)
    }

    @Test("A file written by an older version still loads")
    func forwardCompatibleDecoding() throws {
        // Every field defaults, so a new release can add one without a migration.
        let minimal = Data(#"{"version":1,"xp":42}"#.utf8)
        let restored = try JSONDecoder().decode(LearnerProgress.self, from: minimal)
        #expect(restored.xp == 42)
        #expect(restored.states.isEmpty)
        #expect(restored.currentStreak == 0)
    }

    @Test("The two directions keep separate books")
    func directionsAreSeparate() {
        var progress = LearnerProgress()
        let forward = ItemScope(direction: .itToRu, kind: .concept, itemID: "privet")
        let back = ItemScope(direction: .ruToIt, kind: .concept, itemID: "privet")
        for _ in 0..<6 {
            progress.record(AnswerOutcome(key: forward.key(.recognition), correct: true,
                                          exerciseType: "recognition", answeredAt: now))
        }
        #expect(progress.mastery(of: forward) > 0)
        #expect(progress.mastery(of: back) == 0)
        #expect(progress.keys(in: .ruToIt).isEmpty)
    }

    @Test("Progress keys round-trip through their string form")
    func keyEncoding() throws {
        let key = ProgressKey(direction: .ruToIt, kind: .sentence, itemID: "bar_un_caffe", skill: .sentenceUsage)
        #expect(ProgressKey(key.description) == key)
        #expect(ProgressKey("nonsense") == nil)
        #expect(ProgressKey("it-ru|concept||recall") == nil)
    }
}

@Suite("Content validation")
struct ContentValidationTests {

    @Test("The bundled content passes every validation rule")
    func bundledContentIsValid() {
        // This is the gate: invalid content fails the build rather than
        // shipping as an exercise with no correct answer (§92).
        let problems = ContentValidator.validate(Fixtures.content)
        let report = problems.map(\.description).joined(separator: "\n")
        #expect(problems.isEmpty, "\(problems.count) problem(s):\n\(report)")
    }

    @Test("Both learners have a warm-up and a scenario set")
    func bothDirectionsHaveContent() {
        for direction in Direction.allCases {
            #expect(!Fixtures.content.warmupItems(for: direction).isEmpty, "\(direction) has no warm-up")
            #expect(!Fixtures.content.scenarios(for: direction).isEmpty, "\(direction) has no scenarios")
            #expect(!Fixtures.content.tips(for: direction).isEmpty, "\(direction) has no tips")
            #expect(!Fixtures.content.cultureCards(for: direction).isEmpty, "\(direction) has no culture cards")
        }
    }

    @Test("The validator actually catches what it claims to")
    func validatorRejectsBadContent() {
        // A validator nobody has seen fail is a validator that does nothing.
        let broken = ContentStore(
            concepts: [
                Concept(
                    id: "bad id 🙂",
                    it: LanguageSide(text: "casa", pronunciation: "casa", frequencyRank: 1),
                    ru: LanguageSide(text: "дом", stressed: "до́мик", frequencyRank: 1),
                    category: .house, difficulty: 9
                )
            ],
            sentences: [], letters: [], patterns: [], scenarios: []
        )
        let problems = ContentValidator.validate(broken).map(\.detail).joined(separator: " | ")
        #expect(problems.contains("id contains characters"))
        #expect(problems.contains("only restates the word"))
        #expect(problems.contains("no transliteration"))
        #expect(problems.contains("does not match text"))
        #expect(problems.contains("difficulty"))
        #expect(problems.contains("too few Italian patterns"))
    }
}
