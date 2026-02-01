# rhachet-brains-openai

rhachet brain.atom and brain.repl adapter for openai

## install

```sh
npm install rhachet-brains-openai
```

note: this package bundles `@openai/codex-sdk` js for seamless cjs (e.g., jest) compatibility. vendor binaries come from the peer dep.

## usage

```ts
import { genBrainAtom, genBrainRepl } from 'rhachet-brains-openai';
import { z } from 'zod';

// create a brain atom for direct model inference
const brainAtom = genBrainAtom({ slug: 'openai/gpt/4o-mini' });

// simple string output
const { output: explanation } = await brainAtom.ask({
  role: { briefs: [] },
  prompt: 'explain this code',
  schema: { output: z.string() },
});

// structured object output
const { output: { summary, issues } } = await brainAtom.ask({
  role: { briefs: [] },
  prompt: 'analyze this code',
  schema: { output: z.object({ summary: z.string(), issues: z.array(z.string()) }) },
});

// create a brain repl for agentic tasks
const brainRepl = genBrainRepl({ slug: 'openai/codex' });

// use ask() for read-only operations
const { output: { analysis } } = await brainRepl.ask({
  role: { briefs: [] },
  prompt: 'analyze this codebase',
  schema: { output: z.object({ analysis: z.string() }) },
});

// use act() for read+write operations
const { output: { proposal } } = await brainRepl.act({
  role: { briefs: [] },
  prompt: 'refactor this module',
  schema: { output: z.object({ proposal: z.string() }) },
});
```

## continuation support

both atoms and repls support multi-turn conversations via episode continuation.

### atoms

atoms support continuation via the openai responses api. pass the prior episode to continue the conversation:

```ts
// first call establishes context
const resultFirst = await brainAtom.ask({
  role: {},
  prompt: 'remember the secret word "PINEAPPLE42"',
  schema: { output: z.object({ content: z.string() }) },
});

// second call continues with prior context
const resultSecond = await brainAtom.ask({
  on: { episode: resultFirst.episode },
  role: {},
  prompt: 'what is the secret word I told you?',
  schema: { output: z.object({ content: z.string() }) },
});
// resultSecond.output.content contains "PINEAPPLE42"
```

### repls

repls support continuation via the codex-sdk `resumeThread()` api. the episode exid contains the thread id prefixed with `openai/codex/` for cross-supplier validation:

```ts
// first call starts a new thread
const resultFirst = await brainRepl.ask({
  role: {},
  prompt: 'remember the secret word "MANGO99"',
  schema: { output: z.object({ content: z.string() }) },
});
// resultFirst.episode.exid = "openai/codex/{threadId}"

// second call resumes the thread
const resultSecond = await brainRepl.ask({
  on: { episode: resultFirst.episode },
  role: {},
  prompt: 'what is the secret word I told you?',
  schema: { output: z.object({ content: z.string() }) },
});
// resultSecond.output.content contains "MANGO99"
```

### limitations

- **cross-supplier continuation is not supported**: episodes from other brain suppliers (e.g., anthropic) cannot be used to continue openai conversations. this throws a `BadRequestError`.
- **exid validation**: the episode exid must start with `openai/codex/` for repl continuation. this prevents accidental cross-supplier continuation attempts.

## available brains

### atoms (via genBrainAtom)

stateless inference without tool use.

