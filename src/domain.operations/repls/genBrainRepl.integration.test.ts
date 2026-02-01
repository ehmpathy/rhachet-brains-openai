import { BadRequestError } from 'helpful-errors';
import { toMilliseconds } from 'iso-time';
import path from 'path';
import { genArtifactGitFile } from 'rhachet-artifact-git';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { TEST_ASSETS_DIR } from '../../.test/assets/dir';
import { genBrainRepl } from './genBrainRepl';

const BRIEFS_DIR = path.join(TEST_ASSETS_DIR, '/example.briefs');

const outputSchema = z.object({ content: z.string() });

if (!process.env.OPENAI_API_KEY)
  throw new BadRequestError('OPENAI_API_KEY is required for integration tests');

describe('genBrainRepl.integration', () => {
  jest.setTimeout(60000);

  const brainRepl = genBrainRepl({ slug: 'openai/codex' });

  given('[case1] genBrainRepl({ slug: "openai/codex" })', () => {
    when('[t0] inspecting the repl', () => {
      then('repo is "openai"', () => {
        expect(brainRepl.repo).toEqual('openai');
      });

      then('slug is "openai/codex"', () => {
        expect(brainRepl.slug).toEqual('openai/codex');
      });

      then('description is defined', () => {
        expect(brainRepl.description).toBeDefined();
        expect(brainRepl.description.length).toBeGreaterThan(0);
      });
    });
  });

  given('[case2] ask is called (readonly mode)', () => {
    when('[t0] with simple prompt', () => {
      const result = useThen('it returns a substantive response', async () => {
        const response = await brainRepl.ask({
          role: {},
          prompt: 'respond with exactly: hello from codex',
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
        expect(exchange.input).toContain('hello from codex');
        expect(exchange.output).toBeDefined();
        expect(exchange.output.length).toBeGreaterThan(0);
      });

      then('series is returned with hash and episodes', () => {
        expect(result.series).toBeDefined();
        expect(result.series!.hash).toBeDefined();
        expect(result.series!.hash.length).toBeGreaterThan(0);
        expect(result.series!.episodes).toBeDefined();
        expect(result.series!.episodes.length).toEqual(1);
      });

      then('series.episodes[0] matches the episode', () => {
        expect(result.series!.episodes[0]!.hash).toEqual(result.episode.hash);
      });
    });

    when('[t1] with briefs', () => {
      then('response leverages knowledge from brief', async () => {
        const briefs = [
          genArtifactGitFile({
            uri: path.join(BRIEFS_DIR, 'secret-code.brief.md'),
          }),
        ];
        const result = await brainRepl.ask({
          role: { briefs },
          prompt: 'say hello',
          schema: { output: outputSchema },
        });
        expect(result.output.content).toBeDefined();
        expect(result.output.content).toContain('ZEBRA42');
      });
    });
  });

  given('[case3] act is called (read+write mode)', () => {
    when('[t0] with simple prompt', () => {
      then('it returns a substantive response', async () => {
        const result = await brainRepl.act({
          role: {},
          prompt: 'respond with exactly: hello from codex action',
          schema: { output: outputSchema },
        });
        expect(result.output.content).toBeDefined();
        expect(result.output.content.length).toBeGreaterThan(0);
        expect(result.output.content.toLowerCase()).toContain('hello');
      });
    });
  });

  given('[case4] episode continuation is supported', () => {
    when('[t0] ask is called, then continued with on.episode', () => {
      const resultFirst = useThen(
        'first call establishes context with secret word',
        async () =>
          brainRepl.ask({
            role: {},
            prompt:
              'remember the secret word "MANGO99". respond with exactly: { "content": "got it" }',
            schema: { output: outputSchema },
          }),
      );

      then('first call returns episode with one exchange', () => {
        expect(resultFirst.episode.exchanges.length).toEqual(1);
      });

      then('first call episode.exid contains prefixed thread id', () => {
        expect(resultFirst.episode.exid).toBeDefined();
        expect(resultFirst.episode.exid?.startsWith('openai/codex/')).toBe(
          true,
        );
      });

      const resultSecond = useThen(
        'second call uses episode for continuation',
        async () =>
          brainRepl.ask({
            on: { episode: resultFirst.episode },
            role: {},
            prompt:
              'what is the secret word I told you? respond with exactly: { "content": "MANGO99" }',
            schema: { output: outputSchema },
          }),
      );

      then('second call remembers context from first call', () => {
        expect(resultSecond.output.content).toContain('MANGO99');
      });

      then('second call episode has two exchanges', () => {
        expect(resultSecond.episode.exchanges.length).toEqual(2);
      });

      then('second call episode includes both exchanges in order', () => {
        const exchanges = resultSecond.episode.exchanges;
        expect(exchanges[0]?.input).toContain('MANGO99');
        expect(exchanges[1]?.input).toContain('secret word');
      });
    });
  });
});
