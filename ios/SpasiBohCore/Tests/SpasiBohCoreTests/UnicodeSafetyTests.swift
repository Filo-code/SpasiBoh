import Testing
import Foundation
@testable import SpasiBohCore

/// The app mixes Cyrillic, combining stress marks, precomposed and decomposed
/// Italian accents, flag emoji and ZWJ sequences. Every one of those breaks if
/// text is handled as UTF-16 offsets or unicode scalars. These tests pin the
/// grapheme-cluster behaviour so a regression shows up here rather than as
/// mojibake in a drill.
@Suite("Unicode safety")
struct UnicodeSafetyTests {

    // MARK: - Grapheme cluster counting

    @Test("Flag emoji are one Character but two scalars")
    func flagEmoji() {
        let italy = "🇮🇹"
        let russia = "🇷🇺"
        #expect(italy.count == 1)
        #expect(italy.unicodeScalars.count == 2)
        #expect(russia.count == 1)
        #expect(russia.unicodeScalars.count == 2)
        // The property the UI depends on: flags survive a round trip through
        // our own text handling without being split.
        #expect(Language.italian.flag.count == 1)
        #expect(Language.russian.flag.count == 1)
    }

    @Test("ZWJ sequences are a single Character")
    func zwjSequence() {
        let family = "👨‍👩‍👧"
        #expect(family.count == 1)
        #expect(family.unicodeScalars.count == 5)
        #expect(Array(family).count == 1)
    }

    @Test("Combining acute stress is part of its base Character")
    func combiningStress() {
        let stressed = "вода\u{0301}"   // вода́
        #expect(stressed.count == 4)
        #expect(stressed.unicodeScalars.count == 5)
    }

    @Test("Stress stripping preserves the base letters")
    func stripStress() {
        #expect(TextNormalization.stripStressMarks("вода\u{0301}") == "вода")
        #expect(TextNormalization.stripStressMarks("приве\u{0301}т") == "привет")
        #expect(TextNormalization.stripStressMarks("здра\u{0301}вствуйте") == "здравствуйте")
        // Nothing to strip: unchanged.
        #expect(TextNormalization.stripStressMarks("вокзал") == "вокзал")
    }

    @Test("Stress stripping leaves emoji intact")
    func stripStressKeepsEmoji() {
        let text = "вода\u{0301} 💧 🇷🇺 👨‍👩‍👧"
        let stripped = TextNormalization.stripStressMarks(text)
        #expect(stripped == "вода 💧 🇷🇺 👨‍👩‍👧")
        #expect(!stripped.contains("\u{FFFD}"))  // no replacement chars
    }

    // MARK: - Cyrillic

    @Test("Cyrillic case folding round-trips")
    func cyrillicCase() {
        #expect("ПРИВЕТ".lowercased() == "привет")
        #expect("привет".uppercased() == "ПРИВЕТ")
        #expect("Ё".lowercased() == "ё")
        #expect("ъ".uppercased() == "Ъ")
        #expect("ь".uppercased() == "Ь")
    }

    @Test("ё folds to е but й is left alone")
    func yoFolding() {
        // ё/е: both spellings are in the wild, so they must compare equal.
        #expect(TextNormalization.normalizeRussian("ещё") == TextNormalization.normalizeRussian("еще"))
        // й/и: different words. Folding these would accept a real error.
        #expect(TextNormalization.normalizeRussian("мой") != TextNormalization.normalizeRussian("мои"))
    }

    @Test("Spelling tiles split by Character, not scalar")
    func spellingTiles() {
        let tiles = TextNormalization.spellingTiles("вода")
        #expect(tiles == ["в", "о", "д", "а"])
        // A decomposed й must stay one tile, not split into и + breve.
        let decomposed = "мо\u{0438}\u{0306}"
        let decomposedTiles = TextNormalization.spellingTiles(decomposed)
        #expect(decomposedTiles.count == 3)
        #expect(decomposedTiles.allSatisfy { !$0.isEmpty })
    }

    // MARK: - Italian

