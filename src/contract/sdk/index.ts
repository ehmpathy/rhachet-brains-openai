import type { BrainAtom } from 'rhachet';
import type { BrainRepl } from 'rhachet';

import { genBrainAtom } from '../../domain.operations/atoms/genBrainAtom';
import { genBrainRepl } from '../../domain.operations/repls/genBrainRepl';

/**
 * .what = returns all brain atoms provided by openai
 * .why = enables consumers to register openai atoms with genContextBrain
 */
export const getBrainAtomsByOpenAI = (): BrainAtom[] => {
  return [genBrainAtom({ slug: 'openai/gpt-4o' })];
};

/**
 * .what = returns all brain repls provided by openai
 * .why = enables consumers to register openai repls with genContextBrain
 */
export const getBrainReplsByOpenAI = (): BrainRepl[] => {
  return [genBrainRepl({ slug: 'openai/codex' })];
};

// re-export factories for direct access
export { genBrainAtom } from '../../domain.operations/atoms/genBrainAtom';
export { genBrainRepl } from '../../domain.operations/repls/genBrainRepl';
