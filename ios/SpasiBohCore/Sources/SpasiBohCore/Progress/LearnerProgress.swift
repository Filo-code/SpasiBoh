import Foundation

/// One completed study session, kept for the history screen (§103).
public struct SessionRecord: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let direction: Direction
    public let startedAt: Date
    public let finishedAt: Date
    public let answered: Int
    public let correct: Int
    public let xpEarned: Int

    public init(
        id: String, direction: Direction, startedAt: Date, finishedAt: Date,
        answered: Int, correct: Int, xpEarned: Int
    ) {
        self.id = id
        self.direction = direction
        self.startedAt = startedAt
        self.finishedAt = finishedAt
        self.answered = answered
        self.correct = correct
        self.xpEarned = xpEarned
    }

    public var accuracy: Double {
        answered == 0 ? 0 : Double(correct) / Double(answered)
    }

    public var duration: TimeInterval { finishedAt.timeIntervalSince(startedAt) }
}

/// Everything the learner has earned, in one value type.
///
/// A single Codable snapshot rather than a row-per-record database. The data is
/// small (a few thousand small structs), single-user, never synced and never
/// queried by anything but this app, so a relational store would buy nothing
/// and cost a schema. It also means export/import (§105) is the same code path
/// as saving, instead of a second serialization format that can drift.
///
/// **Migration safety**: every field decodes with a default, so adding one in a
/// later version reads old files without a migration step. `version` exists so
/// a genuinely breaking change can be detected rather than silently misread.
public struct LearnerProgress: Codable, Sendable, Hashable {
    public static let currentVersion = 1

    public var version: Int
    /// Keyed by `ProgressKey.description` — a plain string so the JSON stays
    /// readable and diffable. A struct key would encode as a positional array.
    public var states: [String: SkillState]
    public var xp: Int
    public var currentStreak: Int
    public var bestStreak: Int
    /// Local calendar day of the last completed session, `yyyy-MM-dd`.
    public var lastStudyDay: String?
    public var sessions: [SessionRecord]
    public var unlockedCultureCards: Set<String>
    public var unlockedTips: Set<String>
    /// Achievement id → when it was earned.
    public var achievements: [String: Date]
    /// Concept/sentence ids the learner has explicitly starred.
    public var favourites: Set<String>

    public init(
        version: Int = LearnerProgress.currentVersion,
        states: [String: SkillState] = [:],
        xp: Int = 0,
        currentStreak: Int = 0,
        bestStreak: Int = 0,
        lastStudyDay: String? = nil,
        sessions: [SessionRecord] = [],
        unlockedCultureCards: Set<String> = [],
        unlockedTips: Set<String> = [],
        achievements: [String: Date] = [:],
        favourites: Set<String> = []
    ) {
        self.version = version
        self.states = states
        self.xp = xp
        self.currentStreak = currentStreak
        self.bestStreak = bestStreak
        self.lastStudyDay = lastStudyDay
        self.sessions = sessions
        self.unlockedCultureCards = unlockedCultureCards
        self.unlockedTips = unlockedTips
        self.achievements = achievements
        self.favourites = favourites
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = try c.decodeIfPresent(Int.self, forKey: .version) ?? Self.currentVersion
        states = try c.decodeIfPresent([String: SkillState].self, forKey: .states) ?? [:]
        xp = try c.decodeIfPresent(Int.self, forKey: .xp) ?? 0
        currentStreak = try c.decodeIfPresent(Int.self, forKey: .currentStreak) ?? 0
        bestStreak = try c.decodeIfPresent(Int.self, forKey: .bestStreak) ?? 0
        lastStudyDay = try c.decodeIfPresent(String.self, forKey: .lastStudyDay)
        sessions = try c.decodeIfPresent([SessionRecord].self, forKey: .sessions) ?? []
        unlockedCultureCards = try c.decodeIfPresent(Set<String>.self, forKey: .unlockedCultureCards) ?? []
        unlockedTips = try c.decodeIfPresent(Set<String>.self, forKey: .unlockedTips) ?? []
        achievements = try c.decodeIfPresent([String: Date].self, forKey: .achievements) ?? [:]
        favourites = try c.decodeIfPresent(Set<String>.self, forKey: .favourites) ?? []
    }

