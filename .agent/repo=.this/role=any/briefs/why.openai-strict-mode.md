# why.openai-strict-mode

## .what

openai function call has a `strict: true` option that guarantees the model output will always match the provided json schema exactly.

## .why we use it

**token economics**: without strict mode, the model may output malformed json. you pay for those tokens, then have to retry. with strict mode, openai guarantees valid output — no wasted tokens on retries.

| mode | malformed output? | retry cost | validation |
|------|-------------------|------------|------------|
| `strict: false` | possible | pay twice | client-side |
| `strict: true` | never | n/a | openai-side |

## .how it works

openai uses constrained decode (grammar-based generation) to force the model to only emit tokens that produce valid json that matches your schema.

## .the catch

strict mode has stricter schema requirements than standard json schema:

1. **all properties must be in `required` array** — even optional ones
2. **optional properties must have nullable type** — `["string", "null"]` instead of just `"string"`
3. **`additionalProperties: false`** — must be explicit

### example

zod schema with optional property:
```ts
z.object({
  path: z.string(),
  offset: z.number().optional(),
})
```

**wrong** (standard json schema):
```json
{
  "properties": { "path": { "type": "string" }, "offset": { "type": "number" } },
  "required": ["path"]
}
```

**correct** (openai strict mode):
```json
{
  "properties": { "path": { "type": "string" }, "offset": { "type": ["number", "null"] } },
  "required": ["path", "offset"],
  "additionalProperties": false
}
```

## .implementation

`asJsonSchema()` in this repo transforms zod schemas to openai-compatible format via:
1. convert optional props to nullable types
2. add all props to `required` array
3. recurse into nested objects

## .refs

- openai structured outputs docs: https://platform.openai.com/docs/guides/structured-outputs
- openai function call: https://platform.openai.com/docs/guides/function-calling
