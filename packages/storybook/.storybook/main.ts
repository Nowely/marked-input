import type {StorybookConfig as ReactConfig} from '@storybook/react-vite'
import type {StorybookConfig as VueConfig} from '@storybook/vue3-vite'
import vue from '@vitejs/plugin-vue'

const shared = {
	addons: ['@storybook/addon-links', '@storybook/addon-docs'],
	core: {disableTelemetry: true},
}

const react: ReactConfig = {
	...shared,
	stories: ['../src/pages/**/*.react.stories.tsx'],
	staticDirs: ['../public'],
	framework: {name: '@storybook/react-vite', options: {}},
	refs: {vue: {title: 'Vue', url: 'http://localhost:6007'}},
}

const vue3: VueConfig = {
	...shared,
	stories: ['../src/pages/**/*.vue.stories.ts'],
	framework: {name: '@storybook/vue3-vite', options: {}},
	viteFinal: viteConfig => ({
		...viteConfig,
		plugins: [...(viteConfig.plugins ?? []), vue()],
	}),
}

export default process.env.FRAMEWORK === 'react' ? react : vue3