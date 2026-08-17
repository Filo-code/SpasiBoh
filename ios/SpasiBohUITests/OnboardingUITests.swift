import XCTest

/// Covers the one flow that must work before anything else can: choosing a
/// direction on first launch and landing on Home.
final class OnboardingUITests: XCTestCase {

    override func setUp() {
        continueAfterFailure = false
    }

    private func launchFresh() -> XCUIApplication {
        let app = XCUIApplication()
        // Reset so the onboarding screen is actually shown rather than skipped
        // because a previous run already chose a direction.
        app.launchArguments += ["-spasiboh.direction", ""]
        app.launch()
        return app
    }

    func testOnboardingIsBilingual() {
        let app = launchFresh()
        // The question is asked in both languages, because the learner has no
        // UI language yet.
        XCTAssertTrue(app.staticTexts["Cosa vuoi imparare?"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Что хочешь выучить?"].exists)
    }

    func testChoosingRussianLandsOnHome() {
        let app = launchFresh()
        let russian = app.buttons.containing(
            NSPredicate(format: "label CONTAINS %@", "Русский")
        ).firstMatch
        XCTAssertTrue(russian.waitForExistence(timeout: 10))
        russian.tap()

        XCTAssertTrue(app.staticTexts["SpasiBoh!"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Italiano → Русский"].exists)
    }
}
