import type {StorybookConfig} from '@storybook/vue3-vite'

const config: StorybookConfig = {
	stories: ['../src/pages/**/*.stories.vue.ts'],
	addons: ['@storybook/addon-links', '@storybook/addon-docs'],
	framework: {
		name: '@storybook/vue3-vite',
		options: {},
	},
	core: {
		disableTelemetry: true,
	},
}

export default config