    @Test("Precomposed and decomposed Italian accents fold identically")
    func italianAccents() {
        let precomposed = "citt\u{00E0}"          // città
        let decomposed = "citta\u{0300}"          // citta + combining grave
        #expect(precomposed.count == decomposed.count)
        #expect(
            TextNormalization.normalizeItalian(precomposed)
            == TextNormalization.normalizeItalian(decomposed)
        )
        // And both fold to the unaccented form, so a missing accent still passes.
        #expect(TextNormalization.normalizeItalian(precomposed) == "citta")
    }

    @Test("Italian apostrophes are handled")
    func italianApostrophe() {
        // Straight and curly apostrophes must behave the same.
        #expect(
            TextNormalization.normalizeItalian("dov'e")
            == TextNormalization.normalizeItalian("dov\u{2019}e")
        )
    }

    // MARK: - IDs

    @Test("Content IDs are machine-safe ASCII")
    func idCharset() {
        // §42/§45: IDs must never be emoji or display text.
        let valid = ["food_water", "conv-01", "greetings_hello"]
        for id in valid {
            #expect(id.allSatisfy { $0.isASCII })
            // Note: `isEmoji` is true for plain ASCII digits, because 0–9 are
            // emoji *base* characters for keycap sequences. `isEmojiPresentation`
            // is the property that actually means "renders as an emoji".
            #expect(!id.unicodeScalars.contains { $0.properties.isEmojiPresentation })
        }
        // And the check has teeth: a real emoji id would be rejected.
        #expect("💧".unicodeScalars.contains { $0.properties.isEmojiPresentation })
    }

    @Test("ProgressKey round-trips through its string form")
    func progressKeyRoundTrip() {
        let key = ProgressKey(direction: .itToRu, kind: .concept, itemID: "food_water", skill: .recall)
        let restored = ProgressKey(key.description)
        #expect(restored == key)
    }

    @Test("ProgressKey rejects malformed strings")
    func progressKeyRejectsGarbage() {
        #expect(ProgressKey("nonsense") == nil)
        #expect(ProgressKey("it-ru|concept|food_water") == nil)      // missing skill
        #expect(ProgressKey("xx-yy|concept|food_water|recall") == nil) // bad direction
        #expect(ProgressKey("it-ru|concept||recall") == nil)          // empty id
    }
}

/// Normalization has to be forgiving about formatting without being forgiving
/// about spelling. These pin both edges.
@Suite("Speech normalization")
struct SpeechNormalizationTests {

    @Test("Punctuation and case are ignored")
    func punctuationAndCase() {
        #expect(TextNormalization.matches("Привет!", expected: "привет", language: .russian))
        #expect(TextNormalization.matches("  КАК   ДЕЛА?  ", expected: "как дела", language: .russian))
        #expect(TextNormalization.matches("Ciao!", expected: "ciao", language: .italian))
    }

    @Test("Hyphens become word boundaries, not deletions")
    func hyphens() {
        // по-английски must tokenise to two words, not one glued one.
        #expect(TextNormalization.normalizeRussian("по-английски") == "по английски")
    }

    @Test("Wrong answers are still wrong")
    func doesNotOverNormalize() {
        #expect(!TextNormalization.matches("кит", expected: "кот", language: .russian))
        #expect(!TextNormalization.matches("pane", expected: "cane", language: .italian))
        #expect(!TextNormalization.matches("", expected: "вода", language: .russian))
    }

    @Test("Short targets demand near-exact speech, long ones get slack")
    func thresholds() {
        #expect(TextNormalization.threshold(forTargetLength: 3) == 0.95)
        #expect(TextNormalization.threshold(forTargetLength: 7) == 0.82)
        #expect(TextNormalization.threshold(forTargetLength: 20) == 0.75)
    }

    @Test("Speech matching scores every alternative, not just the first")
    func matchesLaterAlternative() {
        // Recognisers often rank a wrong homophone first. Grading only the top
        // hypothesis would fail correct speech.
        let result = TextNormalization.matchSpeech(
            transcripts: ["кит", "кот"],
            expected: "кот",
            language: .russian
        )
        #expect(result.matched)
        #expect(result.bestTranscript == "кот")
    }

    @Test("A one-letter miss on a short word fails")
    func shortWordMiss() {
        let result = TextNormalization.matchSpeech(
            transcripts: ["кит"],
            expected: "кот",
            language: .russian
        )
        #expect(!result.matched)
    }

    @Test("Accepted alternatives pass")
    func alternatives() {
        let result = TextNormalization.matchSpeech(
            transcripts: ["salve"],
            expected: "ciao",
            accepting: ["salve", "buongiorno"],
            language: .italian
        )
        #expect(result.matched)
    }

    @Test("Assembled blocks compare as a sentence")
    func blocks() {
        #expect(TextNormalization.blocksMatch(
            ["Я", "живу", "в", "Италии"],
            expected: "Я живу в Италии.",
            language: .russian
        ))
        #expect(!TextNormalization.blocksMatch(
            ["Я", "в", "живу", "Италии"],
            expected: "Я живу в Италии.",
            language: .russian
        ))
    }
}
