import Foundation

/// The two languages the app knows about.
///
/// Neither language is privileged: `Language` is only ever used to *select a
/// side* of a bilingual record. Web V1 hard-coded Russian as "the subject" and
/// Italian as "the explanation"; here they are peers.
public enum Language: String, Codable, CaseIterable, Sendable, Hashable {
    case italian = "it"
    case russian = "ru"

    /// BCP-47 locale used for speech synthesis and recognition.
    public var speechLocale: String {
        switch self {
        case .italian: "it-IT"
        case .russian: "ru-RU"
        }
    }

    public var flag: String {
        switch self {
        case .italian: "🇮🇹"
        case .russian: "🇷🇺"
        }
    }

    /// The endonym — how the language names itself. Used on the onboarding
    /// screen, where the learner does not yet have a UI language.
    public var endonym: String {
        switch self {
        case .italian: "Italiano"
        case .russian: "Русский"
        }
    }

    public var other: Language {
        switch self {
        case .italian: .russian
        case .russian: .italian
        }
    }
}

/// Which way the learner is studying.
///
/// This is the single most load-bearing value in the app: it selects the UI
/// language, the target language, the warm-up, the scenario set, the culture
/// cards, and the direction-specific half of every progress record.
public enum Direction: String, Codable, CaseIterable, Sendable, Hashable {
    /// Italian speaker learning Russian. UI in Italian.
    case itToRu = "it-ru"
    /// Russian speaker learning Italian. UI in Russian.
    case ruToIt = "ru-it"

    /// The learner's own language. Also the UI language (§12).
    public var native: Language {
        switch self {
        case .itToRu: .italian
        case .ruToIt: .russian
        }
    }

    /// The language being learned.
    public var target: Language {
        switch self {
        case .itToRu: .russian
        case .ruToIt: .italian
        }
    }

    public init(native: Language) {
        self = native == .italian ? .itToRu : .ruToIt
    }

    public var flipped: Direction {
        switch self {
        case .itToRu: .ruToIt
        case .ruToIt: .itToRu
        }
    }
}

/// How appropriate an expression is in a given social setting (§94).
public enum Register: String, Codable, CaseIterable, Sendable, Hashable {
    case formal
    case neutral
    case informal
    case colloquial
    case slang
    case vulgar
    case regional
}
