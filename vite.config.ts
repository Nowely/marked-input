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
				'**/*.stories.ts',
				'**/*.stories.tsx',
				'**/dist/**',
				'**/index.ts',
				'**/__testing__/**',
				'packages/storybook/vitest.setup.*.ts',
			],
		},
		projects: [
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
				resolve: {dedupe: ['react', 'react-dom']},
				test: {
					name: 'react',
					globals: true,
					setupFiles: ['./packages/storybook/vitest.setup.react.ts'],
					include: ['packages/storybook/src/pages/**/*.react.spec.tsx'],
					browser: {
						...browserBase,
						instances: [{browser: 'chromium' as const}],
					},
				},
			}),
			defineProject({
				plugins: [vue()],
				resolve: {dedupe: ['vue']},
				test: {
					name: 'vue',
					globals: true,
					setupFiles: ['./packages/storybook/vitest.setup.vue.ts'],
					include: ['packages/storybook/src/pages/**/*.vue.spec.ts'],
					browser: {
						...browserBase,
						instances: [{browser: 'chromium' as const}],
					},
				},
			}),
		],
	},
})