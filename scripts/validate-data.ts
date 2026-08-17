/**
 * Content validator — `npm run validate:data`.
 *
 * Catches the mistakes that are easy to make when hand-authoring a few hundred
 * entries: duplicate ids, missing translations, categories that don't exist,
 * scenario steps that point at nothing.
 *
 * Exits non-zero on errors so it can gate a build; warnings are informational.
 */
import { ALPHABET } from '../src/data/alphabet'
import { WORDS } from '../src/data/words/index'
import { PHRASES } from '../src/data/phrases/index'
import { SCENARIOS } from '../src/data/scenarios/index'
import { REPLYABLE_PHRASE_IDS } from '../src/engine/exerciseFactory'
import { WORD_CATEGORIES, PHRASE_CATEGORIES } from '../src/types/content'

const errors: string[] = []
const warnings: string[] = []

function error(message: string): void {
  errors.push(message)
}
function warn(message: string): void {
  warnings.push(message)
}

const CYRILLIC = /^[Ѐ-ӿ\s.,!?«»:;()«»'’—-]+$/

// ------------------------------------------------------------------ alphabet

function validateAlphabet(): void {
  if (ALPHABET.length !== 33) {
    error(`alfabeto: attese 33 lettere, trovate ${ALPHABET.length}`)
  }

  const ids = new Set<string>()
  const orders = new Set<number>()

  for (const letter of ALPHABET) {
    if (ids.has(letter.id)) error(`alfabeto: id duplicato "${letter.id}"`)
    ids.add(letter.id)

    if (orders.has(letter.order)) error(`alfabeto: ordine duplicato ${letter.order}`)
    orders.add(letter.order)

    if (!letter.upper || !letter.lower) error(`alfabeto ${letter.id}: maiuscola/minuscola mancante`)
    if (!letter.name) error(`alfabeto ${letter.id}: nome mancante`)
    if (!letter.pronunciation) error(`alfabeto ${letter.id}: pronuncia mancante`)
    if (!letter.soundKey) error(`alfabeto ${letter.id}: soundKey mancante`)
    if (!letter.exampleWord) error(`alfabeto ${letter.id}: parola d'esempio mancante`)
    if (!letter.exampleWordItalian) error(`alfabeto ${letter.id}: traduzione esempio mancante`)
    if (!letter.exampleWordTranslit) error(`alfabeto ${letter.id}: traslitterazione esempio mancante`)

    if (letter.upper.toLowerCase() !== letter.lower) {
      warn(`alfabeto ${letter.id}: "${letter.upper}"/"${letter.lower}" non sembrano la stessa lettera`)
    }

    for (const other of letter.confusableWith) {
      if (!ALPHABET.some((l) => l.id === other)) {
        error(`alfabeto ${letter.id}: confusableWith punta a "${other}" che non esiste`)
      }
      if (other === letter.id) error(`alfabeto ${letter.id}: confusableWith contiene se stessa`)
    }
  }

  // Multiple-choice options must be distinguishable.
  const soundKeys = new Map<string, string[]>()
  for (const letter of ALPHABET) {
    const list = soundKeys.get(letter.soundKey) ?? []
    list.push(letter.id)
    soundKeys.set(letter.soundKey, list)
  }
  for (const [key, list] of soundKeys) {
    if (list.length > 1) {
      error(`alfabeto: soundKey "${key}" condiviso da ${list.join(', ')} — le risposte sarebbero ambigue`)
    }
  }
}

// --------------------------------------------------------------------- words

function validateWords(): void {
  const ids = new Set<string>()
  const russians = new Map<string, string>()
  const categories = new Set<string>(WORD_CATEGORIES)

  for (const word of WORDS) {
    const where = `parola ${word.id}`

    if (ids.has(word.id)) error(`${where}: id duplicato`)
    ids.add(word.id)

    if (!word.russian?.trim()) error(`${where}: campo russo vuoto`)
    if (!word.italian?.trim()) error(`${where}: traduzione italiana mancante`)
    if (!word.transliteration?.trim()) error(`${where}: traslitterazione mancante`)
    if (!word.stress?.trim()) error(`${where}: forma accentata mancante`)

    const existing = russians.get(word.russian)
    if (existing) {
      error(`${where}: "${word.russian}" duplicato (già presente come ${existing})`)
    }
    russians.set(word.russian, word.id)

    if (!categories.has(word.category)) error(`${where}: categoria "${word.category}" non valida`)
    if (word.difficulty < 1 || word.difficulty > 5) error(`${where}: difficoltà fuori intervallo`)
    if (!Number.isFinite(word.frequencyRank)) error(`${where}: frequencyRank non numerico`)

    if (!CYRILLIC.test(word.russian)) {
      error(`${where}: il campo russo contiene caratteri non cirillici — "${word.russian}"`)
    }

    // The stressed form must match the plain one once the accent is removed.
    const bare = word.stress.replaceAll('́', '')
    if (bare !== word.russian) {
      error(`${where}: stress "${word.stress}" non corrisponde a "${word.russian}"`)
    }
    // Monosyllables carry no accent mark, and ё is always stressed by
    // definition — only multi-vowel words genuinely need one.
    const vowels = (word.russian.match(/[аеёиоуыэюяАЕЁИОУЫЭЮЯ]/g) ?? []).length
    if (vowels > 1 && !word.stress.includes('́') && !word.russian.includes('ё')) {
      warn(`${where}: nessun segno di accento in "${word.stress}"`)
    }

    if (word.exampleSentence && !word.exampleItalian) {
      warn(`${where}: esempio russo senza traduzione italiana`)
    }
    if (word.visualHint && word.visualHint.length > 8) {
      warn(`${where}: visualHint sospettamente lungo`)
    }
  }

  if (WORDS.length < 500) {
    error(`vocabolario: attese almeno 500 parole, trovate ${WORDS.length}`)
  }
}

// ------------------------------------------------------------------- phrases

function validatePhrases(): void {
  const ids = new Set<string>()
  const russians = new Map<string, string>()
  const categories = new Set<string>(PHRASE_CATEGORIES)
  const wordIds = new Set(WORDS.map((w) => w.id))

  for (const phrase of PHRASES) {
    const where = `frase ${phrase.id}`

    if (ids.has(phrase.id)) error(`${where}: id duplicato`)
    ids.add(phrase.id)

    if (!phrase.russian?.trim()) error(`${where}: campo russo vuoto`)
    if (!phrase.italian?.trim()) error(`${where}: traduzione italiana mancante`)
    if (!phrase.transliteration?.trim()) error(`${where}: traslitterazione mancante`)
    if (!phrase.audioText?.trim()) error(`${where}: audioText mancante`)

    const existing = russians.get(phrase.russian)
    if (existing) error(`${where}: "${phrase.russian}" duplicato (già presente come ${existing})`)
    russians.set(phrase.russian, phrase.id)

    if (!categories.has(phrase.category)) error(`${where}: categoria "${phrase.category}" non valida`)
    if (phrase.difficulty < 1 || phrase.difficulty > 5) error(`${where}: difficoltà fuori intervallo`)

    for (const keyword of phrase.keywords) {
      if (!wordIds.has(keyword)) {
        error(`${where}: keyword "${keyword}" non corrisponde a nessuna parola del vocabolario`)
      }
    }

    if (phrase.keywords.length === 0) warn(`${where}: nessuna keyword collegata`)

    // Distractor blocks must not accidentally be part of the solution.
    if (phrase.distractors) {
      const own = new Set(phrase.russian.split(/\s+/).map((w) => w.toLowerCase()))
      for (const distractor of phrase.distractors) {
        if (own.has(distractor.toLowerCase())) {
          error(`${where}: il distrattore "${distractor}" fa parte della frase stessa`)
        }
      }
    }
  }

  if (PHRASES.length < 150) {
    error(`frasi: attese almeno 150 frasi, trovate ${PHRASES.length}`)
  }

  for (const id of REPLYABLE_PHRASE_IDS) {
    if (!ids.has(id)) {
      error(`risposte conversazionali: la frase "${id}" non esiste nel dataset`)
    }
  }
}

// ----------------------------------------------------------------- scenarios

function validateScenarios(): void {
  const ids = new Set<string>()
  const categories = new Set<string>(PHRASE_CATEGORIES)

  for (const scenario of SCENARIOS) {
    const where = `scenario ${scenario.id}`

    if (ids.has(scenario.id)) error(`${where}: id duplicato`)
    ids.add(scenario.id)

    if (!scenario.title?.trim()) error(`${where}: titolo mancante`)
    if (!scenario.intro?.trim()) error(`${where}: introduzione mancante`)
    if (!categories.has(scenario.category)) error(`${where}: categoria "${scenario.category}" non valida`)

    if (scenario.steps.length < 4 || scenario.steps.length > 10) {
      warn(`${where}: ${scenario.steps.length} passaggi (attesi 4–10)`)
    }

    const stepIds = new Set<string>()
    let interactive = 0

    for (const step of scenario.steps) {
      const stepWhere = `${where} / passaggio ${step.id}`

      if (stepIds.has(step.id)) error(`${stepWhere}: id duplicato`)
      stepIds.add(step.id)

      if (!step.prompt?.trim()) error(`${stepWhere}: prompt mancante`)

      if (step.kind !== 'info') interactive += 1

      if (step.kind === 'comprehension' || step.kind === 'choice') {
        if (!step.options || step.options.length < 2) {
          error(`${stepWhere}: servono almeno 2 opzioni`)
        } else if (
          step.correctOption === undefined ||
          step.correctOption < 0 ||
          step.correctOption >= step.options.length
        ) {
          error(`${stepWhere}: correctOption fuori intervallo`)
        } else if (new Set(step.options).size !== step.options.length) {
          error(`${stepWhere}: opzioni duplicate`)
        }
      }

      if (step.kind === 'comprehension' && !step.npcRussian) {
        error(`${stepWhere}: un passaggio di comprensione richiede npcRussian`)
      }

      if (step.kind === 'build' || step.kind === 'pronounce') {
        if (!step.targetRussian?.trim()) error(`${stepWhere}: targetRussian mancante`)
        if (!step.targetItalian?.trim()) error(`${stepWhere}: targetItalian mancante`)
        if (!step.targetTransliteration?.trim()) {
          error(`${stepWhere}: targetTransliteration mancante`)
        }
      }

      if (step.kind === 'build' && step.targetRussian) {
        const blocks = step.targetRussian.split(/\s+/)
        if (blocks.length < 2) error(`${stepWhere}: frase troppo corta da comporre a blocchi`)
        const own = new Set(blocks.map((b) => b.toLowerCase()))
        for (const distractor of step.distractors ?? []) {
          if (own.has(distractor.toLowerCase())) {
            error(`${stepWhere}: il distrattore "${distractor}" fa parte della soluzione`)
          }
        }
      }

      if (step.npcRussian && !CYRILLIC.test(step.npcRussian)) {
        warn(`${stepWhere}: npcRussian contiene caratteri non cirillici`)
      }
    }

    if (interactive === 0) error(`${where}: nessun passaggio interattivo`)
  }

  if (SCENARIOS.length < 10) {
    error(`scenari: attesi almeno 10 scenari, trovati ${SCENARIOS.length}`)
  }
}

// ---------------------------------------------------------------------- main

validateAlphabet()
validateWords()
validatePhrases()
validateScenarios()

console.log('--- Validazione contenuti ---')
console.log(`Lettere:  ${ALPHABET.length}`)
console.log(`Parole:   ${WORDS.length}`)
console.log(`Frasi:    ${PHRASES.length}`)
console.log(`Scenari:  ${SCENARIOS.length} (${SCENARIOS.reduce((n, s) => n + s.steps.length, 0)} passaggi)`)
console.log('')

if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} avvisi:`)
  for (const message of warnings) console.log(`   - ${message}`)
  console.log('')
}

if (errors.length > 0) {
  console.error(`❌ ${errors.length} errori:`)
  for (const message of errors) console.error(`   - ${message}`)
  process.exit(1)
}

console.log('✅ Nessun errore nei contenuti.')
