import Testing
import Foundation
@testable import SpasiBoh

/// Regression tests for the launch crash.
///
/// The app died in `_dispatch_assert_queue_fail` inside the speech
/// authorization callback: the closure had been written inside a `@MainActor`
/// method, so it inherited main-actor isolation, and Speech invoked it on its
/// own queue. The trap happened on *entering* the closure, which is why
/// wrapping the body in `DispatchQueue.main.async` would not have helped.
///
/// Real TCC cannot be driven from a test without prompting, so these tests
/// exercise the same hazard shape: a callback bridge fired from a background
/// queue. If the bridge were actor-isolated, they would trap exactly as the
/// app did.
@Suite("Speech callback concurrency")
struct SpeechConcurrencyTests {

    /// A stand-in for `SFSpeechRecognizer.requestAuthorization`: hands its
    /// result back on an arbitrary queue, exactly as the framework does.
    nonisolated static func frameworkStyleCallback(
        _ handler: @escaping @Sendable (Int) -> Void
    ) {
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 0.01) {
            handler(42)
        }
    }

    /// The shape of the fix: a nonisolated async bridge whose closure really is
    /// `@Sendable`, awaited from the main actor.
    nonisolated static func bridge() async -> Int {
        await withCheckedContinuation { continuation in
            frameworkStyleCallback { @Sendable value in
                continuation.resume(returning: value)
            }
        }
    }

    @Test("A permission-style callback arriving off the main actor does not trap")
    @MainActor
    func offMainCallbackSurvives() async {
        // Awaited from the main actor, resumed from a background queue. This is
        // the exact path that crashed.
        let value = await Self.bridge()
        #expect(value == 42)
        // Traps if control did not come back to the main actor — the same
        // class of check that killed the app when it was violated the other way.
        MainActor.assertIsolated("control must return to the main actor")
    }

    @Test("Resuming from several threads at once resumes exactly once")
    func resumeOnceIsOnce() async throws {
        // The recognition handler fires for every partial result and again on
        // error; resuming a continuation twice is a hard crash.
        let result: Int = try await withCheckedThrowingContinuation { continuation in
            let box = ResumeOnce<Int>(continuation)
            DispatchQueue.concurrentPerform(iterations: 8) { index in
                box.finish(with: index)
            }
        }
        #expect(result >= 0 && result < 8)
    }

    @Test("A late error still returns the hypotheses already captured")
    func errorKeepsPartialResults() async throws {
        // A recogniser error after speech was captured must not discard an
        // answer the learner actually gave.
        let transcripts: [String] = try await withCheckedThrowingContinuation { continuation in
            let box = ResumeOnce<[String]>(continuation)
            DispatchQueue.global().async {
                box.remember(["привет"])
                box.finish(throwing: URLError(.timedOut))
            }
        }
        #expect(transcripts == ["привет"])
    }

    @Test("An error with nothing captured does throw")
    func errorWithoutResultsThrows() async {
        await #expect(throws: URLError.self) {
            let _: [String] = try await withCheckedThrowingContinuation { continuation in
                let box = ResumeOnce<[String]>(continuation)
                DispatchQueue.global().async {
                    box.finish(throwing: URLError(.cannotConnectToHost))
                }
            }
        }
    }
}
