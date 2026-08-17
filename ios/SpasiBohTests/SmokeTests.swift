import Testing
import SpasiBohCore

@Suite("App target smoke")
struct SmokeTests {
    @Test("Direction maps to the right UI and target languages")
    func directions() {
        #expect(Direction.itToRu.native == .italian)
        #expect(Direction.itToRu.target == .russian)
        #expect(Direction.ruToIt.native == .russian)
        #expect(Direction.ruToIt.target == .italian)
        #expect(Direction.itToRu.flipped == .ruToIt)
    }

    @Test("Speech locales are the ones the recognisers expect")
    func locales() {
        #expect(Language.russian.speechLocale == "ru-RU")
        #expect(Language.italian.speechLocale == "it-IT")
    }
}
