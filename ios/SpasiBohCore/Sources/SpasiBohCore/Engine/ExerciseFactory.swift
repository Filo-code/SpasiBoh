import Foundation

/// Turns "practise this item" into an actual question.
///
/// Everything is driven by the seeded generator so a session is reproducible:
/// the same seed and the same progress produce the same questions, which is the
/// only way scheduling behaviour can be asserted rather than eyeballed.
public struct ExerciseFactory: Sendable {
    public let content: ContentStore
    /// Set false when microphone or speech permission was refused, so
    /// pronunciation exercises are never generated instead of being generated
    /// and then failing (§90).
    public var speechAvailable: Bool

    public init(content: ContentStore, speechAvailable: Bool = true) {
        self.content = content
        self.speechAvailable = speechAvailable
    }

    // MARK: - Kind selection

    /// Pick a format for an item, weighted by how well it is already known.
    ///
    /// This is the §28 easy→hard progression, and it is a weighting rather than
    /// a ladder on purpose: recognition never disappears entirely (it is still
    /// the fastest way to refresh a lapsed item), it just stops dominating.
    public static func weight(_ kind: ExerciseKind, mastery: Double) -> Double {
        switch kind {
        case .recognition, .letterRecognize, .patternSound:
            max(0.2, 3 - 4 * mastery)
        case .recall, .letterSound:
            0.8 + 1.5 * mastery
        case .listening, .minimalPair:
            0.6 + 0.9 * mastery
        case .spelling:
            0.3 + 1.4 * mastery
        case .pronunciation:
            0.4 + 0.9 * mastery
        case .sentenceBuild, .sentenceGap, .sentenceReply:
            0.2 + 1.6 * mastery
        }
    }

    func chooseKind(
        from candidates: [ExerciseKind],
        scope: ItemScope,
        progress: LearnerProgress,
        using generator: inout SeededGenerator
    ) -> ExerciseKind? {
        let available = candidates.filter { speechAvailable || !$0.needsMicrophone }
        guard !available.isEmpty else { return nil }

        let mastery = progress.mastery(of: scope)
        // Avoid repeating the format the learner just saw for this item — the
        // difference between a session that feels varied and one that grinds.
        let recentlyUsed = Set(
            Skill.allCases.flatMap { progress[scope.key($0)].recentExerciseTypes }.prefix(3)
        )
        let fresh = available.filter { !recentlyUsed.contains($0.rawValue) }
        let pool = fresh.isEmpty ? available : fresh

        return pool.weightedChoice(using: &generator) { Self.weight($0, mastery: mastery) } ?? pool.first
    }

    // MARK: - Entry point

    /// Build a question for a scheduled item, or nil if the content cannot
    /// support any format (a one-word sentence has no build exercise).
    public func exercise(
        for planned: PlannedItem,
        progress: LearnerProgress,
        using generator: inout SeededGenerator
    ) -> Exercise? {
        let scope = planned.scope
        switch scope.kind {
        case .concept:
            guard let concept = content.concept(scope.itemID) else { return nil }
            return conceptExercise(concept, direction: scope.direction, progress: progress, using: &generator)
        case .sentence:
            guard let sentence = content.sentence(scope.itemID) else { return nil }
            return sentenceExercise(sentence, direction: scope.direction, progress: progress, using: &generator)
        case .warmup:
            guard let item = content.warmupItems(for: scope.direction).first(where: { $0.id == scope.itemID })
            else { return nil }
            return warmupExercise(item, direction: scope.direction, progress: progress, using: &generator)
        }
    }

    // MARK: - Concepts

