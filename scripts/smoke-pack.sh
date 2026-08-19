#!/usr/bin/env bash
#
# Consume the publishable packages the way npm users do: pack `dist`, install the
# tarball into a throwaway project outside the workspace, and build against it.
#
# Nothing else in the repo touches the published artifact — apps and stories resolve
# `@markput/react` through the workspace symlink to `index.ts`, so a `dist` that no
# consumer can resolve still passes every other check. That is how 0.10.1 through
# 0.14.3 shipped a bundle whose first line failed to resolve.
#
# Run after `pnpm run build`.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

smoke() {
	local pkg_dir="$1" plugin="$2" entry_ext="$3" entry_body="$4"
	local name
	name="$(node -p "require('$REPO/$pkg_dir/dist/package.json').name")"
	echo "── $name"

	local tarball
	tarball="$(cd "$REPO/$pkg_dir/dist" && npm pack --silent --pack-destination "$WORK")"

	local app="$WORK/consumer-$(basename "$(dirname "$pkg_dir")")"
	mkdir -p "$app/src"
	echo '{"name":"consumer","private":true,"type":"module","version":"1.0.0"}' >"$app/package.json"
	printf '%s\n' "$entry_body" >"$app/src/main.$entry_ext"
	cat >"$app/vite.config.js" <<-EOF
		import plugin from '$plugin'
		export default {
			plugins: [plugin()],
			logLevel: 'warn',
			build: {lib: {entry: 'src/main.$entry_ext', formats: ['es'], fileName: 'out'}},
		}
	EOF

	(cd "$app" && npm install --silent --no-audit --no-fund "$WORK/$tarball" $PEERS vite "$plugin")
	(cd "$app" && ./node_modules/.bin/vite build)

	# The package pulls its own stylesheet in through `import "./index.css"`. If the JS
	# entry ever gets overwritten by a pass that externalises CSS, the build still
	# succeeds and the styles silently vanish — so assert the CSS reached the output.
	if ! ls "$app"/dist/*.css >/dev/null 2>&1; then
		echo "✗ $name: consumer bundle has no CSS — the stylesheet import was lost" >&2
		exit 1
	fi

	echo "✓ $name: packs, installs and builds"
}

PEERS="react react-dom"
smoke "packages/react/markput" "@vitejs/plugin-react" "jsx" \
	'import {MarkedInput} from "@markput/react"
export default () => <MarkedInput value="hi @[Alice](1)" onChange={() => {}} />'

PEERS="vue"
smoke "packages/vue/markput" "@vitejs/plugin-vue" "js" \
	'import {MarkedInput} from "@markput/vue"
export default MarkedInput'
