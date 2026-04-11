import path from 'path'
import {fileURLToPath} from 'url'

import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
	// TODO: add dts() here with enforce:'pre' once https://github.com/sxzz/rolldown-plugin-dts/issues/201
	// is resolved. Even with enforce:'pre' (which fixes MISSING_EXPORT), duplicated-export errors
	// remain — same physical file arrives via two IDs (paths alias vs workspace symlink) causing
	// rolldown to bundle it twice. DTS is built in prepack.js via standalone rolldown instead.
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