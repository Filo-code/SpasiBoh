/**
 * Converts the Web V1 TypeScript datasets into the bilingual JSON the native
 * app ships.
 *
 * Run from the repo root:  npx tsx ios/Tools/extract-content.ts
 *
 * This is a one-way, re-runnable migration, not a build step: the JSON is
 * committed and the app never parses TypeScript. Keeping it re-runnable means
 * corrections made in the web dataset can still be pulled forward.
 *
 * The important transformation is structural, not textual. Web V1 modelled
 * Russian as the subject and Italian as its translation, so `transliteration`
 * and `stress` were Russian-only and `frequencyRank` meant Russian frequency.
 * Here each language becomes a peer `LanguageSide`, and anything that was
 * implicitly Russian is placed on the Russian side explicitly.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { WORDS } from '../../src/data/words/index'
import { PHRASES } from '../../src/data/phrases/index'
import { ALPHABET } from '../../src/data/alphabet'
import { SCENARIOS } from '../../src/data/scenarios/index'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../SpasiBohCore/Sources/SpasiBohCore/Resources/Content')

/**
 * Italian category keys → English machine identifiers.
 *
 * The web enum used Italian words as keys, which reads as noise to a Russian
 * speaker and leaks the metalanguage into the data layer. Display names now
 * come from the localization catalogue instead.
 */
const CATEGORY: Record<string, string> = {
  saluti: 'greetings', persone: 'people', numeri: 'numbers', tempo: 'time',
  casa: 'house', cibo: 'food', ristorante: 'restaurant', bar: 'bar',
  citta: 'city', trasporti: 'travel', metro: 'metro', treno: 'train',
  aeroporto: 'airport', hotel: 'hotel', viaggio: 'travel', shopping: 'shopping',
  verbi: 'verbs', aggettivi: 'adjectives', domande: 'questions',
  conversazione: 'conversation', emergenze: 'emergency', natura: 'nature',
  'corpo-salute': 'health', taxi: 'taxi', orientamento: 'directions',
  'numeri-tempo': 'time',
}

const mapCategory = (key: string): string => {
  const mapped = CATEGORY[key]
  if (!mapped) throw new Error(`Unmapped category: ${key}`)
  return mapped
}

/**
 * Italian words needing a pronunciation hint.
 *
 * Deliberately sparse. Italian orthography is largely predictable, so a hint on
 * `casa` teaches nothing and is filler; only real traps earn one. Keyed by the
 * Italian surface form, matched case-insensitively on the first sense.
 */
const IT_HINTS: Record<string, { stressed?: string; hint?: string }> = {
  'acqua': { hint: 'QU = "ку" — kw, mai "ку-у"' },
  'famiglia': { hint: 'GLI = мягкое "льи", язык у нёба' },
  'figlio': { hint: 'GLI = "льо", не "глио"' },
  'moglie': { hint: 'GLI = "лье"' },
  'aglio': { hint: 'GLI = "льо"' },
  'bagno': { hint: 'GN = "нь" — как в "конья́к"' },
  'signore': { hint: 'GN = "нь"' },
  'signora': { hint: 'GN = "нь"' },
  'sogno': { hint: 'GN = "нь"' },
  'pesce': { hint: 'SCE = "ше", не "сце"' },
  'sciare': { hint: 'SCI = "ши"' },
  'uscita': { hint: 'SC + I = "ши"' },
  'ciao': { hint: 'CI = "ч"' },
  'cena': { hint: 'CE = "че"' },
  'cinque': { hint: 'CI = "чи", QU = "кв"' },
  'che': { hint: 'CHE = "ке" — твёрдое' },
  'chi': { hint: 'CHI = "ки" — твёрдое' },
  'chiuso': { hint: 'CHI = "ки"' },
  'giorno': { hint: 'GI = "джо"' },
  'gelato': { hint: 'GE = "дже"' },
  'ghiaccio': { hint: 'GHI = "ги" твёрдое; CCI = "ччо"' },
  'zucchero': { hint: 'Z = "дз"; CCH = "кк"' },
  'grazie': { hint: 'Z = "ц"' },
  'stazione': { hint: 'ZI = "ци"' },
  'pizza': { hint: 'ZZ = "ц" долгое' },
  'città': { stressed: 'cittá', hint: 'ударение на последний слог' },
  'caffè': { stressed: 'caffè', hint: 'ударение на последний слог' },
  'perché': { stressed: 'perché', hint: 'ударение на последний слог' },
  'telefono': { stressed: 'teléfono', hint: 'ударение на 3-й слог от конца' },
  'medico': { stressed: 'médico', hint: 'ударение на 3-й слог от конца' },
  'macchina': { stressed: 'mácchina', hint: 'ударение на 3-й слог; CCH = "кк"' },
  'camera': { stressed: 'cámera', hint: 'ударение на 3-й слог от конца' },
  'nonno': { hint: 'NN долгое — ср. "nono" (девятый)' },
  'anno': { hint: 'NN долгое — ср. "ano"' },
  'cassa': { hint: 'SS долгое — ср. "casa" (дом)' },
  'sette': { hint: 'TT долгое — ср. "sete" (жажда)' },
  'palla': { hint: 'LL долгое — ср. "pala" (лопата)' },
  'freddo': { hint: 'DD долгое' },
  'bello': { hint: 'LL долгое' },
  'donna': { hint: 'NN долгое' },
}

