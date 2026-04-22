import path from 'path'
import {fileURLToPath} from 'url'

import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

import {createChromiumBrowserPreset} from '../../config/vitest.browser.preset'

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
		browser: createChromiumBrowserPreset(playwright()),
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['**/*.bench.ts', '**/*.spec.ts', '**/dist/**', '**/index.ts', '**/__testing__/**'],
		},
	},
})