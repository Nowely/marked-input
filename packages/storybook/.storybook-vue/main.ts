import type {StorybookConfig} from '@storybook/vue3-vite'
import vue from '@vitejs/plugin-vue'

const config: StorybookConfig = {
	stories: ['../src/pages/**/*.vue.stories.ts'],
	addons: ['@storybook/addon-links', '@storybook/addon-docs'],
	framework: {
		name: '@storybook/vue3-vite',
		options: {},
	},
	core: {
		disableTelemetry: true,
	},
	async viteFinal(config) {
		config.plugins = config.plugins ?? []
		config.plugins.push(vue())
		return config
	},
}

export default config