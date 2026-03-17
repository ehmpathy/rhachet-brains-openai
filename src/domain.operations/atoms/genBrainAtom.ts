import OpenAI from 'openai';
import {
  BrainAtom,
  type BrainEpisode,
  BrainOutput,
  BrainOutputMetrics,
  type BrainPlugs,
  type BrainPlugToolExecution,
  calcBrainOutputCost,
  castBriefsToPrompt,
  genBrainContinuables,
} from 'rhachet/brains';
import type { Artifact } from 'rhachet-artifact';
import type { GitFile } from 'rhachet-artifact-git';
import type { Empty } from 'type-fns';
import type { z } from 'zod';

import {
  CONFIG_BY_ATOM_SLUG,
  type OpenaiBrainAtomSlug,
} from '../../domain.objects/BrainAtom.config';
import { castFromOpenaiFunctionCall } from '../../infra/cast/castFromOpenaiFunctionCall';
import { castIntoOpenaiFunctionCallOutput } from '../../infra/cast/castIntoOpenaiFunctionCallOutput';
import { castIntoOpenaiFunctionTool } from '../../infra/cast/castIntoOpenaiFunctionTool';
import { asJsonSchema } from '../../infra/schema/asJsonSchema';

/**
 * .what = reconstruct assistant message from serialized exchange output
 * .why = function_call items were serialized as JSON array, need to spread back
 *
 * .note = detects if output is JSON array with function_call/message items
 * .note = returns original items if function_calls present, plain text otherwise
 */
