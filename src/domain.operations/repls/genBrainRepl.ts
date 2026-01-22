import { Codex } from '@openai/codex-sdk';
import type { BrainSpec } from 'rhachet';
import {
  BrainOutput,
  BrainOutputMetrics,
  BrainRepl,
  castBriefsToPrompt,
} from 'rhachet';
import type { BrainReplPlugs } from 'rhachet/dist/domain.objects/BrainReplPlugs';
import { calcBrainOutputCost } from 'rhachet/dist/domain.operations/brainCost/calcBrainOutputCost';
import type { Artifact } from 'rhachet-artifact';
import type { GitFile } from 'rhachet-artifact-git';
import type { Empty } from 'type-fns';
import { withRetry, withTimeout } from 'wrapper-fns';
import type { z } from 'zod';

import { asJsonSchema } from '@src/infra/schema/asJsonSchema';

import {
  type BrainAtomConfig,
  CONFIG_BY_ATOM_SLUG,
} from '../../domain.objects/BrainAtom.config';

/**
 * .what = supported openai brain repl slugs
 * .why = enables type-safe slug specification with model variants
 *
 * .structure
 *   openai/codex                → default (5.1-max)
 *   openai/codex/{5.1,5.2}      → version (defaults to max tier)
 *   openai/codex/{mini,max}     → capability tier (defaults to 5.1)
 *   openai/codex/{mini,max}/5.1 → explicit version + tier
 *
 * .note = 5.2 has only one variant (gpt-5.2-codex); mini/max/5.2 slugs will be added when available
 */
export type OpenaiBrainReplSlug =
  | 'openai/codex'
  | 'openai/codex/5.1'
  | 'openai/codex/5.2'
  | 'openai/codex/mini'
  | 'openai/codex/max'
  | 'openai/codex/mini/5.1'
  | 'openai/codex/max/5.1';

/**
 * .what = repl config by slug
 * .why = maps repl slugs to atom configs (reuses specs from CONFIG_BY_ATOM_SLUG)
 */
const CONFIG_BY_REPL_SLUG: Record<OpenaiBrainReplSlug, BrainAtomConfig> = {
  // default
  'openai/codex': CONFIG_BY_ATOM_SLUG['openai/gpt/codex/5.1-max'],

  // version only (defaults to max tier)
  'openai/codex/5.1': CONFIG_BY_ATOM_SLUG['openai/gpt/codex/5.1-max'],
  'openai/codex/5.2': CONFIG_BY_ATOM_SLUG['openai/gpt/codex/5.2'],

  // capability tier (defaults to 5.1)
  'openai/codex/mini': CONFIG_BY_ATOM_SLUG['openai/gpt/codex/5.1-mini'],
  'openai/codex/max': CONFIG_BY_ATOM_SLUG['openai/gpt/codex/5.1-max'],

  // explicit 5.1 versions
  'openai/codex/mini/5.1': CONFIG_BY_ATOM_SLUG['openai/gpt/codex/5.1-mini'],
  'openai/codex/max/5.1': CONFIG_BY_ATOM_SLUG['openai/gpt/codex/5.1-max'],
};

/**
 * .what = composes full prompt with optional system context
 * .why = codex-sdk ThreadOptions doesn't have systemPrompt, must prepend to user prompt
 */
const composePromptWithSystem = (
  userPrompt: string,
  systemPrompt: string | undefined,
): string => {
  if (!systemPrompt) return userPrompt;
  return `${systemPrompt}\n\n---\n\n${userPrompt}`;
};

/**
 * .what = invokes codex sdk with specified sandbox mode
 * .why = dedupes shared logic between ask (read-only) and act (workspace-write)
 */
