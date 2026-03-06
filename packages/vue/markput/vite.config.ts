import path from 'path'
import {fileURLToPath} from 'url'

import vue from '@vitejs/plugin-vue'
import {defineConfig} from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
	plugins: [vue()],
	build: {
		lib: {
			entry: path.resolve(__dirname, './index.ts'),
			name: 'MarkedInput',
			formats: ['es'],
			fileName: 'index',
		},
		rollupOptions: {
			external: ['vue'],
			output: {
				intro: chunk => (chunk.fileName === 'index.js' ? 'import "./index.css";' : ''),
				globals: {
					vue: 'Vue',
				},
			},
		},
	},
})