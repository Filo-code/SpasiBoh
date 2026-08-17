import Foundation

/// A warm-up item — the thing drilled in the first stage of a daily session.
///
/// Both directions get a warm-up, but they are teaching genuinely different
/// problems, so this is an enum rather than a forced common shape:
///
/// - Italian → Russian: the script itself. Cyrillic is unreadable at first and
///   several letters are false friends of Latin ones (В Н Р С У Х).
/// - Russian → Italian: **not** the Latin alphabet, which a Russian speaker
///   already reads. The real difficulty is Italian orthography — GLI, GN, SC,
///   the hard/soft C and G, and double consonants that change meaning (§33).
public enum WarmupItem: Codable, Identifiable, Hashable, Sendable {
    case letter(CyrillicLetter)
    case pattern(ItalianPattern)

    public var id: String {
        switch self {
        case .letter(let l): "letter_\(l.id)"
        case .pattern(let p): "pattern_\(p.id)"
        }
    }

    /// Which learning direction this item belongs to.
    public var direction: Direction {
        switch self {
        case .letter: .itToRu
        case .pattern: .ruToIt
        }
    }
}

// MARK: - Russian warm-up

/// One letter of the Russian alphabet.
public struct CyrillicLetter: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let upper: String
    public let lower: String
    /// The letter's name in Russian, e.g. `жэ`.
    public let name: String
    /// How it sounds, written for an Italian ear rather than in IPA — the goal
    /// is that reading it aloud produces something a Russian understands.
    public let pronunciation: String
    /// Short Latin key used as a multiple-choice option, e.g. `zh`.
    public let soundKey: String
    public let exampleWord: String
    public let exampleWordTranslated: String
    public let exampleWordTranslit: String
    /// Letters genuinely easy to confuse with this one — either because they
    /// look like a Latin letter with a different value, or because they sound
    /// close (Ш/Щ, Ц/Ч, Ы/И). Used to build *hard* distractors rather than
    /// random ones, which is what makes the drill worth doing.
    public let confusableWith: [String]
    /// `false` for ъ and ь, which have no sound of their own.
    public let hasSound: Bool
    /// True for the Latin look-alikes that cause the most beginner errors.
    public let isFalseFriend: Bool
    public let note: BilingualNote?
    public let order: Int

    public init(
        id: String, upper: String, lower: String, name: String,
        pronunciation: String, soundKey: String,
        exampleWord: String, exampleWordTranslated: String, exampleWordTranslit: String,
        confusableWith: [String], hasSound: Bool, isFalseFriend: Bool = false,
        note: BilingualNote? = nil, order: Int
    ) {
        self.id = id
        self.upper = upper
        self.lower = lower
        self.name = name
        self.pronunciation = pronunciation
        self.soundKey = soundKey
        self.exampleWord = exampleWord
        self.exampleWordTranslated = exampleWordTranslated
        self.exampleWordTranslit = exampleWordTranslit
        self.confusableWith = confusableWith
        self.hasSound = hasSound
        self.isFalseFriend = isFalseFriend
        self.note = note
        self.order = order
    }
}

// MARK: - Italian warm-up

/// What kind of Italian pronunciation problem a pattern teaches.
public enum ItalianPatternKind: String, Codable, CaseIterable, Sendable, Hashable {
    /// GLI, GN, SC, CI/CE, CHI/CHE, GI/GE, GHI/GHE, QU.
    case digraph
    /// Consonant length that changes meaning: `pala` / `palla`.
    case doubleConsonant
    /// Stress that is not on the penultimate syllable: `àbito`, `tèlefono`.
    case stress
    /// Voiced vs voiceless Z, open vs closed E/O.
    case vowelOrZ
}

/// An Italian spelling/sound pattern worth drilling.
public struct ItalianPattern: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let kind: ItalianPatternKind
    /// The grapheme or contrast being taught: `"gli"`, `"pala / palla"`.
    public let pattern: String
    /// How it sounds, written for a Russian ear.
    public let pronunciation: String
    /// Short key used as a multiple-choice option.
    public let soundKey: String
    public let exampleWord: String
    public let exampleWordTranslated: String
    /// Words that look similar but sound different — the hard distractors.
    public let confusableWith: [String]
    /// For `doubleConsonant`, the two words of the minimal pair and what each
    /// one means. This is the whole lesson: consonant length carries meaning.
    public let minimalPair: MinimalPair?
    public let note: BilingualNote?
    public let order: Int

    public init(
        id: String, kind: ItalianPatternKind, pattern: String,
        pronunciation: String, soundKey: String,
        exampleWord: String, exampleWordTranslated: String,
        confusableWith: [String] = [], minimalPair: MinimalPair? = nil,
        note: BilingualNote? = nil, order: Int
    ) {
        self.id = id
        self.kind = kind
        self.pattern = pattern
        self.pronunciation = pronunciation
        self.soundKey = soundKey
        self.exampleWord = exampleWord
        self.exampleWordTranslated = exampleWordTranslated
        self.confusableWith = confusableWith
        self.minimalPair = minimalPair
        self.note = note
        self.order = order
    }
}

/// Two Italian words differing only in consonant length (§35).
public struct MinimalPair: Codable, Hashable, Sendable {
    public let short: String
    public let shortMeaning: BilingualNote
    public let long: String
    public let longMeaning: BilingualNote

    public init(short: String, shortMeaning: BilingualNote, long: String, longMeaning: BilingualNote) {
        self.short = short
        self.shortMeaning = shortMeaning
        self.long = long
        self.longMeaning = longMeaning
    }
}