    public func conceptExercise(
        _ concept: Concept,
        direction: Direction,
        progress: LearnerProgress,
        using generator: inout SeededGenerator,
        forcing kind: ExerciseKind? = nil
    ) -> Exercise? {
        let scope = ItemScope(direction: direction, kind: .concept, itemID: concept.id)
        var candidates: [ExerciseKind] = [.recognition, .recall, .listening, .pronunciation]
        // Spelling a word you cannot yet read is busywork; wait until there is
        // some recognition to build on.
        if progress.mastery(of: scope) > 0.25, concept[direction.target].text.count >= 3 {
            candidates.append(.spelling)
        }
        guard let kind = kind ?? chooseKind(from: candidates, scope: scope, progress: progress, using: &generator)
        else { return nil }

        let target = concept[direction.target]
        let native = concept[direction.native]
        let key = scope.key(kind.skill)
        let id = "\(concept.id)-\(kind.rawValue)"

        switch kind {
        case .recognition:
            let options = optionSet(
                correct: native.text,
                language: direction.native,
                pool: distractorConcepts(for: concept, using: &generator).map { $0[direction.native].text },
                using: &generator
            )
            return Exercise(
                id: id, kind: kind, key: key,
                promptText: target.text,
                promptSubtitle: target.pronunciation,
                promptLanguage: direction.target,
                options: options.options, correctOption: options.correctIndex,
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: concept.note
            )

        case .recall:
            let options = optionSet(
                correct: target.text,
                language: direction.target,
                pool: distractorConcepts(for: concept, using: &generator).map { $0[direction.target].text },
                using: &generator
            )
            return Exercise(
                id: id, kind: kind, key: key,
                promptText: native.text,
                promptLanguage: direction.native,
                options: options.options, correctOption: options.correctIndex,
                note: concept.note
            )

        case .listening:
            let options = optionSet(
                correct: native.text,
                language: direction.native,
                pool: distractorConcepts(for: concept, using: &generator).map { $0[direction.native].text },
                using: &generator
            )
            return Exercise(
                id: id, kind: kind, key: key,
                promptText: "",
                promptLanguage: direction.target,
                options: options.options, correctOption: options.correctIndex,
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: concept.note
            )

        case .pronunciation:
            return Exercise(
                id: id, kind: kind, key: key,
                promptText: target.text,
                promptSubtitle: target.pronunciation ?? native.text,
                promptLanguage: direction.target,
                expected: target.text,
                expectedLanguage: direction.target,
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: concept.note
            )

        case .spelling:
            // Tiles are split by Character, never by scalar: `й` may arrive
            // decomposed, and a bare combining breve as its own tile is both
            // unreadable and unselectable.
            let tiles = TextNormalization.spellingTiles(target.text)
            guard tiles.count >= 3 else { return nil }
            return Exercise(
                id: id, kind: kind, key: key,
                promptText: native.text,
                promptSubtitle: target.pronunciation,
                promptLanguage: direction.native,
                expected: target.text,
                expectedLanguage: direction.target,
                blocks: tiles.shuffled(using: &generator),
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: concept.note
            )

        default:
            return nil
        }
    }

    /// Wrong answers drawn from the same category first.
    ///
    /// Random distractors make a multiple-choice question answerable by
    /// elimination without knowing the word — if the prompt is a drink and
    /// three options are verbs, the question tests nothing.
    func distractorConcepts(
        for concept: Concept,
        count: Int = 3,
        using generator: inout SeededGenerator
    ) -> [Concept] {
        let sameCategory = content.concepts.filter { $0.category == concept.category && $0.id != concept.id }
        var picked = sameCategory.sample(count, using: &generator)
        if picked.count < count {
            let chosen = Set(picked.map(\.id) + [concept.id])
            let rest = content.concepts.filter { !chosen.contains($0.id) }
            picked += rest.sample(count - picked.count, using: &generator)
        }
        return picked
    }

    // MARK: - Sentences

