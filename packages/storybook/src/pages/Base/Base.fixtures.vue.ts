import type {RowProps} from '@markput/vue'
import {defineComponent} from 'vue'

import Button from '../../shared/components/Button/Button.vue'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Base.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Hand-written components are written with `template:` rather than `h()`: `@storybook/vue3-vite`
 * aliases `vue` to the runtime-compiler build for exactly this, and it keeps these fixtures
 * readable next to their React counterparts. The trade is that a template string is not
 * typechecked.
 */
export const fixtures = {
	Button,
}

/**
 * Spec fixtures: mark components the shared spec mounts through story args.
 *
 * `inheritAttrs: false` is what keeps the rendered DOM equal to React's. Core hands every mark
 * `{value, meta}`; Vue puts every prop a component does not declare onto its root element, so
 * they would land there as attributes — `<mark meta="1">` against React's `<mark>`. Every mark
 * that reads through `useMark()`, through the slot, or through only part of the pair needs it.
 */
export const marks = {
	Todo: defineComponent({
		inheritAttrs: false,
		template: '<span><input type="checkbox" aria-label="done" /><slot /></span>',
	}),
}

export const Overlay = defineComponent({template: `<span>I'm here!</span>`})

/**
 * THE ROW PROPS A KIND DECLARES, spelled once for the three fixtures below. They are DECLARED for
 * `marks.vue.ts`'s reason: vue puts every undeclared prop onto the root element, so `node` and
 * `depth` would face React's bare `<li>` as attributes.
 *
 * `satisfies Record<keyof RowProps, unknown>` is a COMPILE-TIME PIN on the published type, and the
 * only one there can be: it fails `typecheck:vue` the moment `RowProps` grows a key this list has
 * not, or loses one it has. What it is guarding against is a FALLTHROUGH ATTRIBUTE creeping back
 * onto the type — Vue removes a DECLARED key from `$attrs`, so a `class` or `style` on `RowProps`
 * makes a kind written straight from it lose the editor's own paint, and nothing on screen says so.
 */
const rowProps = {meta: String, node: {type: null}, depth: Number} satisfies Record<keyof RowProps, unknown>

/**
 * Spec fixtures: a row KIND that paints its own child rows. React delivers them as the `rows`
 * PROP and Vue as the `rows` SLOT, which is the one place the two adapters' row contract
 * differs — so the shared spec needs one fixture per framework to read it at all.
 */
export const rows = {
	Bullet: defineComponent({
		inheritAttrs: false,
		props: rowProps,
		// `data-id` is the browser's NODE-IDENTITY oracle: a row's id is minted at node birth and
		// never reused, so an id that survived a move is a node that survived it — which the DOM
		// element cannot say, since neither framework can move an element between two parents.
		template: '<li :data-id="node.id"><slot /><slot name="rows" /></li>',
	}),
	/**
	 * A COLLAPSIBLE row kind, and the collapse state is the CONSUMER'S — component-local `data`,
	 * keyed to nothing but the component instance. That is what makes it the measurement the spec
	 * owes: if a cross-parent drop re-mints the row's node, both adapters key by `node.id` and
	 * rebuild the component, and this state goes with it.
	 *
	 * HIDDEN, never absent, which is core's contract for a collapsed row: an unpainted row leaves
	 * `bind` and takes its anchors with it, so a collapse is CSS and nothing else.
	 */
	Toggle: defineComponent({
		inheritAttrs: false,
		props: rowProps,
		data: () => ({open: true}),
		template:
			'<div :data-id="node.id"><input type="checkbox" aria-label="open" :checked="open" @change="open = !open" /><slot />' +
			'<span :hidden="!open"><slot name="rows" /></span></div>',
	}),
	/**
	 * A row KIND that is handed its child rows and PAINTS NONE OF THEM — a heading, which is the
	 * commonest shape of it. It is a fixture and not a mistake: nothing in the option API obliges a
	 * kind to render the `rows` slot, so a row nested under one would be in the document with no
	 * box, no caret position and nothing on screen. Both gestures that can deepen a row have to
	 * refuse it.
	 */
	Heading: defineComponent({
		inheritAttrs: false,
		props: rowProps,
		template: '<h2 :data-id="node.id"><slot /></h2>',
	}),
}