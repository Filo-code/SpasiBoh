import Foundation

/// Where progress lives.
///
/// A protocol so the engine and the views can be exercised against an in-memory
/// store, and so the on-disk format is one replaceable detail rather than
/// something every call site knows about.
public protocol ProgressPersisting: Sendable {
    func load() throws -> LearnerProgress
    func save(_ progress: LearnerProgress) throws
}

/// JSON on disk, written atomically.
///
/// Atomic matters: the app saves after every answer, and a process killed
/// mid-write must not leave a half-file that loses everything the learner has
/// done. `Data.write(options: .atomic)` writes to a temporary file and renames,
/// so the old file survives intact until the new one is complete.
public struct FileProgressStore: ProgressPersisting {
    public let url: URL

    public init(url: URL) {
        self.url = url
    }

    /// `Application Support/SpasiBoh/progress.json`.
    ///
    /// Not Documents: this is app data the learner never browses, and putting
    /// it in Documents would expose it in Files. Not Caches: the system may
    /// delete Caches under pressure, and that would silently erase months of
    /// work.
    public static func defaultURL(
        for directory: FileManager.SearchPathDirectory = .applicationSupportDirectory
    ) throws -> URL {
        let base = try FileManager.default.url(
            for: directory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        let folder = base.appendingPathComponent("SpasiBoh", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("progress.json")
    }

    public func load() throws -> LearnerProgress {
        guard FileManager.default.fileExists(atPath: url.path) else { return LearnerProgress() }
        let data = try Data(contentsOf: url)
        return try Self.decoder.decode(LearnerProgress.self, from: data)
    }

    public func save(_ progress: LearnerProgress) throws {
        try Self.encoder.encode(progress).write(to: url, options: .atomic)
    }

    /// Move a corrupt file aside instead of deleting it.
    ///
    /// If the file will not decode, the learner has already lost their history;
    /// destroying the evidence as well means it can never be recovered by hand.
    @discardableResult
    public func quarantineCorruptFile() -> URL? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let backup = url.deletingLastPathComponent()
            .appendingPathComponent("progress-corrupt-\(Int(Date().timeIntervalSince1970)).json")
        try? FileManager.default.moveItem(at: url, to: backup)
        return backup
    }

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }()

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

/// Non-persisting store for previews and tests.
public final class InMemoryProgressStore: ProgressPersisting, @unchecked Sendable {
    private let lock = NSLock()
    private var progress: LearnerProgress

    public init(_ progress: LearnerProgress = LearnerProgress()) {
        self.progress = progress
    }

    public func load() throws -> LearnerProgress {
        lock.withLock { progress }
    }

    public func save(_ progress: LearnerProgress) throws {
        lock.withLock { self.progress = progress }
    }
}

// MARK: - Export / import

/// Reading and writing the transfer format (§105).
///
/// The archive is the same shape as the on-disk file plus a small header, so
/// there is exactly one serialization of progress in the app. A second format
/// would drift from the first the moment a field is added.
public enum ProgressArchive {

    public struct Envelope: Codable, Sendable {
        public let app: String
        public let format: Int
        public let exportedAt: Date
        public let progress: LearnerProgress

        public init(progress: LearnerProgress, exportedAt: Date = Date()) {
            self.app = "SpasiBoh"
            self.format = LearnerProgress.currentVersion
            self.exportedAt = exportedAt
            self.progress = progress
        }
    }

    public enum ImportError: Error, CustomStringConvertible, Equatable {
        case notSpasiBohData
        case unsupportedFormat(Int)
        case unreadable(String)

        public var description: String {
            switch self {
            case .notSpasiBohData: "This file is not a SpasiBoh! export."
            case .unsupportedFormat(let v): "Export format \(v) is newer than this version of the app."
            case .unreadable(let detail): "The file could not be read: \(detail)"
            }
        }
    }

    public static func export(_ progress: LearnerProgress, at date: Date = Date()) throws -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(Envelope(progress: progress, exportedAt: date))
    }

    /// Parse and validate — but never apply.
    ///
    /// Returning the parsed value instead of writing it is what makes "never
    /// silently overwrite" (§105) enforceable: the caller has to show the
    /// learner what is about to replace their data and get a yes.
    public static func parse(_ data: Data) throws -> Envelope {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let envelope: Envelope
        do {
            envelope = try decoder.decode(Envelope.self, from: data)
        } catch {
            // A plain LearnerProgress with no envelope is not accepted: without
            // the header there is no way to tell a SpasiBoh export from any
            // other JSON that happens to decode into mostly-default fields.
            throw ImportError.unreadable(String(describing: error))
        }
        guard envelope.app == "SpasiBoh" else { throw ImportError.notSpasiBohData }
        guard envelope.format <= LearnerProgress.currentVersion else {
            throw ImportError.unsupportedFormat(envelope.format)
        }
        return envelope
    }

    /// A short human summary, so the confirmation dialog can say what will
    /// actually be replaced rather than asking for a blind yes.
    public struct Summary: Sendable, Hashable {
        public let exportedAt: Date
        public let trackedItems: Int
        public let xp: Int
        public let streak: Int
        public let sessions: Int
    }

    public static func summary(of envelope: Envelope) -> Summary {
        let scopes = Set(envelope.progress.states.keys.compactMap(ProgressKey.init).map(\.itemScope))
        return Summary(
            exportedAt: envelope.exportedAt,
            trackedItems: scopes.count,
            xp: envelope.progress.xp,
            streak: envelope.progress.currentStreak,
            sessions: envelope.progress.sessions.count
        )
    }
}