    public func sentenceExercise(
        _ sentence: Sentence,
        direction: Direction,
        progress: LearnerProgress,
        using generator: inout SeededGenerator,
        forcing kind: ExerciseKind? = nil
    ) -> Exercise? {
        let scope = ItemScope(direction: direction, kind: .sentence, itemID: sentence.id)
        let words = sentence[direction.target].text.split(whereSeparator: \.isWhitespace).map(String.init)

        var candidates: [ExerciseKind] = [.recognition, .listening, .pronunciation]
        if words.count >= 2 { candidates.append(.sentenceBuild) }
        if words.count >= 3 { candidates.append(.sentenceGap) }
        if sentence.scenarioID != nil { candidates.append(.sentenceReply) }

        guard let kind = kind ?? chooseKind(from: candidates, scope: scope, progress: progress, using: &generator)
        else { return nil }

        let target = sentence[direction.target]
        let native = sentence[direction.native]
        let key = scope.key(kind.skill)
        let id = "\(sentence.id)-\(kind.rawValue)"

        switch kind {
        case .recognition, .sentenceReply:
            // Same category first — a wrong answer from the same situation is
            // a real distractor; one from a different one is a giveaway.
            let sameCategory = content.sentences
                .filter { $0.id != sentence.id && $0.category == sentence.category }
                .shuffled(using: &generator)
            let rest = content.sentences
                .filter { $0.id != sentence.id && $0.category != sentence.category }
                .shuffled(using: &generator)
            let options = optionSet(
                correct: native.text, language: direction.native,
                pool: (sameCategory + rest).map { $0[direction.native].text },
                using: &generator
            )
            return Exercise(
                id: id, kind: kind, key: key,
                promptText: target.text,
                promptSubtitle: target.pronunciation,
                promptLanguage: direction.target,
                options: options.options, correctOption: options.correctIndex,
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: sentence.note
            )

        case .listening:
            let pool = content.sentences
                .filter { $0.id != sentence.id }
                .shuffled(using: &generator)
                .map { $0[direction.native].text }
            let options = optionSet(
                correct: native.text, language: direction.native,
                pool: pool, using: &generator
            )
            return Exercise(
                id: id, kind: kind, key: key,
                promptText: "", promptLanguage: direction.target,
                options: options.options, correctOption: options.correctIndex,
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: sentence.note
            )

        case .pronunciation:
            return Exercise(
                id: id, kind: kind, key: key,
                promptText: target.text,
                promptSubtitle: native.text,
                promptLanguage: direction.target,
                expected: target.text,
                expectedLanguage: direction.target,
                acceptedAlternatives: sentence.alternatives(for: direction.target),
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: sentence.note
            )

        case .sentenceBuild:
            let extras = sentence.distractors(for: direction.target)
            return Exercise(
                id: id, kind: kind, key: key,
                promptText: native.text,
                promptLanguage: direction.native,
                expected: target.text,
                expectedLanguage: direction.target,
                acceptedAlternatives: sentence.alternatives(for: direction.target),
                blocks: (words + extras).shuffled(using: &generator),
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: sentence.note
            )

        case .sentenceGap:
            // Blank the longest word rather than a random one: blanking `a` or
            // `и` asks the learner to guess a particle from context, which is a
            // different and much harder skill than the one being drilled.
            guard let missing = words.max(by: { $0.count < $1.count }),
                  let index = words.firstIndex(of: missing) else { return nil }
            var gapped = words
            gapped[index] = "___"
            let pool = content.concepts
                .shuffled(using: &generator)
                .map { $0[direction.target].text }
                .filter { $0.caseInsensitiveCompare(missing) != .orderedSame }
            let options = optionSet(
                correct: missing, language: direction.target,
                pool: pool, using: &generator
            )
            return Exercise(
                id: id, kind: kind, key: key,
                promptText: gapped.joined(separator: " "),
                promptSubtitle: native.text,
                promptLanguage: direction.target,
                options: options.options, correctOption: options.correctIndex,
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: sentence.note
            )

        default:
            return nil
        }
    }

    // MARK: - Warm-up

    public func warmupExercise(
        _ item: WarmupItem,
        direction: Direction,
        progress: LearnerProgress,
        using generator: inout SeededGenerator,
        forcing kind: ExerciseKind? = nil
    ) -> Exercise? {
        let scope = ItemScope(direction: direction, kind: .warmup, itemID: item.id)
        switch item {
        case .letter(let letter):
            let kind = kind ?? chooseKind(
                from: [.letterSound, .letterRecognize],
                scope: scope, progress: progress, using: &generator
            ) ?? .letterSound
            return letterExercise(letter, kind: kind, scope: scope, using: &generator)
        case .pattern(let pattern):
            let available: [ExerciseKind] = pattern.minimalPair == nil ? [.patternSound] : [.patternSound, .minimalPair]
            let kind = kind ?? chooseKind(
                from: available, scope: scope, progress: progress, using: &generator
            ) ?? .patternSound
            return patternExercise(pattern, kind: kind, scope: scope, using: &generator)
        }
    }

