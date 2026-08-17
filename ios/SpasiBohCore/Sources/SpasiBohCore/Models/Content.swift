import Foundation

// MARK: - Categories

/// Content categories.
///
/// Raw values are deliberately **English machine identifiers**, not display
/// text (§42). Web V1 used Italian keys (`saluti`, `cibo`) which leaked the
/// metalanguage into the data layer and read as nonsense to a Russian speaker.
/// Display names live in the localization catalogue, keyed off these.
public enum Category: String, Codable, CaseIterable, Sendable, Hashable {
    case greetings, people, family, body, numbers, time, weather
    case house, food, drink, restaurant, bar, city, metro, train
    case airport, hotel, travel, taxi, shopping, money, verbs
    case adjectives, questions, conversation, emergency, directions
    case pharmacy, nature, health

    /// SF Symbol used on category tiles. Presentation only.
    public var symbolName: String {
        switch self {
        case .greetings: "hand.wave"
        case .people: "person.2"
        case .family: "figure.2.and.child.holdinghands"
        case .body: "figure.stand"
        case .numbers: "number"
        case .time: "clock"
        case .weather: "cloud.sun"
        case .house: "house"
        case .food: "fork.knife"
        case .drink: "cup.and.saucer"
        case .restaurant: "menucard"
        case .bar: "wineglass"
        case .city: "building.2"
        case .metro: "tram.fill.tunnel"
        case .train: "tram"
        case .airport: "airplane"
        case .hotel: "bed.double"
        case .travel: "suitcase"
        case .taxi: "car"
        case .shopping: "bag"
        case .money: "banknote"
        case .verbs: "bolt"
        case .adjectives: "paintpalette"
        case .questions: "questionmark.circle"
        case .conversation: "bubble.left.and.bubble.right"
        case .emergency: "cross.case"
        case .directions: "location"
        case .pharmacy: "pills"
        case .nature: "leaf"
        case .health: "heart"
        }
    }
}

// MARK: - Language side

/// One language's half of a bilingual record.
///
/// Both `Concept.it` and `Concept.ru` are this same type — that symmetry is
/// the whole point. Fields that only make sense for one language are optional
/// rather than being modelled as language-specific extra fields.
public struct LanguageSide: Codable, Hashable, Sendable {
    /// The plain form, as written. `"вода"` / `"acqua"`.
    public let text: String

    /// The form with stress marked, if stress is worth teaching.
    ///
    /// Russian: combining acute on the stressed vowel — `"вода́"`. Always
    /// present, because Russian stress is unpredictable and changes vowel
    /// quality.
    ///
    /// Italian: only where stress is *not* the default penultimate —
    /// `"àbito"`, `"tèlefono"`. `nil` for regular words, which is most of them.
    public let stressed: String?

    /// A pronunciation hint, when one earns its place.
    ///
    /// Russian: Latin transliteration for an Italian reader — `"vadà"`.
    /// Present on every entry, since Cyrillic is unreadable to a beginner.
    ///
    /// Italian: a targeted note about a real trap — digraphs, double
    /// consonants, open/closed vowels. `nil` for phonetically regular words.
    /// Italian orthography is largely predictable, so a hint on `casa` teaches
    /// nothing; filler here is worse than absence (validated against).
    public let pronunciation: String?

    /// Text handed to speech synthesis. Defaults to `text` when nil.
    public let audioText: String?

    /// Frequency rank *within this language*, lower = more common.
    ///
    /// Deliberately per-side: the 50th most common Russian word is not the
    /// translation of the 50th most common Italian word, and introduction
    /// order must follow the language actually being learned.
    public let frequencyRank: Int

    /// An example sentence in this language.
    public let example: String?

    public init(
        text: String,
        stressed: String? = nil,
        pronunciation: String? = nil,
        audioText: String? = nil,
        frequencyRank: Int = 9999,
        example: String? = nil
    ) {
        self.text = text
        self.stressed = stressed
        self.pronunciation = pronunciation
        self.audioText = audioText
        self.frequencyRank = frequencyRank
        self.example = example
    }

    /// What to speak. Never empty.
    public var spokenText: String {
        let candidate = audioText ?? text
        return candidate.isEmpty ? text : candidate
    }

    /// What to display when showing stress is helpful, falling back to plain.
    public var displayStressed: String { stressed ?? text }
}

/// A note that exists in both languages, so it can be shown to either learner.
public struct BilingualNote: Codable, Hashable, Sendable {
    public let it: String
    public let ru: String

    public init(it: String, ru: String) {
        self.it = it
        self.ru = ru
    }

    public subscript(language: Language) -> String {
        switch language {
        case .italian: it
        case .russian: ru
        }
    }
}

// MARK: - Concept

