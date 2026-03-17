import type OpenAI from 'openai';
import { given, then, when } from 'test-fns';

import { castFromOpenaiFunctionCall } from './castFromOpenaiFunctionCall';

describe('castFromOpenaiFunctionCall', () => {
  given('[case1] an openai function_call response item', () => {
    const item: OpenAI.Responses.ResponseFunctionToolCall = {
      type: 'function_call',
      call_id: 'call_xyz789',
      name: 'weather.lookup',
      arguments: '{"city":"austin"}',
    };

    when('[t0] cast to rhachet invocation', () => {
      const result = castFromOpenaiFunctionCall({ item });

      then('call_id maps to exid', () => {
        expect(result.exid).toEqual('call_xyz789');
      });

      then('name maps to slug', () => {
        expect(result.slug).toEqual('weather.lookup');
      });

      then('arguments JSON parsed to input', () => {
        expect(result.input).toEqual({ city: 'austin' });
      });
    });
  });

  given('[case2] a function_call with complex arguments', () => {
    const item: OpenAI.Responses.ResponseFunctionToolCall = {
      type: 'function_call',
      call_id: 'call_complex123',
      name: 'customer.search',
      arguments:
        '{"filters":{"status":"active","tags":["vip","premium"]},"limit":10}',
    };

    when('[t0] cast to rhachet invocation', () => {
      const result = castFromOpenaiFunctionCall({ item });

      then('nested JSON parsed correctly', () => {
        expect(result.input).toEqual({
          filters: { status: 'active', tags: ['vip', 'premium'] },
          limit: 10,
        });
      });
    });
  });
});
