import {useOverlay} from '@markput/vue'
import {defineComponent} from 'vue'

import {defineMark, Empty} from '../../shared/lib/marks'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Overlay.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Hand-written components are written with `template:` rather than `h()`: `@storybook/vue3-vite`
 * aliases `vue` to the runtime-compiler build for exactly this, and it keeps these fixtures
 * readable next to their React counterparts. The trade is that a template string is not
 * typechecked.
 */
export const fixtures = {
	Mark: defineMark({tag: 'mark'}),
	/** The three overlay-only stories render no mark: the overlay itself is what they show. */
	Empty,
	Overlay: defineComponent({template: '<h1>I am the overlay</h1>'}),
	Tooltip: defineComponent({
		// The computed is returned at the TOP level so `proxyRefs` unwraps it for the template;
		// nested under the handler it would still be a ref and read as `undefined`.
		setup: () => ({overlayStyle: useOverlay().style}),
		template:
			`<div :style="{position: 'absolute', left: overlayStyle.left + 'px', top: overlayStyle.top + 'px'}">` +
			'I am the overlay</div>',
	}),
	List: defineComponent({
		setup() {
			const {select, ref: overlayRef} = useOverlay()
			return {
				setOverlayRef: (element: HTMLElement | null) => {
					overlayRef.current = element
				},
				selectFirst: () => select({value: 'First'}),
				selectSecond: () => select({value: 'Second'}),
			}
		},
		template:
			'<ul :ref="setOverlayRef">' +
			'<li @click="selectFirst()">Clickable First</li>' +
			'<li @click="selectSecond()">Clickable Second</li>' +
			'</ul>',
	}),
}