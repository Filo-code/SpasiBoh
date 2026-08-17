import Foundation

/// Loads the bundled static content.
///
/// Static content and user progress are kept strictly apart (§13, §81):
/// nothing here is ever mutated, and progress refers to it only by stable id.
/// That separation is what lets the content be corrected or extended in an
/// update without touching what the learner has already earned.
public struct ContentStore: Sendable {
    public let concepts: [Concept]
    public let sentences: [Sentence]
    public let letters: [CyrillicLetter]
    public let patterns: [ItalianPattern]
    public let scenarios: [Scenario]
    public let idioms: [Idiom]
    public let cultureCards: [CultureCard]
    public let tips: [LanguageTip]

    private let conceptsByID: [String: Concept]
    private let sentencesByID: [String: Sentence]

    public init(
        concepts: [Concept],
        sentences: [Sentence],
        letters: [CyrillicLetter],
        patterns: [ItalianPattern],
        scenarios: [Scenario],
        idioms: [Idiom] = [],
        cultureCards: [CultureCard] = [],
        tips: [LanguageTip] = []
    ) {
        self.concepts = concepts
        self.sentences = sentences
        self.letters = letters
        self.patterns = patterns
        self.scenarios = scenarios
        self.idioms = idioms
        self.cultureCards = cultureCards
        self.tips = tips
        self.conceptsByID = Dictionary(concepts.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        self.sentencesByID = Dictionary(sentences.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    }

    public func concept(_ id: String) -> Concept? { conceptsByID[id] }
    public func sentence(_ id: String) -> Sentence? { sentencesByID[id] }

    /// Scenarios for one learning direction. A Russia-set scenario is useless
    /// to someone learning Italian, so this is a hard filter, not a sort.
    public func scenarios(for direction: Direction) -> [Scenario] {
        scenarios.filter { $0.direction == direction }
    }

    /// Warm-up items for a direction. The two directions drill genuinely
    /// different problems — Cyrillic script vs Italian orthography.
    public func warmupItems(for direction: Direction) -> [WarmupItem] {
        switch direction {
        case .itToRu: letters.sorted { $0.order < $1.order }.map(WarmupItem.letter)
        case .ruToIt: patterns.sorted { $0.order < $1.order }.map(WarmupItem.pattern)
        }
    }

    /// Culture cards written for this learner, cheapest to unlock first.
    public func cultureCards(for direction: Direction) -> [CultureCard] {
        cultureCards.filter { $0.audience == direction }.sorted { $0.unlockXP < $1.unlockXP }
    }

    /// Tips about the language being learned. A tip about Russian aspect is of
    /// no use to someone learning Italian.
    public func tips(for direction: Direction) -> [LanguageTip] {
        tips.filter { $0.language == direction.target }.sorted { $0.unlockXP < $1.unlockXP }
    }

    public func idioms(for direction: Direction) -> [Idiom] {
        idioms.filter { $0.language == direction.target }
    }

    /// Concepts in the order they should be introduced, by target-language
    /// frequency.
    public func introductionOrder(for direction: Direction) -> [Concept] {
        concepts.sorted { $0.introductionRank(for: direction) < $1.introductionRank(for: direction) }
    }

    // MARK: - Loading

    public enum LoadError: Error, CustomStringConvertible {
        case missingResource(String)
        case decodingFailed(String, Error)

        public var description: String {
            switch self {
            case .missingResource(let name):
                "Content resource not found in bundle: \(name).json"
            case .decodingFailed(let name, let error):
                "Failed to decode \(name).json — \(error)"
            }
        }
    }

    /// Load from a bundle. Defaults to the package's own resource bundle.
    ///
    /// Throws rather than returning empty content: shipping an app that
    /// silently has no vocabulary is far worse than failing loudly at launch,
    /// and the validator exists precisely so this never reaches a user.
    /// `Bundle.module` is internal to the package, so it cannot appear as a
    /// public default argument — hence the optional plus lookup inside.
    public static func load(from bundle: Bundle? = nil) throws -> ContentStore {
        let bundle = bundle ?? .module
        return ContentStore(
            concepts: try decode([Concept].self, "concepts", bundle),
            sentences: try decode([Sentence].self, "sentences", bundle),
            letters: try decode([CyrillicLetter].self, "letters", bundle),
            patterns: try decode([ItalianPattern].self, "patterns", bundle),
            scenarios: try decode([Scenario].self, "scenarios", bundle),
            idioms: try decode([Idiom].self, "idioms", bundle),
            cultureCards: try decode([CultureCard].self, "culture", bundle),
            tips: try decode([LanguageTip].self, "tips", bundle)
        )
    }

    private static func decode<T: Decodable>(_ type: T.Type, _ name: String, _ bundle: Bundle) throws -> T {
        guard let url = bundle.url(forResource: name, withExtension: "json", subdirectory: "Content")
                ?? bundle.url(forResource: name, withExtension: "json")
        else { throw LoadError.missingResource(name) }
        do {
            return try JSONDecoder().decode(type, from: Data(contentsOf: url))
        } catch {
            throw LoadError.decodingFailed(name, error)
        }
    }
}
