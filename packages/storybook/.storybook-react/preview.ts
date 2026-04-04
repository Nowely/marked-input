import type {Preview} from '@storybook/react-vite'

import {withPlainValue} from '../src/shared/lib/withPlainValue.react'

const preview: Preview = {
	decorators: [withPlainValue],
	globalTypes: {
		showPlainValue: {
			name: 'Plain Value',
			description: 'Plain value panel position',
			defaultValue: 'right',
			toolbar: {
				icon: 'sidebaralt',
				items: [
					{value: 'right', title: 'Show right', icon: 'sidebaralt'},
					{value: 'bottom', title: 'Show bottom', icon: 'bottombar'},
					{value: 'hide', title: 'Hide', icon: 'eyeclose'},
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