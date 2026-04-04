import type {Preview} from '@storybook/react-vite'

import {withPlainValue as withPlainValueReact} from '../src/shared/lib/withPlainValue.react'
import {withPlainValue as withPlainValueVue} from '../src/shared/lib/withPlainValue.vue'

const isReact = process.env.FRAMEWORK === 'react'

const preview: Preview = {
	decorators: [isReact ? withPlainValueReact : withPlainValueVue],
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
				order: isReact ? ['MarkedInput', 'Styled'] : ['MarkedInput', 'API'],
				locales: 'en-US',
			},
		},
		docs: {
			codePanel: true,
		},
	},
}

export default preview