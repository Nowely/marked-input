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
	screenshotFailures: false,
	expect: {
		toMatchScreenshot: {
			comparatorOptions: {
				allowedMismatchedPixelRatio: 0.002,
			},
			// Route baselines to `<Category>/__screenshots__/<Story>-<framework>-<browser>-<platform>.png`
			// so each story's screenshot lives next to its source file. The framework segment
			// is critical — without it React's `Base-Default` baseline collides with Vue's
			// same-named baseline at the same path and they silently overwrite each other
			// during `test:update`, producing dimension-mismatch failures on the next compare run.
			// `arg` is the first argument passed to `toMatchScreenshot()` — shape `Category-Story`.
			resolveScreenshotPath: (data: {
				arg: string
				browserName: string
				ext: string
				platform: string
				root: string
				testFileDirectory: string
				testFileName: string
			}) => {
				const [category, ...rest] = data.arg.split('-')
				const story = rest.join('-')
				const framework = data.testFileName.includes('.react.') ? 'react' : 'vue'
				return `${data.root}/${data.testFileDirectory}/${category}/__screenshots__/${story}-${framework}-${data.browserName}-${data.platform}${data.ext}`
			},
		},
	},
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
					include: ['src/pages/**/*.react.spec.tsx'],
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