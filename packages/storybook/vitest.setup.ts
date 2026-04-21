import {setProjectAnnotations as setReactAnnotations} from '@storybook/react-vite'
import {setProjectAnnotations as setVueAnnotations} from '@storybook/vue3-vite'

import preview from './.storybook/preview'

if (process.env.FRAMEWORK === 'react') {
	setReactAnnotations(preview)
} else {
	setVueAnnotations(preview)
}

// Kill-switch for hover/focus-driven inline-style mutations and in-flight
// CSS transitions/animations during VRT specs. Scoped to `html[data-vrt]`
// so functional specs (Drag.*, Selection.*, Clipboard.*) keep real
// pointer-events, transitions, and animations — VRT specs opt in by
// setting the attribute in `beforeAll`.
//
// Why each rule is load-bearing:
// - `pointer-events: none` — Playwright's virtual cursor lands inside
//   components on some OSs, triggering `:hover` / `onMouseEnter` that
//   flip inline styles (e.g. `Nested/InteractiveNested` toggled
//   `style="border: 2px solid #2196f3"` on Linux but not macOS).
// - `transition: none`, `animation: none` — prevents capture during
//   mid-flight CSS state, which would otherwise produce non-idempotent
//   serialized HTML between runs.
if (typeof document !== 'undefined') {
	const style = document.createElement('style')
	style.textContent = `
		html[data-vrt], html[data-vrt] * {
			pointer-events: none !important;
			transition: none !important;
			animation: none !important;
		}
	`
	document.head.appendChild(style)
}