import type {StorybookConfig} from '@storybook/react-vite'

const config: StorybookConfig = {
	stories: ['../src/pages/**/*.stories.react.tsx'],
	staticDirs: ['../public'],
	addons: ['@storybook/addon-links', '@storybook/addon-docs'],
	framework: {
		name: '@storybook/react-vite',
		options: {},
	},
	refs: {
		vue: {
			title: 'Vue',
			url: 'http://localhost:6007',
		},
	},
	core: {
		disableTelemetry: true,
	},
}

export default config