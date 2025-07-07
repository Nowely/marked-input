import {StorybookConfig} from '@storybook/react-vite'

const config: StorybookConfig = {
	stories: ['./stories'],
	staticDirs: ['./public'],
	addons: [
		'@storybook/addon-links',
		'@storybook/addon-docs'
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

/*
maybe need wrap for monorepo addons and framework
const require = createRequire(import.meta.url)
function getAbsolutePath(value: string): string {
	return dirname(require.resolve(join(value, 'package.json')))
}*/
