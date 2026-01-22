# brain.atom vs brain.repl

## .what

two distinct interfaces for llm interaction:

| interface | purpose | api |
|-----------|---------|-----|
| brain.atom | raw model access, single inference call | OpenAI Responses API |
| brain.repl | agentic loop with tool use and sandbox | Codex SDK |

## .why

- **atom** = the atomic unit of llm interaction
  - one api call, one response
  - stateless, no memory of prior calls
  - supports all models (gpt-4o, o1, codex, etc.)

- **repl** = read, execute, print, loop
  - leverages atoms within a loop to enable multistep thought and action
  - orchestrates multiple atom calls with tool execution between steps
  - provides sandboxed execution (read-only or workspace-write)

## .key relationship

repls are built on top of atoms:

```
repl.ask(prompt)
  └── loop until done:
        ├── atom.ask(prompt) → thought
        ├── execute tools based on thought
        └── feed results back into next atom call
```

the repl is not a different model — it's an orchestration layer that invokes the same base atom repeatedly, with tool results injected between calls.

## .architecture

```
brain.atom (Responses API)
├── gpt-4o, gpt-4o-mini, gpt-4-turbo
├── o1, o1-mini, o1-preview
└── gpt-5.1-codex-max, gpt-5.1-codex-mini, gpt-5.2-codex

brain.repl (Codex SDK)
├── wraps atom with agentic loop
├── sandbox modes: read-only, workspace-write
└── reuses atom specs (no duplicate declarations)
```

## .key insight

the codex models (gpt-5.1-codex-*, gpt-5.2-codex) are available via both:
1. **Responses API** - direct inference (atom)
2. **Codex SDK** - agentic wrapper (repl)

the repl is not a different model - it's a different interaction pattern built on top of the same models.

## .refs

- responses api: https://platform.openai.com/docs/api-reference/responses
- codex sdk: https://github.com/openai/codex-sdk
- migration guide: https://platform.openai.com/docs/guides/migrate-to-responses