    // MARK: - Reading

    public subscript(key: ProgressKey) -> SkillState {
        get { states[key.description] ?? SkillState() }
        set { states[key.description] = newValue }
    }

    public func skills(of scope: ItemScope) -> [Skill: SkillState] {
        var result: [Skill: SkillState] = [:]
        for skill in Skill.allCases {
            if let state = states[scope.key(skill).description] {
                result[skill] = state
            }
        }
        return result
    }

    /// Aggregate mastery of one item in one direction. 0 when never practised.
    public func mastery(of scope: ItemScope) -> Double {
        Mastery.aggregate(skills(of: scope))
    }

    public func level(of scope: ItemScope) -> MasteryLevel {
        let practised = skills(of: scope)
        let seen = practised.values.reduce(0) { $0 + $1.seenCount }
        return Mastery.level(mastery(of: scope), seenCount: seen)
    }

    /// Every key recorded for one direction. Used by statistics and by the
    /// mistake review, which must not leak items from the other direction.
    public func keys(in direction: Direction) -> [ProgressKey] {
        states.keys.compactMap(ProgressKey.init).filter { $0.direction == direction }
    }

    // MARK: - Writing

    /// Fold one answer in and return the XP it earned.
    ///
    /// XP is awarded here rather than in the UI so that every path that records
    /// an answer — daily session, free training, scenario — earns consistently
    /// and cannot forget to.
    @discardableResult
    public mutating func record(_ outcome: AnswerOutcome) -> Int {
        guard !outcome.selfAssessed else { return 0 }
        let before = self[outcome.key]
        let after = Mastery.apply(outcome, to: before)
        self[outcome.key] = after

        guard outcome.correct else { return 0 }
        // Harder skills pay more, and a first-time-right answer pays a small
        // bonus — otherwise re-drilling easy items is the fastest way to level,
        // which is exactly the wrong incentive.
        let base = 10.0 * outcome.key.skill.masteryWeight / Skill.recognition.masteryWeight
        let firstTime = before.seenCount == 0 ? 5.0 : 0
        let streakBonus = min(Double(after.streak), 5)
        return Int((base * 0.5 + firstTime + streakBonus).rounded())
    }

    /// Update the day streak. Idempotent within a single day.
    public mutating func registerStudyDay(_ date: Date, calendar: Calendar = .current) {
        let today = Self.dayString(date, calendar: calendar)
        guard lastStudyDay != today else { return }

        if let last = lastStudyDay,
           let lastDate = Self.day(from: last, calendar: calendar),
           let yesterday = calendar.date(byAdding: .day, value: -1, to: calendar.startOfDay(for: date)),
           calendar.isDate(lastDate, inSameDayAs: yesterday) {
            currentStreak += 1
        } else {
            currentStreak = 1
        }
        bestStreak = max(bestStreak, currentStreak)
        lastStudyDay = today
    }

    /// A streak the learner has already broken must not keep being displayed as
    /// live. Called on read, so opening the app after a gap tells the truth.
    public func effectiveStreak(on date: Date, calendar: Calendar = .current) -> Int {
        guard let last = lastStudyDay, let lastDate = Self.day(from: last, calendar: calendar) else { return 0 }
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: lastDate), to: calendar.startOfDay(for: date)).day ?? 0
        return days <= 1 ? currentStreak : 0
    }

    // MARK: - Day formatting

    /// `yyyy-MM-dd` in the *local* calendar with a fixed POSIX locale, so the
    /// string is stable regardless of the device's language and does not shift
    /// under a Russian or Italian locale's formatting rules.
    public static func dayString(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func day(from string: String, calendar: Calendar = .current) -> Date? {
        let parts = string.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        return calendar.date(from: components)
    }
}
