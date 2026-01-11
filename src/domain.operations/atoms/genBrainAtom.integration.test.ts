import { BadRequestError } from 'helpful-errors';
import path from 'path';
import { genArtifactGitFile } from 'rhachet-artifact-git';
import { given, then, when } from 'test-fns';
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
  const brainAtom = genBrainAtom({ slug: 'openai/gpt-4o-mini' });

  given('[case1] genBrainAtom({ slug: "openai/gpt-4o-mini" })', () => {
    when('[t0] inspecting the atom', () => {
      then('repo is "openai"', () => {
        expect(brainAtom.repo).toEqual('openai');
      });

      then('slug is "openai/gpt-4o-mini"', () => {
        expect(brainAtom.slug).toEqual('openai/gpt-4o-mini');
      });

      then('description is defined', () => {
        expect(brainAtom.description).toBeDefined();
        expect(brainAtom.description.length).toBeGreaterThan(0);
      });
    });
  });

  given('[case2] ask is called with object schema', () => {
    when('[t0] with simple prompt', () => {
      then('it returns a substantive response', async () => {
        const result = await brainAtom.ask({
          role: {},
          prompt: 'respond with exactly: hello world',
          schema: { output: outputSchema },
        });
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content.toLowerCase()).toContain('hello');
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
        expect(result.content).toBeDefined();
        expect(result.content).toContain('ZEBRA42');
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
        expect(typeof result).toEqual('string');
        expect(result.length).toBeGreaterThan(0);
        expect(result.toLowerCase()).toContain('hello');
      });
    });
  });
});
