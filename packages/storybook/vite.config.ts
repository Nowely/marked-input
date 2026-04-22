import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig, defineProject} from 'vitest/config'

import {createChromiumBrowserPreset} from '../../config/vitest.browser.preset'

const chromiumBrowserPreset = createChromiumBrowserPreset(playwright())

export default defineConfig({
	plugins: process.env.FRAMEWORK === 'react' ? [react()] : [vue()],
	define: {'process.env.FRAMEWORK': JSON.stringify(process.env.FRAMEWORK ?? '')},
	test: {
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'**/*.stories.ts',
				'**/*.stories.tsx',
				'**/*.spec.ts',
				'**/*.spec.tsx',
				'**/dist/**',
				'vitest.setup.ts',
			],
		},
		projects: [
			defineProject({
				plugins: [react()],
				resolve: {dedupe: ['react', 'react-dom']},
				define: {'process.env.FRAMEWORK': JSON.stringify('react')},
				test: {
					name: 'react',
					globals: true,
					setupFiles: ['./vitest.setup.ts'],
					include: ['src/pages/**/*.react.spec.tsx'],
					browser: chromiumBrowserPreset,
				},
			}),
			defineProject({
				plugins: [vue()],
				resolve: {dedupe: ['vue']},
				define: {'process.env.FRAMEWORK': JSON.stringify('vue')},
				test: {
					name: 'vue',
					globals: true,
					setupFiles: ['./vitest.setup.ts'],
					include: ['src/pages/**/*.vue.spec.ts'],
					browser: chromiumBrowserPreset,
				},
			}),
		],
	},
})