/// A single vocabulary item, held language-neutrally.
///
/// The `id` is a stable machine identifier (`food_water`) and is what all
/// progress is keyed on — never the text, never an emoji (§42, §45, §80).
public struct Concept: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let it: LanguageSide
    public let ru: LanguageSide
    public let category: Category
    /// 1 = very easy, 5 = advanced.
    public let difficulty: Int
    /// Emoji shown in the "which one is this?" exercise. Presentation only —
    /// never an identifier.
    public let visualHint: String?
    /// SF Symbol alternative to `visualHint`, preferred where one fits.
    public let symbolName: String?
    public let register: Register
    public let tags: [String]
    public let note: BilingualNote?

    public init(
        id: String,
        it: LanguageSide,
        ru: LanguageSide,
        category: Category,
        difficulty: Int,
        visualHint: String? = nil,
        symbolName: String? = nil,
        register: Register = .neutral,
        tags: [String] = [],
        note: BilingualNote? = nil
    ) {
        self.id = id
        self.it = it
        self.ru = ru
        self.category = category
        self.difficulty = difficulty
        self.visualHint = visualHint
        self.symbolName = symbolName
        self.register = register
        self.tags = tags
        self.note = note
    }

    public subscript(language: Language) -> LanguageSide {
        switch language {
        case .italian: it
        case .russian: ru
        }
    }

    /// Introduction order for a given direction — always the *target*
    /// language's frequency, since that is what the learner is acquiring.
    public func introductionRank(for direction: Direction) -> Int {
        self[direction.target].frequencyRank
    }
}

// MARK: - Sentence

/// A useful sentence or fixed expression, in both languages.
public struct Sentence: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let it: LanguageSide
    public let ru: LanguageSide
    public let category: Category
    public let difficulty: Int
    /// Concept ids this sentence reinforces.
    public let keywords: [String]
    public let register: Register
    public let note: BilingualNote?
    /// Hand-picked wrong blocks for the sentence-building game, per language.
    /// Generated ones work, but authored ones make a far better exercise.
    public let distractors: [String: [String]]
    /// Other acceptable translations, per language.
    public let alternatives: [String: [String]]
    /// Scenario this sentence belongs to, if any.
    public let scenarioID: String?

    public init(
        id: String,
        it: LanguageSide,
        ru: LanguageSide,
        category: Category,
        difficulty: Int,
        keywords: [String] = [],
        register: Register = .neutral,
        note: BilingualNote? = nil,
        distractors: [String: [String]] = [:],
        alternatives: [String: [String]] = [:],
        scenarioID: String? = nil
    ) {
        self.id = id
        self.it = it
        self.ru = ru
        self.category = category
        self.difficulty = difficulty
        self.keywords = keywords
        self.register = register
        self.note = note
        self.distractors = distractors
        self.alternatives = alternatives
        self.scenarioID = scenarioID
    }

    public subscript(language: Language) -> LanguageSide {
        switch language {
        case .italian: it
        case .russian: ru
        }
    }

    public func distractors(for language: Language) -> [String] {
        distractors[language.rawValue] ?? []
    }

    public func alternatives(for language: Language) -> [String] {
        alternatives[language.rawValue] ?? []
    }

    /// Word count in the given language — decides whether build/gap exercises
    /// are even possible.
    public func wordCount(in language: Language) -> Int {
        self[language].text.split(whereSeparator: \.isWhitespace).count
    }
}

// MARK: - Idiom

/// An expression that cannot be translated literally (§63, §64).
///
/// `boh`, `figurati`, `magari` on the Italian side; `давай`, `ну`, `как раз`
/// on the Russian side. The literal reading is kept precisely *because* it is
/// misleading — showing it next to the real meaning is the teaching moment.
public struct Idiom: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    /// Which language the expression belongs to.
    public let language: Language
    public let expression: String
    public let pronunciation: String?
    /// Word-for-word rendering — often nonsense, and that is the point.
    public let literal: BilingualNote
    /// What it actually means.
    public let meaning: BilingualNote
    /// The closest natural equivalent in the other language.
    public let equivalent: String?
    public let register: Register
    public let usage: BilingualNote
    public let culturalNote: BilingualNote?

    public init(
        id: String,
        language: Language,
        expression: String,
        pronunciation: String? = nil,
        literal: BilingualNote,
        meaning: BilingualNote,
        equivalent: String? = nil,
        register: Register,
        usage: BilingualNote,
        culturalNote: BilingualNote? = nil
    ) {
        self.id = id
        self.language = language
        self.expression = expression
        self.pronunciation = pronunciation
        self.literal = literal
        self.meaning = meaning
        self.equivalent = equivalent
        self.register = register
        self.usage = usage
        self.culturalNote = culturalNote
    }
}
