import type { AlphabetLetter, Phrase, Word } from '@/types/content'
import type {
  AnswerMode,
  ChoiceOption,
  Exercise,
  ExerciseType,
  Reveal,
} from '@/types/exercise'
import type { ItemProgress } from '@/types/progress'
import { itemKey } from '@/types/progress'
import { ALPHABET, ALPHABET_BY_ID } from '@/data/alphabet'
import { WORDS, VISUAL_WORDS } from '@/data/words'
import { PHRASES } from '@/data/phrases'
import type { Rng } from '@/utils/random'
import { toBlocks } from '@/utils/text'

/**
 * Turns a scheduled item into a concrete question.
 *
 * Two rules drive everything here:
 * 1. Never reveal the answer (transliteration, translation, audio) before the
 *    user has committed to an attempt — that information lives in `reveal`,
 *    which the UI only shows afterwards.
 * 2. Rotate the exercise format for the same item so the user learns the word,
 *    not the position of the right button.
 */

let uidCounter = 0
function nextUid(prefix: string): string {
  uidCounter += 1
  return `${prefix}-${uidCounter}`
}

/** Exposed for tests so uids are reproducible. */
export function resetUidCounter(): void {
  uidCounter = 0
}

export interface FactoryOptions {
  /** Disable microphone exercises when the browser has no SpeechRecognition. */
  allowSpeech: boolean
  /** Force a specific exercise type (free-training modes). */
  forceType?: ExerciseType
}

// ---------------------------------------------------------------- helpers

function shuffleOptions(rng: Rng, options: ChoiceOption[]): ChoiceOption[] {
  return rng.shuffle(options)
}

function makeOptions(
  rng: Rng,
  correctLabel: string,
  distractorLabels: string[],
  cyrillic: boolean,
): ChoiceOption[] {
  const options: ChoiceOption[] = [
    { id: 'opt-correct', label: correctLabel, correct: true, cyrillic },
    ...distractorLabels.map((label, i) => ({
      id: `opt-${i}`,
      label,
      correct: false,
      cyrillic,
    })),
  ]
  return shuffleOptions(rng, options)
}

/**
 * Picks distractors that are actually confusable: same category first, then
 * same difficulty, then anything. Never returns the correct answer itself.
 */
function pickWordDistractors(rng: Rng, word: Word, count: number, byItalian: boolean): Word[] {
  const sameCategory = WORDS.filter(
    (w) => w.id !== word.id && w.category === word.category && !isTooSimilar(w, word, byItalian),
  )
  const sameDifficulty = WORDS.filter(
    (w) =>
      w.id !== word.id &&
      w.category !== word.category &&
      Math.abs(w.difficulty - word.difficulty) <= 1 &&
      !isTooSimilar(w, word, byItalian),
  )

  const chosen: Word[] = rng.sample(sameCategory, count)
  if (chosen.length < count) {
    const used = new Set(chosen.map((w) => w.id))
    for (const candidate of rng.shuffle(sameDifficulty)) {
      if (chosen.length >= count) break
      if (used.has(candidate.id)) continue
      chosen.push(candidate)
      used.add(candidate.id)
    }
  }
  if (chosen.length < count) {
    const used = new Set([word.id, ...chosen.map((w) => w.id)])
    for (const candidate of rng.shuffle(WORDS)) {
      if (chosen.length >= count) break
      if (used.has(candidate.id)) continue
      chosen.push(candidate)
      used.add(candidate.id)
    }
  }
  return chosen
}

/** Guards against two options that mean the same thing in Italian. */
function isTooSimilar(a: Word, b: Word, byItalian: boolean): boolean {
  if (byItalian) {
    const left = a.italian.split('/')[0].trim().toLowerCase()
    const right = b.italian.split('/')[0].trim().toLowerCase()
    return left === right
  }
  return a.russian === b.russian
}

/**
 * Chooses which format to use next for an item.
 *
 * Early on we stay on recognition (ru→it, audio); once the item is known we
 * move towards production (it→ru, spelling, pronunciation). Formats used in
 * the last two attempts are avoided.
 */
