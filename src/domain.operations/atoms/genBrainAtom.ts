import OpenAI from 'openai';
import {
  BrainAtom,
  type BrainAtomPlugs,
  type BrainEpisode,
  BrainOutput,
  BrainOutputMetrics,
  calcBrainOutputCost,
  castBriefsToPrompt,
  genBrainContinuables,
} from 'rhachet/brains';
import type { Artifact } from 'rhachet-artifact';
import type { GitFile } from 'rhachet-artifact-git';
import type { Empty } from 'type-fns';
import { z } from 'zod';

import {
  CONFIG_BY_ATOM_SLUG,
  type OpenaiBrainAtomSlug,
} from '../../domain.objects/BrainAtom.config';

/**
 * .what = factory to generate openai brain atom instances
 * .why = enables model variant selection via slug
 *
 * .example
 *   genBrainAtom({ slug: 'openai/gpt/4o' })
 *   genBrainAtom({ slug: 'openai/gpt/4o-mini' }) // fast + cheap
 *   genBrainAtom({ slug: 'openai/o/1' }) // advanced reason
 */
export const genBrainAtom = (input: {
  slug: OpenaiBrainAtomSlug;
}): BrainAtom => {
  const config = CONFIG_BY_ATOM_SLUG[input.slug];

  return new BrainAtom({
    repo: 'openai',
    slug: input.slug,
    description: config.description,
    spec: config.spec,

    /**
     * .what = stateless inference (no tool use)
     * .why = provides direct model access for reason tasks
     */
    ask: async <TOutput>(
      askInput: {
        on?: { episode: BrainEpisode };
        plugs?: BrainAtomPlugs;
        role: { briefs?: Artifact<typeof GitFile>[] };
        prompt: string;
        schema: { output: z.Schema<TOutput> };
      },
      context?: Empty,
    ): Promise<BrainOutput<TOutput>> => {
      // capture start time for metrics
      const startTime = Date.now();

      // compose system prompt from briefs
      const systemPrompt = askInput.role.briefs
        ? await castBriefsToPrompt({ briefs: askInput.role.briefs })
        : undefined;

      // get openai client from context or create new one
      const openai =
        (context?.openai as OpenAI | undefined) ??
        new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // convert zod schema to json schema for structured output
      const jsonSchema = z.toJSONSchema(askInput.schema.output);

      // check if schema is an object type (openai only supports object schemas for response_format)
      const isObjectSchema =
        typeof jsonSchema === 'object' &&
        jsonSchema !== null &&
        'type' in jsonSchema &&
        jsonSchema.type === 'object';

      // compose full prompt with system context
      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\n---\n\n${askInput.prompt}`
        : askInput.prompt;

      // build input from prior episode exchanges + current prompt
      const priorMessages: OpenAI.Responses.ResponseInputItem[] =
        askInput.on?.episode?.exchanges.flatMap((exchange) => [
          { role: 'user' as const, content: exchange.input },
          { role: 'assistant' as const, content: exchange.output },
        ]) ?? [];
      const inputMessages: OpenAI.Responses.ResponseInputItem[] = [
        ...priorMessages,
        { role: 'user' as const, content: fullPrompt },
      ];

      // call responses api
      const response = await openai.responses.create({
        model: config.model,
        input: inputMessages,
        ...(isObjectSchema && {
          text: {
            format: {
              type: 'json_schema',
              name: 'response',
              strict: true,
              schema: jsonSchema,
            },
          },
        }),
      });

      // extract content from responses api output
      const outputItem = response.output.find(
        (item) => item.type === 'message',
      );
      const textContent =
        outputItem?.type === 'message'
          ? outputItem.content.find((c) => c.type === 'output_text')
          : undefined;
      const content =
        textContent?.type === 'output_text' ? textContent.text : '';

      // extract token usage from responses api
      const tokensInput = response.usage?.input_tokens ?? 0;
      const tokensOutput = response.usage?.output_tokens ?? 0;
      const tokensCacheGet =
        response.usage?.input_tokens_details?.cached_tokens ?? 0;

      // capture elapsed time
      const elapsedMs = Date.now() - startTime;

      // compute character counts
      const charsInput = fullPrompt.length;
      const charsOutput = content.length;

      // build size metrics
      const size = {
        tokens: {
          input: tokensInput,
          output: tokensOutput,
          cache: { get: tokensCacheGet, set: 0 },
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
        with: { cost: { cash: config.spec.cost.cash } },
      });

      // build metrics
      const metrics = new BrainOutputMetrics({
        size,
        cost: {
          time: { milliseconds: elapsedMs },
          cash,
        },
      });

      // parse response based on schema type
      const output = isObjectSchema
        ? askInput.schema.output.parse(JSON.parse(content))
        : askInput.schema.output.parse(content);

      // generate continuation artifacts (episode for atom, series is null)
      const continuables = await genBrainContinuables({
        for: { grain: 'atom' },
        on: {
          episode: askInput.on?.episode ?? null,
          series: null,
        },
        with: {
          exchange: {
            input: askInput.prompt,
            output: content,
            exid: response.id,
          },
        },
      });

      return new BrainOutput({
        output,
        metrics,
        episode: continuables.episode,
        series: continuables.series,
      });
    },
  });
};
