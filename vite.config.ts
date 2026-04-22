import {defineConfig} from 'vitest/config'

// oxlint-disable-next-line typescript-eslint/no-unsafe-call
export default defineConfig({
	test: {
		projects: ['packages/core/vite.config.ts', 'packages/storybook/vite.config.ts'],
	},
})