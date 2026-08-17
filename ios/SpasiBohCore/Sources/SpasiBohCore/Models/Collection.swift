import Foundation

/// A short piece of cultural context (§21–§22).
///
/// Every card carries a `source`. Nothing is invented: a language app that
/// makes up plausible-sounding facts about a country teaches the learner
/// something worse than nothing, and there is no way for them to tell.
public struct CultureCard: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    /// Which learner this is for — a card about Italian bar etiquette is for
    /// the learner going to Italy.
    public let audience: Direction
    public let title: BilingualNote
    public let body: BilingualNote
    public let symbolName: String
    /// Where the fact comes from. Required by the validator.
    public let source: String
    /// XP at which this card becomes visible.
    public let unlockXP: Int

    public init(
        id: String, audience: Direction, title: BilingualNote, body: BilingualNote,
        symbolName: String, source: String, unlockXP: Int
    ) {
        self.id = id
        self.audience = audience
        self.title = title
        self.body = body
        self.symbolName = symbolName
        self.source = source
        self.unlockXP = unlockXP
    }
}

/// A browsable note about how the language works (§64).
public struct LanguageTip: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    /// The language the tip is *about*, so it can be shown to the right learner.
    public let language: Language
    public let title: BilingualNote
    public let body: BilingualNote
    /// A worked example, when one helps more than prose.
    public let example: BilingualNote?
    public let unlockXP: Int

    public init(
        id: String, language: Language, title: BilingualNote,
        body: BilingualNote, example: BilingualNote? = nil, unlockXP: Int
    ) {
        self.id = id
        self.language = language
        self.title = title
        self.body = body
        self.example = example
        self.unlockXP = unlockXP
    }
}
