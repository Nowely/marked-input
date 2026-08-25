import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig, defineProject} from 'vitest/config'

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
			// `@markput/notion`'s own check is a READ OF ITS SOURCE, not of its behaviour: the claim
			// is that the package imports nothing but the published adapter and touches no store
			// member. There is nothing to render, so no browser and no framework plugin.
			defineProject({
				test: {
					name: 'notion',
					include: ['packages/notion/src/**/*.spec.ts'],
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
					exclude: ['**/node_modules/**', 'packages/storybook/src/pages/**/*.vue.spec.ts'],
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
					browser: {
						...browserBase,
						instances: [{browser: 'chromium' as const}],
					},
				},
			}),
		],
	},
})