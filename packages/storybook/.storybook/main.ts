import type {StorybookConfig} from '@storybook/react-vite'
import vue from '@vitejs/plugin-vue'

// oxlint-disable-next-line @typescript-eslint/no-unsafe-member-access
const isReact = process.env.FRAMEWORK === 'react'

// oxlint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-type-assertion
const config = {
	stories: isReact ? ['../src/pages/**/*.react.stories.tsx'] : ['../src/pages/**/*.vue.stories.ts'],
	staticDirs: isReact ? ['../public'] : [],
	addons: ['@storybook/addon-links', '@storybook/addon-docs'],
	framework: {
		name: isReact ? '@storybook/react-vite' : '@storybook/vue3-vite',
		options: {},
	},
	refs: isReact ? {vue: {title: 'Vue', url: 'http://localhost:6007'}} : {},
	core: {
		disableTelemetry: true,
	},
	...(isReact
		? {}
		: {
				viteFinal: async (config: any) => {
					config.plugins = config.plugins ?? []
					config.plugins.push(vue())
					return config
				},
			}),
} as unknown as StorybookConfig

export default config