export function chooseExerciseType(
  available: ExerciseType[],
  progress: ItemProgress,
  rng: Rng,
  options: FactoryOptions,
): ExerciseType {
  if (options.forceType && available.includes(options.forceType)) return options.forceType

  let pool = available
  if (!options.allowSpeech) {
    pool = pool.filter((t) => !t.endsWith('pronounce'))
  }

  const recent = new Set(progress.recentExerciseTypes.slice(0, 2))
  const fresh = pool.filter((t) => !recent.has(t))
  const candidates = fresh.length > 0 ? fresh : pool

  const weights = candidates.map((type) => ({ type, weight: weightForType(type, progress) }))
  const total = weights.reduce((sum, w) => sum + w.weight, 0)
  let ticket = rng.next() * total
  for (const entry of weights) {
    ticket -= entry.weight
    if (ticket <= 0) return entry.type
  }
  return candidates[candidates.length - 1]
}

function weightForType(type: ExerciseType, progress: ItemProgress): number {
  const m = progress.mastery
  const isNew = progress.seenCount === 0

  switch (type) {
    // Recognition — heavy at the start.
    case 'ru-it':
    case 'letter-sound':
    case 'phrase-listen':
      return isNew ? 5 : 3 - m
    case 'audio-it':
      return isNew ? 2 : 2.5
    // Recall — needs some footing first.
    case 'it-ru':
    case 'letter-recognize':
    case 'phrase-it-ru':
      return isNew ? 1 : 1.5 + m
    case 'audio-ru':
    case 'letter-audio':
      return isNew ? 1 : 2
    case 'visual-ru':
      return isNew ? 2 : 2
    case 'phrase-gap':
    case 'phrase-reply':
      return isNew ? 0.5 : 1.5 + m
    // Production — only once the item is reasonably solid.
    case 'word-spell':
    case 'phrase-build':
      return isNew ? 0.4 : 1 + m * 1.5
    case 'word-pronounce':
    case 'letter-pronounce':
    case 'phrase-pronounce':
      return isNew ? 0.3 : 0.8 + m * 1.5
  }
}

// ---------------------------------------------------------------- letters

function letterReveal(letter: AlphabetLetter): Reveal {
  return {
    russian: letter.upper,
    italian: `Nome della lettera: ${letter.name}`,
    transliteration: letter.pronunciation,
    example: `${letter.exampleWord} — ${letter.exampleWordTranslit}`,
    exampleItalian: letter.exampleWordItalian,
    note: letter.notes,
    audioText: letter.exampleWord,
  }
}

function letterDistractors(rng: Rng, letter: AlphabetLetter, count: number): AlphabetLetter[] {
  const confusable = letter.confusableWith
    .map((id) => ALPHABET_BY_ID[id])
    .filter((l): l is AlphabetLetter => Boolean(l) && l.id !== letter.id)

  const chosen = [...confusable].slice(0, count)
  if (chosen.length < count) {
    const used = new Set([letter.id, ...chosen.map((l) => l.id)])
    for (const candidate of rng.shuffle(ALPHABET)) {
      if (chosen.length >= count) break
      if (used.has(candidate.id)) continue
      if (candidate.soundKey === letter.soundKey) continue
      chosen.push(candidate)
      used.add(candidate.id)
    }
  }
  return rng.shuffle(chosen)
}

