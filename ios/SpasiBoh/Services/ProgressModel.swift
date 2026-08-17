import Foundation
import SwiftUI
import SpasiBohCore

/// The app's single source of truth for content and progress.
///
/// `@MainActor` because every reader is a view. The engine underneath is pure
/// and synchronous, so there is nothing to await and no actor hopping — the
/// only I/O is a small atomic file write.
@MainActor
@Observable
final class ProgressModel {
    private(set) var progress: LearnerProgress
    let content: ContentStore
    /// Set when content or progress failed to load, so the UI can say what
    /// broke instead of showing a plausible-looking empty app.
    private(set) var loadFailure: String?

    private let store: ProgressPersisting

    init(store: ProgressPersisting, content: ContentStore) {
        self.store = store
        self.content = content
        do {
            progress = try store.load()
        } catch {
            // Move the unreadable file aside rather than deleting it: the
            // learner has already lost their history, and destroying the
            // evidence means it can never be recovered by hand.
            if let fileStore = store as? FileProgressStore {
                fileStore.quarantineCorruptFile()
            }
            progress = LearnerProgress()
            loadFailure = String(describing: error)
        }
    }

    /// Real app startup. Content failing to load is fatal to the app's purpose,
    /// so it is surfaced rather than papered over with an empty store.
    static func live() -> ProgressModel {
        do {
            let content = try ContentStore.load()
            // UI tests need a known starting point; without this each test
            // inherits whatever the previous one left behind.
            if ProcessInfo.processInfo.environment["SPASIBOH_UITEST_RESET"] == "1" {
                return ProgressModel(store: InMemoryProgressStore(), content: content)
            }
            let store = try FileProgressStore(url: FileProgressStore.defaultURL())
            return ProgressModel(store: store, content: content)
        } catch {
            let model = ProgressModel(store: InMemoryProgressStore(), content: .empty)
            model.loadFailure = String(describing: error)
            return model
        }
    }

    static func preview() -> ProgressModel {
        ProgressModel(
            store: InMemoryProgressStore(),
            content: (try? ContentStore.load()) ?? .empty
        )
    }

    // MARK: - Recording

    /// Fold in one answer and persist. Returns the XP earned.
    ///
    /// Saving on every answer rather than at the end of a session: a session
    /// interrupted by a phone call must not lose the work already done, and the
    /// write is a few kilobytes.
    @discardableResult
    func record(_ outcome: AnswerOutcome) -> Int {
        let xp = progress.record(outcome)
        progress.xp += xp
        persist()
        return xp
    }

    func finishSession(_ record: SessionRecord) {
        progress.sessions.insert(record, at: 0)
        // Keeping every session forever would grow the file without bound for
        // no benefit; the statistics screen shows recent history.
        if progress.sessions.count > 200 { progress.sessions.removeLast() }
        progress.registerStudyDay(record.finishedAt)
        persist()
    }

    func unlock(cultureCard id: String) {
        guard !progress.unlockedCultureCards.contains(id) else { return }
        progress.unlockedCultureCards.insert(id)
        persist()
    }

    func unlock(tip id: String) {
        guard !progress.unlockedTips.contains(id) else { return }
        progress.unlockedTips.insert(id)
        persist()
    }

    func toggleFavourite(_ id: String) {
        if progress.favourites.contains(id) {
            progress.favourites.remove(id)
        } else {
            progress.favourites.insert(id)
        }
        persist()
    }

    func award(achievement id: String, at date: Date = Date()) {
        guard progress.achievements[id] == nil else { return }
        progress.achievements[id] = date
        persist()
    }

    // MARK: - Whole-store operations

    func replaceAll(with newProgress: LearnerProgress) {
        progress = newProgress
        persist()
    }

    func reset() {
        progress = LearnerProgress()
        persist()
    }

    private func persist() {
        do {
            try store.save(progress)
            if loadFailure != nil { loadFailure = nil }
        } catch {
            loadFailure = String(describing: error)
        }
    }

    // MARK: - Derived figures

    func streak(on date: Date = Date()) -> Int {
        progress.effectiveStreak(on: date)
    }

    /// Share of the vocabulary this learner has reached `.good` or better on.
    func vocabularyMastery(for direction: Direction) -> Double {
        let scopes = content.concepts.map { ItemScope(direction: direction, kind: .concept, itemID: $0.id) }
        guard !scopes.isEmpty else { return 0 }
        let known = scopes.filter { progress.mastery(of: $0) >= 0.6 }.count
        return Double(known) / Double(scopes.count)
    }

    /// Overall mastery across everything practised in this direction. Averaged
    /// over *all* content, not just what has been seen — otherwise a learner
    /// who has practised three words sits at 100%.
    func overallMastery(for direction: Direction) -> Double {
        let scopes = content.concepts.map { ItemScope(direction: direction, kind: .concept, itemID: $0.id) }
            + content.sentences.map { ItemScope(direction: direction, kind: .sentence, itemID: $0.id) }
        guard !scopes.isEmpty else { return 0 }
        return scopes.reduce(0.0) { $0 + progress.mastery(of: $1) } / Double(scopes.count)
    }

    func mistakeCount(for direction: Direction) -> Int {
        Set(
            progress.keys(in: direction)
                .filter { progress[$0].wrongCount > 0 && !progress[$0].isMastered }
                .map(\.itemScope)
        ).count
    }
}

extension ContentStore {
    /// Used when content cannot be loaded, so the app can still render an error
    /// screen instead of crashing on launch.
    static let empty = ContentStore(concepts: [], sentences: [], letters: [], patterns: [], scenarios: [])
}

