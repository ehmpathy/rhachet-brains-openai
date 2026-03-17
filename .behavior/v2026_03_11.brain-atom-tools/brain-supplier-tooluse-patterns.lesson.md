# lesson: brain supplier tool use patterns

patterns discovered in openai tool use implementation that apply to all brain suppliers.

---

## correction 1: extract cast operations at provider boundary

**issue**: inline transformations between rhachet contracts and provider SDK formats mix concerns and reduce testability.

**pattern**: extract cast operations as dedicated domain operations.

| direction | name convention | example |
|-----------|-----------------|---------|
| out (rhachet → provider) | `castInto{Provider}{Format}` | `castIntoOpenaiFunctionTool` |
| in (provider → rhachet) | `castFrom{Provider}{Format}` | `castFromOpenaiFunctionCall` |

**cast operations for tool use**:

| operation | transforms |
|-----------|------------|
| `castInto{Provider}FunctionTool` | BrainPlugToolDefinition → provider tool format |
| `castInto{Provider}FunctionCallOutput` | BrainPlugToolExecution → provider result format |
| `castFrom{Provider}FunctionCall` | provider function_call → BrainPlugToolInvocation |

**why**:
- explicit boundary between rhachet domain and provider SDK
- testable in isolation (unit tests for each cast)
- reusable if provider API has multiple entry points
- reviewable transformation logic

---

## correction 2: tool exchanges fit standard exchange pattern

**issue**: separate codepath for tool exchanges vs message exchanges.

**pattern**: both exchange types use the same serialized input/output structure.

| exchange type | input | output |
|---------------|-------|--------|
| message | prompt string | response text |
| tool call | JSON of invocations | JSON of results |

**why**:
- no special-case code for tool exchanges
- episode continuation works identically
- simpler implementation

---

## correction 3: output and calls are NOT mutually exclusive

**issue**: assumed output is null when calls present.

**pattern**: model can return both simultaneously.

```
scenario: "Let me look that up for you" + function_call

output: "Let me look that up for you"  (present)
calls: { tools: [{ slug: 'lookup', ... }] }  (also present)
```

**implementation**:

```ts
// extract calls (independent)
const functionCallItems = response.output.filter((item) => item.type === 'function_call');
const calls = functionCallItems.length > 0
  ? { tools: functionCallItems.map(castFromProviderFunctionCall) }
  : null;

// extract output (independent)
const messageItem = response.output.find((item) => item.type === 'message');
const output = messageItem ? parseOutput(messageItem) : null;

// return both — do NOT assume mutual exclusivity
return new BrainOutput({ output, calls, ... });
```

**why**:
- models may provide partial responses while tools are also requested
- mutual exclusivity assumption loses information
- extraction should be independent

---

## checklist for new suppliers

when tool use support is added to a new brain supplier:

- [ ] identify provider's tool definition format
- [ ] identify provider's tool invocation format (response)
- [ ] identify provider's tool result format (continuation)
- [ ] create `castInto{Provider}FunctionTool`
- [ ] create `castInto{Provider}FunctionCallOutput`
- [ ] create `castFrom{Provider}FunctionCall`
- [ ] extract output and calls independently (not mutually exclusive)
- [ ] use standard exchange input/output for episode continuation

