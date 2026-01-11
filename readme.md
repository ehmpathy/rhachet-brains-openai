# rhachet-brains-openai

rhachet brain.atom and brain.repl adapter for openai

## install

```sh
npm install rhachet-brains-openai
```

## usage

```ts
import { genBrainAtom, genBrainRepl } from 'rhachet-brains-openai';
import { z } from 'zod';

// create a brain atom for direct model inference
const brainAtom = genBrainAtom({ slug: 'openai/gpt-4o-mini' });

// simple string output
const response = await brainAtom.ask({
  role: { briefs: [] },
  prompt: 'explain this code',
  schema: { output: z.string() },
});

// structured object output
const result = await brainAtom.ask({
  role: { briefs: [] },
  prompt: 'analyze this code',
  schema: { output: z.object({ summary: z.string(), issues: z.array(z.string()) }) },
});

// create a brain repl for agentic tasks
const brainRepl = genBrainRepl({ slug: 'openai/codex' });

// use ask() for read-only operations
const result = await brainRepl.ask({
  role: { briefs: [] },
  prompt: 'analyze this codebase',
  schema: { output: z.object({ content: z.string() }) },
});

// use act() for read+write operations
const result = await brainRepl.act({
  role: { briefs: [] },
  prompt: 'refactor this module',
  schema: { output: z.object({ content: z.string() }) },
});
```

## available brains

### atoms (via genBrainAtom)

stateless inference without tool use.

| slug                 | model       | description                                   |
| -------------------- | ----------- | --------------------------------------------- |
| `openai/gpt-4o`      | gpt-4o      | multimodal model for reasoning and vision     |
| `openai/gpt-4o-mini` | gpt-4o-mini | fast and cost-effective multimodal model      |
| `openai/gpt-4-turbo` | gpt-4-turbo | high capability with vision support           |
| `openai/o1`          | o1          | advanced reasoning model for complex problems |
| `openai/o1-mini`     | o1-mini     | fast reasoning model for coding and math      |
| `openai/o1-preview`  | o1-preview  | preview of advanced reasoning capabilities    |

### repls (via genBrainRepl)

agentic coding assistant with tool use via codex-sdk.

| slug                | model              | description                               |
| ------------------- | ------------------ | ----------------------------------------- |
| `openai/codex`      | default            | uses SDK default (gpt-5.1-codex-max)      |
| `openai/codex/max`  | gpt-5.1-codex-max  | optimized for long-horizon agentic coding |
| `openai/codex/mini` | gpt-5.1-codex-mini | fast and cost-effective                   |
| `openai/codex/5.2`  | gpt-5.2-codex      | most advanced agentic coding model        |

## sources

- [Codex Models Documentation](https://developers.openai.com/codex/models/)
- [Codex SDK Documentation](https://developers.openai.com/codex/sdk/)
