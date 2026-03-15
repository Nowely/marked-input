import type {Preview} from '@storybook/react-vite'

import {withPlainValue} from '../src/shared/lib/withPlainValue'

const preview: Preview = {
	decorators: [withPlainValue],
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