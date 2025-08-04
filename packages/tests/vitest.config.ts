import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.spec.ts', '**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
	//TODO remove it
  resolve: {
    alias: {
      // Main package alias
      'rc-marked-input': path.resolve(__dirname, '../markput/index.ts'),
      // Additional aliases for specific imports
      'rc-marked-input/utils/functions/markupToRegex': path.resolve(__dirname, '../markput/src/utils/functions/markupToRegex.ts'),
      'rc-marked-input/utils/functions/normalizeMark': path.resolve(__dirname, '../markput/src/utils/functions/normalizeMark.ts'),
      'rc-marked-input/features/preparsing/utils/findGap': path.resolve(__dirname, '../markput/src/features/preparsing/utils/findGap.ts'),
      'rc-marked-input/utils/classes/TriggerFinder': path.resolve(__dirname, '../markput/src/utils/classes/TriggerFinder.ts'),
      'rc-marked-input/types': path.resolve(__dirname, '../markput/src/types.ts')
    }
  }
})