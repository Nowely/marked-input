import react from '@vitejs/plugin-react-swc'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

export default defineConfig({
	plugins: [react()],
	resolve: {
		dedupe: ['react', 'react-dom'],
	},
	test: {
		globals: true,
		setupFiles: ['./vitest.setup.react.ts'],
		include: ['src/pages/**/*.react.spec.tsx'],
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