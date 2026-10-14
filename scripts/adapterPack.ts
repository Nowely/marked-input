import {readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import type {PackUserConfig} from 'vite-plus/pack'

const REPO_ROOT = join(import.meta.dirname, '..')

// lightningcss hashes CSS-module class names from the file's absolute path unless it is given a
// project root, and tsdown passes none: CI and a laptop would name every class differently.
export const CSS = {minify: true, lightningcss: {projectRoot: REPO_ROOT}} satisfies PackUserConfig['css']

/** A published adapter: `pnpm publish dist` publishes the output directory as a package of its own. */
export function adapterPack(
	packageDir: string,
	{plugins, vue = false}: {plugins?: {name: string}[]; vue?: boolean} = {}
): PackUserConfig {
	return {
		entry: ['index.ts'],
		platform: 'browser',
		// Vite's default build target. It keeps the `-webkit-` prefixes Safari still needs.
		target: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'],
		minify: true,
		plugins,
		dts: {
			vue,
			// `@markput/core` never reaches npm: its types are inlined from source, not imported.
			compilerOptions: {paths: {'@markput/core': ['../../core/index.ts']}},
			// Defaults to the root tsconfig's `declarationMap`, and turns on the JS map too. Both would
			// point outside the tarball.
			sourcemap: false,
		},
		// One stylesheet, imported by the entry itself, so a consumer's bundler picks it up unasked.
		css: {...CSS, fileName: 'index.css', inject: true},
		copy: [join(REPO_ROOT, 'README.md')],
		hooks: {
			// `vue/compiler-sfc` picks its compiler build from NODE_ENV, and only the production one
			// drops template comments from the rendered DOM.
			'build:prepare': () => {
				if (vue) process.env.NODE_ENV = 'production'
			},
			'build:done': () => writeDistManifest(packageDir),
		},
	}
}

const WORKSPACE_ONLY = new Set(['private', 'scripts', 'dependencies', 'devDependencies', 'workspaces'])

function writeDistManifest(packageDir: string): void {
	const source: Record<string, unknown> = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
	const manifest = Object.fromEntries(Object.entries(source).filter(([key]) => !WORKSPACE_ONLY.has(key)))
	writeFileSync(join(packageDir, 'dist/package.json'), JSON.stringify(manifest, null, 2))
}