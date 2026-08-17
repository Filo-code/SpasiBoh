# SpasiBoh! — native iOS architecture

Native SwiftUI iPhone app teaching Italian ↔ Russian in both directions. No
WebView, no React Native, no Capacitor. Web V1 still lives at the repository
root and is untouched.

## Layout

```
ios/
├── project.yml            # XcodeGen spec — the source of truth
├── SpasiBoh.xcodeproj     # GENERATED, gitignored, never hand-edited
├── SpasiBohCore/          # SwiftPM package — all logic, no UI
│   ├── Sources/SpasiBohCore/
│   │   ├── Models/        # Concept, Sentence, Scenario, Warmup, Collection
│   │   ├── Engine/        # Mastery, Scheduler, ExerciseFactory, SessionBuilder
│   │   ├── Content/       # ContentStore, ContentValidator
│   │   ├── Text/          # Unicode-safe normalization
│   │   ├── Progress/      # LearnerProgress, ProgressStore, export/import
│   │   └── Resources/Content/*.json
│   ├── Sources/ValidateContent/   # `swift run validate-content`
│   └── Tests/SpasiBohCoreTests/
├── SpasiBoh/              # App target — SwiftUI, AVFoundation, Speech
│   ├── App/ DesignSystem/ Features/ Localization/ Services/
├── SpasiBohTests/         # App-target unit tests
├── SpasiBohUITests/       # End-to-end tests against the running app
└── Tools/                 # extract-content.ts, author-content.py
```

**Why the package split.** `SpasiBohCore` cannot import SwiftUI — the compiler
enforces the boundary rather than a convention doing it. Engine logic is
therefore testable with `swift test` in under a second, with no simulator, and
the app target is left holding only presentation and platform services.

## Building

```bash
brew install xcodegen                  # once — pinned at 2.46.0
cd ios && xcodegen generate            # after any project.yml change or fresh clone

cd ios/SpasiBohCore && swift test      # engine + content, ~0.1s
swift run validate-content             # content report, non-zero exit on problems

xcodebuild -project ios/SpasiBoh.xcodeproj -scheme SpasiBoh \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' test
```

`SpasiBoh.xcodeproj` is a build artifact and is gitignored, so `xcodegen
generate` is the mandatory first step after cloning.

Deployment target iOS 26.0; built against SDK 26.5 with Xcode 26.6.

## The bidirectional model

Web V1 privileged Russian: `Word` carried `russian`, `italian`, and Russian-only
`transliteration`, `stress` and `frequencyRank`. Here both sides are the same
type:

```swift
struct Concept { let it: LanguageSide; let ru: LanguageSide; … }
```

`LanguageSide.frequencyRank` is **per language**, because the 50th most common
Russian word is not the translation of the 50th most common Italian word, and
new material must be introduced in the order of the language actually being
learned.

Category raw values are English machine identifiers (`greetings`, `food`), not
the Italian keys Web V1 used (`saluti`, `cibo`) — those leaked the metalanguage
into the data layer and read as nonsense to a Russian speaker. Display names
come from the localization table.

### Asymmetric pronunciation rules

Russian and Italian are not mirror images and the validator does not pretend
they are:

- **Russian** requires a transliteration on every entry and a stress form that
  matches its base word once combining marks are stripped. Cyrillic is
  unreadable to a beginner and Russian stress is unpredictable.
- **Italian** takes a hint *only where one teaches something* — digraphs,
  meaningful double consonants, irregular stress. A hint that merely restates
  the spelling fails validation, because filler trains the learner to ignore
  hints.

## Progress model

Progress is per **direction**, per **item**, per **skill**:

```
ProgressKey = direction | kind | itemID | skill
```

Knowing `вода → acqua` at 96% says nothing about producing `вода` from `acqua`,
which may be 55%. Collapsing them into Web V1's single scalar lets an item read
as mastered when only its easy half is. Each skill carries its own SM-2 state;
the item-level figure is a weighted roll-up with production weighted above
recognition, and unpractised skills excluded so they do not drag it down.

### Storage

One `LearnerProgress` value, Codable, written atomically to
`Application Support/SpasiBoh/progress.json`.

Not SwiftData, which the original plan named. The data is a few thousand small
structs, single-user, never synced and never queried by anything but this app,
so a relational store buys nothing and costs a schema plus a `@MainActor`
`ModelContext` that would drag persistence into the app target and out of reach
of `swift test`. As a value type it also makes export/import the *same* code
path as saving, rather than a second serialization that can drift from the
first.

Every field decodes with a default, so a later version can add one without a
migration step. `version` exists so a genuinely breaking change is detectable
rather than silently misread.

A file that fails to decode is **moved aside, not deleted**: the history is
already lost, and destroying the evidence means it can never be recovered by
hand.

## Engine

Ported faithfully from Web V1, reimplemented per skill.

| Constant | Value |
|---|---|
| Target streak | 5 |
| Mastery interval | 21 days |
| Minimum exposures | 3 |
| Ease | 2.5, clamped [1.3, 2.8] |
| Max box | 5 |
| Relearn delay | 8 minutes |
| Max interval | 180 days |

