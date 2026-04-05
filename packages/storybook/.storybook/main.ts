import type {StorybookConfig as ReactConfig} from '@storybook/react-vite'
import type {StorybookConfig as VueConfig} from '@storybook/vue3-vite'

const shared = {
	addons: ['@storybook/addon-links', '@storybook/addon-docs'],
	core: {disableTelemetry: true},
}

const react: ReactConfig = {
	...shared,
	stories: ['../src/pages/**/*.react.stories.tsx'],
	staticDirs: ['../public'],
	framework: {name: '@storybook/react-vite', options: {}},
}

const vue3: VueConfig = {
	...shared,
	stories: ['../src/pages/**/*.vue.stories.ts'],
	framework: {name: '@storybook/vue3-vite', options: {}},
	// async viteFinal(config) {
	// 	const {mergeConfig} = await import('vite')
	// 	return mergeConfig(config, {
	// 		resolve: {dedupe: ['react', 'react-dom', '@mdx-js/react']},
	// 		optimizeDeps: {include: ['react', 'react-dom']},
	// 	})
	// },
}

export default process.env.FRAMEWORK === 'react' ? react : vue3