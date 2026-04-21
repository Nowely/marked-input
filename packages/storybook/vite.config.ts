import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig, defineProject} from 'vitest/config'

const browser = {
	enabled: true,
	// oxlint-disable-next-line typescript-eslint/no-unsafe-call
	provider: playwright(),
	instances: [{browser: 'chromium' as const}],
	viewport: {width: 1280, height: 720},
	headless: true,
}

export default defineConfig({
	plugins: process.env.FRAMEWORK === 'react' ? [react()] : [vue()],
	define: {'process.env.FRAMEWORK': JSON.stringify(process.env.FRAMEWORK ?? '')},
	test: {
		coverage: {provider: 'v8', reporter: ['text', 'json', 'html']},
		projects: [
			// oxlint-disable-next-line typescript-eslint/no-unsafe-call
			defineProject({
				plugins: [react()],
				resolve: {dedupe: ['react', 'react-dom']},
				define: {'process.env.FRAMEWORK': JSON.stringify('react')},
				test: {
					name: 'react',
					globals: true,
					setupFiles: ['./vitest.setup.ts'],
					include: ['src/pages/**/*.react.spec.tsx', 'src/pages/**/*.spec.ts'],
					browser,
				},
			}),
			// oxlint-disable-next-line typescript-eslint/no-unsafe-call
			defineProject({
				plugins: [vue()],
				resolve: {dedupe: ['vue']},
				define: {'process.env.FRAMEWORK': JSON.stringify('vue')},
				test: {
					name: 'vue',
					globals: true,
					setupFiles: ['./vitest.setup.ts'],
					include: ['src/pages/**/*.vue.spec.ts'],
					browser,
				},
			}),
		],
	},
})