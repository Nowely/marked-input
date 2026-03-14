import type {Preview} from '@storybook/react-vite'

const preview: Preview = {
	globalTypes: {
		showPlainValue: {
			name: 'Plain Value',
			description: 'Toggle plain value panel',
			defaultValue: 'show',
			toolbar: {
				icon: 'eye',
				items: [
					{value: 'show', icon: 'eye'},
					{value: 'hide', icon: 'eyeclose'},
				],
			},
		},
	},
	parameters: {
		controls: {
			hideNoControlsWarning: true,
			expanded: true,
		},

		options: {
			storySort: {
				method: 'alphabetical',
				order: ['MarkedInput', 'Styled'],
				locales: 'en-US',
			},
		},

		docs: {
			codePanel: true,
		},
	},
}

export default preview