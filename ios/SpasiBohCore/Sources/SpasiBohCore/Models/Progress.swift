import Foundation

/// What kind of thing progress is being tracked for.
public enum ItemKind: String, Codable, CaseIterable, Sendable, Hashable {
    case warmup, concept, sentence
}

/// The distinct abilities tracked separately for one item.
///
/// This is the §27 requirement, and the biggest departure from Web V1, which
/// collapsed everything into one scalar. Knowing `вода → acqua` at 96% tells
/// you almost nothing about whether the learner can produce `вода` when
/// prompted with `acqua` — that might be 55%. Treating them as one number
/// lets an item look "mastered" when only half of it is.
public enum Skill: String, Codable, CaseIterable, Sendable, Hashable {
    /// target → native. Seeing the foreign word and knowing what it means.
    case recognition
    /// native → target. Producing the foreign word. Much harder.
    case recall
    /// Understanding it when heard.
    case listening
    /// Saying it so a recogniser understands.
    case pronunciation
    /// Writing/assembling it correctly.
    case spelling
    /// Using it inside a sentence.
    case sentenceUsage

    /// Weight in the aggregate mastery roll-up. Production counts for more
    /// than recognition, because recognition is the easy half and letting it
    /// dominate would overstate how well the item is actually known.
    public var masteryWeight: Double {
        switch self {
        case .recognition: 0.15
        case .recall: 0.30
        case .listening: 0.20
        case .pronunciation: 0.10
        case .spelling: 0.10
        case .sentenceUsage: 0.15
        }
    }
}

/// Identifies one trackable ability of one item in one direction.
///
/// Direction is part of the key because the two directions are genuinely
/// different learning tasks over the same content.
public struct ProgressKey: Codable, Hashable, Sendable, CustomStringConvertible {
    public let direction: Direction
    public let kind: ItemKind
    public let itemID: String
    public let skill: Skill

    public init(direction: Direction, kind: ItemKind, itemID: String, skill: Skill) {
        self.direction = direction
        self.kind = kind
        self.itemID = itemID
        self.skill = skill
    }

    /// Stable string form used as the persistence primary key. Built only from
    /// machine identifiers, never from display text (§80).
    public var description: String {
        "\(direction.rawValue)|\(kind.rawValue)|\(itemID)|\(skill.rawValue)"
    }

    public init?(_ string: String) {
        let parts = string.split(separator: "|", omittingEmptySubsequences: false)
        guard parts.count == 4,
              let d = Direction(rawValue: String(parts[0])),
              let k = ItemKind(rawValue: String(parts[1])),
              let s = Skill(rawValue: String(parts[3])),
              !parts[2].isEmpty
        else { return nil }
        self.init(direction: d, kind: k, itemID: String(parts[2]), skill: s)
    }

    /// The same item and direction, without the skill — used to roll up.
    public var itemScope: ItemScope {
        ItemScope(direction: direction, kind: kind, itemID: itemID)
    }
}

/// One item in one direction, across all skills.
public struct ItemScope: Codable, Hashable, Sendable {
    public let direction: Direction
    public let kind: ItemKind
    public let itemID: String

    public init(direction: Direction, kind: ItemKind, itemID: String) {
        self.direction = direction
        self.kind = kind
        self.itemID = itemID
    }

    public func key(_ skill: Skill) -> ProgressKey {
        ProgressKey(direction: direction, kind: kind, itemID: itemID, skill: skill)
    }
}

/// Spaced-repetition state for one skill of one item.
///
/// The scheduling model is ported from Web V1: SM-2's ease factor and
/// multiplicative interval growth, plus a Leitner box for a readable notion of
/// "how far along is this". Deliberately not a faithful SM-2 — answers here are
/// binary right/wrong, not a 0–5 self-grade, because asking a learner to grade
/// their own recall mid-drill breaks the pace.
public struct SkillState: Codable, Hashable, Sendable {
    public var seenCount: Int = 0
    public var correctCount: Int = 0
    public var wrongCount: Int = 0
    public var streak: Int = 0
    public var bestStreak: Int = 0
    public var mastery: Double = 0
    public var ease: Double = SkillState.initialEase
    public var intervalDays: Double = 0
    public var box: Int = 0
    public var lastSeenAt: Date?
    public var firstSeenAt: Date?
    public var nextReviewAt: Date
    /// Most recent first, capped — used to avoid showing the same format twice
    /// in a row, which is what makes a session feel varied rather than a grind.
    public var recentExerciseTypes: [String] = []
    /// 0…1. Rises on misses, decays on hits. Breaks ties between items whose
    /// scheduling state otherwise looks identical.
    public var perceivedDifficulty: Double = 0.5

    // Tuning constants, ported verbatim from the web engine.
    public static let initialEase: Double = 2.5
    public static let minEase: Double = 1.3
    public static let maxEase: Double = 2.8
    public static let maxBox: Int = 5
    public static let targetStreak: Int = 5
    public static let masteryIntervalDays: Double = 21
    public static let minExposures: Int = 3
    public static let maxIntervalDays: Double = 180
    /// A miss reschedules the item ~8 minutes out, i.e. *within the same
    /// session*. This is what makes "no lives" real (§18): a wrong answer buys
    /// you another attempt today, not a lockout.
    public static let relearnDelay: TimeInterval = 8 * 60
    public static let recentTypeMemory: Int = 4

    public init(nextReviewAt: Date = .distantPast) {
        self.nextReviewAt = nextReviewAt
    }

    public var accuracy: Double {
        seenCount == 0 ? 0 : Double(correctCount) / Double(seenCount)
    }

    public var isNew: Bool { seenCount == 0 }

    public var isMastered: Bool {
        mastery >= 0.85 && streak >= Self.targetStreak
    }

    /// Weak = has been seen, has been missed, and is still shaky. Any one of
    /// the three symptoms is enough; requiring all of them would let items with
    /// a good average but a broken streak slip through unreviewed.
    public var isWeak: Bool {
        seenCount > 0 && wrongCount > 0 && (mastery < 0.5 || accuracy < 0.65 || streak == 0)
    }

    public func isDue(at now: Date) -> Bool {
        seenCount > 0 && nextReviewAt <= now
    }

    public func overdueDays(at now: Date) -> Double {
        now.timeIntervalSince(nextReviewAt) / 86_400
    }
}

/// A learner's answer to one exercise.
public struct AnswerOutcome: Sendable, Hashable {
    public let key: ProgressKey
    public let correct: Bool
    public let exerciseType: String
    public let answeredAt: Date
    /// Self-assessed answers (used when the mic is unavailable) must not move
    /// the schedule — an unverified claim of "I said it right" is not evidence.
    public let selfAssessed: Bool

    public init(key: ProgressKey, correct: Bool, exerciseType: String, answeredAt: Date = Date(), selfAssessed: Bool = false) {
        self.key = key
        self.correct = correct
        self.exerciseType = exerciseType
        self.answeredAt = answeredAt
        self.selfAssessed = selfAssessed
    }
}
