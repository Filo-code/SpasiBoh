import Testing
import Foundation
@testable import SpasiBohCore

/// Content validation (§92). These are not smoke tests — a failure here means
/// broken content would reach a learner, so the build must go red.
@Suite("Bundled content")
struct ContentTests {

    private func store() throws -> ContentStore { try ContentStore.load() }

    @Test("Content loads and is not empty")
    func loads() throws {
        let store = try store()
        #expect(store.concepts.count >= 500)   // §40 asks for ~500 minimum
        #expect(store.sentences.count >= 150)  // §52 asks for 150–250
        #expect(store.letters.count == 33)     // the Russian alphabet, exactly
        #expect(!store.scenarios.isEmpty)
    }

    @Test("No duplicate IDs")
    func uniqueIDs() throws {
        let store = try store()
        #expect(Set(store.concepts.map(\.id)).count == store.concepts.count)
        #expect(Set(store.sentences.map(\.id)).count == store.sentences.count)
        #expect(Set(store.letters.map(\.id)).count == store.letters.count)
        #expect(Set(store.scenarios.map(\.id)).count == store.scenarios.count)
    }

    @Test("IDs are machine-safe")
    func idsAreMachineSafe() throws {
        // §42/§45: never emoji, never display text, never a translated label.
        let store = try store()
        for concept in store.concepts {
            #expect(!concept.id.isEmpty)
            #expect(concept.id.allSatisfy { $0.isASCII })
            #expect(!concept.id.unicodeScalars.contains { $0.properties.isEmojiPresentation })
        }
    }

    @Test("Both language sides are always populated")
    func bothSidesPresent() throws {
        // The whole bilingual premise fails if either side can be blank.
        let store = try store()
        for concept in store.concepts {
            #expect(!concept.it.text.trimmingCharacters(in: .whitespaces).isEmpty, "\(concept.id) missing IT")
            #expect(!concept.ru.text.trimmingCharacters(in: .whitespaces).isEmpty, "\(concept.id) missing RU")
        }
        for sentence in store.sentences {
            #expect(!sentence.it.text.trimmingCharacters(in: .whitespaces).isEmpty, "\(sentence.id) missing IT")
            #expect(!sentence.ru.text.trimmingCharacters(in: .whitespaces).isEmpty, "\(sentence.id) missing RU")
        }
    }

    @Test("Every Russian concept carries stress and transliteration")
    func russianHasPronunciationData() throws {
        // Russian stress is unpredictable and changes vowel quality, so it is
        // required on every entry — unlike Italian, where it is the exception.
        let store = try store()
        for concept in store.concepts {
            #expect(concept.ru.pronunciation?.isEmpty == false, "\(concept.id) missing translit")
            #expect(concept.ru.stressed?.isEmpty == false, "\(concept.id) missing stress")
        }
    }

    @Test("Italian hints are sparse and never restate the word")
    func italianHintsAreNotFiller() throws {
        // Italian orthography is largely predictable. A hint that just repeats
        // the spelling teaches nothing, and shipping 598 of them would be
        // padding rather than teaching.
        let store = try store()
        let hinted = store.concepts.filter { $0.it.pronunciation != nil }
        #expect(!hinted.isEmpty, "no Italian hints at all")
        #expect(hinted.count < store.concepts.count / 2, "hints look like filler")

        for concept in hinted {
            let hint = concept.it.pronunciation!
            #expect(!hint.isEmpty)
            #expect(hint.lowercased() != concept.it.text.lowercased(), "\(concept.id) hint restates the word")
        }
    }

    @Test("Russian text is Cyrillic and Italian text is not")
    func scriptsAreCorrect() throws {
        let store = try store()
        func isCyrillic(_ c: Character) -> Bool {
            c.unicodeScalars.contains { (0x0400...0x04FF).contains($0.value) }
        }
        for concept in store.concepts {
            #expect(concept.ru.text.contains(where: isCyrillic), "\(concept.id) RU is not Cyrillic")
            #expect(!concept.it.text.contains(where: isCyrillic), "\(concept.id) IT contains Cyrillic")
        }
    }

