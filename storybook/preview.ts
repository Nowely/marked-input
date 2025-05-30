import {Preview} from '@storybook/react-vite'

const preview: Preview = {
	parameters: {
		controls: {hideNoControlsWarning: true},

		options: {
			storySort: {
				method: 'alphabetical',
				order: ['MarkedInput', 'Styled'],
				locales: 'en-US',
			}
		},

		docs: {
			codePanel: true
		}
	}
}

export default preview