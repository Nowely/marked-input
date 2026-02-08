import react from '@vitejs/plugin-react-swc'
import path from 'path'
import {fileURLToPath} from 'url'
import {defineConfig} from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
	plugins: [react()],
	build: {
		lib: {
			entry: path.resolve(__dirname, './index.ts'),
			name: 'MarkedInput',
			formats: ['es'],
			fileName: 'index',
		},
		rollupOptions: {
			external: ['react', 'react/jsx-runtime'],
			output: {
				intro: chunk => (chunk.fileName === 'index.js' ? 'import "./index.css";' : ''),
				globals: {
					react: 'React',
					'react/jsx-runtime': 'ReactJsxRuntime',
				},
			},
		},
	},
})
