import type OpenAI from 'openai';
import type { BrainPlugToolDefinition } from 'rhachet/brains';

import { asJsonSchema } from '../schema/asJsonSchema';

/**
 * .what = transforms slug to valid openai function name
 * .why = openai requires names match pattern ^[a-zA-Z0-9_-]+$
 */
export const asOpenaiFunctionName = (slug: string): string =>
  slug.replace(/\./g, '_');

/**
 * .what = cast rhachet tool definition to openai function tool format
 * .why = explicit boundary between rhachet domain and openai sdk
 */
export const castIntoOpenaiFunctionTool = (input: {
  definition: BrainPlugToolDefinition<unknown, unknown, 'atom', string>;
}): OpenAI.Responses.FunctionTool => ({
  type: 'function',
  name: asOpenaiFunctionName(input.definition.slug),
  description: input.definition.description,
  parameters: asJsonSchema({ schema: input.definition.schema.input }) as {
    [key: string]: unknown;
  },
  strict: true,
});
