import type { BrainPlugToolDefinition } from 'rhachet/brains';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { castIntoOpenaiFunctionTool } from './castIntoOpenaiFunctionTool';

describe('castIntoOpenaiFunctionTool', () => {
  given('[case1] a tool definition', () => {
    const definition: BrainPlugToolDefinition<
      { city: string },
      { temp: number; conditions: string },
      'atom',
      'weather.lookup'
    > = {
      slug: 'weather.lookup',
      name: 'Weather Lookup',
      description: 'get current weather for a city',
      schema: {
        input: z.object({
          city: z.string().describe('the city name'),
        }),
        output: z.object({
          temp: z.number(),
          conditions: z.string(),
        }),
      },
    };

    when('[t0] cast to openai function tool', () => {
      const result = castIntoOpenaiFunctionTool({ definition });

      then('type is function', () => {
        expect(result.type).toEqual('function');
      });

      then('slug maps to name (dots become underscores)', () => {
        expect(result.name).toEqual('weather_lookup');
      });

      then('description maps to description', () => {
        expect(result.description).toEqual('get current weather for a city');
      });

      then('strict is true', () => {
        expect(result.strict).toEqual(true);
      });

      then('zod schema maps to JSON schema', () => {
        expect(result.parameters).toMatchObject({
          type: 'object',
          properties: {
            city: { type: 'string' },
          },
          required: ['city'],
        });
      });
    });
  });
});
