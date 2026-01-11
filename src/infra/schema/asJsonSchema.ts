import { z } from 'zod';

/**
 * .what = convert a zod schema to JSON schema for native SDK enforcement
 * .why = enables native structured output support in SDKs, reducing
 *   token waste on validation retries
 *
 * .note = different SDKs require different conversion options:
 *   - claude-agent-sdk: { $refStrategy: 'root' }
 *   - codex-sdk: { target: 'openAi' }
 */
export const asJsonSchema = (input: {
  schema: z.ZodSchema;
}): object => {
  return z.toJSONSchema(input.schema, { target: 'openAi' });
};
