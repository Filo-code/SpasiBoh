import Foundation

/// What the learner asked for.
public enum TrainingMode: String, Codable, CaseIterable, Sendable, Hashable {
    /// The mixed daily session: warm-up, then words, then sentences.
    case daily
    /// Script/orthography drill only.
    case warmup
    case vocabulary
    case listening
    case pronunciation
    /// Native → target production only.
    case translation
    case sentences
    /// Only items that have actually been missed.
    case mistakes

    /// Formats this mode is allowed to produce. `nil` means "whatever fits",
    /// which is what makes the daily session varied.
    var allowedKinds: [ExerciseKind]? {
        switch self {
        case .daily, .mistakes: nil
        case .warmup: [.letterSound, .letterRecognize, .patternSound, .minimalPair]
        case .vocabulary: [.recognition, .recall, .spelling]
        case .listening: [.listening, .minimalPair]
        case .pronunciation: [.pronunciation]
        case .translation: [.recall, .sentenceBuild]
        case .sentences: [.sentenceBuild, .sentenceGap, .sentenceReply, .recognition]
        }
    }
}

/// A built session, ready to be run. Immutable — answering does not mutate it,
/// it produces outcomes that the progress store folds in.
public struct Session: Sendable, Identifiable, Hashable {
    public let id: String
    public let direction: Direction
    public let mode: TrainingMode
    public let exercises: [Exercise]
    public let createdAt: Date

    public init(id: String, direction: Direction, mode: TrainingMode, exercises: [Exercise], createdAt: Date) {
        self.id = id
        self.direction = direction
        self.mode = mode
        self.exercises = exercises
        self.createdAt = createdAt
    }

    public var isEmpty: Bool { exercises.isEmpty }
}

/// Assembles sessions from content, progress and a schedule.
public struct SessionBuilder: Sendable {
    public let content: ContentStore
    public var speechAvailable: Bool

    public init(content: ContentStore, speechAvailable: Bool = true) {
        self.content = content
        self.speechAvailable = speechAvailable
    }

    /// The daily session length. Ten to fifteen minutes of work — long enough
    /// to be worth opening the app, short enough to finish on a commute.
    public static let defaultLength = 18
    /// How many warm-up questions lead a daily session, while the script is
    /// still shaky. It is a warm-up, not a lesson.
    public static let warmupLead = 4

    public func build(
        mode: TrainingMode,
        direction: Direction,
        progress: LearnerProgress,
        now: Date = Date(),
        length: Int = SessionBuilder.defaultLength,
        seed: String? = nil
    ) -> Session {
        let seed = seed ?? "\(direction.rawValue)-\(mode.rawValue)-\(LearnerProgress.dayString(now))"
        var generator = SeededGenerator(seed: seed)
        let factory = ExerciseFactory(content: content, speechAvailable: speechAvailable)

        let exercises: [Exercise] = switch mode {
        case .daily:
            dailyExercises(direction: direction, progress: progress, now: now, length: length,
                           factory: factory, seed: seed, generator: &generator)
        case .mistakes:
            mistakeExercises(direction: direction, progress: progress, now: now, length: length,
                             factory: factory, generator: &generator)
        default:
            modeExercises(mode: mode, direction: direction, progress: progress, now: now, length: length,
                          factory: factory, seed: seed, generator: &generator)
        }

        return Session(id: seed, direction: direction, mode: mode, exercises: exercises, createdAt: now)
    }

    // MARK: - Daily

    private func dailyExercises(
        direction: Direction,
        progress: LearnerProgress,
        now: Date,
        length: Int,
        factory: ExerciseFactory,
        seed: String,
        generator: inout SeededGenerator
    ) -> [Exercise] {
        var result: [Exercise] = []

        // Warm-up leads, but only while it is still needed. Drilling the
        // alphabet at 95% every day is filler, and filler is what makes people
        // stop opening the app.
        let warmupScopes = warmupScopes(direction: direction)
        let warmupMastery = averageMastery(of: warmupScopes, in: progress)
        if warmupMastery < 0.8, !warmupScopes.isEmpty {
            let planned = Scheduler.plan(
                orderedScopes: warmupScopes, progress: progress, now: now,
                count: Self.warmupLead, seed: seed + "-warmup"
            )
            result += planned.compactMap { factory.exercise(for: $0, progress: progress, using: &generator) }
        }

        let remaining = max(0, length - result.count)
        // Words before sentences: a sentence built from words you do not know
        // is a memory test, not a language exercise.
        let conceptCount = Int(Double(remaining) * 0.6)
        let sentenceCount = remaining - conceptCount

        result += plannedExercises(
            scopes: conceptScopes(direction: direction), count: conceptCount,
            direction: direction, progress: progress, now: now,
            factory: factory, seed: seed + "-concepts", generator: &generator
        )
        result += plannedExercises(
            scopes: sentenceScopes(direction: direction), count: sentenceCount,
            direction: direction, progress: progress, now: now,
            factory: factory, seed: seed + "-sentences", generator: &generator
        )
        return result
    }

    // MARK: - Single-mode training

