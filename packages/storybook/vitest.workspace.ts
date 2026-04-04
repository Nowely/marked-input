import react from '@vitejs/plugin-react-swc'
import vue from '@vitejs/plugin-vue'
import {playwright} from '@vitest/browser-playwright'
import {defineWorkspace} from 'vitest/config'

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const browser = {
	enabled: true,
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	provider: playwright(),
	instances: [{browser: 'chromium'}],
	viewport: {width: 1280, height: 720},
	headless: true,
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export default defineWorkspace([
	{
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		plugins: [react()],
		resolve: {dedupe: ['react', 'react-dom']},
		test: {
			name: 'react',
			globals: true,
			setupFiles: ['./vitest.setup.react.ts'],
			include: ['src/pages/**/*.react.spec.tsx'],
			coverage: {provider: 'v8', reporter: ['text', 'json', 'html']},
			browser,
		},
	},
	{
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		plugins: [vue()],
		resolve: {dedupe: ['vue']},
		test: {
			name: 'vue',
			globals: true,
			setupFiles: ['./vitest.setup.vue.ts'],
			include: ['src/pages/**/*.vue.spec.ts'],
			coverage: {provider: 'v8', reporter: ['text', 'json', 'html']},
			browser,
		},
	},
])