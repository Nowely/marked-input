import {StorybookConfig} from '@storybook/react-vite'

const config: StorybookConfig = {
	stories: [{
		directory: './stories'
	},
		//'./stories/**/*.stories.mdx',
		//'./stories/**/*.stories.@(js|jsx|ts|tsx)',
	],
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