export function buildLetterExercise(
  letter: AlphabetLetter,
  progress: ItemProgress,
  rng: Rng,
  options: FactoryOptions,
): Exercise {
  const type = chooseExerciseType(
    ['letter-sound', 'letter-recognize', 'letter-audio', 'letter-pronounce'],
    progress,
    rng,
    options,
  )
  const distractors = letterDistractors(rng, letter, 3)
  const base = {
    uid: nextUid('ex'),
    itemKey: itemKey('letter', letter.id),
    itemKind: 'letter' as const,
    itemId: letter.id,
    reveal: letterReveal(letter),
    isNew: progress.seenCount === 0,
  }

  switch (type) {
    case 'letter-recognize':
      return {
        ...base,
        type,
        answerMode: 'choice' as AnswerMode,
        prompt: 'Quale lettera si legge così?',
        promptMain: letter.soundKey,
        promptSub: 'Scegli il carattere cirillico',
        options: makeOptions(
          rng,
          letter.upper,
          distractors.map((l) => l.upper),
          true,
        ),
      }

    case 'letter-audio':
      return {
        ...base,
        type,
        answerMode: 'choice' as AnswerMode,
        prompt: 'Ascolta e scegli la lettera',
        audioText: letter.exampleWord,
        audioIsPrompt: true,
        promptSub: 'Con quale lettera inizia questa parola?',
        options: makeOptions(
          rng,
          letter.upper,
          distractors.map((l) => l.upper),
          true,
        ),
      }

    case 'letter-pronounce':
      return {
        ...base,
        type,
        answerMode: 'speech' as AnswerMode,
        prompt: 'Pronuncia questa parola',
        promptMain: letter.exampleWord,
        promptIsCyrillic: true,
        accepted: [letter.exampleWord],
        reveal: { ...letterReveal(letter), audioText: letter.exampleWord },
      }

    case 'letter-sound':
    default:
      return {
        ...base,
        type: 'letter-sound',
        answerMode: 'choice' as AnswerMode,
        prompt: 'Come si pronuncia?',
        promptMain: letter.upper,
        promptIsCyrillic: true,
        options: makeOptions(
          rng,
          letter.soundKey,
          distractors.map((l) => l.soundKey),
          false,
        ),
      }
  }
}

// ------------------------------------------------------------------ words

function wordReveal(word: Word): Reveal {
  return {
    russian: word.russian,
    italian: word.italian,
    transliteration: word.transliteration,
    stressed: word.stress,
    example: word.exampleSentence,
    exampleItalian: word.exampleItalian,
    note: word.notes,
    audioText: word.russian,
  }
}

export function buildWordExercise(
  word: Word,
  progress: ItemProgress,
  rng: Rng,
  options: FactoryOptions,
): Exercise {
  const available: ExerciseType[] = ['ru-it', 'it-ru', 'audio-ru', 'audio-it', 'word-pronounce']
  if (word.visualHint) available.push('visual-ru')
  if (word.russian.replace(/\s/g, '').length <= 9) available.push('word-spell')

  const type = chooseExerciseType(available, progress, rng, options)

  const base = {
    uid: nextUid('ex'),
    itemKey: itemKey('word', word.id),
    itemKind: 'word' as const,
    itemId: word.id,
    reveal: wordReveal(word),
    isNew: progress.seenCount === 0,
  }

  switch (type) {
    case 'it-ru': {
      const distractors = pickWordDistractors(rng, word, 3, false)
      return {
        ...base,
        type,
        answerMode: 'choice',
        prompt: 'Come si dice in russo?',
        promptMain: word.italian,
        options: makeOptions(
          rng,
          word.russian,
          distractors.map((w) => w.russian),
          true,
        ),
      }
    }

    case 'audio-ru': {
      const distractors = pickWordDistractors(rng, word, 3, false)
      return {
        ...base,
        type,
        answerMode: 'choice',
        prompt: 'Ascolta e scegli la parola',
        audioText: word.russian,
        audioIsPrompt: true,
        options: makeOptions(
          rng,
          word.russian,
          distractors.map((w) => w.russian),
          true,
        ),
      }
    }

    case 'audio-it': {
      const distractors = pickWordDistractors(rng, word, 3, true)
      return {
        ...base,
        type,
        answerMode: 'choice',
        prompt: 'Ascolta: che cosa significa?',
        audioText: word.russian,
        audioIsPrompt: true,
        options: makeOptions(
          rng,
          word.italian,
          distractors.map((w) => w.italian),
          false,
        ),
      }
    }

    case 'visual-ru': {
      const pool = VISUAL_WORDS.filter((w) => w.id !== word.id && w.visualHint !== word.visualHint)
      const distractors = rng.sample(pool, 3)
      return {
        ...base,
        type,
        answerMode: 'choice',
        prompt: 'Che cos\'è?',
        promptEmoji: word.visualHint,
        options: makeOptions(
          rng,
          word.russian,
          distractors.map((w) => w.russian),
          true,
        ),
      }
    }

    case 'word-spell': {
      const letters = [...word.russian.replace(/\s/g, '')]
      const extra = rng
        .sample(
          ALPHABET.filter((l) => !letters.includes(l.lower)),
          Math.min(3, Math.max(1, 8 - letters.length)),
        )
        .map((l) => l.lower)
      return {
        ...base,
        type,
        answerMode: 'build',
        prompt: 'Ricostruisci la parola russa',
        promptMain: word.italian,
        solutionBlocks: letters,
        blocks: rng.shuffle([...letters, ...extra]),
      }
    }

    case 'word-pronounce':
      return {
        ...base,
        type,
        answerMode: 'speech',
        prompt: 'Pronuncia questa parola',
        promptMain: word.russian,
        promptIsCyrillic: true,
        accepted: [word.russian],
      }

    case 'ru-it':
    default: {
      const distractors = pickWordDistractors(rng, word, 3, true)
      return {
        ...base,
        type: 'ru-it',
        answerMode: 'choice',
        prompt: 'Che cosa significa?',
        promptMain: word.russian,
        promptIsCyrillic: true,
        options: makeOptions(
          rng,
          word.italian,
          distractors.map((w) => w.italian),
          false,
        ),
      }
    }
  }
}

