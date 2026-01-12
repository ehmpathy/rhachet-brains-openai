#!/usr/bin/env bash
######################################################################
# .what = compile src to cjs bundle with import.meta.url shim
# .why = @openai/codex-sdk uses import.meta.url which is undefined in cjs.
#        this command bundles with esbuild and applies a post-build shim.
######################################################################
set -euo pipefail

DIST_FILE="dist/index.js"

# extract external deps from package.json (dependencies + peerDependencies)
EXTERNALS=$(jq -r '
  [.dependencies, .peerDependencies]
  | map(keys // [])
  | flatten
  | unique
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

# apply import_meta shim for cjs compat
echo "• apply import_meta shim"
node -e "
const fs = require('fs');
const content = fs.readFileSync('$DIST_FILE', 'utf8');
const shimmed = content.replace(
  /var import_meta = \\{\\};/g,
  'var import_meta = { url: require(\"url\").pathToFileURL(__filename).href };'
);
fs.writeFileSync('$DIST_FILE', shimmed);
"

# copy codex vendor binaries
echo "• copy codex vendor binaries"
rm -rf vendor
cp -r node_modules/@openai/codex-sdk/vendor vendor

# emit type declarations
echo "• emit type declarations"
npx tsc -p ./tsconfig.build.json --emitDeclarationOnly

echo "✔ compile complete"
