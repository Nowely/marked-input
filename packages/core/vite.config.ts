import {defineConfig} from 'vite-plus'

import {BROWSER_TARGET, READABLE_MINIFY} from '../../scripts/adapterPack'

// Core reaches npm only inside the adapters' bundles. This build proves it bundles on its own.
export default defineConfig({
	pack: {
		entry: ['index.ts'],
		platform: 'browser',
		target: BROWSER_TARGET,
		...READABLE_MINIFY,
		// `types` in package.json would otherwise turn declarations on; nothing consumes them.
		dts: false,
		css: {fileName: 'index.css', minify: true, modules: {generateScopedName: '_[local]_[hash]'}},
	},
})