// ---------------------------------------------------------------- phrases

function phraseReveal(phrase: Phrase): Reveal {
  return {
    russian: phrase.russian,
    italian: phrase.italian,
    transliteration: phrase.transliteration,
    note: phrase.notes,
    audioText: phrase.audioText,
  }
}

function pickPhraseDistractors(rng: Rng, phrase: Phrase, count: number): Phrase[] {
  const sameCategory = PHRASES.filter(
    (p) => p.id !== phrase.id && p.category === phrase.category && p.italian !== phrase.italian,
  )
  const chosen = rng.sample(sameCategory, count)
  if (chosen.length < count) {
    const used = new Set([phrase.id, ...chosen.map((p) => p.id)])
    for (const candidate of rng.shuffle(PHRASES)) {
      if (chosen.length >= count) break
      if (used.has(candidate.id)) continue
      if (candidate.italian === phrase.italian) continue
      chosen.push(candidate)
      used.add(candidate.id)
    }
  }
  return chosen
}

export function buildPhraseExercise(
  phrase: Phrase,
  progress: ItemProgress,
  rng: Rng,
  options: FactoryOptions,
): Exercise {
  const words = toBlocks(phrase.russian)
  const available: ExerciseType[] = ['phrase-listen', 'phrase-it-ru', 'phrase-pronounce']
  if (words.length >= 3) available.push('phrase-build')
  if (words.length >= 2) available.push('phrase-gap')
  if (isQuestionLike(phrase)) available.push('phrase-reply')

  const type = chooseExerciseType(available, progress, rng, options)

  const base = {
    uid: nextUid('ex'),
    itemKey: itemKey('phrase', phrase.id),
    itemKind: 'phrase' as const,
    itemId: phrase.id,
    reveal: phraseReveal(phrase),
    isNew: progress.seenCount === 0,
  }

  switch (type) {
    case 'phrase-it-ru': {
      const distractors = pickPhraseDistractors(rng, phrase, 3)
      return {
        ...base,
        type,
        answerMode: 'choice',
        prompt: 'Come si dice in russo?',
        promptMain: phrase.italian,
        options: makeOptions(
          rng,
          phrase.russian,
          distractors.map((p) => p.russian),
          true,
        ),
      }
    }

    case 'phrase-build': {
      const distractorBlocks = phrase.distractors ?? defaultBlockDistractors(rng, phrase)
      return {
        ...base,
        type,
        answerMode: 'build',
        prompt: 'Componi la frase in russo',
        promptMain: phrase.italian,
        solutionBlocks: words,
        blocks: rng.shuffle([...words, ...distractorBlocks]),
      }
    }

    case 'phrase-gap': {
      const gapIndex = pickGapIndex(rng, words)
      const missing = words[gapIndex]
      const masked = words.map((w, i) => (i === gapIndex ? '____' : w)).join(' ')
      const distractorWords = pickGapDistractors(rng, missing, 3)
      return {
        ...base,
        type,
        answerMode: 'choice',
        prompt: 'Completa la frase',
        promptMain: masked,
        promptIsCyrillic: true,
        promptSub: phrase.italian,
        options: makeOptions(rng, missing, distractorWords, true),
      }
    }

    case 'phrase-reply': {
      const replies = pickReplyDistractors(rng, phrase, 3)
      const answer = replyFor(phrase)
      return {
        ...base,
        type,
        answerMode: 'choice',
        prompt: 'Come rispondi?',
        promptMain: `— ${phrase.russian}`,
        promptIsCyrillic: true,
        audioText: phrase.audioText,
        options: makeOptions(
          rng,
          answer.russian,
          replies.map((p) => p.russian),
          true,
        ),
        reveal: {
          ...phraseReveal(phrase),
          russian: answer.russian,
          italian: answer.italian,
          transliteration: answer.transliteration,
          audioText: answer.audioText,
          note: `Domanda: ${phrase.russian} — ${phrase.italian}`,
        },
      }
    }

    case 'phrase-pronounce':
      return {
        ...base,
        type,
        answerMode: 'speech',
        prompt: 'Pronuncia questa frase',
        promptMain: phrase.russian,
        promptIsCyrillic: true,
        promptSub: phrase.italian,
        accepted: [phrase.russian, ...(phrase.alternativeTranslations ?? [])],
      }

    case 'phrase-listen':
    default: {
      const distractors = pickPhraseDistractors(rng, phrase, 3)
      return {
        ...base,
        type: 'phrase-listen',
        answerMode: 'choice',
        prompt: 'Ascolta: che cosa significa?',
        audioText: phrase.audioText,
        audioIsPrompt: true,
        options: makeOptions(
          rng,
          phrase.italian,
          distractors.map((p) => p.italian),
          false,
        ),
      }
    }
  }
}

