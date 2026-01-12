# why we bundle @openai/codex-sdk

## .what

this package bundles `@openai/codex-sdk` js code into its dist output while it requires it as a peer dependency for vendor binaries.

## .why

### vendor binaries are huge

`@openai/codex-sdk` ships with platform-specific codex binaries (~50MB per platform × 6 platforms = ~308MB). to bundle these would make our package enormous.

### js code needs bundle for cjs compat

`@openai/codex-sdk` is esm-only. when consumers use jest with pnpm, they encounter module resolution failures due to pnpm's nested symlink structure. a bundle of the js code avoids this.

### peer dep for binaries

to list `@openai/codex-sdk` as a peer dependency:
- consumers install the package themselves (brings in vendor binaries)
- our shim finds their installation at runtime via directory walk
- our package stays small (~17KB vs ~308MB)

## .how

the build is handled by `bin/compile.withshim.sh` which does two things:

### 1. bundle with esbuild (codex-sdk excluded from externals)

```sh
# extract external deps, exclude @openai/codex-sdk so its JS gets bundled
EXTERNALS=$(jq -r '
  [.dependencies, .peerDependencies]
  | map(keys // [])
  | flatten
  | unique
  | map(select(. != "@openai/codex-sdk"))
  | map("--external:" + .)
  | join(" ")
' package.json)

esbuild src/index.ts \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile=dist/index.js \
  $EXTERNALS
```

this inlines `@openai/codex-sdk` js while it keeps other peer deps external.

### 2. shim import.meta.url via directory walk

`@openai/codex-sdk` uses `import.meta.url` to locate its vendor binaries. this is undefined in cjs bundles. esbuild emits:

```js
var import_meta = {};
```

the build replaces this with a shim that walks up from `__dirname` to find the peer dep:

```js
var import_meta = { get url() {
  var path = require('path');
  var fs = require('fs');
  var dir = __dirname;
  while (dir !== path.dirname(dir)) {
    var candidate = path.join(dir, 'node_modules', '@openai', 'codex-sdk', 'dist', 'index.js');
    if (fs.existsSync(candidate)) return require('url').pathToFileURL(candidate).href;
    dir = path.dirname(dir);
  }
  throw new Error('@openai/codex-sdk not found. Install it as a peer dependency.');
} };
```

this approach:
- uses lazy evaluation (getter) so resolution happens only when codex is used
- walks up from `__dirname` (bundle location) not `process.cwd()` (works with pnpm which links peer deps relative to package location)
- bypasses jest's module resolver entirely (no moduleNameMapper needed)
- points to `dist/index.js` so relative vendor/ paths resolve correctly

## .result

consumers get:
- small package (~17KB)
- cjs format that works with jest, node, and all bundlers
- vendor binaries from their own `@openai/codex-sdk` peer dep installation
- no jest config changes needed (works with pnpm out of the box)

## .see also

- esbuild bundle docs: https://esbuild.github.io/api/#bundle
- pnpm symlink structure: https://pnpm.io/symlinked-node-modules-structure
- import.meta.url in cjs: https://github.com/evanw/esbuild/issues/1492
