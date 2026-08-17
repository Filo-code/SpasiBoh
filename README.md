# SpasiBoh! 🇮🇹 ↔ 🇷🇺

**Learn Russian and Italian through adaptive exercises, pronunciation, real-life scenarios, spaced repetition, culture — and a little chaos.**

SpasiBoh! is an experimental language-learning game focused on making **Italian ↔ Russian** practice useful, interactive and actually enjoyable.

Web V1 was the first **web prototype**, built to test the learning system. The
native iPhone app now lives in [`ios/`](ios/) on the `ios-swift` branch.

---

## 📱 Native iOS app

**Status: working and verified on the simulator, on the `ios-swift` branch. Not merged into `main`, not shipped to the App Store.**

SwiftUI, no WebView, no React Native, no Capacitor. The app lives in [`ios/`](ios/).

It is genuinely **bidirectional**, which is the main departure from Web V1: that
version taught *Russian, explained in Italian*. Here Italian → Russian and
Russian → Italian are two separate learning tasks over the same content, with
separate progress, separate warm-ups, separate scenario sets and separate
interface languages.

### Architecture

```
ios/
├── project.yml            # XcodeGen spec — the source of truth
├── SpasiBoh.xcodeproj     # GENERATED, gitignored, never hand-edited
├── SpasiBohCore/          # SwiftPM package — all logic, no UI
│   ├── Models/ Engine/ Content/ Text/ Progress/
│   └── Resources/Content/*.json
├── SpasiBoh/              # App target — SwiftUI, AVFoundation, Speech
├── SpasiBohTests/         # App-target unit tests
├── SpasiBohUITests/       # End-to-end tests against the running app
└── Tools/                 # content extraction and authoring scripts
```

`SpasiBohCore` **cannot import SwiftUI** — the compiler enforces the boundary, so
the engine is testable in under a second with no simulator, and the app target
holds only presentation and platform services.

Design notes, the bidirectional model, the engine constants and the Swift
concurrency rules for the speech callbacks are in
[`docs/ios/ARCHITECTURE.md`](docs/ios/ARCHITECTURE.md).

### Build and run

The Xcode project is a build artifact, so generating it is the mandatory first
step after cloning:

```bash
brew install xcodegen                  # once — pinned at 2.46.0
cd ios && xcodegen generate            # after cloning, or after editing project.yml
```

Then, from the repository root:

```bash
# Engine and content — fast, no simulator
cd ios/SpasiBohCore && swift test
swift run validate-content             # content report; non-zero exit on problems

# Full app build and tests
xcodebuild -project ios/SpasiBoh.xcodeproj -scheme SpasiBoh \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' test
```

Requires **Xcode 26.6**, iOS SDK 26.5. Deployment target **iOS 26.0**.
Edit `ios/project.yml`, never the generated project.

### Tests

| Suite | Count | What it covers |
|---|---|---|
| `SpasiBohCoreTests` | 101 | mastery/scheduling, seeded RNG, exercise generation, Unicode safety, content validation |
| `SpasiBohTests` | 6 | app-target units, incl. speech-callback concurrency regressions |
| `SpasiBohUITests` | 7 | onboarding both directions, a full session, scenarios, collection, relaunch persistence, speech authorization |

All green on iPhone 17 Pro / iOS 26.5. Content validation runs **inside** the
test suite, so invalid content fails the build rather than shipping as an
exercise with no correct answer.

### Content

| Asset | Count | Origin |
|---|---|---|
| Concepts | 598 | extracted from Web V1 |
| Sentences | 214 | extracted from Web V1 |
| Cyrillic letters | 33 | extracted from Web V1 |
| Italian pronunciation patterns | 21 | new |
| Scenarios | 20 (10 Russia, 10 Italy) | 10 extracted, 10 new |
| Idioms | 12 | new |
| Culture cards | 12 | new, each with a source |
| Language tips | 14 | new |

