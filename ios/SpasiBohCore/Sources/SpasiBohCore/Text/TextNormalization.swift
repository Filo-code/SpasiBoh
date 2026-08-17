import Foundation

/// Text comparison for answer checking and speech matching.
///
/// Every function here operates on `Character` (grapheme clusters), never on
/// UTF-16 offsets or unicode scalars. That is not incidental: the content mixes
/// Cyrillic, combining stress marks, precomposed and decomposed Italian
/// accents, flag emoji (two scalars) and ZWJ sequences (five or more). Indexing
/// any of those by scalar splits them and renders replacement characters —
/// which is exactly the "emoji break" failure this app must not have.
public enum TextNormalization {

    /// U+0301. Used to mark Russian stress (`вода́`) and, occasionally, Italian.
    public static let combiningAcute: Character = "\u{0301}"

    /// Written with explicit escapes for the curly forms: typing them as
    /// literals is how the straight and curly apostrophe silently end up being
    /// the same character, which then lets `dov'è` and `dov’è` compare unequal.
    private static let punctuation: Set<Character> = [
        ".", ",", "!", "?", ";", ":", "(", ")",
        "-", "\u{2013}", "\u{2014}",                    // - – —
        "\u{0027}", "\u{2018}", "\u{2019}", "\u{02BC}", // ' ‘ ’ ʼ
        "\u{0022}", "\u{201C}", "\u{201D}", "\u{201E}", // " “ ” „
        "\u{00AB}", "\u{00BB}",                         // « »
        "\u{2026}",                                     // …
    ]

    /// Remove stress marks, leaving the base letters.
    ///
    /// Works on unicode scalars *within* each character so a combining mark is
    /// stripped without disturbing the grapheme boundaries around it.
    public static func stripStressMarks(_ text: String) -> String {
        var result = ""
        result.reserveCapacity(text.count)
        for character in text {
            let kept = character.unicodeScalars.filter { $0 != "\u{0301}" && $0 != "\u{0300}" }
            if kept.isEmpty {
                result.append(character)
            } else {
                var view = String.UnicodeScalarView()
                kept.forEach { view.append($0) }
                result.append(String(view))
            }
        }
        return result
    }

    /// Collapse punctuation and whitespace to single spaces.
    ///
    /// Punctuation becomes a *space*, not nothing: `по-английски` must become
    /// two tokens, and deleting the hyphen outright would glue them.
    private static func collapse(_ text: String) -> String {
        var out = ""
        out.reserveCapacity(text.count)
        for character in text {
            if punctuation.contains(character) || character.isWhitespace {
                out.append(" ")
            } else {
                out.append(character)
            }
        }
        return out.split(separator: " ", omittingEmptySubsequences: true)
            .joined(separator: " ")
    }

    /// Normalize Russian for comparison.
    ///
    /// `ё → е` is applied because both spellings occur in the wild and most
    /// keyboards and recognisers produce `е`; treating them as different would
    /// fail correct answers.
    ///
    /// `й → и` is deliberately **not** applied even though it would catch more
    /// near-misses. It is too lossy: `мой` and `мои` are different words, and
    /// accepting one for the other would teach an actual error.
    public static func normalizeRussian(_ text: String) -> String {
        collapse(stripStressMarks(text).lowercased().replacingOccurrences(of: "ё", with: "е"))
    }

    /// Normalize Italian for comparison.
    ///
    /// Diacritics are folded, so `perché` and `perche` both pass — recognisers
    /// and keyboards are unreliable about accents and failing on them would
    /// punish the learner for the tool rather than the language. Applied via
    /// NFD decomposition so precomposed `à` and decomposed `a`+U+0300 fold
    /// identically.
    public static func normalizeItalian(_ text: String) -> String {
        let folded = text.lowercased()
            .folding(options: [.diacriticInsensitive], locale: Locale(identifier: "it_IT"))
        return collapse(folded)
    }

    public static func normalize(_ text: String, language: Language) -> String {
        switch language {
        case .italian: normalizeItalian(text)
        case .russian: normalizeRussian(text)
        }
    }

