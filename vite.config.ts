import react from '@vitejs/plugin-react-swc'
import path from 'path'
import {fileURLToPath} from 'url'
import {defineConfig} from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Root vite.config.ts for the monorepo
// Used primarily for the e2e test app
export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: 'jsdom',
	},
	// Resolve packages in the monorepo
	/*resolve: {
		alias: {
			'rc-marked-input': path.resolve(__dirname, 'packages/marked-input-react/index.ts')
		}
	}*/
})