| slug                           | model               | context | cost (input) | cost (output) | cutoff  |
| ------------------------------ | ------------------- | ------- | ------------ | ------------- | ------- |
| `openai/gpt/5.2-instant`       | gpt-5.2-instant     | 400K    | $1.75/1M     | $14/1M        | 2025-08 |
| `openai/gpt/5.2-pro`           | gpt-5.2-pro         | 400K    | $21/1M       | $168/1M       | 2025-08 |
| `openai/gpt/5.2-thoughtful`    | gpt-5.2             | 400K    | $1.75/1M     | $14/1M        | 2025-08 |
| `openai/gpt/codex/5.2`         | gpt-5.2-codex       | 400K    | $10/1M       | $40/1M        | 2025-08 |
| `openai/gpt/5`                 | gpt-5               | 400K    | $1.25/1M     | $10/1M        | 2024-09 |
| `openai/gpt/5-pro`             | gpt-5-pro           | 272K    | $15/1M       | $120/1M       | 2024-09 |
| `openai/gpt/5-thoughtful`      | gpt-5-thinking      | 400K    | $1.25/1M     | $10/1M        | 2024-09 |
| `openai/gpt/5-thoughtful-mini` | gpt-5-thinking-mini | 400K    | $0.25/1M     | $2/1M         | 2024-09 |
| `openai/gpt/5.1-instant`       | gpt-5.1-chat-latest | 400K    | $1.25/1M     | $10/1M        | 2024-09 |
| `openai/gpt/5.1-thoughtful`    | gpt-5.1             | 400K    | $1.25/1M     | $10/1M        | 2024-09 |
| `openai/gpt/codex/5.1-max`     | gpt-5.1-codex-max   | 400K    | $7.50/1M     | $30/1M        | 2024-09 |
| `openai/gpt/codex/5.1-mini`    | gpt-5.1-codex-mini  | 400K    | $3/1M        | $12/1M        | 2024-09 |
| `openai/gpt/4.1`               | gpt-4.1             | 1M      | $2/1M        | $8/1M         | 2024-06 |
| `openai/gpt/4.1-mini`          | gpt-4.1-mini        | 128K    | $0.40/1M     | $1.60/1M      | 2024-06 |
| `openai/gpt/4.1-nano`          | gpt-4.1-nano        | 1M      | $0.10/1M     | $0.40/1M      | 2024-06 |
| `openai/o/3`                   | o3                  | 200K    | $0.40/1M     | $1.60/1M      | 2024-06 |
| `openai/o/3-mini`              | o3-mini             | 200K    | $1.10/1M     | $4.40/1M      | 2024-06 |
| `openai/o/3-pro`               | o3-pro              | 200K    | $20/1M       | $80/1M        | 2024-06 |
| `openai/o/4-mini`              | o4-mini             | 200K    | $1.10/1M     | $4.40/1M      | 2024-06 |
| `openai/gpt/5-mini`            | gpt-5-mini          | 400K    | $0.25/1M     | $2/1M         | 2024-05 |
| `openai/gpt/4-turbo`           | gpt-4-turbo         | 128K    | $10/1M       | $30/1M        | 2023-12 |
| `openai/gpt/4o`                | gpt-4o              | 128K    | $2.50/1M     | $10/1M        | 2023-10 |
| `openai/gpt/4o-mini`           | gpt-4o-mini         | 128K    | $0.15/1M     | $0.60/1M      | 2023-10 |
| `openai/o/1`                   | o1                  | 200K    | $15/1M       | $60/1M        | 2023-10 |
| `openai/o/1-mini`              | o1-mini             | 128K    | $3/1M        | $12/1M        | 2023-10 |
| `openai/o/1-preview`           | o1-preview          | 128K    | $15/1M       | $60/1M        | 2023-10 |

### repls (via genBrainRepl)

agentic code assistant with tool use via codex-sdk.

| slug                     | model              | context | cost (input) | cost (output) | cutoff  |
| ------------------------ | ------------------ | ------- | ------------ | ------------- | ------- |
| `openai/codex`           | gpt-5.1-codex-max  | 400K    | $7.50/1M     | $30/1M        | 2024-09 |
| `openai/codex/mini`      | gpt-5.1-codex-mini | 400K    | $3/1M        | $12/1M        | 2024-09 |
| `openai/codex/max`       | gpt-5.1-codex-max  | 400K    | $7.50/1M     | $30/1M        | 2024-09 |
| `openai/codex/5.1`       | gpt-5.1-codex-max  | 400K    | $7.50/1M     | $30/1M        | 2024-09 |
| `openai/codex/5.2`       | gpt-5.2-codex      | 400K    | $10/1M       | $40/1M        | 2025-08 |
| `openai/codex/mini/5.1`  | gpt-5.1-codex-mini | 400K    | $3/1M        | $12/1M        | 2024-09 |
| `openai/codex/max/5.1`   | gpt-5.1-codex-max  | 400K    | $7.50/1M     | $30/1M        | 2024-09 |

## sources

- [openai api costs](https://openai.com/api/pricing/)
- [codex models documentation](https://developers.openai.com/codex/models/)
- [codex sdk documentation](https://developers.openai.com/codex/sdk/)
