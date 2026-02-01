import { BadRequestError } from 'helpful-errors';
import { toMilliseconds } from 'iso-time';
import path from 'path';
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
});
