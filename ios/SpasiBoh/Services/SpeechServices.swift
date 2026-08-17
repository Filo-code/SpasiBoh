import Foundation
import AVFoundation
import Speech
import SpasiBohCore

// MARK: - Speaking

/// Text-to-speech, behind a protocol so exercise logic can be tested without a
/// simulator and without audio.
@MainActor
protocol Speaking: AnyObject {
    func speak(_ cue: AudioCue, slow: Bool)
    func stop()
    /// Whether a voice for this language is actually installed. The simulator
    /// often has one; a real device may not, and pretending otherwise means a
    /// silent listening exercise the learner cannot answer.
    func hasVoice(for language: Language) -> Bool
}

@MainActor
final class SpeechSynthesizer: NSObject, Speaking {
    private let synthesizer = AVSpeechSynthesizer()

    /// Slow playback rate for the "say it again, slower" control (§36).
    /// Not `minimumSpeechRate`, which is so slow the prosody falls apart and
    /// stops resembling the language.
    private static let slowRate = AVSpeechUtteranceDefaultSpeechRate * 0.55
    private static let normalRate = AVSpeechUtteranceDefaultSpeechRate * 0.92

    private var sessionConfigured = false

    /// Configured on first use, not in `init`.
    ///
    /// SwiftUI builds the default value of every `@State` property each time a
    /// view is initialised, so doing this eagerly would duck whatever the
    /// learner is listening to the moment a screen is constructed — before a
    /// single word has been spoken.
    private func configureSessionIfNeeded() {
        guard !sessionConfigured else { return }
        // `.playback` rather than `.ambient`: the learner is listening to a
        // word they must repeat, and having it silenced by the ring switch
        // makes the exercise unanswerable with no visible cause.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? AVAudioSession.sharedInstance().setActive(true, options: [])
        sessionConfigured = true
    }

    func speak(_ cue: AudioCue, slow: Bool = false) {
        guard !cue.text.isEmpty else { return }
        configureSessionIfNeeded()
        stop()
        let utterance = AVSpeechUtterance(string: cue.text)
        utterance.voice = Self.voice(for: cue.language)
        utterance.rate = slow ? Self.slowRate : Self.normalRate
        utterance.pitchMultiplier = 1.0
        // A short lead-in stops the first phoneme being clipped by the audio
        // session waking up, which on Cyrillic consonant clusters is the
        // difference between hearing `вход` and hearing `ход`.
        utterance.preUtteranceDelay = 0.05
        synthesizer.speak(utterance)
    }

    func stop() {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
    }

    func hasVoice(for language: Language) -> Bool {
        Self.voice(for: language) != nil
    }

    private static func voice(for language: Language) -> AVSpeechSynthesisVoice? {
        let code = language.speechLocale
        let candidates = AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix(String(code.prefix(2))) }
        // Prefer an exact locale match, then enhanced quality — a compact voice
        // reading Russian is understandable but a poor model to imitate.
        return candidates.first { $0.language == code && $0.quality != .default }
            ?? candidates.first { $0.language == code }
            ?? candidates.first
            ?? AVSpeechSynthesisVoice(language: code)
    }
}

/// Silent stand-in for previews and tests.
@MainActor
final class SilentSpeaker: Speaking {
    private(set) var spoken: [AudioCue] = []
    func speak(_ cue: AudioCue, slow: Bool) { spoken.append(cue) }
    func stop() {}
    func hasVoice(for language: Language) -> Bool { true }
}

// MARK: - Listening

enum SpeechAuthorization: Equatable, Sendable {
    case notDetermined
    case granted
    case denied
    /// The device has no recogniser for this language at all.
    case unavailable
}

/// Speech recognition, behind a protocol for the same reason as speaking.
@MainActor
protocol Listening: AnyObject {
    var authorization: SpeechAuthorization { get }
    func requestAuthorization() async -> SpeechAuthorization
    /// Record until `stop()`, then return every hypothesis the recogniser
    /// produced — not just the top one. Recognisers routinely rank a wrong
    /// homophone first with the right reading sitting second, and grading only
    /// the best guess fails correct speech.
    func record(language: Language) async throws -> [String]
    func stop()
}

/// Bridges the framework permission callbacks into async, **outside any actor**.
///
/// This is the whole fix for the launch crash. A closure written inside a
/// `@MainActor` method inherits MainActor isolation, so when Speech and
/// AVFoundation invoke it on their own queue Swift 6 traps in
/// `_dispatch_assert_queue_fail` before a single line of the body runs.
/// Wrapping the body in `DispatchQueue.main.async` does not help: the
/// violation is entering the closure, not what it does. These helpers are
/// `nonisolated` and their closures are explicitly `@Sendable`, which is the
/// truthful description — the callback really can arrive on any thread.
enum SpeechPermissions {

    nonisolated static func requestSpeechRecognition() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { @Sendable status in
                continuation.resume(returning: status)
            }
        }
    }

    nonisolated static func requestMicrophone() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { @Sendable granted in
                continuation.resume(returning: granted)
            }
        }
    }
}

