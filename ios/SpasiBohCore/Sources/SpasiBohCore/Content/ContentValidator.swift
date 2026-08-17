import Foundation

/// Checks the bundled content for the mistakes that silently produce broken
/// exercises (§92).
///
/// Wired into the test suite, so invalid content fails the build rather than
/// shipping as an unanswerable question. Every rule here exists because the
/// alternative is a learner staring at an exercise with no correct answer.
public enum ContentValidator {

    public struct Problem: Sendable, Hashable, CustomStringConvertible {
        public let item: String
        public let detail: String
        public var description: String { "\(item): \(detail)" }
    }

    /// Identifiers must be machine-safe (§42, §45): they key persisted progress
    /// and appear in file paths, so an emoji or a space in one is a bug that
    /// only shows up months later as lost history.
    static let allowedIDCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")

    public static func validate(_ content: ContentStore) -> [Problem] {
        var problems: [Problem] = []
        func fail(_ item: String, _ detail: String) {
            problems.append(Problem(item: item, detail: detail))
        }

        // MARK: IDs

        func checkID(_ id: String, _ label: String) {
            if id.isEmpty {
                fail(label, "empty id")
            } else if id.unicodeScalars.contains(where: { !allowedIDCharacters.contains($0) }) {
                fail(label, "id contains characters outside [A-Za-z0-9_-]: \(id)")
            }
        }

        func checkUnique(_ ids: [String], _ label: String) {
            var seen: Set<String> = []
            for id in ids where !seen.insert(id).inserted {
                fail(label, "duplicate id: \(id)")
            }
        }

        checkUnique(content.concepts.map(\.id), "concepts")
        checkUnique(content.sentences.map(\.id), "sentences")
        checkUnique(content.letters.map(\.id), "letters")
        checkUnique(content.patterns.map(\.id), "patterns")
        checkUnique(content.scenarios.map(\.id), "scenarios")
        checkUnique(content.idioms.map(\.id), "idioms")
        checkUnique(content.cultureCards.map(\.id), "culture")
        checkUnique(content.tips.map(\.id), "tips")

        // MARK: Concepts

        for concept in content.concepts {
            let label = "concept \(concept.id)"
            checkID(concept.id, label)

            for language in Language.allCases {
                let side = concept[language]
                if side.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    fail(label, "empty \(language.rawValue) text")
                }
                if side.frequencyRank <= 0 {
                    fail(label, "\(language.rawValue) frequencyRank must be positive")
                }
            }

            // Russian is unreadable to a beginner without help, so the rule is
            // absolute: every Russian side carries stress and transliteration.
            if concept.ru.pronunciation?.isEmpty != false {
                fail(label, "russian side has no transliteration")
            }
            if let stressed = concept.ru.stressed,
               TextNormalization.stripStressMarks(stressed) != concept.ru.text {
                fail(label, "stressed form '\(stressed)' does not match text '\(concept.ru.text)'")
            }

            // Italian is the inverse: a hint is only allowed where it teaches
            // something. `casa` needs no note, and one that merely restates the
            // spelling is filler that trains the learner to ignore hints.
            if let hint = concept.it.pronunciation {
                if hint.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    fail(label, "italian pronunciation hint is present but empty")
                } else if TextNormalization.normalizeItalian(hint) == TextNormalization.normalizeItalian(concept.it.text) {
                    fail(label, "italian hint '\(hint)' only restates the word")
                }
            }