    private func modeExercises(
        mode: TrainingMode,
        direction: Direction,
        progress: LearnerProgress,
        now: Date,
        length: Int,
        factory: ExerciseFactory,
        seed: String,
        generator: inout SeededGenerator
    ) -> [Exercise] {
        let scopes: [ItemScope] = switch mode {
        case .warmup: warmupScopes(direction: direction)
        case .sentences: sentenceScopes(direction: direction)
        case .vocabulary, .pronunciation, .translation: conceptScopes(direction: direction)
        case .listening: conceptScopes(direction: direction) + sentenceScopes(direction: direction)
        default: conceptScopes(direction: direction)
        }
        return plannedExercises(
            scopes: scopes, count: length, direction: direction, progress: progress, now: now,
            factory: factory, seed: seed, generator: &generator, allowedKinds: mode.allowedKinds
        )
    }

    // MARK: - Mistakes

    /// Items the learner has actually got wrong, hardest first (§102).
    ///
    /// Scoped to the current direction: having missed `acqua → вода` says
    /// nothing about the reverse, and mixing them would make the review list
    /// dishonest.
    private func mistakeExercises(
        direction: Direction,
        progress: LearnerProgress,
        now: Date,
        length: Int,
        factory: ExerciseFactory,
        generator: inout SeededGenerator
    ) -> [Exercise] {
        let scopes = Set(
            progress.keys(in: direction)
                .filter { progress[$0].wrongCount > 0 && !progress[$0].isMastered }
                .map(\.itemScope)
        )
        let ordered = scopes.sorted {
            progress.mastery(of: $0) < progress.mastery(of: $1)
        }
        return ordered.prefix(length).compactMap { scope in
            factory.exercise(
                for: PlannedItem(scope: scope, bucket: .weak, urgency: 1),
                progress: progress, using: &generator
            )
        }
    }

    // MARK: - Shared

    private func plannedExercises(
        scopes: [ItemScope],
        count: Int,
        direction: Direction,
        progress: LearnerProgress,
        now: Date,
        factory: ExerciseFactory,
        seed: String,
        generator: inout SeededGenerator,
        allowedKinds: [ExerciseKind]? = nil
    ) -> [Exercise] {
        guard count > 0 else { return [] }
        // Over-plan: some items cannot produce some formats (a two-letter word
        // has no spelling exercise), and asking for exactly `count` would
        // return a short session whenever that happens.
        let planned = Scheduler.plan(
            orderedScopes: scopes, progress: progress, now: now,
            count: count * 2, seed: seed
        )

        var result: [Exercise] = []
        for item in planned {
            guard result.count < count else { break }
            let exercise: Exercise? = if let allowedKinds {
                forcedExercise(item, allowedKinds: allowedKinds, progress: progress, factory: factory, generator: &generator)
            } else {
                factory.exercise(for: item, progress: progress, using: &generator)
            }
            if let exercise { result.append(exercise) }
        }
        return result
    }

    private func forcedExercise(
        _ item: PlannedItem,
        allowedKinds: [ExerciseKind],
        progress: LearnerProgress,
        factory: ExerciseFactory,
        generator: inout SeededGenerator
    ) -> Exercise? {
        let usable = allowedKinds.filter { factory.speechAvailable || !$0.needsMicrophone }
        for kind in usable.shuffled(using: &generator) {
            let exercise: Exercise? = switch item.scope.kind {
            case .concept:
                content.concept(item.scope.itemID).flatMap {
                    factory.conceptExercise($0, direction: item.scope.direction, progress: progress,
                                            using: &generator, forcing: kind)
                }
            case .sentence:
                content.sentence(item.scope.itemID).flatMap {
                    factory.sentenceExercise($0, direction: item.scope.direction, progress: progress,
                                             using: &generator, forcing: kind)
                }
            case .warmup:
                content.warmupItems(for: item.scope.direction)
                    .first { $0.id == item.scope.itemID }
                    .flatMap {
                        factory.warmupExercise($0, direction: item.scope.direction, progress: progress,
                                               using: &generator, forcing: kind)
                    }
            }
            if let exercise { return exercise }
        }
        return nil
    }

    public func conceptScopes(direction: Direction) -> [ItemScope] {
        content.introductionOrder(for: direction)
            .map { ItemScope(direction: direction, kind: .concept, itemID: $0.id) }
    }

    public func sentenceScopes(direction: Direction) -> [ItemScope] {
        content.sentences
            .sorted { $0.difficulty < $1.difficulty }
            .map { ItemScope(direction: direction, kind: .sentence, itemID: $0.id) }
    }

    public func warmupScopes(direction: Direction) -> [ItemScope] {
        content.warmupItems(for: direction)
            .map { ItemScope(direction: direction, kind: .warmup, itemID: $0.id) }
    }

    func averageMastery(of scopes: [ItemScope], in progress: LearnerProgress) -> Double {
        guard !scopes.isEmpty else { return 1 }
        return scopes.reduce(0.0) { $0 + progress.mastery(of: $1) } / Double(scopes.count)
    }
}