The Italy scenarios are written around Italian situations — paying at the cassa
before ordering at the bar, validating a regional ticket, the coperto on a bill —
not translated from the Moscow set.

### Current limitations

Stated plainly rather than left to be discovered:

* **Music & Culture is deliberately not built.** See below.
* **Italian pronunciation data is sparse**: 34 of 598 concepts carry a hint and 6
  carry an explicit stress mark. This is partly by design — Italian orthography is
  largely phonetic, and the validator *rejects* a hint that merely restates the
  spelling — but enriching the genuine traps is the largest remaining content job.
* **No explicit Dynamic Type pass.** Tap targets, accessibility labels and text
  scaling are in place; the accessibility text sizes have not been swept.
* **Speech recognition is only simulator-verified.** Microphone input in the
  simulator is unreliable, so on-device accuracy is unproven.
* Layout checked on iPhone 17e and 17 Pro Max, in both directions. Not checked on
  iPad.
* Not merged into `main`, and no App Store build.

---

## 🎯 The idea

SpasiBoh! is not meant to be another basic flashcard app.

The goal is to combine:

* adaptive learning;
* spaced repetition;
* pronunciation;
* listening;
* vocabulary;
* sentence building;
* real-world travel situations;
* mistake tracking;
* statistics;
* cultural content;
* lightweight gamification.

The app should progressively learn **what you know, what you keep getting wrong, and what you need to review next**.

---

## 🚀 Web V1

The current version includes the first working implementation of the learning system.

### 🔤 Russian alphabet

Interactive alphabet training with:

* Cyrillic recognition;
* pronunciation;
* example words;
* audio;
* mistake tracking;
* adaptive review.

### 📚 Vocabulary

Vocabulary exercises using a larger structured dataset instead of a tiny fixed quiz.

Exercise types include:

* Russian → Italian;
* Italian → Russian;
* multiple choice;
* listening;
* pronunciation;
* contextual exercises.

### 🎧 Listening

Russian audio exercises using browser speech synthesis.

### 🎙 Pronunciation

Speech recognition exercises using the browser microphone when supported.

The system checks whether the expected Russian word or sentence was recognized.

It is not intended to be professional phonetic scoring.

### 🧩 Sentence training

Exercises for:

* sentence construction;
* word ordering;
* fill-in-the-blank;
* comprehension;
* conversational responses.

### ✈️ Travel scenarios

Interactive exercises based on practical situations such as:

* airport;
* metro;
* railway station;
* hotel;
* restaurant;
* asking for directions;
* basic conversation.

### ❌ Mistake review

Errors are stored and used to prioritize future exercises.

The goal is not to punish mistakes — it is to make them useful.

### 🧠 Adaptive learning

SpasiBoh! includes a learning engine that considers things such as:

* items already seen;
* correct answers;
* mistakes;
* mastery;
* weak items;
* review priority;
* previous sessions.

This prevents mastered words from appearing constantly while difficult concepts receive more attention.

### 📊 Statistics

Learning progress is stored locally and can be reviewed through the statistics section.

---

## 💾 Local-first

The current web version stores learning progress locally using **IndexedDB**.

No account is required.

No backend is required.

No cloud database is required.

The learner's progress remains on the device.

---

## 🛠 Tech stack

The Web V1 is built with:

* React
* TypeScript
* Vite
* IndexedDB
* Web Speech API
* Speech Synthesis API
* PWA support

---

## 📁 Project structure

```text
src/
├── components/       Reusable UI and exercise components
├── data/             Alphabet, vocabulary, phrases and scenarios
├── db/               Local persistence and backup logic
├── engine/           Scheduler, mastery and exercise generation
├── features/         Main learning features
├── hooks/            Shared React hooks
├── pages/            Application screens
├── services/         Speech recognition and audio
├── store/            Application state
├── types/            TypeScript models
└── utils/            Shared utilities

scripts/
└── validate-data.ts  Learning dataset validation
```

---

## ▶️ Running locally