            if concept.difficulty < 1 || concept.difficulty > 5 {
                fail(label, "difficulty \(concept.difficulty) outside 1…5")
            }
        }

        // MARK: Sentences

        let conceptIDs = Set(content.concepts.map(\.id))
        for sentence in content.sentences {
            let label = "sentence \(sentence.id)"
            checkID(sentence.id, label)
            for language in Language.allCases where sentence[language].text.isEmpty {
                fail(label, "empty \(language.rawValue) text")
            }
            for keyword in sentence.keywords where !conceptIDs.contains(keyword) {
                fail(label, "keyword refers to unknown concept: \(keyword)")
            }
            if let scenarioID = sentence.scenarioID,
               !content.scenarios.contains(where: { $0.id == scenarioID }) {
                fail(label, "refers to unknown scenario: \(scenarioID)")
            }
        }

        // MARK: Warm-up

        let letterIDs = Set(content.letters.map(\.id))
        for letter in content.letters {
            let label = "letter \(letter.id)"
            checkID(letter.id, label)
            if letter.upper.isEmpty || letter.lower.isEmpty { fail(label, "missing case forms") }
            if letter.hasSound && letter.pronunciation.isEmpty { fail(label, "no pronunciation") }
            for confusable in letter.confusableWith where !letterIDs.contains(confusable) {
                fail(label, "confusableWith refers to unknown letter: \(confusable)")
            }
        }

        // Without at least four sounded letters there is no four-way choice.
        if !content.letters.isEmpty, content.letters.filter(\.hasSound).count < 4 {
            fail("letters", "too few sounded letters to build a multiple-choice question")
        }

        for pattern in content.patterns {
            let label = "pattern \(pattern.id)"
            checkID(pattern.id, label)
            if pattern.pronunciation.isEmpty { fail(label, "no pronunciation") }
            if pattern.exampleWord.isEmpty { fail(label, "no example word") }
            if pattern.kind == .doubleConsonant && pattern.minimalPair == nil {
                fail(label, "a double-consonant pattern without a minimal pair teaches nothing")
            }
            if let pair = pattern.minimalPair, pair.short == pair.long {
                fail(label, "minimal pair has identical members")
            }
        }
        // The Russian→Italian learner has no warm-up at all without these.
        if content.patterns.count < 4 {
            fail("patterns", "too few Italian patterns to build a warm-up")
        }

        // MARK: Scenarios

        for scenario in content.scenarios {
            let label = "scenario \(scenario.id)"
            checkID(scenario.id, label)
            if scenario.steps.isEmpty { fail(label, "no steps") }
            // The prompt is rendered in the learner's own language, so the
            // audience's half must be present. The other half may be empty.
            let audienceLanguage = scenario.direction.native
            if scenario.title[audienceLanguage].isEmpty { fail(label, "no title for its audience") }

            for step in scenario.steps {
                let stepLabel = "\(label)/\(step.id)"
                checkID(step.id, stepLabel)
                if step.prompt[audienceLanguage].isEmpty {
                    fail(stepLabel, "prompt is empty in the audience language")
                }
                switch step.kind {
                case .info:
                    break
                case .comprehension, .choice:
                    let language = step.kind == .comprehension
                        ? scenario.direction.native
                        : scenario.direction.target
                    let options = step.options(language)
                    if options.count < 2 { fail(stepLabel, "needs at least two options") }
                    guard let correct = step.correctOption else {
                        fail(stepLabel, "no correct option")
                        continue
                    }
                    if !options.indices.contains(correct) {
                        fail(stepLabel, "correctOption \(correct) is out of range")
                    }
                    if Set(options).count != options.count {
                        fail(stepLabel, "duplicate options")
                    }
                case .build:
                    guard let target = step.target(scenario.direction.target) else {
                        fail(stepLabel, "build step with no target line")
                        continue
                    }
                    if target.text.split(whereSeparator: \.isWhitespace).count < 2 {
                        fail(stepLabel, "build step needs at least two words")
                    }
                case .pronounce:
                    if step.target(scenario.direction.target)?.text.isEmpty != false {
                        fail(stepLabel, "pronounce step with no target line")
                    }
                }
            }
        }

        // Both learners need scenarios, or one direction silently has none.
        for direction in Direction.allCases where content.scenarios(for: direction).isEmpty {
            fail("scenarios", "no scenarios for \(direction.rawValue)")
        }

        // MARK: Culture and tips

        for card in content.cultureCards {
            let label = "culture \(card.id)"
            checkID(card.id, label)
            // A cultural claim with no source is exactly the thing this app
            // must not ship.
            if card.source.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                fail(label, "no source")
            }
            for language in Language.allCases {
                if card.title[language].isEmpty { fail(label, "no \(language.rawValue) title") }
                if card.body[language].isEmpty { fail(label, "no \(language.rawValue) body") }
            }
            if card.unlockXP < 0 { fail(label, "negative unlockXP") }
        }

        for tip in content.tips {
            let label = "tip \(tip.id)"
            checkID(tip.id, label)
            for language in Language.allCases {
                if tip.title[language].isEmpty { fail(label, "no \(language.rawValue) title") }
                if tip.body[language].isEmpty { fail(label, "no \(language.rawValue) body") }
            }
        }

        for idiom in content.idioms {
            let label = "idiom \(idiom.id)"
            checkID(idiom.id, label)
            if idiom.expression.isEmpty { fail(label, "no expression") }
            for language in Language.allCases {
                if idiom.meaning[language].isEmpty { fail(label, "no \(language.rawValue) meaning") }
                if idiom.literal[language].isEmpty { fail(label, "no \(language.rawValue) literal reading") }
            }
        }

        return problems
    }
}
