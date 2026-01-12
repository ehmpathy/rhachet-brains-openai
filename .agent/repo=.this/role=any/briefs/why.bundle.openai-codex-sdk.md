# why we bundle @openai/codex-sdk

## .what

this package bundles `@openai/codex-sdk` into its dist output rather than list it as a runtime dependency.

## .why

### jest + pnpm + esm = resolution nightmare

`@openai/codex-sdk` is an esm-only package. when consumers of rhachet-brains-openai use jest with pnpm, they encounter module resolution failures:

```
Cannot find module '@openai/codex-sdk' from 'node_modules/.pnpm/rhachet-brains-openai@.../...'
```

this happens because:
1. pnpm uses a nested symlink structure for dependencies
2. jest's module resolver struggles with esm-only deps in nested pnpm structures
3. the consumer would need to add a `moduleNameMapper` workaround in their jest config

### bundle to make it portable

when we bundle `@openai/codex-sdk` into our dist:
- consumers never need to resolve it at runtime
- no jest workarounds required
- no pnpm-specific configuration needed
- the package "just works" regardless of the consumer's package manager or test runner

## .how

the build is handled by `bin/compile.withshim.sh` which does three things:

### 1. bundle with esbuild

```sh
esbuild src/index.ts \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile=dist/index.js \
  --external:rhachet \
  --external:openai \
  --external:zod \
  # ... other peer deps
```

this inlines `@openai/codex-sdk` while it keeps peer deps external.

### 2. shim import.meta.url for cjs compat

`@openai/codex-sdk` uses `import.meta.url` to locate its vendor binaries. this is undefined in cjs bundles. esbuild emits:

```js
var import_meta = {};
```

the build replaces this with a functional shim:

```js
var import_meta = { url: require("url").pathToFileURL(__filename).href };
```

this allows the bundled code to resolve paths correctly in cjs context.

### 3. copy vendor binaries

`@openai/codex-sdk` ships with platform-specific codex binaries in its `vendor/` directory. the build copies these to the package root:

```sh
cp -r node_modules/@openai/codex-sdk/vendor vendor
```

the `vendor/` directory is:
- included in `package.json` files array (published with the package)
- added to `.gitignore` (build artifact, not source)

## .result

consumers get a fully portable package:
- cjs format works with jest, node, and all bundlers
- codex binaries included, no separate install needed
- `@openai/codex-sdk` listed as devDependency (build time only)

## .see also

- esbuild bundle docs: https://esbuild.github.io/api/#bundle
- pnpm symlink structure: https://pnpm.io/symlinked-node-modules-structure
- import.meta.url in cjs: https://github.com/evanw/esbuild/issues/1492
