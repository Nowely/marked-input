import {StorybookConfig} from '@storybook/react-vite'

const config: StorybookConfig = {
	stories: ['./stories'],
	staticDirs: ['./public'],
	addons: [
		'@storybook/addon-links',
		'@storybook/addon-essentials',
		'@storybook/addon-storysource'
	],
	framework: {
		name: '@storybook/react-vite',
		options: {}
	},
	core: {
		disableTelemetry: true,
	},
}

export default config