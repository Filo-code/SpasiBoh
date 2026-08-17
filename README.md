# SpasiBoh! 🇮🇹 ↔ 🇷🇺

**Learn Russian and Italian through adaptive exercises, pronunciation, real-life scenarios, spaced repetition, culture — and a little chaos.**

SpasiBoh! is an experimental language-learning game focused on making **Italian ↔ Russian** practice useful, interactive and actually enjoyable.

The current version is the first **web prototype**, built to test the learning system before moving toward a native iPhone app.

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

The long-term target is a **native Swift / SwiftUI version for iPhone**.

The web version exists partly to validate:

* learning mechanics;
* exercise design;
* content;
* progression;
* UX;

before rebuilding the final experience natively in Xcode.

The iOS version is expected to use native Apple technologies for:

* SwiftUI interface;
* local persistence;
* speech recognition;
* text-to-speech;
* haptics;
* animations;
* offline learning.

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
