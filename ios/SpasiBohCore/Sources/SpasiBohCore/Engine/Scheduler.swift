import Foundation

/// Why an item was pulled into a session.
public enum Bucket: String, Codable, CaseIterable, Sendable, Hashable {
    /// Its review date has passed. The backbone of spaced repetition.
    case due
    /// Seen, missed, and still shaky.
    case weak
    /// Never practised in this direction.
    case new
    /// Known well — revisited rarely, only to stop it decaying.
    case mastered
    /// Seen, healthy, and scheduled for the future. Not pulled unless the other
    /// buckets cannot fill the session.
    case resting
}

/// How much of a session each bucket should occupy.
///
/// Ported from the web scheduler. The proportions matter more than they look:
/// a session that is mostly new material feels like drinking from a hose and
/// nothing sticks, while one that is all review never advances.
public struct SessionMix: Sendable, Hashable {
    public let due: Double
    public let weak: Double
    public let new: Double
    public let mastered: Double

    public init(due: Double, weak: Double, new: Double, mastered: Double) {
        self.due = due
        self.weak = weak
        self.new = new
        self.mastered = mastered
    }

    public static let `default` = SessionMix(due: 0.50, weak: 0.25, new: 0.20, mastered: 0.05)

    /// A first session has nothing due and nothing weak, so the default mix
    /// would yield almost nothing. Introduce material instead.
    public static let firstSession = SessionMix(due: 0, weak: 0, new: 1.0, mastered: 0)

    public func share(_ bucket: Bucket) -> Double {
        switch bucket {
        case .due: due
        case .weak: weak
        case .new: new
        case .mastered: mastered
        case .resting: 0
        }
    }
}

public struct PlannedItem: Sendable, Hashable, Identifiable {
    public let scope: ItemScope
    public let bucket: Bucket
    public let urgency: Double

    public var id: String { "\(scope.direction.rawValue)|\(scope.kind.rawValue)|\(scope.itemID)" }

    public init(scope: ItemScope, bucket: Bucket, urgency: Double) {
        self.scope = scope
        self.bucket = bucket
        self.urgency = urgency
    }
}

/// Decides *what* to practise. It does not decide *how* — that is
/// `ExerciseFactory`'s job, and keeping them apart is what lets the same item
/// come back in a different format tomorrow.
public enum Scheduler {

    /// Classify one item for one direction.
    public static func classify(
        _ scope: ItemScope,
        progress: LearnerProgress,
        now: Date
    ) -> Bucket {
        let skills = progress.skills(of: scope)
        guard !skills.isEmpty, skills.values.contains(where: { $0.seenCount > 0 }) else { return .new }
        if skills.values.contains(where: { $0.isDue(at: now) }) { return .due }
        if skills.values.contains(where: { $0.isWeak }) { return .weak }
        if Mastery.aggregate(skills) >= 0.85 { return .mastered }
        return .resting
    }

    /// How badly an item wants attention within its bucket.
    ///
    /// `introductionRank` only matters for new items, where it is the whole
    /// story: new material must arrive in target-language frequency order, not
    /// at random, or the learner meets `soltanto` before `sì`.
    public static func urgency(
        _ scope: ItemScope,
        bucket: Bucket,
        progress: LearnerProgress,
        introductionRank: Int,
        now: Date
    ) -> Double {
        let skills = progress.skills(of: scope)
        let mastery = Mastery.aggregate(skills)
        switch bucket {
        case .new:
            // Rank 1 → 1.0, rank 600 → ~0.0. Monotonic, bounded, no cliff.
            return 1 / (1 + Double(max(0, introductionRank)) / 50)
        case .due, .mastered:
            let overdue = skills.values.map { $0.overdueDays(at: now) }.max() ?? 0
            return min(overdue / 7, 1.5) + (1 - mastery)
        case .weak:
            let difficulty = skills.values.map(\.perceivedDifficulty).max() ?? 0.5
            return (1 - mastery) + difficulty
        case .resting:
            return 1 - mastery
        }
    }

    /// Build the practice list for a session.
    ///
    /// `orderedScopes` must already be in introduction order — the index inside
    /// it *is* the introduction rank, which keeps this function independent of
    /// what kind of content it is scheduling.
    public static func plan(
        orderedScopes: [ItemScope],
        progress: LearnerProgress,
        now: Date,
        count: Int,
        mix: SessionMix = .default,
        seed: String
    ) -> [PlannedItem] {
        guard count > 0, !orderedScopes.isEmpty else { return [] }

        var buckets: [Bucket: [PlannedItem]] = [:]
        for (rank, scope) in orderedScopes.enumerated() {
            let bucket = classify(scope, progress: progress, now: now)
            let score = urgency(scope, bucket: bucket, progress: progress, introductionRank: rank, now: now)
            buckets[bucket, default: []].append(PlannedItem(scope: scope, bucket: bucket, urgency: score))
        }
        for key in buckets.keys {
            buckets[key]?.sort { $0.urgency > $1.urgency }
        }

        // A learner with nothing due and nothing weak is on their first
        // sessions; the standard mix would hand them three items.
        let effectiveMix = (buckets[.due]?.isEmpty ?? true) && (buckets[.weak]?.isEmpty ?? true)
            ? SessionMix.firstSession
            : mix

        var chosen: [PlannedItem] = []
        var taken: Set<String> = []
        for bucket in [Bucket.due, .weak, .new, .mastered] {
            let want = Int((Double(count) * effectiveMix.share(bucket)).rounded())
            for item in (buckets[bucket] ?? []).prefix(want) where !taken.contains(item.id) {
                chosen.append(item)
                taken.insert(item.id)
            }
        }

        // Backfill in priority order so a short session is never returned just
        // because one bucket happened to be empty.
        if chosen.count < count {
            for bucket in [Bucket.due, .weak, .new, .resting, .mastered] {
                for item in buckets[bucket] ?? [] where !taken.contains(item.id) {
                    chosen.append(item)
                    taken.insert(item.id)
                    if chosen.count == count { break }
                }
                if chosen.count == count { break }
            }
        }

        var generator = SeededGenerator(seed: seed)
        return Array(chosen.shuffled(using: &generator).prefix(count))
    }
}