Clone the repository:

```bash
git clone https://github.com/Filo-code/SpasiBoh.git
```

Enter the project directory:

```bash
cd SpasiBoh
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open the local URL shown by Vite.

---

## 🧪 Development

Useful commands:

```bash
npm run dev
npm run build
npm run test
```

If available in the current project configuration:

```bash
npm run validate:data
```

The validation system is intended to catch problems such as:

* duplicate IDs;
* incomplete learning items;
* malformed phrases;
* invalid references;
* missing translations.

---

## 🗺 Roadmap

### Web V1 ✅

Initial playable prototype and learning engine.

### Bilingual architecture 🇮🇹 ↔ 🇷🇺

The next major evolution is full two-way support:

**Italian speakers learning Russian**

and

**Russian speakers learning Italian**

with equivalent:

* warm-ups;
* vocabulary;
* pronunciation;
* sentence exercises;
* travel scenarios;
* interface localization.

### Italian pronunciation 🇮🇹

The Italian-learning mode will focus on real pronunciation difficulties instead of simply teaching the Latin alphabet:

* GLI
* GN
* SC
* CI / CHI
* CE / CHE
* GI / GHI
* GE / GHE
* R
* stress
* double consonants

### Culture & tips 🌍

Future versions will introduce unlockable cultural content such as:

* unusual geography;
* history;
* everyday habits;
* food;
* expressions;
* slang;
* language tips;
* Italian ↔ Russian cultural connections.

For example: the Russian city **Tolyatti / Тольятти**, named after Italian politician Palmiro Togliatti.

### Music & Culture 🎵

Short interactive activities based on legally reusable music and cultural material:

* listening;
* word recognition;
* phrase ordering;
* meaning;
* pronunciation;
* cultural context.

Only public-domain, appropriately licensed or otherwise legally usable material will be included.

> **Deferred in the native app, on purpose.** The licensing constraint above is
> the whole difficulty: the recording rights and the composition rights are
> separate, and neither could be verified for this milestone. Shipping a
> plausible-looking catalogue without confirmed licences would be worse than
> shipping nothing, so the feature is not built. The data model treats
> composition and recording rights as separate fields for when it is.

### Progression 🔥

Future progression may include:

* XP;
* streaks;
* challenges;
* achievements;
* unlockable tips;
* cultural curiosities.

No hearts.

No lives.

No “wait until tomorrow because you made too many mistakes”.

---

## 📱 Native iPhone version

**This is now built** — see [Native iOS app](#-native-ios-app) above. This section
records what the web prototype was *for*.

The web version existed partly to validate:

* learning mechanics;
* exercise design;
* content;
* progression;
* UX;

before rebuilding the final experience natively in Xcode.

The native version was expected to use Apple technologies for the SwiftUI
interface, local persistence, speech recognition, text-to-speech, haptics,
animations and offline learning. All of these are in the shipped `ios-swift`
build except haptics-heavy animation polish, which is deliberately restrained:
a buzz on every tap is noise, and noise gets the whole app muted.

---

## 🧩 Unicode matters

SpasiBoh! works with:

* Cyrillic;
* Italian accented characters;
* mixed-language text;
* emoji;
* flags;
* Unicode grapheme clusters.

Unicode handling is therefore treated as a real technical requirement.

Emoji and visible text should never be used as internal identifiers or relied upon for unsafe string indexing.

This will become especially important in the native Swift version.

---

## 🥟 Why “SpasiBoh!”?

`Спасибо` — **Spasibo** — means “thank you” in Russian.

`Boh` is possibly the most Italian way of saying:

> “I have absolutely no idea.”

Put them together and you get:

# SpasiBoh!

Serious language learning.

Slightly less serious branding.

---

## 📌 Project status

**Current release:** Web V1

The project is actively evolving and is primarily an experimental/personal learning project.

---

## License

No license has currently been specified.

Until a license is explicitly added, normal copyright rules apply to the repository.
