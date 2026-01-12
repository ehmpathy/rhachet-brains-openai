#!/usr/bin/env bash
######################################################################
# .what = compile src to cjs bundle with import.meta.url shim
# .why = @openai/codex-sdk uses import.meta.url which is undefined in cjs.
#        this command bundles with esbuild and applies a post-build shim.
######################################################################
set -euo pipefail

DIST_FILE="dist/index.js"

# extract external deps from package.json (dependencies + peerDependencies)
# note: @openai/codex-sdk is excluded - we bundle its JS but use peer dep for vendor binaries
EXTERNALS=$(jq -r '
  [.dependencies, .peerDependencies]
  | map(keys // [])
  | flatten
  | unique
  | map(select(. != "@openai/codex-sdk"))
  | map("--external:" + .)
  | join(" ")
' package.json)

# bundle with esbuild, external deps from package.json
echo "• bundle src/index.ts → $DIST_FILE"
npx esbuild src/index.ts \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile="$DIST_FILE" \
  $EXTERNALS

# apply import_meta shim to resolve via @openai/codex-sdk location
# uses a directory walk to find the peer dep - works in jest + pnpm without config
echo "• apply import_meta shim → @openai/codex-sdk"
node -e "
const fs = require('fs');
const content = fs.readFileSync('$DIST_FILE', 'utf8');
// shim walks up from __dirname to find @openai/codex-sdk in node_modules
// this works with pnpm which links peer deps relative to the package location
const shim = \`var import_meta = { get url() {
  var path = require('path');
  var fs = require('fs');
  var dir = __dirname;
  while (dir !== path.dirname(dir)) {
    var candidate = path.join(dir, 'node_modules', '@openai', 'codex-sdk', 'dist', 'index.js');
    if (fs.existsSync(candidate)) return require('url').pathToFileURL(candidate).href;
    dir = path.dirname(dir);
  }
  throw new Error('@openai/codex-sdk not found. Install it as a peer dependency.');
} };\`;
const shimmed = content.replace(/var import_meta = \\{\\};/g, shim);
fs.writeFileSync('$DIST_FILE', shimmed);
"

# emit type declarations
echo "• emit type declarations"
npx tsc -p ./tsconfig.build.json --emitDeclarationOnly

echo "✔ compile complete"