const reconstructAssistantItems = (
  exchangeOutput: string,
): OpenAI.Responses.ResponseInputItem[] => {
  // try to parse as JSON array of response items
  try {
    const parsed = JSON.parse(exchangeOutput);
    if (Array.isArray(parsed)) {
      // check if it looks like response output items (has function_call or message)
      const hasResponseItems = parsed.some(
        (item) =>
          item?.type === 'function_call' ||
          item?.type === 'message' ||
          item?.type === 'reasoning',
      );
      if (hasResponseItems) {
        // spread the items as-is (function_call items preserved)
        return parsed as OpenAI.Responses.ResponseInputItem[];
      }
    }
  } catch (error) {
    // allowlist: SyntaxError means not valid JSON, treat as plain text
    if (!(error instanceof SyntaxError)) throw error;
  }
  // fallback: treat as plain assistant text
  return [{ role: 'assistant' as const, content: exchangeOutput }];
};

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
     * .what = stateless inference with optional tool use
     * .why = provides direct model access for reason tasks, supports tool invocations
     */
    ask: async <TOutput, TPlugs extends BrainPlugs>(
      askInput: {
        on?: { episode: BrainEpisode };
        plugs?: TPlugs;
        role: { briefs?: Artifact<typeof GitFile>[] };
        prompt: string | BrainPlugToolExecution<unknown, unknown>[];
        schema: { output: z.Schema<TOutput> };
      },
      context?: Empty,
    ): Promise<BrainOutput<TOutput, 'atom', TPlugs>> => {
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
      const jsonSchema = asJsonSchema({ schema: askInput.schema.output });

      // check if schema is an object type (openai only supports object schemas for response_format)
      const isObjectSchema =
        typeof jsonSchema === 'object' &&
        jsonSchema !== null &&
        'type' in jsonSchema &&
        jsonSchema.type === 'object';

      // detect if prompt is tool execution results vs string
      const isToolExecutionArray = Array.isArray(askInput.prompt);

      // check if tools are plugged
      const pluggedTools = askInput.plugs?.tools ?? [];
      const hasTools = pluggedTools.length > 0;

      // compose full prompt with system context (only for string prompts)
      const fullPrompt = isToolExecutionArray
        ? null
        : systemPrompt
          ? `${systemPrompt}\n\n---\n\n${askInput.prompt}`
          : (askInput.prompt as string);

      // convert tool definitions to openai format
      const openaiFunctionTools = hasTools
        ? pluggedTools.map((definition) =>
            castIntoOpenaiFunctionTool({ definition }),
          )
        : [];

      // build input from prior episode exchanges + current prompt
      // note: function_call exchanges are serialized as JSON array, need to reconstruct
      const priorMessages: OpenAI.Responses.ResponseInputItem[] =
        askInput.on?.episode?.exchanges.flatMap((exchange) => [
          { role: 'user' as const, content: exchange.input },
          ...reconstructAssistantItems(exchange.output),
        ]) ?? [];

      // build current input (tool results or string prompt)
      const currentInput: OpenAI.Responses.ResponseInputItem[] =
        isToolExecutionArray
          ? (askInput.prompt as BrainPlugToolExecution<unknown, unknown>[]).map(
              (execution) => castIntoOpenaiFunctionCallOutput({ execution }),
            )
          : [{ role: 'user' as const, content: fullPrompt as string }];

      // build system instruction for JSON output (response_format not available with tools)
      const systemInstruction: OpenAI.Responses.ResponseInputItem[] =
        hasTools && isObjectSchema
          ? [
              {
                role: 'system' as const,
                content: `When you have the final answer, respond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`,
              },
            ]
          : [];

      const inputMessages: OpenAI.Responses.ResponseInputItem[] = [
        ...systemInstruction,
        ...priorMessages,
        ...currentInput,
      ];

      // call responses api
      // note: response_format and tools are mutually exclusive
      const response = await openai.responses.create({
        model: config.model,
        input: inputMessages,
        ...(hasTools && {
          tools: openaiFunctionTools,
        }),
        ...(!hasTools &&
          isObjectSchema && {
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

      // extract tool calls from response (independent of output)
      const functionCallItems = response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
          item.type === 'function_call',
      );
      const calls =
        functionCallItems.length > 0
          ? {
              tools: functionCallItems.map((item) =>
                castFromOpenaiFunctionCall({ item }),
              ),
            }
          : null;

      // extract message content from response (independent of calls)
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
      const charsInput = isToolExecutionArray
        ? JSON.stringify(askInput.prompt).length
        : (fullPrompt as string).length;
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

      // parse response based on schema type, with graceful fallback for tool use
      const output = (() => {
        // if no content, return null (brain deferred to tools)
        if (!content) return null;

        // when tools are plugged, we skip response_format
        // model may return JSON or plain text - try JSON first, fallback to text
        if (hasTools && isObjectSchema) {
          try {
            // try to parse as JSON first
            return askInput.schema.output.parse(JSON.parse(content));
          } catch (error) {
            // allowlist: SyntaxError (invalid JSON) or ZodError (schema mismatch)
            const isParseError =
              error instanceof SyntaxError ||
              error?.constructor?.name === 'ZodError';
            if (!isParseError) throw error;

            // model returned plain text - try to extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                return askInput.schema.output.parse(JSON.parse(jsonMatch[0]));
              } catch (extractError) {
                // allowlist: SyntaxError or ZodError for extracted JSON
                const isExtractParseError =
                  extractError instanceof SyntaxError ||
                  extractError?.constructor?.name === 'ZodError';
                if (!isExtractParseError) throw extractError;
              }
            }
            // if tool calls present, this is expected (partial response)
            if (calls) return null;
            // no structured output available with tools
            return null;
          }
        }

        // standard parsing (with response_format or string schema)
        try {
          return isObjectSchema
            ? askInput.schema.output.parse(JSON.parse(content))
            : askInput.schema.output.parse(content);
        } catch (error) {
          // allowlist: SyntaxError or ZodError - if tool calls present, expected
          const isParseError =
            error instanceof SyntaxError ||
            error?.constructor?.name === 'ZodError';
          if (!isParseError) throw error;
          if (calls) return null;
          throw new Error('structured output parse failed with no tool calls');
        }
      })();

      // serialize exchange input (tool results as JSON, string as-is)
      const exchangeInput = isToolExecutionArray
        ? JSON.stringify(askInput.prompt)
        : (askInput.prompt as string);

      // serialize exchange output (include function_call items if present)
      const exchangeOutput =
        functionCallItems.length > 0
          ? JSON.stringify(response.output)
          : content;

      // generate continuation artifacts (episode for atom, series is null)
      const continuables = await genBrainContinuables({
        for: { grain: 'atom' },
        on: {
          episode: askInput.on?.episode ?? null,
          series: null,
        },
        with: {
          exchange: {
            input: exchangeInput,
            output: exchangeOutput,
            exid: response.id,
          },
        },
      });

      // note: type assertions needed due to complex conditional types
      // runtime behavior is correct: output/calls follow plugs.tools presence
      return new BrainOutput({
        output: output as TOutput,
        calls: calls as unknown as null,
        metrics,
        episode: continuables.episode,
        series: continuables.series,
      }) as unknown as BrainOutput<TOutput, 'atom', TPlugs>;
    },
  });
};
