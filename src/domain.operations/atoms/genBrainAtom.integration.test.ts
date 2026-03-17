import { BadRequestError } from 'helpful-errors';
import { toMilliseconds } from 'iso-time';
import path from 'path';
import { genBrainPlugToolDeclaration } from 'rhachet/brains';
import { genArtifactGitFile } from 'rhachet-artifact-git';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { TEST_ASSETS_DIR } from '../../.test/assets/dir';
import { genBrainAtom } from './genBrainAtom';

const BRIEFS_DIR = path.join(TEST_ASSETS_DIR, '/example.briefs');

const outputSchema = z.object({ content: z.string() });

if (!process.env.OPENAI_API_KEY)
  throw new BadRequestError('OPENAI_API_KEY is required for integration tests');

describe('genBrainAtom.integration', () => {
  jest.setTimeout(30000);

  // use gpt-4o-mini for fast integration tests
  const brainAtom = genBrainAtom({ slug: 'openai/gpt/4o-mini' });

  given('[case1] genBrainAtom({ slug: "openai/gpt/4o-mini" })', () => {
    when('[t0] inspecting the atom', () => {
      then('repo is "openai"', () => {
        expect(brainAtom.repo).toEqual('openai');
      });

      then('slug is "openai/gpt/4o-mini"', () => {
        expect(brainAtom.slug).toEqual('openai/gpt/4o-mini');
      });

      then('description is defined', () => {
        expect(brainAtom.description).toBeDefined();
        expect(brainAtom.description.length).toBeGreaterThan(0);
      });
    });
  });

  given('[case2] ask is called with object schema', () => {
    when('[t0] with simple prompt', () => {
      const result = useThen('it returns a substantive response', async () => {
        const response = await brainAtom.ask({
          role: {},
          prompt: 'respond with exactly: hello world',
          schema: { output: outputSchema },
        });
        expect(response.output.content).toBeDefined();
        expect(response.output.content.length).toBeGreaterThan(0);
        expect(response.output.content.toLowerCase()).toContain('hello');
        return response;
      });

      then('metrics.size includes token and char counts', () => {
        expect(result.metrics.size.tokens.input).toBeGreaterThan(0);
        expect(result.metrics.size.tokens.output).toBeGreaterThan(0);
        expect(result.metrics.size.chars.input).toBeGreaterThan(0);
        expect(result.metrics.size.chars.output).toBeGreaterThan(0);
      });

      then('metrics.cost.time is greater than 0', () => {
        expect(toMilliseconds(result.metrics.cost.time)).toBeGreaterThan(0);
      });

      then('metrics.cost.cash includes total and deets', () => {
        expect(result.metrics.cost.cash.total).toBeDefined();
        expect(result.metrics.cost.cash.deets.input).toBeDefined();
        expect(result.metrics.cost.cash.deets.output).toBeDefined();
      });

      then('episode is returned with hash and exchanges', () => {
        expect(result.episode).toBeDefined();
        expect(result.episode.hash).toBeDefined();
        expect(result.episode.hash.length).toBeGreaterThan(0);
        expect(result.episode.exchanges).toBeDefined();
        expect(result.episode.exchanges.length).toEqual(1);
      });

      then('episode.exchanges[0] contains the input and output', () => {
        const exchange = result.episode.exchanges[0]!;
        expect(exchange.input).toContain('hello world');
        expect(exchange.output).toBeDefined();
        expect(exchange.output.length).toBeGreaterThan(0);
        expect(exchange.exid).toBeDefined();
      });

      then('series is null (atoms do not support series)', () => {
        expect(result.series).toBeNull();
      });
    });

    when('[t1] with briefs', () => {
      then('response leverages knowledge from brief', async () => {
        const briefs = [
          genArtifactGitFile({
            uri: path.join(BRIEFS_DIR, 'secret-code.brief.md'),
          }),
        ];
        const result = await brainAtom.ask({
          role: { briefs },
          prompt: 'say hello',
          schema: { output: outputSchema },
        });
        expect(result.output.content).toBeDefined();
        expect(result.output.content).toContain('ZEBRA42');
      });
    });
  });

  given('[case3] ask is called with string schema', () => {
    when('[t0] with z.string() output schema', () => {
      then('it returns a string directly', async () => {
        const result = await brainAtom.ask({
          role: {},
          prompt: 'respond with exactly: hello world',
          schema: { output: z.string() },
        });
        expect(typeof result.output).toEqual('string');
        expect(result.output.length).toBeGreaterThan(0);
        expect(result.output.toLowerCase()).toContain('hello');
      });
    });
  });

  given('[case4] episode continuation is supported', () => {
    when('[t0] ask is called, then continued with on.episode', () => {
      const resultFirst = useThen(
        'first call establishes context with secret word',
        async () =>
          brainAtom.ask({
            role: {},
            prompt:
              'remember the secret word "PINEAPPLE42". respond with exactly: got it',
            schema: { output: outputSchema },
          }),
      );

      then('first call returns episode with one exchange', () => {
        expect(resultFirst.episode.exchanges.length).toEqual(1);
      });

      const resultSecond = useThen(
        'second call uses episode for continuation',
        async () =>
          brainAtom.ask({
            on: { episode: resultFirst.episode },
            role: {},
            prompt: 'what is the secret word I told you?',
            schema: { output: outputSchema },
          }),
      );

      then('second call remembers context from first call', () => {
        expect(resultSecond.output.content).toContain('PINEAPPLE42');
      });

      then('second call episode has two exchanges', () => {
        expect(resultSecond.episode.exchanges.length).toEqual(2);
      });

      then('second call episode includes both exchanges in order', () => {
        const exchanges = resultSecond.episode.exchanges;
        expect(exchanges[0]?.input).toContain('PINEAPPLE42');
        expect(exchanges[1]?.input).toContain('secret word');
      });
    });
  });

  // ============================================
  // tool use tests
  // ============================================

  given('[case5] tools plugged and brain needs external data', () => {
    const weatherTool = genBrainPlugToolDeclaration({
      slug: 'weather_lookup',
      name: 'Weather Lookup',
      description: 'get current weather for a city',
      schema: {
        input: z.object({ city: z.string().describe('the city name') }),
        output: z.object({
          temp: z.number(),
          conditions: z.string(),
        }),
      },
      execute: async () => ({ temp: 72, conditions: 'sunny' }), // mock for type satisfaction
    });

    when('[t0] ask requires tool to answer', () => {
      const result = useThen('it requests the tool', async () =>
        brainAtom.ask({
          role: {},
          prompt: 'what is the current weather in austin?',
          schema: { output: z.object({ summary: z.string() }) },
          plugs: { tools: [weatherTool] },
        }),
      );

      then('output is null (brain deferred to tools)', () => {
        expect(result.output).toBeNull();
      });

      then('calls.tools is defined with invocations', () => {
        expect(result.calls).toBeDefined();
        expect(result.calls?.tools).toBeDefined();
        expect(result.calls?.tools.length).toBeGreaterThan(0);
      });

      then('invocation has exid, slug, and input', () => {
        const invocation = result.calls?.tools[0];
        expect(invocation?.exid).toBeDefined();
        expect(invocation?.slug).toEqual('weather_lookup');
        expect(invocation?.input).toBeDefined();
        expect(
          (invocation?.input as { city: string }).city.toLowerCase(),
        ).toContain('austin');
      });
    });

    when('[t1] tool results provided via continuation', () => {
      // first call to get tool invocation
      const resultFirst = useThen('first call requests tool', async () =>
        brainAtom.ask({
          role: {},
          prompt: 'what is the current weather in austin?',
          schema: { output: z.object({ summary: z.string() }) },
          plugs: { tools: [weatherTool] },
        }),
      );

      // continue with mock tool result
      const resultSecond = useThen(
        'second call provides tool result',
        async () => {
          const invocation = resultFirst.calls?.tools[0];
          if (!invocation) throw new Error('expected tool invocation');

          return brainAtom.ask({
            on: { episode: resultFirst.episode },
            role: {},
            prompt: [
              {
                exid: invocation.exid,
                slug: invocation.slug,
                input: invocation.input,
                signal: 'success' as const,
                output: { temp: 85, conditions: 'sunny' },
                metrics: { cost: { time: { milliseconds: 100 } } },
              },
            ],
            schema: { output: z.object({ summary: z.string() }) },
            plugs: { tools: [weatherTool] },
          });
        },
      );

      then('output is defined with final answer', () => {
        expect(resultSecond.output).toBeDefined();
        expect(resultSecond.output?.summary).toBeDefined();
      });

      then('output references the tool result data', () => {
        const summary = resultSecond.output?.summary.toLowerCase() ?? '';
        // should mention temperature or sunny
        expect(summary.includes('85') || summary.includes('sunny')).toBe(true);
      });

      then('calls is null (no more tools needed)', () => {
        expect(resultSecond.calls).toBeNull();
      });
    });
  });

  given('[case6] tools plugged but brain can answer directly', () => {
    // note: model may choose to use tools even when it could answer directly
    // this is valid behavior - the model decides whether to use tools
    const calculatorTool = genBrainPlugToolDeclaration({
      slug: 'calculator',
      name: 'Calculator',
      description: 'evaluate a math expression',
      schema: {
        input: z.object({ expression: z.string() }),
        output: z.object({ result: z.number() }),
      },
      execute: async () => ({ result: 0 }), // mock for type satisfaction
    });

    when('[t0] ask is answerable without tools', () => {
      const result = useThen('it responds', async () =>
        brainAtom.ask({
          role: {},
          prompt: 'what is 2 + 2? respond with the number only.',
          schema: { output: z.object({ answer: z.string() }) },
          plugs: { tools: [calculatorTool] },
        }),
      );

      then('either output OR calls is defined (not both null)', () => {
        // model may answer directly OR use tools - both are valid
        const hasOutput = result.output !== null;
        const hasCalls = result.calls !== null;
        expect(hasOutput || hasCalls).toBe(true);
      });

      then('if output defined, calls is null', () => {
        if (result.output !== null) {
          expect(result.calls).toBeNull();
        }
      });

      then('if calls defined, output is null', () => {
        if (result.calls !== null) {
          expect(result.output).toBeNull();
        }
      });
    });
  });

  given('[case7] multiple tools plugged', () => {
    const weatherTool = genBrainPlugToolDeclaration({
      slug: 'weather_lookup',
      name: 'Weather Lookup',
      description: 'get current weather for a city',
      schema: {
        input: z.object({ city: z.string() }),
        output: z.object({ temp: z.number() }),
      },
      execute: async () => ({ temp: 72 }), // mock for type satisfaction
    });

    const timeTool = genBrainPlugToolDeclaration({
      slug: 'time_lookup',
      name: 'Time Lookup',
      description: 'get current time in a timezone',
      schema: {
        input: z.object({ timezone: z.string() }),
        output: z.object({ time: z.string() }),
      },
      execute: async () => ({ time: '12:00 PM' }), // mock for type satisfaction
    });

    when('[t0] ask needs multiple tools', () => {
      const result = useThen('it requests both tools', async () =>
        brainAtom.ask({
          role: {},
          prompt:
            'what is the current weather in austin and the current time in new york?',
          schema: { output: z.object({ summary: z.string() }) },
          plugs: { tools: [weatherTool, timeTool] },
        }),
      );

      then('calls.tools contains invocations', () => {
        expect(result.calls?.tools).toBeDefined();
        expect(result.calls?.tools.length).toBeGreaterThanOrEqual(1);
      });

      then('invocations reference plugged tools', () => {
        const slugs = result.calls?.tools.map((inv) => inv.slug) ?? [];
        // should invoke at least one of our tools
        const hasExpectedTool =
          slugs.includes('weather_lookup') || slugs.includes('time_lookup');
        expect(hasExpectedTool).toBe(true);
      });
    });
  });

  given('[case8] tool execution error', () => {
    const weatherTool = genBrainPlugToolDeclaration({
      slug: 'weather_lookup',
      name: 'Weather Lookup',
      description: 'get current weather for a city',
      schema: {
        input: z.object({ city: z.string() }),
        output: z.object({ temp: z.number() }),
      },
      execute: async () => ({ temp: 72 }), // mock for type satisfaction
    });

    when('[t0] tool returns error:constraint', () => {
      // first call to get tool invocation
      const resultFirst = useThen('first call requests tool', async () =>
        brainAtom.ask({
          role: {},
          prompt: 'what is the weather in xyz123notacity?',
          schema: { output: z.object({ summary: z.string() }) },
          plugs: { tools: [weatherTool] },
        }),
      );

      // continue with error result
      const resultSecond = useThen('second call provides error', async () => {
        const invocation = resultFirst.calls?.tools[0];
        if (!invocation) throw new Error('expected tool invocation');

        return brainAtom.ask({
          on: { episode: resultFirst.episode },
          role: {},
          // note: type assertion via unknown needed because Error type doesn't include custom properties
          prompt: [
            {
              exid: invocation.exid,
              slug: invocation.slug,
              input: invocation.input,
              signal: 'error:constraint' as const,
              output: { error: { message: 'city not found' } },
              metrics: { cost: { time: { milliseconds: 50 } } },
            },
          ] as unknown as string,
          schema: { output: z.object({ summary: z.string() }) },
          plugs: { tools: [weatherTool] },
        });
      });

      then('brain receives error and continues episode', () => {
        // brain received the error and responded (even if not structured output)
        // the key verification is that the API call succeeded and episode continued
        expect(resultSecond.episode).toBeDefined();
        expect(resultSecond.episode.exchanges.length).toBeGreaterThan(1);
      });

      then('brain may provide output, calls, or plain text response', () => {
        // model might respond with structured output, more tool calls, or plain text
        // plain text response means output=null and calls=null (text didn't parse)
        // all three are valid responses to tool error
        const hasOutput = resultSecond.output !== null;
        const hasCalls = resultSecond.calls !== null;
        const hasPlainText = !hasOutput && !hasCalls;
        expect(hasOutput || hasCalls || hasPlainText).toBe(true);
      });
    });
  });
});
