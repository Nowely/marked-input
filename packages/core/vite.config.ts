import path from 'path'
import {fileURLToPath} from 'url'
import {defineConfig} from 'vite'

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
})