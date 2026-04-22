import path from 'path'
import {fileURLToPath} from 'url'

import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
	build: {
		lib: {
			entry: path.resolve(__dirname, './index.ts'),
			name: 'MarkputCore',
			formats: ['es'],
			fileName: 'index',
		},
	},
	test: {
		browser: {
			enabled: true,
			// oxlint-disable-next-line typescript-eslint/no-unsafe-call
			provider: playwright(),
			instances: [{browser: 'chromium' as const}],
			viewport: {width: 1280, height: 720},
			headless: true,
			screenshotFailures: false,
		},
	},
})