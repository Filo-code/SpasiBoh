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

    override init() {
        super.init()
        configureSession()
    }

    private func configureSession() {
        // `.playback` rather than `.ambient`: the learner is listening to a
        // word they must repeat, and having it silenced by the ring switch
        // makes the exercise unanswerable with no visible cause.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? AVAudioSession.sharedInstance().setActive(true, options: [])
    }

    func speak(_ cue: AudioCue, slow: Bool = false) {
        guard !cue.text.isEmpty else { return }
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

@MainActor
final class SpeechRecognizerService: NSObject, Listening {
    private(set) var authorization: SpeechAuthorization = .notDetermined

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var continuation: CheckedContinuation<[String], Error>?

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
        let speech = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard speech == .authorized else {
            authorization = .denied
            return authorization
        }
        let microphone = await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { continuation.resume(returning: $0) }
        }
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
        // what the permission string promises, so it must actually be asked
        // for rather than assumed.
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
        self.request = request

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            cleanUp()
            throw Failure.engineFailed(String(describing: error))
        }

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            var best: [String] = []
            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }
                if let result {
                    best = result.transcriptions.map(\.formattedString)
                    if result.isFinal { self.finish(with: best) }
                }
                if error != nil {
                    // A recogniser error after speech was captured still has
                    // usable hypotheses; failing outright would discard a
                    // correct answer the learner actually gave.
                    if best.isEmpty {
                        self.finish(throwing: Failure.engineFailed(String(describing: error!)))
                    } else {
                        self.finish(with: best)
                    }
                }
            }
        }
    }

    func stop() {
        request?.endAudio()
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
    }

    private func finish(with transcripts: [String]) {
        guard let continuation else { return }
        self.continuation = nil
        cleanUp()
        continuation.resume(returning: transcripts)
    }

    private func finish(throwing error: Error) {
        guard let continuation else { return }
        self.continuation = nil
        cleanUp()
        continuation.resume(throwing: error)
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
