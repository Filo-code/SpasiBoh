import Foundation
import SpasiBohCore

// Command-line front end for the validator. The same checks run inside the
// test suite, so content problems fail the build; this exists so a content
// edit can be checked in a second without booting a test runner.

do {
    let content = try ContentStore.load()
    let problems = ContentValidator.validate(content)

    print("""
    SpasiBoh! content
      concepts:  \(content.concepts.count)
      sentences: \(content.sentences.count)
      letters:   \(content.letters.count)
      patterns:  \(content.patterns.count)
      scenarios: \(content.scenarios.count) \
    (\(content.scenarios(for: .itToRu).count) IT→RU, \(content.scenarios(for: .ruToIt).count) RU→IT)
      idioms:    \(content.idioms.count)
      culture:   \(content.cultureCards.count)
      tips:      \(content.tips.count)
    """)

    if problems.isEmpty {
        print("\nNo problems found.")
    } else {
        print("\n\(problems.count) problem(s):")
        for problem in problems { print("  \(problem)") }
        exit(1)
    }
} catch {
    print("Content failed to load: \(error)")
    exit(2)
}
