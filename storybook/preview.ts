import {Preview} from '@storybook/react'

const preview: Preview = {
	parameters: {
		controls: {hideNoControlsWarning: true},
		options: {
			storySort: {
				method: 'alphabetical',
				order: ['Base', 'Styled'],
				locales: 'en-US',
			}
		},
	}
}

export default preview