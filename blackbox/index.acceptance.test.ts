import { given, then, when } from 'test-fns';
import { z } from 'zod';

// import from compiled dist to verify the published package contract
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { genBrainAtom, genBrainRepl } = require('../dist');

/**
 * .what = acceptance tests for the readme behavioral contract
 * .why = verify the compiled dist satisfies the documented api
 *
 * these tests mirror the exact usage patterns from the readme
 */
describe('rhachet-brains-openai.acceptance', () => {
  given('[case1] genBrainAtom usage from readme', () => {
    when('[t0] create a brain atom for direct model inference', () => {
      then('brainAtom is created with correct slug', () => {
        const brainAtom = genBrainAtom({ slug: 'openai/gpt-4o-mini' });
        expect(brainAtom.slug).toEqual('openai/gpt-4o-mini');
      });

      then('brainAtom has ask method', () => {
        const brainAtom = genBrainAtom({ slug: 'openai/gpt-4o-mini' });
        expect(typeof brainAtom.ask).toEqual('function');
      });
    });

    when('[t1] ask with string schema output', () => {
      then('returns a string directly', async () => {
        const brainAtom = genBrainAtom({ slug: 'openai/gpt-4o-mini' });
        const explanation = await brainAtom.ask({
          role: { briefs: [] },
          prompt: 'respond with exactly: hello world',
          schema: { output: z.string() },
        });

        expect(typeof explanation).toEqual('string');
        expect(explanation.toLowerCase()).toContain('hello');
      });
    });

    when('[t2] ask with structured object schema output', () => {
      then('returns structured object that fits schema', async () => {
        const brainAtom = genBrainAtom({ slug: 'openai/gpt-4o-mini' });
        const result = await brainAtom.ask({
          role: { briefs: [] },
          prompt: 'analyze this code: console.log("test")',
          schema: {
            output: z.object({
              summary: z.string(),
              issues: z.array(z.string()),
            }),
          },
        });

        expect(result).toHaveProperty('summary');
        expect(result).toHaveProperty('issues');
        expect(typeof result.summary).toEqual('string');
        expect(Array.isArray(result.issues)).toEqual(true);
      });
    });
  });

  given('[case2] genBrainRepl usage from readme', () => {
    when('[t0] create a brain repl for agentic tasks', () => {
      then('brainRepl is created', () => {
        const brainRepl = genBrainRepl({ slug: 'openai/codex' });
        expect(brainRepl).toBeDefined();
        expect(brainRepl.slug).toEqual('codex');
      });

      then('brainRepl has ask method', () => {
        const brainRepl = genBrainRepl({ slug: 'openai/codex' });
        expect(typeof brainRepl.ask).toEqual('function');
      });

      then('brainRepl has act method', () => {
        const brainRepl = genBrainRepl({ slug: 'openai/codex' });
        expect(typeof brainRepl.act).toEqual('function');
      });
    });

    when('[t1] ask() for read-only operations', () => {
      then('returns structured response', async () => {
        const brainRepl = genBrainRepl({ slug: 'openai/codex' });
        const result = await brainRepl.ask({
          role: { briefs: [] },
          prompt: 'what is 2 + 2? respond with just the number',
          schema: { output: z.object({ analysis: z.string() }) },
        });

        expect(result).toHaveProperty('analysis');
        expect(typeof result.analysis).toEqual('string');
      });
    });

    when('[t2] act() for read+write operations', () => {
      then('returns structured response', async () => {
        const brainRepl = genBrainRepl({ slug: 'openai/codex' });
        const result = await brainRepl.act({
          role: { briefs: [] },
          prompt: 'describe what you would do to refactor: const x = 1',
          schema: { output: z.object({ proposal: z.string() }) },
        });

        expect(result).toHaveProperty('proposal');
        expect(typeof result.proposal).toEqual('string');
      });
    });
  });

  given('[case3] available brain slugs from readme', () => {
    when('[t0] atom slugs', () => {
      then('openai/gpt-4o works', () => {
        const atom = genBrainAtom({ slug: 'openai/gpt-4o' });
        expect(atom.slug).toEqual('openai/gpt-4o');
      });

      then('openai/gpt-4o-mini works', () => {
        const atom = genBrainAtom({ slug: 'openai/gpt-4o-mini' });
        expect(atom.slug).toEqual('openai/gpt-4o-mini');
      });

      then('openai/o1 works', () => {
        const atom = genBrainAtom({ slug: 'openai/o1' });
        expect(atom.slug).toEqual('openai/o1');
      });

      then('openai/o1-mini works', () => {
        const atom = genBrainAtom({ slug: 'openai/o1-mini' });
        expect(atom.slug).toEqual('openai/o1-mini');
      });
    });

    when('[t1] repl slugs', () => {
      then('openai/codex works', () => {
        const repl = genBrainRepl({ slug: 'openai/codex' });
        expect(repl.slug).toEqual('codex');
      });

      then('openai/codex/max works', () => {
        const repl = genBrainRepl({ slug: 'openai/codex/max' });
        expect(repl.slug).toEqual('codex/max');
      });

      then('openai/codex/mini works', () => {
        const repl = genBrainRepl({ slug: 'openai/codex/mini' });
        expect(repl.slug).toEqual('codex/mini');
      });
    });
  });
});