    private func letterExercise(
        _ letter: CyrillicLetter,
        kind: ExerciseKind,
        scope: ItemScope,
        using generator: inout SeededGenerator
    ) -> Exercise? {
        // Distractors come from `confusableWith` first — Ш against Щ teaches
        // something, Ш against Ф does not.
        let confusables = content.letters.filter { letter.confusableWith.contains($0.id) && $0.id != letter.id }
        let others = content.letters.filter { $0.id != letter.id && !letter.confusableWith.contains($0.id) && $0.hasSound }
        let pool = confusables + others.shuffled(using: &generator)
        let key = scope.key(kind.skill)

        switch kind {
        case .letterSound:
            let options = optionSet(
                correct: letter.pronunciation, language: nil,
                pool: pool.map(\.pronunciation), using: &generator
            )
            return Exercise(
                id: "\(letter.id)-sound", kind: kind, key: key,
                promptText: "\(letter.upper) \(letter.lower)",
                promptSubtitle: nil,
                promptLanguage: .russian,
                options: options.options, correctOption: options.correctIndex,
                audio: AudioCue(text: letter.exampleWord, language: .russian),
                note: letter.note
            )
        case .letterRecognize:
            let options = optionSet(
                correct: letter.upper, language: .russian,
                pool: pool.map(\.upper), using: &generator
            )
            return Exercise(
                id: "\(letter.id)-recognize", kind: kind, key: key,
                promptText: letter.pronunciation,
                promptSubtitle: letter.exampleWordTranslit,
                promptLanguage: nil,
                options: options.options, correctOption: options.correctIndex,
                audio: AudioCue(text: letter.exampleWord, language: .russian),
                note: letter.note
            )
        default:
            return nil
        }
    }

    private func patternExercise(
        _ pattern: ItalianPattern,
        kind: ExerciseKind,
        scope: ItemScope,
        using generator: inout SeededGenerator
    ) -> Exercise? {
        let key = scope.key(kind.skill)
        switch kind {
        case .patternSound:
            let pool = content.patterns
                .filter { $0.id != pattern.id }
                .shuffled(using: &generator)
                .map(\.pronunciation)
            let options = optionSet(
                correct: pattern.pronunciation, language: nil,
                pool: pool, using: &generator
            )
            return Exercise(
                id: "\(pattern.id)-sound", kind: kind, key: key,
                promptText: pattern.pattern,
                promptSubtitle: pattern.exampleWord,
                promptLanguage: .italian,
                options: options.options, correctOption: options.correctIndex,
                audio: AudioCue(text: pattern.exampleWord, language: .italian),
                note: pattern.note
            )
        case .minimalPair:
            // The whole lesson: consonant length carries meaning. The learner
            // hears one of the pair and must say which word it was.
            guard let pair = pattern.minimalPair else { return nil }
            let heardLong = generator.nextDouble() < 0.5
            let heard = heardLong ? pair.long : pair.short
            let options = [
                ExerciseOption(id: 0, text: pair.short, language: .italian),
                ExerciseOption(id: 1, text: pair.long, language: .italian),
            ]
            return Exercise(
                id: "\(pattern.id)-pair-\(heardLong ? "long" : "short")", kind: kind, key: key,
                promptText: "",
                promptLanguage: .italian,
                options: options,
                correctOption: heardLong ? 1 : 0,
                audio: AudioCue(text: heard, language: .italian),
                note: pattern.note
            )
        default:
            return nil
        }
    }

    // MARK: - Options

    struct OptionSet {
        let options: [ExerciseOption]
        let correctIndex: Int
    }

    /// Build a shuffled four-way choice.
    ///
    /// Distractors are de-duplicated against the correct answer by normalized
    /// text, not raw string: two options that differ only by an accent or a
    /// stress mark read as the same answer twice and make the question unfair.
    ///
    /// No option carries a subtitle. Attaching the transliteration to the
    /// correct answer only — the obvious thing to do — marks it visually and
    /// makes the question answerable without reading a word of it.
    ///
    /// `pool` is consumed **in order** and is not shuffled here: callers pass
    /// their best distractors first (confusable letters, same-category words)
    /// and shuffling would throw that ordering away, turning a hard question
    /// into one answerable by elimination. Callers with no preference shuffle
    /// their own pool.
    func optionSet(
        correct: String,
        language: Language?,
        pool: [String],
        count: Int = 4,
        using generator: inout SeededGenerator
    ) -> OptionSet {
        let normalizedCorrect = language.map { TextNormalization.normalize(correct, language: $0) }
            ?? correct.lowercased()
        var seen: Set<String> = [normalizedCorrect]
        var wrong: [String] = []
        for candidate in pool {
            let normalized = language.map { TextNormalization.normalize(candidate, language: $0) }
                ?? candidate.lowercased()
            guard !seen.contains(normalized) else { continue }
            seen.insert(normalized)
            wrong.append(candidate)
            if wrong.count == count - 1 { break }
        }

        let texts = ([correct] + wrong).shuffled(using: &generator)
        let index = texts.firstIndex(of: correct) ?? 0
        let options = texts.enumerated().map { position, text in
            ExerciseOption(id: position, text: text, language: language)
        }
        return OptionSet(options: options, correctIndex: index)
    }
}
