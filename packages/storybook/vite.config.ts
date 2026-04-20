import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig, defineProject} from 'vitest/config'

// Chromium flags that normalise Skia font-rendering across macOS / Linux CI.
// Without them, even with `@fontsource/inter` pinned, Skia picks different
// hinting + subpixel-AA paths on each OS → ~2–7% pixel drift on every
// antialiased text edge and occasional ±1 px line-height rounding (that's
// how `InteractiveNested` gets +2 px taller on Linux). The flags collapse
// both paths to the simpler, OS-agnostic grayscale + integer-positioning
// rasteriser. Drop any flag and you'll see drift return for that axis.
//
// API: these go into `playwright({ launchOptions })`, NOT `instances[n].launch`
// — the latter is silently ignored by @vitest/browser-playwright.
const chromiumLaunchOptions = {
	args: [
		'--font-render-hinting=none',
		'--disable-font-subpixel-positioning',
		'--disable-lcd-text',
		'--force-color-profile=srgb',
	],
}

const browser = {
	enabled: true,
	// oxlint-disable-next-line typescript-eslint/no-unsafe-call
	provider: playwright({launchOptions: chromiumLaunchOptions}),
	instances: [{browser: 'chromium' as const}],
	viewport: {width: 1280, height: 720},
	headless: true,
	screenshotFailures: false,
	expect: {
		toMatchScreenshot: {
			// ≤2% residual pixel drift is tolerated. With Inter pinned + the four
			// Chromium flags above, cross-OS drift should be well under 1%; this
			// leaves headroom for the occasional <1 px AA border shimmer without
			// masking real regressions. Bump cautiously if CI still flakes.
			comparatorOptions: {allowedMismatchedPixelRatio: 0.02},
			// Colocate VRT baselines next to each story: `<Category>/__screenshots__/<Story>-<framework>-<browser>.png`.
			// The `-<platform>` suffix from Vitest's default path is intentionally dropped so
			// a single baseline serves every OS (macOS/Linux/Windows).
			//
			// For any other screenshot test (functional specs like Selection.react.spec.tsx) we
			// fall through to the Vitest default path — this resolver is the only place where
			// `resolveScreenshotPath` is definable, so the branch keeps other tests untouched.
			// The `<framework>` segment is load-bearing: without it, React and Vue same-named
			// stories collide at one shared path during `test:update`.
			resolveScreenshotPath: (data: {
				arg: string
				browserName: string
				ext: string
				platform: string
				root: string
				screenshotDirectory: string
				testFileDirectory: string
				testFileName: string
			}) => {
				const isVisualRegressionSpec = data.testFileName.startsWith('screenshots.')

				if (!isVisualRegressionSpec) {
					// Mirror Vitest's default path for any non-VRT screenshot test.
					return `${data.root}/${data.testFileDirectory}/${data.screenshotDirectory}/${data.testFileName}/${data.arg}-${data.browserName}-${data.platform}${data.ext}`
				}

				const [category, story] = data.arg.split('/')
				const framework = data.testFileName.includes('.react.') ? 'react' : 'vue'
				return `${data.root}/${data.testFileDirectory}/${category}/__screenshots__/${story}-${framework}-${data.browserName}${data.ext}`
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