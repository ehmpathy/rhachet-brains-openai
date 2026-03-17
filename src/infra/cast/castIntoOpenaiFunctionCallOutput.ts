import type OpenAI from 'openai';
import type { BrainPlugToolExecution } from 'rhachet/brains';

/**
 * .what = generate unique id with fc_ prefix for function_call_output
 * .why = openai requires function_call_output.id to start with 'fc_'
 */
const genFunctionCallOutputId = (): string =>
  `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

/**
 * .what = cast rhachet tool execution to openai function_call_output format
 * .why = explicit boundary between rhachet domain and openai sdk
 *
 * .note = id is a new generated id for this output item (must start with fc_)
 * .note = call_id references the original function_call this responds to
 */
export const castIntoOpenaiFunctionCallOutput = (input: {
  execution: BrainPlugToolExecution<unknown, unknown>;
}): OpenAI.Responses.ResponseFunctionToolCallOutputItem => ({
  type: 'function_call_output',
  id: genFunctionCallOutputId(),
  call_id: input.execution.exid,
  output: JSON.stringify(input.execution.output),
});
