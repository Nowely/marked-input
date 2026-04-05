import type {StorybookConfig as ReactConfig} from '@storybook/react-vite'
import type {StorybookConfig as VueConfig} from '@storybook/vue3-vite'
import type {UserConfig} from 'vite'

const DEV_PORT = process.env.FRAMEWORK === 'react' ? 6006 : 6007

const viteFinal = async (config: UserConfig): Promise<UserConfig> => ({
	...config,
	server: {
		...config.server,
		port: DEV_PORT,
	},
})

const shared = {
	addons: ['@storybook/addon-links', '@storybook/addon-docs'],
	core: {disableTelemetry: true},
	viteFinal,
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
}

export default process.env.FRAMEWORK === 'react' ? react : vue3