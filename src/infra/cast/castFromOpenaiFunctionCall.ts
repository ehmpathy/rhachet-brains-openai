import type OpenAI from 'openai';
import type { BrainPlugToolInvocation } from 'rhachet/brains';

/**
 * .what = cast openai function_call to rhachet tool invocation
 * .why = explicit boundary between openai sdk and rhachet domain
 */
export const castFromOpenaiFunctionCall = (input: {
  item: OpenAI.Responses.ResponseFunctionToolCall;
}): BrainPlugToolInvocation<unknown> => ({
  exid: input.item.call_id,
  slug: input.item.name,
  input: JSON.parse(input.item.arguments),
});