    @Test("Stressed forms match their base word once marks are stripped")
    func stressedFormsAreConsistent() throws {
        // Catches a stress mark accidentally attached to the wrong word.
        let store = try store()
        for concept in store.concepts {
            guard let stressed = concept.ru.stressed else { continue }
            let stripped = TextNormalization.stripStressMarks(stressed)
            #expect(
                TextNormalization.normalizeRussian(stripped) == TextNormalization.normalizeRussian(concept.ru.text),
                "\(concept.id): stressed '\(stressed)' does not match '\(concept.ru.text)'"
            )
        }
    }

    @Test("Visual hints are emoji, never used as identifiers")
    func visualHintsArePresentationOnly() throws {
        let store = try store()
        for concept in store.concepts {
            guard let hint = concept.visualHint else { continue }
            #expect(!hint.isEmpty)
            // One visible character, whatever its scalar count — a flag is 2
            // scalars and a ZWJ family is 5, and both must survive intact.
            #expect(hint.count <= 2, "\(concept.id) visualHint is not a single glyph")
        }
    }

    @Test("Scenarios are well formed")
    func scenarioIntegrity() throws {
        let store = try store()
        for scenario in store.scenarios {
            #expect(scenario.steps.count >= 4, "\(scenario.id) too short")   // §61: 4–10
            #expect(scenario.steps.count <= 12, "\(scenario.id) too long")
            #expect(Set(scenario.steps.map(\.id)).count == scenario.steps.count)

            for step in scenario.steps {
                // Which language a step's options are written in depends on the
                // scenario's audience: comprehension is answered in the
                // learner's own language, choice in the one being learned.
                // Hard-coding Italian and Russian here only held while the
                // Italy set did not exist.
                switch step.kind {
                case .comprehension, .choice:
                    let language = step.kind == .comprehension
                        ? scenario.direction.native
                        : scenario.direction.target
                    let options = step.options(language)
                    #expect(!options.isEmpty, "\(step.id) has no options in \(language.rawValue)")
                    if let correct = step.correctOption {
                        #expect(correct >= 0 && correct < options.count, "\(step.id) option index out of range")
                    }
                case .build, .pronounce:
                    #expect(
                        step.target(scenario.direction.target) != nil,
                        "\(step.id) has no target line in the language being learned"
                    )
                case .info:
                    break
                }
            }
        }
    }

    @Test("Scenario direction filtering works")
    func scenarioDirections() throws {
        let store = try store()
        let forItalians = store.scenarios(for: .itToRu)
        #expect(!forItalians.isEmpty)
        #expect(forItalians.allSatisfy { $0.direction == .itToRu })
    }

    @Test("Categories are valid and lookups resolve")
    func categoriesAndLookup() throws {
        let store = try store()
        let used = Set(store.concepts.map(\.category))
        #expect(!used.isEmpty)
        // Round-trip a known id through the index.
        let first = store.concepts[0]
        #expect(store.concept(first.id)?.id == first.id)
        #expect(store.concept("does_not_exist") == nil)
    }

    @Test("Introduction order follows target-language frequency")
    func introductionOrder() throws {
        // Order must follow the language being learned, not a shared rank —
        // the 50th most common Russian word is not the translation of the
        // 50th most common Italian one.
        let store = try store()
        let ordered = store.introductionOrder(for: .itToRu)
        let ranks = ordered.map { $0.ru.frequencyRank }
        #expect(ranks == ranks.sorted())
    }

    @Test("Every letter has distractors to build a real question from")
    func lettersHaveDistractors() throws {
        let store = try store()
        for letter in store.letters {
            #expect(!letter.confusableWith.isEmpty, "\(letter.id) has no confusables")
            #expect(!letter.soundKey.isEmpty)
            #expect(!letter.exampleWord.isEmpty)
        }
        // ъ and ь have no sound of their own.
        #expect(store.letters.filter { !$0.hasSound }.count == 2)
    }
}
