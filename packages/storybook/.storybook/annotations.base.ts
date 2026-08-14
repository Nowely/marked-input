import type {GlobalTypes} from 'storybook/internal/types'

/** The framework-free half of the preview: globals and parameters both instances share. */

const globalTypes = {
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
} satisfies GlobalTypes

export const annotationsBase = {
	globalTypes,
	parameters: {
		controls: {
			hideNoControlsWarning: true,
			expanded: true,
		},
		options: {
			storySort: {
				method: 'alphabetical',
				order: ['MarkedInput', 'Styled', 'API'],
				locales: 'en-US',
			},
		},
		docs: {
			codePanel: true,
		},
	},
}