    /// Exact-after-normalization comparison. Used for typed and assembled
    /// answers, where we want tolerance for formatting but not for spelling.
    public static func matches(_ answer: String, expected: String, language: Language) -> Bool {
        let a = normalize(answer, language: language)
        guard !a.isEmpty else { return false }
        return a == normalize(expected, language: language)
    }

    /// Split a word into tappable tiles for the spelling exercise.
    ///
    /// Must split by `Character`: `й` may arrive decomposed as `и`+U+0306, and
    /// splitting by scalar would produce a bare combining breve as its own
    /// tile — visually broken and unselectable.
    public static func spellingTiles(_ text: String) -> [String] {
        text.filter { !$0.isWhitespace }.map(String.init)
    }

    // MARK: - Speech matching

    /// Levenshtein distance over `Character`s.
    ///
    /// Two-row DP: the full matrix is never needed and the phrases here are
    /// short, but allocating one per comparison during a drill is wasteful.
    public static func levenshtein(_ a: [Character], _ b: [Character]) -> Int {
        if a.isEmpty { return b.count }
        if b.isEmpty { return a.count }
        var previous = Array(0...b.count)
        var current = [Int](repeating: 0, count: b.count + 1)
        for i in 1...a.count {
            current[0] = i
            for j in 1...b.count {
                let cost = a[i - 1] == b[j - 1] ? 0 : 1
                current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            }
            swap(&previous, &current)
        }
        return previous[b.count]
    }

    /// 0…1 similarity. 1 when both strings are empty.
    public static func similarity(_ a: String, _ b: String) -> Double {
        let ac = Array(a), bc = Array(b)
        let longest = max(ac.count, bc.count)
        guard longest > 0 else { return 1 }
        return 1 - Double(levenshtein(ac, bc)) / Double(longest)
    }

    /// How close a transcript must be to count as correct.
    ///
    /// Short words need near-exactness because the whole word *is* the
    /// distinction — `кот` vs `кит` differ by one character and are different
    /// animals. Long phrases get slack because recognisers routinely drop
    /// particles and articles without the learner having said anything wrong.
    public static func threshold(forTargetLength length: Int) -> Double {
        if length <= 4 { return 0.95 }
        if length <= 8 { return 0.82 }
        return 0.75
    }

    public struct SpeechMatch: Sendable, Hashable {
        public let matched: Bool
        public let score: Double
        /// The raw transcript that scored best — shown back to the learner so
        /// they can see what the recogniser actually heard.
        public let bestTranscript: String
    }

    /// Score speech-recognition alternatives against an expected answer.
    ///
    /// Takes *all* alternatives rather than only the top one: recognisers
    /// frequently rank a wrong homophone first while the correct reading sits
    /// second, and grading only the top hypothesis fails correct speech.
    public static func matchSpeech(
        transcripts: [String],
        expected: String,
        accepting alternatives: [String] = [],
        language: Language
    ) -> SpeechMatch {
        let targets = ([expected] + alternatives)
            .map { normalize($0, language: language) }
            .filter { !$0.isEmpty }
        guard !targets.isEmpty else {
            return SpeechMatch(matched: false, score: 0, bestTranscript: "")
        }

        var bestScore = 0.0
        var bestTranscript = ""
        for transcript in transcripts {
            let normalized = normalize(transcript, language: language)
            guard !normalized.isEmpty else { continue }
            for target in targets {
                let score = similarity(normalized, target)
                if score > bestScore {
                    bestScore = score
                    bestTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
        }

        let limit = threshold(forTargetLength: normalize(expected, language: language).count)
        return SpeechMatch(matched: bestScore >= limit, score: bestScore, bestTranscript: bestTranscript)
    }

    /// Compare assembled sentence blocks against the expected sentence.
    public static func blocksMatch(_ blocks: [String], expected: String, language: Language) -> Bool {
        matches(blocks.joined(separator: " "), expected: expected, language: language)
    }
}
