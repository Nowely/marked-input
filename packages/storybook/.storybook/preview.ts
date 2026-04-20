import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/700.css'
import type {ProjectAnnotations, Renderer} from 'storybook/internal/types'

import {withPlainValue as withPlainValueReact} from '../src/shared/lib/withPlainValue.react'
import {withPlainValue as withPlainValueVue} from '../src/shared/lib/withPlainValue.vue'

// Pin Inter everywhere so screenshots are OS-agnostic. `!important` is load-bearing:
// Ant/Rsuite push their own `font-family` via component-level CSS, and without
// `!important` those selectors win and reintroduce system-font drift (macOS
// `-apple-system` vs Linux `DejaVu Sans` differ by ~1 px per line → dimension
// mismatches on multi-line stories and 6–12% pixel drift on Tag-heavy layouts).
// `text-rendering: geometricPrecision` asks Skia to use the same metrics path
// across OSes; without it Chromium falls into a faster legacy path on macOS.
if (typeof document !== 'undefined') {
	const style = document.createElement('style')
	style.textContent = `
		html, body, #storybook-root, .sb-show-main, .ant-tag, .rs-tag, .rs-input, input, button {
			font-family: 'Inter', sans-serif !important;
			text-rendering: geometricPrecision;
		}
	`
	document.head.appendChild(style)
}

const isReact = process.env.FRAMEWORK === 'react'

const preview: ProjectAnnotations<Renderer> = {
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
				order: ['MarkedInput', 'Styled', 'API'],
				locales: 'en-US',
			},
		},
		docs: {
			codePanel: true,
		},
	},
}

export default preview