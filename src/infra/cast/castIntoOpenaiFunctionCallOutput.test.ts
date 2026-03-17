import type { BrainPlugToolExecution } from 'rhachet/brains';
import { given, then, when } from 'test-fns';

import { castIntoOpenaiFunctionCallOutput } from './castIntoOpenaiFunctionCallOutput';

describe('castIntoOpenaiFunctionCallOutput', () => {
  given('[case1] a successful tool execution', () => {
    const execution: BrainPlugToolExecution<
      { city: string },
      { temp: number }
    > = {
      exid: 'call_abc123',
      slug: 'weather.lookup',
      input: { city: 'austin' },
      signal: 'success',
      output: { temp: 85 },
      metrics: { cost: { time: { milliseconds: 500 } } },
    };

    when('[t0] cast to openai format', () => {
      const result = castIntoOpenaiFunctionCallOutput({ execution });

      then('type is function_call_output', () => {
        expect(result.type).toEqual('function_call_output');
      });

      then('id starts with fc_ prefix', () => {
        expect(result.id).toMatch(/^fc_/);
      });

      then('exid maps to call_id', () => {
        expect(result.call_id).toEqual('call_abc123');
      });

      then('output is JSON stringified', () => {
        expect(result.output).toEqual('{"temp":85}');
      });
    });
  });

  given('[case2] a failed tool execution with error:constraint', () => {
    // use object with error info (BadRequestError serializes to this shape)
    // note: type assertion via unknown needed because Error type doesn't include custom properties
    const execution = {
      exid: 'call_def456',
      slug: 'weather.lookup',
      input: { city: 'invalid' },
      signal: 'error:constraint',
      output: { error: { message: 'city not found', city: 'invalid' } },
      metrics: { cost: { time: { milliseconds: 100 } } },
    } as unknown as BrainPlugToolExecution<{ city: string }, { temp: number }>;

    when('[t0] cast to openai format', () => {
      const result = castIntoOpenaiFunctionCallOutput({ execution });

      then('type is function_call_output', () => {
        expect(result.type).toEqual('function_call_output');
      });

      then('output contains error as JSON', () => {
        expect(result.output).toContain('error');
        expect(result.output).toContain('city not found');
      });
    });
  });

  given('[case3] a failed tool execution with error:malfunction', () => {
    // use object with error info (UnexpectedCodePathError serializes to this shape)
    // note: type assertion via unknown needed because Error type doesn't include custom properties
    const execution = {
      exid: 'call_ghi789',
      slug: 'weather.lookup',
      input: { city: 'austin' },
      signal: 'error:malfunction',
      output: { error: { message: 'api timeout', timeout: 5000 } },
      metrics: { cost: { time: { milliseconds: 5000 } } },
    } as unknown as BrainPlugToolExecution<{ city: string }, { temp: number }>;

    when('[t0] cast to openai format', () => {
      const result = castIntoOpenaiFunctionCallOutput({ execution });

      then('type is function_call_output', () => {
        expect(result.type).toEqual('function_call_output');
      });

      then('output contains error as JSON', () => {
        expect(result.output).toContain('error');
        expect(result.output).toContain('api timeout');
      });
    });
  });
});