/** Blanks a content word rather than a one-letter preposition when possible. */
function pickGapIndex(rng: Rng, words: string[]): number {
  const meaningful = words
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.replace(/[^\p{L}]/gu, '').length >= 3)
  if (meaningful.length === 0) return rng.int(words.length)
  return rng.pick(meaningful).i
}

function pickGapDistractors(rng: Rng, missing: string[] | string, count: number): string[] {
  const target = Array.isArray(missing) ? missing[0] : missing
  const bare = target.replace(/[^\p{L}]/gu, '').toLowerCase()
  const pool = new Set<string>()
  for (const phrase of rng.shuffle(PHRASES)) {
    for (const candidate of toBlocks(phrase.russian)) {
      const candidateBare = candidate.replace(/[^\p{L}]/gu, '').toLowerCase()
      if (!candidateBare || candidateBare === bare) continue
      if (Math.abs(candidateBare.length - bare.length) > 3) continue
      pool.add(candidate)
      if (pool.size >= count * 4) break
    }
    if (pool.size >= count * 4) break
  }
  return rng.sample([...pool], count)
}

/** Words dropped in to make the block game non-trivial. */
function defaultBlockDistractors(rng: Rng, phrase: Phrase): string[] {
  const own = new Set(toBlocks(phrase.russian).map((w) => w.toLowerCase()))
  const pool: string[] = []
  for (const other of rng.shuffle(PHRASES)) {
    if (other.id === phrase.id) continue
    for (const block of toBlocks(other.russian)) {
      if (own.has(block.toLowerCase())) continue
      pool.push(block)
      if (pool.length >= 12) break
    }
    if (pool.length >= 12) break
  }
  return rng.sample(pool, 2)
}

