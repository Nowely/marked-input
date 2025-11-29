import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
	plugins: [react()] as any,
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
		},
	},
})

