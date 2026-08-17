import XCTest

/// End-to-end checks against the real app.
///
/// These exist because "it compiles" and "it works" are different claims, and
/// only one of them can be made without launching the thing.
// Whole case is main-actor: every XCUITest API is, and annotating helpers one
// by one only moves the mismatch to their callers.
@MainActor
final class OnboardingUITests: XCTestCase {

    override func setUp() {
        continueAfterFailure = false
    }

    /// A fresh start every time — otherwise the second test in a run opens on
    /// Home and the onboarding assertions pass for the wrong reason.
    ///
    /// `resetProgress` is false for the persistence test, which needs the real
    /// on-disk store precisely because that is what it is checking.
    private func launchFresh(resetProgress: Bool = true) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-spasiboh.direction", ""]
        if resetProgress {
            app.launchEnvironment["SPASIBOH_UITEST_RESET"] = "1"
        }
        // Speech permission is a system alert owned by springboard, and an
        // undismissed one blocks every subsequent query. The microphone path is
        // covered by SpeechConcurrencyTests and the exercise unit tests; these
        // tests are about the learning flow, so they run without it.
        app.launchEnvironment["SPASIBOH_UITEST_NO_SPEECH"] = "1"
        app.launch()
        return app
    }

    /// Answer the question on screen, whichever format it is. Which option is
    /// correct depends on the seed, and grading is the unit tests' job — this
    /// only checks that answering works and moves the session forward.
    @discardableResult
    private func answerCurrentQuestion(_ app: XCUIApplication) -> Bool {
        let firstOption = app.buttons["option-0"].firstMatch
        if firstOption.waitForExistence(timeout: 15) {
            firstOption.tap()
            return true
        }
        // Assembly and speech formats have no options; skipping still records
        // an answer and advances.
        let skip = app.buttons["Salta"].firstMatch
        if skip.waitForExistence(timeout: 3) {
            skip.tap()
            return true
        }
        return false
    }

    func testOnboardingIsBilingual() {
        let app = launchFresh()
        // The learner has no interface language yet, so the question is asked
        // in both and each option is written in the one it selects.
        XCTAssertTrue(app.staticTexts["Cosa vuoi imparare?"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Что хочешь выучить?"].exists)
        XCTAssertTrue(app.staticTexts["Русский"].exists)
        XCTAssertTrue(app.staticTexts["Italiano"].exists)
    }

    /// Choose a direction and wait for Home to finish appearing.
    ///
    /// The title lands before the scrolling content below it, so asserting
    /// `.exists` on a row straight after the title waits for the wrong element
    /// and fails on a slow boot rather than on anything being broken.
    private func chooseDirection(_ app: XCUIApplication, _ endonym: String) {
        let choice = app.staticTexts[endonym].firstMatch
        XCTAssertTrue(choice.waitForExistence(timeout: 10), "onboarding never appeared")
        choice.tap()
        XCTAssertTrue(app.staticTexts["SpasiBoh!"].waitForExistence(timeout: 10), "home never appeared")
    }

    func testChoosingRussianLandsOnHome() {
        let app = launchFresh()
        chooseDirection(app, "Русский")
        // UI language follows the direction: an Italian speaker gets Italian.
        XCTAssertTrue(app.staticTexts["Allenamento libero"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Vocabolario"].waitForExistence(timeout: 5))
    }

    func testChoosingItalianGivesARussianInterface() {
        let app = launchFresh()
        chooseDirection(app, "Italiano")
        XCTAssertTrue(app.staticTexts["Свободная тренировка"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Словарь"].waitForExistence(timeout: 5))
    }

    /// The §109 core loop: start a session, answer, get feedback, move on.
    func testDailySessionAnswersAndAdvances() {
        let app = launchFresh()
        chooseDirection(app, "Русский")

        app.buttons.matching(NSPredicate(format: "label CONTAINS 'SESSIONE'")).firstMatch.tap()

        XCTAssertTrue(answerCurrentQuestion(app), "no answerable question appeared")

        let next = app.buttons["Avanti"].firstMatch
        XCTAssertTrue(next.waitForExistence(timeout: 8), "answering produced no feedback")
        next.tap()

        // And the session continues rather than ending after one question.
        XCTAssertTrue(answerCurrentQuestion(app), "session did not advance to a second question")
    }

    /// §109: quit and relaunch, progress retained.
    func testProgressSurvivesRelaunch() {
        // Uses the real on-disk store, because that is the thing under test.
        let app = launchFresh(resetProgress: false)
        chooseDirection(app, "Русский")

        app.buttons.matching(NSPredicate(format: "label CONTAINS 'SESSIONE'")).firstMatch.tap()
        XCTAssertTrue(answerCurrentQuestion(app), "no answerable question appeared")
        XCTAssertTrue(app.buttons["Avanti"].firstMatch.waitForExistence(timeout: 8))

        // Leave mid-session, exactly as a real interruption would — the answer
        // must already be on disk, not waiting for a tidy exit.
        app.terminate()

        let relaunched = XCUIApplication()
        relaunched.launch()
        // Direction was remembered, so onboarding does not reappear.
        XCTAssertTrue(relaunched.staticTexts["SpasiBoh!"].waitForExistence(timeout: 10))
        XCTAssertTrue(relaunched.staticTexts["Allenamento libero"].exists)

        // And the answer itself survived: statistics report a started item.
        relaunched.staticTexts["Statistiche"].firstMatch.tap()
        XCTAssertTrue(relaunched.staticTexts["Iniziate"].waitForExistence(timeout: 8),
                      "statistics did not open")
        let zero = relaunched.staticTexts.matching(identifier: "Iniziate: 0").firstMatch
        XCTAssertFalse(zero.exists, "nothing was recorded across the relaunch")
    }

    /// Regression test for the launch crash, driven through the real app.
    ///
    /// Runs **without** the speech bypass, so `SFSpeechRecognizer` and
    /// `AVAudioApplication` really are asked for permission and really do call
    /// back on their own queues. Before the fix this killed the process in
    /// `_dispatch_assert_queue_fail`, because the callback closures had
    /// inherited main-actor isolation from the method they were written in.
    ///
    /// The assertion is simply that the app is still alive and answering
    /// afterwards — a crash here fails the test by the app being gone.
    func testSurvivesSpeechAuthorization() {
        let app = XCUIApplication()
        app.launchArguments = ["-spasiboh.direction", ""]
        app.launchEnvironment["SPASIBOH_UITEST_RESET"] = "1"
        app.launch()

        chooseDirection(app, "Русский")

        // Pronunciation is the mode that always asks.
        app.staticTexts["Pronuncia"].firstMatch.tap()

        // Two alerts can appear, speech then microphone, and each is owned by
        // springboard — which means the app is legitimately in the background
        // while one is up. Dismiss whatever shows, for as long as it keeps
        // showing, rather than assuming a fixed count and timing.
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let deadline = Date().addingTimeInterval(20)
        while Date() < deadline {
            // The one state that means a real failure. Checked inside the loop
            // so a crash is caught the moment it happens rather than at the end.
            XCTAssertNotEqual(app.state, .notRunning, "the app crashed during speech authorization")
            if app.state == .runningForeground, springboard.alerts.count == 0 { break }
            let allow = springboard.alerts.buttons.matching(
                NSPredicate(format: "label CONTAINS[c] 'OK' OR label CONTAINS[c] 'Allow' OR label CONTAINS[c] 'Consenti'")
            ).firstMatch
            if allow.waitForExistence(timeout: 2) {
                allow.tap()
            }
        }

        // The regression this test exists for is a crash, so that is what is
        // asserted. Being in the background behind a system alert is not a
        // failure — being gone is.
        XCTAssertNotEqual(app.state, .notRunning, "the app crashed during speech authorization")
        XCTAssertEqual(app.state, .runningForeground, "the app never came back to the foreground")

        let closeButton = app.buttons["Chiudi"].firstMatch
        let anyQuestion = app.buttons["option-0"].firstMatch
        let emptyState = app.staticTexts["Non c'è nulla da allenare qui, per ora."].firstMatch
        XCTAssertTrue(
            closeButton.waitForExistence(timeout: 10)
                || anyQuestion.waitForExistence(timeout: 5)
                || emptyState.waitForExistence(timeout: 5),
            "the session screen never rendered after authorization"
        )
        XCTAssertNotEqual(app.state, .notRunning, "the app crashed after authorization")
    }

    func testCollectionAndSettingsOpen() {
        let app = launchFresh()
        chooseDirection(app, "Русский")

        app.staticTexts["Collezione"].firstMatch.tap()
        // The tab labels are segmented-control buttons, not static text.
        XCTAssertTrue(app.buttons["Cultura"].waitForExistence(timeout: 8), "collection did not open")
        XCTAssertTrue(app.buttons["Consigli di lingua"].exists)
        app.buttons["Chiudi"].firstMatch.tap()

        // The sheet dismissal is animated; the row underneath exists before it
        // is hittable, and tapping too early fails on hit-testing rather than
        // on anything being wrong with the app.
        let scenarios = app.staticTexts["Situazioni reali"].firstMatch
        XCTAssertTrue(
            scenarios.waitForExistence(timeout: 8)
                && XCTWaiter().wait(
                    for: [expectation(for: NSPredicate(format: "isHittable == true"), evaluatedWith: scenarios)],
                    timeout: 8
                ) == .completed,
            "home did not come back after closing the collection"
        )
        scenarios.tap()
        XCTAssertTrue(app.buttons["Chiudi"].firstMatch.waitForExistence(timeout: 8),
                      "scenario list did not open")
        // The Russia set is what an Italian speaker is shown.
        XCTAssertTrue(app.staticTexts["Arrivo in aeroporto"].exists,
                      "the Russia scenario set did not render")
        // And the Italy set belongs to the other direction — it must not leak
        // in here, which is the whole point of filtering by direction.
        XCTAssertFalse(app.staticTexts["Al bar"].exists,
                       "an Italy scenario leaked into the IT→RU list")
    }
}
