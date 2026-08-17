import type { Scenario, ScenarioStep } from '@/types/content'
import type { Exercise } from '@/types/exercise'
import { PHRASES } from '@/data/phrases'
import { itemKey } from '@/types/progress'
import { normalizeRussian, toBlocks } from '@/utils/text'
import type { Rng } from '@/utils/random'

/**
 * Scenario steps are rendered by the same `ExerciseRunner` as everything else,
 * so they get identical feedback, audio and accessibility behaviour for free.
 *
 * Where a step's target line already exists in the phrasebook we reuse that
 * phrase's id, so practising it inside a scenario feeds the same spaced
 * repetition record. Otherwise the step gets its own synthetic id.
 */

const phraseByText = new Map(PHRASES.map((p) => [normalizeRussian(p.russian), p.id]))

export function resolveItemId(scenario: Scenario, step: ScenarioStep): string {
  const target = step.targetRussian ?? step.npcRussian
  if (target) {
    const known = phraseByText.get(normalizeRussian(target))
    if (known) return known
  }
  return `scn-${scenario.id}-${step.id}`
}

/** Steps that need no answer are rendered separately, not as exercises. */
export function isInteractive(step: ScenarioStep): boolean {
  return step.kind !== 'info'
}

export function scenarioStepToExercise(
  scenario: Scenario,
  step: ScenarioStep,
  rng: Rng,
  allowSpeech: boolean,
): Exercise | null {
  const id = resolveItemId(scenario, step)
  const base = {
    uid: `${scenario.id}-${step.id}`,
    itemKey: itemKey('phrase', id),
    itemKind: 'phrase' as const,
    itemId: id,
  }

  switch (step.kind) {
    case 'comprehension': {
      if (!step.options || step.correctOption === undefined || !step.npcRussian) return null
      const options = step.options.map((label, index) => ({
        id: `opt-${index}`,
        label,
        correct: index === step.correctOption,
        cyrillic: false,
      }))
      return {
        ...base,
        type: 'phrase-listen',
        answerMode: 'choice',
        prompt: step.prompt,
        promptMain: step.npcRussian,
        promptIsCyrillic: true,
        audioText: step.npcRussian,
        audioIsPrompt: true,
        options: rng.shuffle(options),
        reveal: {
          russian: step.npcRussian,
          italian: step.npcItalian ?? '',
          transliteration: step.npcTransliteration ?? '',
          note: step.hint,
          audioText: step.npcRussian,
        },
      }
    }

    case 'choice': {
      if (!step.options || step.correctOption === undefined) return null
      const options = step.options.map((label, index) => ({
        id: `opt-${index}`,
        label,
        correct: index === step.correctOption,
        cyrillic: true,
      }))
      return {
        ...base,
        type: 'phrase-reply',
        answerMode: 'choice',
        prompt: step.prompt,
        promptMain: step.npcRussian ? `— ${step.npcRussian}` : undefined,
        promptIsCyrillic: Boolean(step.npcRussian),
        options: rng.shuffle(options),
        reveal: {
          russian: step.targetRussian ?? '',
          italian: step.targetItalian ?? '',
          transliteration: step.targetTransliteration ?? '',
          note: step.hint,
          audioText: step.targetRussian ?? '',
        },
      }
    }

    case 'build': {
      if (!step.targetRussian) return null
      const solution = toBlocks(step.targetRussian)
      return {
        ...base,
        type: 'phrase-build',
        answerMode: 'build',
        prompt: step.prompt,
        promptSub: step.hint,
        solutionBlocks: solution,
        blocks: rng.shuffle([...solution, ...(step.distractors ?? [])]),
        reveal: {
          russian: step.targetRussian,
          italian: step.targetItalian ?? '',
          transliteration: step.targetTransliteration ?? '',
          audioText: step.targetRussian,
        },
      }
    }

    case 'pronounce': {
      if (!step.targetRussian) return null
      return {
        ...base,
        type: 'phrase-pronounce',
        answerMode: allowSpeech ? 'speech' : 'speech',
        prompt: step.prompt,
        promptMain: step.targetRussian,
        promptIsCyrillic: true,
        promptSub: step.targetItalian,
        accepted: [step.targetRussian],
        reveal: {
          russian: step.targetRussian,
          italian: step.targetItalian ?? '',
          transliteration: step.targetTransliteration ?? '',
          audioText: step.targetRussian,
        },
      }
    }

    default:
      return null
  }
}
