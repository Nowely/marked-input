import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig, defineProject} from 'vitest/config'

/** The one `pages/**` spec that is a source grep rather than a driven page — see its own project. */
const BOUNDARY_SPEC = 'packages/storybook/src/pages/Notion/boundary.spec.ts'

const browserBase = {
	enabled: true,
	provider: playwright(),
	viewport: {width: 1280, height: 720},
	headless: true,
	screenshotFailures: false,
}

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'**/*.bench.ts',
				'**/*.spec.ts',
				'**/*.spec.tsx',
				'**/*.stories.*',
				'**/dist/**',
				'**/index.ts',
				'**/__testing__/**',
				'packages/storybook/vitest.setup.*.ts',
			],
		},
		projects: [
			// The showcase's boundary check is a READ OF ITS SOURCE, not of its behaviour: the claim
			// is that the page imports nothing but the published adapter and touches no store
			// member. There is nothing to render, so no browser and no framework plugin.
			//
			// It keeps its own project across the move out of `packages/notion`. Under `pages/` a
			// bare `*.spec.ts` is the shared-harness convention and BOTH browser projects would
			// claim it, turning one node run of a string grep into two Playwright boots — so the
			// file is named in their `exclude` lists below, beside this include.
			defineProject({
				test: {
					name: 'boundary',
					include: [BOUNDARY_SPEC],
					environment: 'node',
				},
			}),
			// The published guides' code samples, type-checked against the packages' SOURCE. Like
			// `boundary` it is a read of text rather than of behaviour, so it needs no browser.
			defineProject({
				test: {
					name: 'docs',
					include: ['packages/website/samples/*.spec.ts'],
					environment: 'node',
				},
			}),
			defineProject({
				test: {
					name: 'core',
					include: ['packages/core/src/**/*.spec.ts'],
					benchmark: {
						include: ['packages/core/src/**/*.bench.ts'],
					},
					browser: {
						...browserBase,
						instances: [{browser: 'chromium' as const}],
					},
				},
			}),
			defineProject({
				plugins: [react()],
				resolve: {
					dedupe: ['react', 'react-dom'],
					extensions: ['.react.tsx', '.react.ts', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
				},
				test: {
					name: 'react',
					globals: true,
					setupFiles: ['./packages/storybook/vitest.setup.react.ts'],
					include: [
						'packages/storybook/src/pages/**/*.react.spec.tsx',
						'packages/storybook/src/pages/**/*.spec.ts',
					],
					exclude: ['**/node_modules/**', 'packages/storybook/src/pages/**/*.vue.spec.ts', BOUNDARY_SPEC],
					browser: {
						...browserBase,
						instances: [{browser: 'chromium' as const}],
					},
				},
			}),
			defineProject({
				plugins: [vue()],
				resolve: {
					dedupe: ['vue'],
					// The runtime-compiler build, the same alias `@storybook/vue3-vite` injects: page
					// fixtures declare vue components with `template:` strings. Without it the specs
					// depend on `@vue/test-utils` happening to pull the compiler in.
					alias: {vue: 'vue/dist/vue.esm-bundler.js'},
					extensions: ['.vue.ts', '.vue.tsx', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
				},
				test: {
					name: 'vue',
					globals: true,
					setupFiles: ['./packages/storybook/vitest.setup.vue.ts'],
					include: [
						'packages/storybook/src/pages/**/*.vue.spec.ts',
						'packages/storybook/src/pages/**/*.spec.ts',
					],
					exclude: ['**/node_modules/**', BOUNDARY_SPEC],
					browser: {
						...browserBase,
						instances: [{browser: 'chromium' as const}],
					},
				},
			}),
		],
	},
})