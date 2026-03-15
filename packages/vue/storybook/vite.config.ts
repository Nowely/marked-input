import vue from '@vitejs/plugin-vue'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

export default defineConfig({
	plugins: [vue()],
	resolve: {
		dedupe: ['vue'],
	},
	test: {
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		include: ['src/pages/**/*.spec.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
		},
		browser: {
			enabled: true,
			provider: playwright(),
			instances: [{browser: 'chromium'}],
			viewport: {width: 1280, height: 720},
			headless: true,
		},
	},
})