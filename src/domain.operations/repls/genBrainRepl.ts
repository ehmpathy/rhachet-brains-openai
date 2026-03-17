import { Codex } from '@openai/codex-sdk';
import { BadRequestError } from 'helpful-errors';
import {
  type BrainEpisode,
  BrainOutput,
  BrainOutputMetrics,
  type BrainPlugs,
  BrainRepl,
  type BrainSeries,
  type BrainSpec,
  calcBrainOutputCost,
  castBriefsToPrompt,
  genBrainContinuables,
} from 'rhachet/brains';
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
 * .what = prefix for episode exids from this repo
 * .why = identifies episodes created by openai codex-sdk for validation on continuation
 */
const EXID_PREFIX = 'openai/codex';

/**
 * .what = encodes thread id with prefix for tracking
 * .why = enables validation that continuation attempts use compatible episodes
 */
const encodeExid = (threadId: string): string => `${EXID_PREFIX}/${threadId}`;

/**
 * .what = decodes thread id from prefixed exid
 * .why = extracts raw thread id for codex-sdk resumeThread call
 */
const decodeExid = (
  exid: string,
): { valid: true; threadId: string } | { valid: false } => {
  if (!exid.startsWith(`${EXID_PREFIX}/`)) return { valid: false };
  const threadId = exid.slice(`${EXID_PREFIX}/`.length);
  if (!threadId) return { valid: false };
  return { valid: true, threadId };
};

/**
 * .what = invokes codex sdk with specified sandbox mode
 * .why = dedupes shared logic between ask (read-only) and act (workspace-write)
 */
const invokeCodex = async <TOutput, TPlugs extends BrainPlugs>(input: {
  mode: 'ask' | 'act';
  model: string | undefined;
  spec: BrainSpec;
  on?: { episode?: BrainEpisode; series?: BrainSeries };
  plugs?: TPlugs;
  role: { briefs?: Artifact<typeof GitFile>[] };
  prompt: string;
  schema: { output: z.Schema<TOutput> };
}): Promise<BrainOutput<TOutput, 'repl', TPlugs>> => {
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

  // determine sandbox mode based on operation type
  const sandboxMode: 'read-only' | 'workspace-write' =
    input.mode === 'ask' ? 'read-only' : 'workspace-write';
  const threadOptions = { model: input.model, sandboxMode };

  // resume thread if prior episode provided, otherwise start fresh
  const priorExid = input.on?.episode?.exid ?? null;
  const thread = (() => {
    if (!priorExid) return codex.startThread(threadOptions);

    // validate and decode the exid
    const decoded = decodeExid(priorExid);
    if (!decoded.valid)
      throw new BadRequestError(
        'episode continuation failed: exid is not from openai/codex. cross-supplier continuation is not supported.',
        { priorExid },
      );

    return codex.resumeThread(decoded.threadId, threadOptions);
  })();

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

  // encode thread id with prefix for cross-supplier validation
  const threadExid = thread.id ? encodeExid(thread.id) : null;

  // generate continuation artifacts (episode and series for repl)
  const continuables = await genBrainContinuables({
    for: { grain: 'repl' },
    on: {
      episode: input.on?.episode ?? null,
      series: input.on?.series ?? null,
    },
    with: {
      exchange: {
        input: input.prompt,
        output: content,
        exid: thread.id,
      },
      episode: { exid: threadExid },
    },
  });

  // note: repls execute tools internally, so calls is always null
  return new BrainOutput({
    output,
    calls: null,
    metrics,
    episode: continuables.episode,
    series: continuables.series,
  }) as BrainOutput<TOutput, 'repl', TPlugs>;
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

    // note: repls only accept string prompts (tool execution handled internally by codex SDK)
    // type assertions needed because BrainRepl contract now supports AsBrainPromptFor<TPlugs>
    // but codex SDK's thread.run() only accepts string prompts
    ask: (async <TOutput, TPlugs extends BrainPlugs>(
      askInput: {
        on?: { episode?: BrainEpisode; series?: BrainSeries };
        plugs?: TPlugs;
        role: { briefs?: Artifact<typeof GitFile>[] };
        prompt: string;
        schema: { output: z.Schema<TOutput> };
      },
      _context?: Empty,
    ): Promise<BrainOutput<TOutput, 'repl', TPlugs>> =>
      invokeCodex({
        mode: 'ask',
        model: config.model,
        spec: config.spec,
        on: askInput.on,
        plugs: askInput.plugs,
        role: askInput.role,
        prompt: askInput.prompt,
        schema: askInput.schema,
      })) as BrainRepl['ask'],

    act: (async <TOutput, TPlugs extends BrainPlugs>(
      actInput: {
        on?: { episode?: BrainEpisode; series?: BrainSeries };
        plugs?: TPlugs;
        role: { briefs?: Artifact<typeof GitFile>[] };
        prompt: string;
        schema: { output: z.Schema<TOutput> };
      },
      _context?: Empty,
    ): Promise<BrainOutput<TOutput, 'repl', TPlugs>> =>
      invokeCodex({
        mode: 'act',
        model: config.model,
        spec: config.spec,
        on: actInput.on,
        plugs: actInput.plugs,
        role: actInput.role,
        prompt: actInput.prompt,
        schema: actInput.schema,
      })) as BrainRepl['act'],
  });
};