/** First sense only: `"ciao (nel congedarsi)"` → `"ciao"`. */
const bareItalian = (text: string): string =>
  text.split('/')[0].split('(')[0].trim()

const italianSide = (italian: string, rank: number, example?: string) => {
  const hint = IT_HINTS[bareItalian(italian).toLowerCase()]
  return {
    text: italian,
    stressed: hint?.stressed ?? null,
    pronunciation: hint?.hint ?? null,
    audioText: bareItalian(italian),
    frequencyRank: rank,
    example: example ?? null,
  }
}

const russianSide = (
  russian: string, translit: string, stress: string, rank: number, example?: string
) => ({
  text: russian,
  stressed: stress || null,
  pronunciation: translit || null,
  audioText: russian,
  frequencyRank: rank,
  example: example ?? null,
})

// ---------------------------------------------------------------- concepts

const concepts = WORDS.map((w, index) => ({
  id: w.id,
  it: italianSide(w.italian, index + 1, w.exampleItalian),
  ru: russianSide(w.russian, w.transliteration, w.stress, w.frequencyRank, w.exampleSentence),
  category: mapCategory(w.category),
  difficulty: w.difficulty,
  visualHint: w.visualHint ?? null,
  symbolName: null,
  register: 'neutral',
  tags: [],
  // The web `notes` field was Italian-only prose about Russian. It is kept on
  // the Italian side only; inventing a Russian translation here would be
  // fabricating content, so the RU learner simply sees no note until these are
  // authored properly.
  note: w.notes ? { it: w.notes, ru: '' } : null,
}))

// --------------------------------------------------------------- sentences

const sentences = PHRASES.map((p, index) => ({
  id: p.id,
  it: italianSide(p.italian, index + 1),
  ru: russianSide(p.russian, p.transliteration, '', index + 1),
  category: mapCategory(p.category),
  difficulty: p.difficulty,
  keywords: p.keywords ?? [],
  register: 'neutral',
  note: p.notes ? { it: p.notes, ru: '' } : null,
  distractors: p.distractors?.length ? { ru: p.distractors } : {},
  alternatives: p.alternativeTranslations?.length ? { it: p.alternativeTranslations } : {},
  scenarioID: null,
}))

// ---------------------------------------------------------------- alphabet

const letters = ALPHABET.map((l) => ({
  id: l.id,
  upper: l.upper,
  lower: l.lower,
  name: l.name,
  pronunciation: l.pronunciation,
  soundKey: l.soundKey,
  exampleWord: l.exampleWord,
  exampleWordTranslated: l.exampleWordItalian,
  exampleWordTranslit: l.exampleWordTranslit,
  confusableWith: l.confusableWith,
  hasSound: l.hasSound,
  // The Latin look-alikes that cause the most beginner errors.
  isFalseFriend: ['ve', 'en', 'er', 'es', 'u', 'ha'].includes(l.id),
  note: l.notes ? { it: l.notes, ru: '' } : null,
  order: l.order,
}))

// --------------------------------------------------------------- scenarios

const scenarios = SCENARIOS.map((s) => ({
  id: s.id,
  // Every web scenario is set in Russia, so all of them belong to the
  // Italian-speaker-learning-Russian direction. The Italy set is authored
  // separately rather than mirrored — validating a regional ticket is not the
  // translation of buying a metro token.
  direction: 'it-ru',
  title: { it: s.title, ru: '' },
  symbolName: 'mappin.and.ellipse',
  intro: { it: s.intro, ru: '' },
  category: mapCategory(s.category),
  difficulty: s.difficulty,
  steps: s.steps.map((step) => ({
    id: step.id,
    kind: step.kind,
    npcIt: step.npcItalian ? { text: step.npcItalian, stressed: null, pronunciation: null, audioText: null, frequencyRank: 9999, example: null } : null,
    npcRu: step.npcRussian ? { text: step.npcRussian, stressed: null, pronunciation: step.npcTransliteration ?? null, audioText: step.npcRussian, frequencyRank: 9999, example: null } : null,
    prompt: { it: step.prompt, ru: '' },
    targetIt: step.targetItalian ? { text: step.targetItalian, stressed: null, pronunciation: null, audioText: null, frequencyRank: 9999, example: null } : null,
    targetRu: step.targetRussian ? { text: step.targetRussian, stressed: null, pronunciation: step.targetTransliteration ?? null, audioText: step.targetRussian, frequencyRank: 9999, example: null } : null,
    distractors: step.distractors?.length ? { ru: step.distractors } : {},
    optionsIt: step.kind === 'comprehension' ? (step.options ?? []) : [],
    optionsRu: step.kind === 'choice' ? (step.options ?? []) : [],
    correctOption: step.correctOption ?? null,
    hint: step.hint ? { it: step.hint, ru: '' } : null,
  })),
}))

// ------------------------------------------------------------------ output

mkdirSync(outDir, { recursive: true })

const write = (name: string, data: unknown, count: number) => {
  writeFileSync(resolve(outDir, name), JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`  ${name.padEnd(18)} ${count}`)
}

console.log('Extracted:')
write('concepts.json', concepts, concepts.length)
write('sentences.json', sentences, sentences.length)
write('letters.json', letters, letters.length)
write('scenarios.json', scenarios, scenarios.length)

const withItHint = concepts.filter((c) => c.it.pronunciation).length
console.log(`\nItalian pronunciation hints: ${withItHint}/${concepts.length} (sparse by design)`)
