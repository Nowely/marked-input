import type {StorybookConfig as ReactConfig} from '@storybook/react-vite'
import type {StorybookConfig as VueConfig} from '@storybook/vue3-vite'
import type {Indexer} from 'storybook/internal/types'
import type {InlineConfig} from 'vite'

// The default CSF indexer only matches `*.stories.tsx`. A page's story file is either
// framework-free (`Base.stories.ts`, shared by both instances) or carries the framework
// segment LAST (`Drag.stories.react.tsx`) so specs can resolve it through
// `resolve.extensions` / `moduleSuffixes`. The indexer's test has to allow both.
const storyTest = /(?<!\.d)\.(story|stories)(\.(react|vue))?\.(m?[jt]sx?)$/

const baseExtensions = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']

/**
 * Storybook builds with its own Vite config, so the framework-suffix resolution used by vitest
 * (`resolve.extensions`) has to be re-applied here.
 *
 * `cacheDir` is the third of three caches this project has to split by hand, and the only one
 * Vite owns. `pnpm run dev` starts both instances at once, and everything they cache is keyed
 * on the config DIRECTORY — the same for both, since the framework is chosen by env var. Two
 * servers then write one set of files: one re-optimizes over the other's dependency bundle and
 * never finishes loading, or serves a half-written manager build and renders a blank docs page.
 * Both were observed. The other two caches (`.cache/storybook`, `.cache/sb-vite-plugin-externals`)
 * move together through `CACHE_DIR`, set per instance in `package.json`; Vite does not read that
 * variable, so its own cache is pointed under the same root here.
 */
const withFrameworkResolution = (framework: 'react' | 'vue') => async (config: InlineConfig) => {
	const {mergeConfig} = await import('vite')
	const extensions = framework === 'react' ? ['.react.tsx', '.react.ts'] : ['.vue.ts', '.vue.tsx']
	return mergeConfig(config, {
		cacheDir: `node_modules/.cache/sb-${framework}/vite`,
		resolve: {extensions: [...extensions, ...baseExtensions]},
	})
}

const shared = {
	addons: ['@storybook/addon-links', '@storybook/addon-docs'],
	core: {disableTelemetry: true},
	experimental_indexers: (existing: Indexer[] = []) => existing.map(indexer => ({...indexer, test: storyTest})),
	staticDirs: ['../public'],
}

const react: ReactConfig = {
	...shared,
	stories: ['../src/pages/**/*.stories.ts', '../src/pages/**/*.stories.react.tsx'],
	framework: {name: '@storybook/react-vite', options: {}},
	viteFinal: withFrameworkResolution('react'),
}

const vue3: VueConfig = {
	...shared,
	stories: ['../src/pages/**/*.stories.ts', '../src/pages/**/*.stories.vue.ts'],
	framework: {name: '@storybook/vue3-vite', options: {}},
	viteFinal: withFrameworkResolution('vue'),
	// async viteFinal(config) {
	// 	const {mergeConfig} = await import('vite')
	// 	return mergeConfig(config, {
	// 		resolve: {dedupe: ['react', 'react-dom', '@mdx-js/react']},
	// 		optimizeDeps: {include: ['react', 'react-dom']},
	// 	})
	// },
}

export default process.env.FRAMEWORK === 'react' ? react : vue3