import Foundation

/// The formats an item can be practised in.
///
/// Kind and `Skill` are deliberately separate: several kinds train the same
/// skill (a gap-fill and a build both train sentence usage), and the schedule
/// is kept per skill while variety is kept per kind.
public enum ExerciseKind: String, Codable, CaseIterable, Sendable, Hashable {
    /// Target word shown, pick what it means. The easy half.
    case recognition
    /// Native word shown, pick the target word. Production — much harder.
    case recall
    /// Hear the target word, pick what it means.
    case listening
    /// Say the target word out loud.
    case pronunciation
    /// Assemble the target word from letter tiles.
    case spelling
    /// Assemble the target sentence from word blocks.
    case sentenceBuild
    /// One word removed from the target sentence — put it back.
    case sentenceGap
    /// An NPC line, pick the right reply.
    case sentenceReply
    /// Warm-up: a Cyrillic letter, pick the sound it makes.
    case letterSound
    /// Warm-up: a sound, pick the letter that writes it.
    case letterRecognize
    /// Warm-up: an Italian spelling pattern, pick how it sounds.
    case patternSound
    /// Warm-up: a minimal pair — pick which word was meant.
    case minimalPair

    public var skill: Skill {
        switch self {
        case .recognition, .letterRecognize, .patternSound: .recognition
        case .recall, .letterSound: .recall
        case .listening, .minimalPair: .listening
        case .pronunciation: .pronunciation
        case .spelling: .spelling
        case .sentenceBuild, .sentenceGap, .sentenceReply: .sentenceUsage
        }
    }

    /// Whether answering needs the microphone. Used to skip these entirely when
    /// permission was refused, rather than showing an exercise that cannot be
    /// completed (§90).
    public var needsMicrophone: Bool { self == .pronunciation }

    /// Whether the prompt is audio-only, so it must autoplay and offer a replay.
    public var isAudioPrompt: Bool { self == .listening || self == .minimalPair }
}

/// One selectable answer.
public struct ExerciseOption: Sendable, Hashable, Identifiable {
    public let id: Int
    public let text: String
    /// Transliteration or stress hint shown small under the option.
    public let subtitle: String?
    /// Which language this option is written in — drives the font and the
    /// speech locale if the learner taps to hear it.
    public let language: Language?

    public init(id: Int, text: String, subtitle: String? = nil, language: Language? = nil) {
        self.id = id
        self.text = text
        self.subtitle = subtitle
        self.language = language
    }
}

/// Something to speak, and in which language. Both fields matter: speaking
/// Russian text through an Italian voice produces nonsense.
public struct AudioCue: Sendable, Hashable {
    public let text: String
    public let language: Language

    public init(text: String, language: Language) {
        self.text = text
        self.language = language
    }
}

/// A single question, fully specified and free of UI copy.
///
/// Instruction text ("Choose the meaning") is **not** here — that is interface
/// language and belongs to the app layer, which knows which of the two UI
/// languages to render it in. Everything in this struct is either content or a
/// machine value.
public struct Exercise: Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: ExerciseKind
    public let key: ProgressKey

    /// The main thing shown. Empty for audio-only prompts.
    public let promptText: String
    /// Stress form, transliteration, or the native gloss — shown smaller.
    public let promptSubtitle: String?
    public let promptLanguage: Language?
    /// A line spoken by a character, for scenario and reply exercises.
    public let speakerLine: String?

    public let options: [ExerciseOption]
    public let correctOption: Int?

    /// Free-text / speech / assembly answer.
    public let expected: String?
    public let expectedLanguage: Language?
    public let acceptedAlternatives: [String]
    /// Tiles or word blocks, already shuffled.
    public let blocks: [String]

    public let audio: AudioCue?
    /// Shown after answering, in whichever language the learner reads.
    public let note: BilingualNote?

    public init(
        id: String,
        kind: ExerciseKind,
        key: ProgressKey,
        promptText: String,
        promptSubtitle: String? = nil,
        promptLanguage: Language? = nil,
        speakerLine: String? = nil,
        options: [ExerciseOption] = [],
        correctOption: Int? = nil,
        expected: String? = nil,
        expectedLanguage: Language? = nil,
        acceptedAlternatives: [String] = [],
        blocks: [String] = [],
        audio: AudioCue? = nil,
        note: BilingualNote? = nil
    ) {
        self.id = id
        self.kind = kind
        self.key = key
        self.promptText = promptText
        self.promptSubtitle = promptSubtitle
        self.promptLanguage = promptLanguage
        self.speakerLine = speakerLine
        self.options = options
        self.correctOption = correctOption
        self.expected = expected
        self.expectedLanguage = expectedLanguage
        self.acceptedAlternatives = acceptedAlternatives
        self.blocks = blocks
        self.audio = audio
        self.note = note
    }

    /// Grade a tapped option.
    public func isCorrect(option index: Int) -> Bool {
        correctOption == index
    }

    /// Grade typed or assembled text. Normalization is direction-aware — this
    /// is where Web V1 had a real bug, normalizing both sides as Russian and
    /// letting the spelling exercise skip normalization entirely.
    public func isCorrect(text: String) -> Bool {
        guard let expected, let language = expectedLanguage else { return false }
        if TextNormalization.matches(text, expected: expected, language: language) { return true }
        return acceptedAlternatives.contains {
            TextNormalization.matches(text, expected: $0, language: language)
        }
    }

    /// Grade speech-recognition output.
    public func matchSpeech(_ transcripts: [String]) -> TextNormalization.SpeechMatch {
        guard let expected, let language = expectedLanguage else {
            return .init(matched: false, score: 0, bestTranscript: "")
        }
        return TextNormalization.matchSpeech(
            transcripts: transcripts,
            expected: expected,
            accepting: acceptedAlternatives,
            language: language
        )
    }
}