/// A continuation that can be resumed from any thread, exactly once.
///
/// The recognition handler fires repeatedly — partial results, a final result,
/// and possibly an error — and resuming a continuation twice is a hard crash.
/// The lock is not about contention (these callbacks are rare); it is about
/// making "exactly once" true when the caller is an arbitrary framework queue.
// Internal rather than private so the concurrency regression test can drive it.
final class ResumeOnce<Value: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<Value, Error>?
    /// Best hypotheses so far, kept so a late error can still return them.
    private var latest: Value?

    init(_ continuation: CheckedContinuation<Value, Error>) {
        self.continuation = continuation
    }

    func remember(_ value: Value) {
        lock.withLock { latest = value }
    }

    func finish(with value: Value) {
        let pending = lock.withLock { () -> CheckedContinuation<Value, Error>? in
            defer { continuation = nil }
            return continuation
        }
        pending?.resume(returning: value)
    }

    /// Fail only when there is nothing usable. A recogniser error arriving
    /// after speech was captured still has hypotheses worth grading, and
    /// throwing would discard an answer the learner actually gave.
    func finish(throwing error: Error) {
        let (pending, fallback) = lock.withLock { () -> (CheckedContinuation<Value, Error>?, Value?) in
            defer { continuation = nil }
            return (continuation, latest)
        }
        guard let pending else { return }
        if let fallback {
            pending.resume(returning: fallback)
        } else {
            pending.resume(throwing: error)
        }
    }
}

@MainActor
final class SpeechRecognizerService: NSObject, Listening {
    private(set) var authorization: SpeechAuthorization = .notDetermined

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    enum Failure: Error, LocalizedError {
        case notAuthorized
        case noRecognizer
        case engineFailed(String)

        var errorDescription: String? {
            switch self {
            case .notAuthorized: "Speech recognition is not authorized."
            case .noRecognizer: "No speech recogniser is available for this language."
            case .engineFailed(let detail): "Audio engine failed: \(detail)"
            }
        }
    }

    func requestAuthorization() async -> SpeechAuthorization {
        // Both awaits hop back to the main actor on return, so the state
        // assignments below are main-actor work — but the callbacks that
        // produced them ran wherever the frameworks chose.
        let speech = await SpeechPermissions.requestSpeechRecognition()
        guard speech == .authorized else {
            authorization = .denied
            return authorization
        }
        let microphone = await SpeechPermissions.requestMicrophone()
        authorization = microphone ? .granted : .denied
        return authorization
    }

    func recognizer(for language: Language) -> SFSpeechRecognizer? {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language.speechLocale))
        return recognizer?.isAvailable == true ? recognizer : nil
    }

    func record(language: Language) async throws -> [String] {
        guard authorization == .granted else { throw Failure.notAuthorized }
        guard let recognizer = recognizer(for: language) else { throw Failure.noRecognizer }

        stop()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        // Keep audio on the device where the recogniser supports it. This is
        // what the permission string promises, so it has to actually be asked
        // for rather than assumed.
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
        self.request = request

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        // The tap block runs on a realtime audio thread, never on the main
        // actor. `nonisolated(unsafe)` states plainly that appending buffers to
        // the request from that thread is the framework's documented usage and
        // is not being checked by the compiler.
        nonisolated(unsafe) let sink = request
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { @Sendable buffer, _ in
            sink.append(buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            cleanUp()
            throw Failure.engineFailed(String(describing: error))
        }

        do {
            let transcripts = try await withCheckedThrowingContinuation { continuation in
                let box = ResumeOnce<[String]>(continuation)
                // Explicitly @Sendable, and capturing nothing actor-isolated:
                // this handler is called on the recogniser's own queue.
                task = recognizer.recognitionTask(with: request) { @Sendable result, error in
                    if let result {
                        let hypotheses = result.transcriptions.map(\.formattedString)
                        if result.isFinal {
                            box.finish(with: hypotheses)
                        } else {
                            box.remember(hypotheses)
                        }
                    }
                    if let error {
                        box.finish(throwing: error)
                    }
                }
            }
            // Back on the main actor: tearing down the engine is main-actor
            // work and must not happen inside the callback.
            cleanUp()
            return transcripts
        } catch {
            cleanUp()
            throw error
        }
    }

    func stop() {
        request?.endAudio()
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
    }

    private func cleanUp() {
        stop()
        task?.cancel()
        task = nil
        request = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

/// Test/preview stand-in that returns whatever it is told to.
@MainActor
final class StubListener: Listening {
    var authorization: SpeechAuthorization
    var transcripts: [String]

    init(authorization: SpeechAuthorization = .granted, transcripts: [String] = []) {
        self.authorization = authorization
        self.transcripts = transcripts
    }

    func requestAuthorization() async -> SpeechAuthorization { authorization }
    func record(language: Language) async throws -> [String] { transcripts }
    func stop() {}
}
