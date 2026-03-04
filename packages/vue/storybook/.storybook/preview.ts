import type {Preview} from '@storybook/vue3-vite'

const preview: Preview = {
	parameters: {
		controls: {
			hideNoControlsWarning: true,
			expanded: true,
		},

		options: {
			storySort: {
				method: 'alphabetical',
				order: ['MarkedInput', 'API'],
				locales: 'en-US',
			},
		},

		docs: {
			codePanel: true,
		},
	},
}

export default preview
