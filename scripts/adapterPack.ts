import {readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import type {PackUserConfig} from 'vite-plus/pack'

/** The browsers `vite build` targeted by default (Vite 8's baseline-widely-available). */
export const BROWSER_TARGET = ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4']

/** What `vite build`'s library mode shipped: mangled and comment-free, whitespace kept readable. */
export const READABLE_MINIFY = {
	minify: {compress: true, mangle: true, codegen: {removeWhitespace: false}},
	outputOptions: {comments: {legal: true, annotation: true, jsdoc: false}},
} satisfies PackUserConfig

const REPO_ROOT = join(import.meta.dirname, '..')

/**
 * CSS-module class names in Vite's `_[local]_[hash]` shape. lightningcss hashes the file's ABSOLUTE
 * path unless it is given a project root, and tsdown passes none: a build in CI (where releases are
 * made) and one on a laptop would name every class differently. Hashing the repo-relative path
 * makes the names the same wherever the package is built.
 */
export const CSS_MODULES = {
	modules: {generateScopedName: '_[local]_[hash]'},
	lightningcss: {projectRoot: REPO_ROOT},
} satisfies PackUserConfig['css']

/**
 * The `pack` block of a published adapter. `pnpm publish dist` publishes the output directory as a
 * package of its own, so it gets everything a tarball needs: bundled JS with its stylesheet, one
 * declaration file, the README and a manifest.
 */
export function adapterPack(
	packageDir: string,
	{plugins, vue = false}: {plugins?: {name: string}[]; vue?: boolean} = {}
): PackUserConfig {
	return {
		entry: ['index.ts'],
		platform: 'browser',
		target: BROWSER_TARGET,
		...READABLE_MINIFY,
		plugins,
		// Only csstype may come from node_modules, and only into the declarations: backlog 34. Anything
		// else bundled is a dependency the manifest does not declare, so it fails the build.
		deps: {onlyBundle: ['csstype']},
		dts: {
			vue,
			// `@markput/core` never reaches npm, so its types are inlined from source, not imported.
			compilerOptions: {paths: {'@markput/core': ['../../core/index.ts']}},
			// The map's `sources` point outside the tarball and it carries no `sourcesContent`.
			sourcemap: false,
		},
		// One stylesheet, imported by the entry itself, so a consumer's bundler picks it up unasked.
		css: {fileName: 'index.css', inject: true, minify: true, ...CSS_MODULES},
		copy: [join(REPO_ROOT, 'README.md')],
		hooks: {
			// `vue/compiler-sfc` picks its compiler-core build from NODE_ENV when it loads, and only the
			// production one drops template comments and `v-if` placeholder text. `vite build` set it;
			// `vp pack` does not.
			'build:prepare': () => {
				if (vue) process.env.NODE_ENV = 'production'
			},
			'build:done': () => writeDistManifest(packageDir),
		},
	}
}

/** Manifest fields that only mean something inside the workspace. */
const WORKSPACE_ONLY = new Set(['private', 'scripts', 'dependencies', 'devDependencies', 'workspaces'])

function writeDistManifest(packageDir: string): void {
	const source: Record<string, unknown> = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
	const manifest = Object.fromEntries(Object.entries(source).filter(([key]) => !WORKSPACE_ONLY.has(key)))
	writeFileSync(join(packageDir, 'dist/package.json'), JSON.stringify(manifest, null, 2))
}