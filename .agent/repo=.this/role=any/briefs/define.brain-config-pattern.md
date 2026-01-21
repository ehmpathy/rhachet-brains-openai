# brain config pattern

## .what

standardized pattern for brain atom and repl configuration:

| file | export | purpose |
|------|--------|---------|
| `BrainAtom.config.ts` | `CONFIG_BY_ATOM_SLUG` | maps atom slugs to model configs |
| `BrainRepl.config.ts` | `CONFIG_BY_REPL_SLUG` | maps repl slugs to atom configs |

## .why

- **single source of truth** — specs declared once in atom config, reused by repls
- **explicit relationships** — repl config declares exactly which atom it uses
- **type safety** — slug types enforce valid mappings at compile time

## .structure

### atom config (`BrainAtom.config.ts`)

```ts
export type OpenaiBrainAtomSlug =
  | 'openai/gpt/4o'
  | 'openai/gpt/4o-mini'
  | 'openai/gpt/codex/5.1-max'
  | 'openai/gpt/codex/5.1-mini';

export type BrainAtomConfig = {
  model: string;
  description: string;
  spec: BrainSpec;
};

export const CONFIG_BY_ATOM_SLUG: Record<OpenaiBrainAtomSlug, BrainAtomConfig> = {
  'openai/gpt/4o': {
    model: 'gpt-4o',
    description: 'gpt-4o - multimodal model for reason and vision',
    spec: { ... },
  },
  // ...
};
```

### repl config (`BrainRepl.config.ts` or inline)

```ts
import {
  type BrainAtomConfig,
  CONFIG_BY_ATOM_SLUG,
} from './BrainAtom.config';

export type OpenaiBrainReplSlug =
  | 'openai/codex'
  | 'openai/codex/max'
  | 'openai/codex/mini';

/**
 * .what = repl config by slug
 * .why = maps repl slugs to atom configs (reuses specs from CONFIG_BY_ATOM_SLUG)
 */
export const CONFIG_BY_REPL_SLUG: Record<OpenaiBrainReplSlug, BrainAtomConfig> = {
  'openai/codex': CONFIG_BY_ATOM_SLUG['openai/gpt/codex/5.1-max'],
  'openai/codex/max': CONFIG_BY_ATOM_SLUG['openai/gpt/codex/5.1-max'],
  'openai/codex/mini': CONFIG_BY_ATOM_SLUG['openai/gpt/codex/5.1-mini'],
};
```

## .slug conventions

### atom slugs (explicit)

format: `{repo}/{family}/{model}/{version?}`

examples:
- `openai/gpt/4o`
- `openai/gpt/4o-mini`
- `openai/gpt/codex/5.1-max`
- `openai/o/1`
- `claude/sonnet/v4.5`

### repl slugs (aliases)

format: `{repo}/{capability}/{variant?}`

examples:
- `openai/codex` → default codex model
- `openai/codex/max` → max capability variant
- `openai/codex/mini` → fast + cheap variant
- `claude/code` → default claude code
- `claude/code/opus` → opus variant

## .key insight

repl slugs are **aliases** that map to **explicit atom slugs**:

```ts
// repl slug → atom slug → config
'openai/codex' → 'openai/gpt/codex/5.1-max' → { model, description, spec }
```

this enables:
- simpler repl slugs for common use cases
- explicit atom slugs for precise model selection
- shared specs between atoms and repls (no duplication)

## .name conventions

| constant | scope | content |
|----------|-------|---------|
| `CONFIG_BY_ATOM_SLUG` | atom file | atom slug → config |
| `CONFIG_BY_REPL_SLUG` | repl file | repl slug → atom config |
| `OpenaiBrainAtomSlug` | type | union of valid atom slugs |
| `OpenaiBrainReplSlug` | type | union of valid repl slugs |
| `BrainAtomConfig` | type | shape of config object |