`mastery = clamp01((0.45·accuracy + 0.25·min(streak/5,1) + 0.30·min(interval/21,1)) · min(seen/3,1))`

The confidence multiplier is what stops three lucky answers reading as mastery.

**Session mix**: due 0.50 / weak 0.25 / new 0.20 / mastered 0.05, with backfill
in priority order so a session is never short because one bucket is empty. A
learner with nothing due and nothing weak gets an all-new mix instead of three
items.

**Exercise weighting** encodes the easy→hard progression: recognition weight
`max(0.2, 3−4m)` falls as mastery rises, production `0.8+1.5m` rises. Recognition
never reaches zero — it is still the fastest way to refresh a lapsed item.

**RNG** is mulberry32 seeded by FNV-1a over a string, ported with wrapping
arithmetic (`&*`, `&+`). `String.hashValue` is unusable here: Swift seeds its
hasher randomly per process, so it would produce a different session on every
launch. Seeding makes session composition assertable rather than statistical.

**A miss reschedules, it does not punish.** The 8-minute relearn interval is
shorter than a session, and the runner additionally requeues a missed exercise
at the back of the current queue. No lives, no streak loss, no lockout.

## Text handling

Everything in `TextNormalization` operates on `Character` (grapheme clusters),
never on UTF-16 offsets or unicode scalars. The content mixes Cyrillic,
combining stress marks, precomposed and decomposed Italian accents, flag emoji
(2 scalars) and ZWJ sequences (5+). Splitting any of those by scalar renders
replacement characters — the "emoji break" failure this app must not have.

- Russian: `ё → е` folded (both spellings occur and keyboards produce `е`).
  `й → и` deliberately **not** folded — `мой` and `мои` are different words and
  accepting one for the other teaches an error.
- Italian: diacritics folded via NFD, so precomposed `à` and decomposed `a`+
  U+0300 compare equal.
- Speech threshold is length-dependent: ≤4 chars → 0.95, ≤8 → 0.82, else 0.75.
  Short words need near-exactness (`кот` vs `кит`); long phrases get slack
  because recognisers drop particles without the learner erring.

Web V1 had a real bug here: `word-spell` bypassed normalization entirely, so `ё`
failed spelling but passed sentence-build, and `matchSpeech` normalized *both*
sides as Russian. Both are fixed and covered by tests.

## Localization

A typed bilingual table (`Copy`/`S`), not a String Catalog.

The interface language is **not** the device language: it follows the learning
direction chosen inside the app and switches at runtime. Resolving through
`Bundle` would mean fighting the system locale on every string. A typed table
also fails at compile time when a string is missing, which a stringly-keyed
catalogue cannot.

`InfoPlist.xcstrings` remains the correct mechanism for permission strings,
because iOS renders those itself and follows the device language.

## Speech and audio

Both sit behind protocols (`Speaking`, `Listening`) so exercise logic is
testable with stubs.

**Actor isolation is the subtle part.** A closure written inside a `@MainActor`
method inherits main-actor isolation. Speech and AVFoundation invoke their
callbacks on their own queues, so such a closure traps in
`_dispatch_assert_queue_fail` on *entry* — before any of its body runs. Wrapping
the body in `DispatchQueue.main.async` does not help. Permission callbacks
therefore live in a `nonisolated` `SpeechPermissions` bridge, the recognition
handler and audio tap are explicitly `@Sendable`, and state is updated only
after the `await` returns to the main actor. This is covered by regression
tests in `SpasiBohTests/SpeechConcurrencyTests.swift`.

Recognition grades **every** hypothesis, not just the top one: recognisers
routinely rank a wrong homophone first with the correct reading second.
Feedback shows what was actually heard rather than inventing a phoneme score.

If permission is refused, pronunciation exercises are not generated at all,
rather than offered and then failing.

## Content

| Asset | Count | Source |
|---|---|---|
| Concepts | 598 | extracted from Web V1 TypeScript |
| Sentences | 214 | extracted from Web V1 |
| Cyrillic letters | 33 | extracted from Web V1 |
| Italian patterns | 21 | **new** |
| Scenarios | 20 (10 Russia, 10 Italy) | 10 extracted, 10 **new** |
| Idioms | 12 | **new** |
| Culture cards | 12 | **new**, each sourced |
| Language tips | 14 | **new** |

Italy scenarios are written around Italian situations — paying at the cassa
before ordering at the bar, validating a regional ticket, the coperto on a
restaurant bill — not translated from the Moscow set.

Culture cards each carry a `source` field, shown in the app. The validator
rejects a card without one.

Regenerate the authored files with `python3 ios/Tools/author-content.py`.

## Validation

`ContentValidator` runs inside the test suite, so invalid content fails the
build. It checks duplicate and non-ASCII ids, empty text on either side, Russian
stress/transliteration presence and stress-form consistency, Italian filler
hints, unknown keyword and scenario references, option/index integrity per
step **in the language that step is actually rendered in**, minimal pairs on
double-consonant patterns, culture cards without sources, and that neither
direction is left with no warm-up or no scenarios.

That last rule caught a real defect: an existing test hard-coded Italian
comprehension options and Russian choice options, which held only while the
Italy set did not exist.
