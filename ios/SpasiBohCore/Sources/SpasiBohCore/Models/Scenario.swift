import Foundation

/// What the learner does at one beat of a scenario.
public enum ScenarioStepKind: String, Codable, CaseIterable, Sendable, Hashable {
    /// The NPC speaks; the learner picks what it meant, in their own language.
    case comprehension
    /// The learner assembles a reply in the target language from blocks.
    case build
    /// The learner picks the appropriate target-language reply.
    case choice
    /// The learner says the line out loud.
    case pronounce
    /// Narrative beat, no answer required. Used sparingly, to set a scene.
    case info
}

/// One beat of a scenario conversation.
///
/// Language-neutral by construction: `npc` and `target` are `LanguageSide`
/// pairs, so the same step works whichever direction the learner is studying —
/// the NPC speaks the target language, the learner answers in it, and the
/// comprehension options are rendered in the learner's native language.
public struct ScenarioStep: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let kind: ScenarioStepKind
    /// What the NPC says immediately before this step, in both languages.
    public let npcIt: LanguageSide?
    public let npcRu: LanguageSide?
    /// The instruction shown above the exercise, in both languages.
    public let prompt: BilingualNote
    /// The line the learner must produce, in both languages.
    public let targetIt: LanguageSide?
    public let targetRu: LanguageSide?
    /// Extra blocks mixed into the correct ones for `build` steps, per language.
    public let distractors: [String: [String]]
    /// Options for `comprehension` (shown in native) and `choice` (in target).
    public let optionsIt: [String]
    public let optionsRu: [String]
    public let correctOption: Int?
    public let hint: BilingualNote?

    public init(
        id: String, kind: ScenarioStepKind,
        npcIt: LanguageSide? = nil, npcRu: LanguageSide? = nil,
        prompt: BilingualNote,
        targetIt: LanguageSide? = nil, targetRu: LanguageSide? = nil,
        distractors: [String: [String]] = [:],
        optionsIt: [String] = [], optionsRu: [String] = [],
        correctOption: Int? = nil, hint: BilingualNote? = nil
    ) {
        self.id = id
        self.kind = kind
        self.npcIt = npcIt
        self.npcRu = npcRu
        self.prompt = prompt
        self.targetIt = targetIt
        self.targetRu = targetRu
        self.distractors = distractors
        self.optionsIt = optionsIt
        self.optionsRu = optionsRu
        self.correctOption = correctOption
        self.hint = hint
    }

    public func npc(_ language: Language) -> LanguageSide? {
        switch language {
        case .italian: npcIt
        case .russian: npcRu
        }
    }

    public func target(_ language: Language) -> LanguageSide? {
        switch language {
        case .italian: targetIt
        case .russian: targetRu
        }
    }

    public func options(_ language: Language) -> [String] {
        switch language {
        case .italian: optionsIt
        case .russian: optionsRu
        }
    }

    public func distractors(for language: Language) -> [String] {
        distractors[language.rawValue] ?? []
    }
}

/// A practical situation played as a short interactive dialogue (§58–§61).
///
/// Scenarios are **not** mirrored translations. The Russia set and the Italy
/// set are authored separately around what actually happens in each country:
/// validating a regional ticket and drinking a coffee standing at the bar are
/// Italian problems; buying a metro ticket at a kassa is a Russian one.
public struct Scenario: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    /// Which learner this scenario is for — determined by where it is set.
    public let direction: Direction
    public let title: BilingualNote
    /// SF Symbol for the scenario card.
    public let symbolName: String
    /// One-line setup shown before the scenario starts.
    public let intro: BilingualNote
    public let category: Category
    public let difficulty: Int
    public let steps: [ScenarioStep]

    public init(
        id: String, direction: Direction, title: BilingualNote,
        symbolName: String, intro: BilingualNote,
        category: Category, difficulty: Int, steps: [ScenarioStep]
    ) {
        self.id = id
        self.direction = direction
        self.title = title
        self.symbolName = symbolName
        self.intro = intro
        self.category = category
        self.difficulty = difficulty
        self.steps = steps
    }

    /// Steps that actually require an answer.
    public var answerableSteps: [ScenarioStep] {
        steps.filter { $0.kind != .info }
    }
}