const invokeCodex = async <TOutput>(input: {
  mode: 'ask' | 'act';
  model: string | undefined;
  spec: BrainSpec;
  role: { briefs?: Artifact<typeof GitFile>[] };
  prompt: string;
  schema: { output: z.Schema<TOutput> };
}): Promise<BrainOutput<TOutput>> => {
  // capture start time for metrics
  const startTime = Date.now();

  // compose system prompt from briefs
  const systemPrompt = input.role.briefs
    ? await castBriefsToPrompt({ briefs: input.role.briefs })
    : undefined;

  // convert zod schema to json schema for native enforcement
  const outputSchema = asJsonSchema({
    schema: input.schema.output,
  });

  // create codex client
  const codex = new Codex({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // start thread with sandbox mode based on operation type
  const sandboxMode = input.mode === 'ask' ? 'read-only' : 'workspace-write';
  const thread = codex.startThread({
    model: input.model,
    sandboxMode,
  });

  // compose full prompt and run with timeout + retry for resilience
  const fullPrompt = composePromptWithSystem(input.prompt, systemPrompt);
  const response = await withRetry(
    withTimeout(async () => thread.run(fullPrompt, { outputSchema }), {
      threshold: { seconds: 60 },
    }),
  )();

  // capture elapsed time
  const elapsedMs = Date.now() - startTime;

  // parse output via schema for runtime validation
  const content = response.finalResponse;
  const output = input.schema.output.parse(JSON.parse(content));

  // extract token usage from response (codex sdk uses snake_case)
  const usage = response.usage ?? {
    input_tokens: 0,
    output_tokens: 0,
    cached_input_tokens: 0,
  };
  const tokensInput = usage.input_tokens ?? 0;
  const tokensOutput = usage.output_tokens ?? 0;
  const tokensCacheGet = usage.cached_input_tokens ?? 0;
  const tokensCacheSet = 0;

  // compute character counts
  const charsInput = (systemPrompt?.length ?? 0) + input.prompt.length;
  const charsOutput = content.length;

  // build size metrics
  const size = {
    tokens: {
      input: tokensInput,
      output: tokensOutput,
      cache: { get: tokensCacheGet, set: tokensCacheSet },
    },
    chars: {
      input: charsInput,
      output: charsOutput,
      cache: { get: 0, set: 0 },
    },
  };

  // compute cash costs via rhachet helper
  const { cash } = calcBrainOutputCost({
    for: { tokens: size.tokens },
    with: { cost: { cash: input.spec.cost.cash } },
  });

  // build metrics
  const metrics = new BrainOutputMetrics({
    size,
    cost: {
      time: { milliseconds: elapsedMs },
      cash,
    },
  });

  return new BrainOutput({ output, metrics });
};

/**
 * .what = factory to generate openai codex brain repl instances
 * .why = enables model variant selection via slug
 *
 * .example
 *   genBrainRepl({ slug: 'openai/codex' })          // default (5.1-max)
 *   genBrainRepl({ slug: 'openai/codex/5.2' })      // version only (5.2)
 *   genBrainRepl({ slug: 'openai/codex/mini' })     // tier only (5.1-mini)
 *   genBrainRepl({ slug: 'openai/codex/max/5.2' })  // tier + version
 */
export const genBrainRepl = (input: {
  slug: OpenaiBrainReplSlug;
}): BrainRepl => {
  const config = CONFIG_BY_REPL_SLUG[input.slug];

  return new BrainRepl({
    repo: 'openai',
    slug: input.slug,
    description: config.description,
    spec: config.spec,

    /**
     * .what = readonly analysis (research, queries, code review)
     * .why = provides safe, non-mutate agent interactions via read-only sandbox
     */
    ask: async <TOutput>(
      askInput: {
        plugs?: BrainReplPlugs;
        role: { briefs?: Artifact<typeof GitFile>[] };
        prompt: string;
        schema: { output: z.Schema<TOutput> };
      },
      _context?: Empty,
    ): Promise<BrainOutput<TOutput>> =>
      invokeCodex({
        mode: 'ask',
        model: config.model,
        spec: config.spec,
        ...askInput,
      }),

    /**
     * .what = read+write actions (code changes, file edits)
     * .why = provides full agentic capabilities via workspace-write sandbox
     */
    act: async <TOutput>(
      actInput: {
        plugs?: BrainReplPlugs;
        role: { briefs?: Artifact<typeof GitFile>[] };
        prompt: string;
        schema: { output: z.Schema<TOutput> };
      },
      _context?: Empty,
    ): Promise<BrainOutput<TOutput>> =>
      invokeCodex({
        mode: 'act',
        model: config.model,
        spec: config.spec,
        ...actInput,
      }),
  });
};