function isQuestionLike(phrase: Phrase): boolean {
  return phrase.russian.includes('?') && Boolean(REPLIES[phrase.id])
}

interface ReplyDefinition {
  russian: string
  italian: string
  transliteration: string
  audioText: string
}

/**
 * Hand-written natural answers for the conversational-reply exercise. Only the
 * questions listed here can produce that exercise type — a generated answer
 * would be exactly the kind of fake content this app avoids.
 */
const REPLIES: Record<string, ReplyDefinition> = {
  'conv-06': { russian: 'Хорошо, спасибо.', italian: 'Bene, grazie.', transliteration: 'harashò, spasìba', audioText: 'Хорошо, спасибо.' },
  'conv-10': { russian: 'Меня зовут Микеле.', italian: 'Mi chiamo Michele.', transliteration: 'minjà zavùt Mikèle', audioText: 'Меня зовут Микеле.' },
  'conv-11': { russian: 'Меня зовут Микеле.', italian: 'Mi chiamo Michele.', transliteration: 'minjà zavùt Mikèle', audioText: 'Меня зовут Микеле.' },
  'conv-14': { russian: 'Я из Италии.', italian: 'Vengo dall\'Italia.', transliteration: 'ja iz Itàlii', audioText: 'Я из Италии.' },
  'conv-15': { russian: 'Я из Италии.', italian: 'Vengo dall\'Italia.', transliteration: 'ja iz Itàlii', audioText: 'Я из Италии.' },
  'conv-20': { russian: 'Мне тридцать лет.', italian: 'Ho trent\'anni.', transliteration: 'mne trìtsat let', audioText: 'Мне тридцать лет.' },
  'conv-22': { russian: 'Я немного говорю по-английски.', italian: 'Parlo un po\' di inglese.', transliteration: 'ja nimnòga gavarjù pa-anglìjski', audioText: 'Я немного говорю по-английски.' },
  'conv-47': { russian: 'Конечно.', italian: 'Certo.', transliteration: 'kanèshna', audioText: 'Конечно.' },
  'conv-49': { russian: 'Да, пожалуйста.', italian: 'Sì, per favore.', transliteration: 'da, pazhàlusta', audioText: 'Да, пожалуйста.' },
  'res-06': { russian: 'Тысяча рублей.', italian: 'Mille rubli.', transliteration: 'tỳsicha rubljèj', audioText: 'Тысяча рублей.' },
  'met-12': { russian: 'Нет, это рядом.', italian: 'No, è qui vicino.', transliteration: 'net, èta rjàdam', audioText: 'Нет, это рядом.' },
  'num-01': { russian: 'Сейчас три часа.', italian: 'Sono le tre.', transliteration: 'sichàs tri chisà', audioText: 'Сейчас три часа.' },
  'htl-05': { russian: 'Завтрак с семи до десяти.', italian: 'La colazione è dalle sette alle dieci.', transliteration: 'zàvtrak s simì da disitì', audioText: 'Завтрак с семи до десяти.' },
  'shp-01': { russian: 'Пятьсот рублей.', italian: 'Cinquecento rubli.', transliteration: 'pitsòt rubljèj', audioText: 'Пятьсот рублей.' },
}

function replyFor(phrase: Phrase): ReplyDefinition {
  return REPLIES[phrase.id]
}

function pickReplyDistractors(rng: Rng, phrase: Phrase, count: number): Phrase[] {
  const answer = replyFor(phrase)
  const pool = PHRASES.filter(
    (p) => p.russian !== answer.russian && p.russian !== phrase.russian && !p.russian.includes('?'),
  )
  return rng.sample(pool, count)
}

/** Phrase ids that can produce a `phrase-reply` exercise. */
export const REPLYABLE_PHRASE_IDS = Object.keys(REPLIES)
