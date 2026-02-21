import react from '@vitejs/plugin-react-swc'
import {defineConfig} from 'vitest/config'
import {playwright} from '@vitest/browser-playwright'

export default defineConfig({
	plugins: [react()],
	resolve: {
		dedupe: ['react', 'react-dom'],
	},
	test: {
		globals: true,
		include: ['src/pages/**/*.spec.ts', 'src/pages/**/*.spec.tsx'],
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
