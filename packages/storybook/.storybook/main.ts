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
}

export default process.env.FRAMEWORK === 'react' ? react : vue3