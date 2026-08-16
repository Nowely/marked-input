import type {MarkNode, MarkputApi, Markup, Option, TextNode} from '@markput/vue'
import {MarkedInput} from '@markput/vue'
import {defineComponent, ref, shallowRef} from 'vue'

import {Mark} from '../../shared/lib/marks'
import type {PageArgs} from '../../shared/lib/stories'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Api.stories.ts` is the contract, and it fails to compile under either project
 * if this file drifts.
 *
 * Hand-written components are written with `template:` rather than `h()`, matching their React
 * counterparts.
 */

const MARKUP = '@[__value__](__meta__)' as Markup

const OPTIONS: Option[] = [{markup: MARKUP}]

/**
 * US-5 driven entirely through the §2.3 host object: every button is a `MarkputApi` verb
 * over node anchors, with no global offsets anywhere.
 *
 * `@mousedown.prevent` on the first button is REQUIRED, not decoration: the selection controller
 * clears its stored anchors on `focusout`, so a toolbar button that takes focus makes
 * `insertMark('caret')` reject every time. It is the standard toolbar pattern and the only way
 * §2.3's `'caret'` verb is usable from UI outside the editor.
 */
const Playground = defineComponent({
	components: {MarkedInput},
	// Both props are forwarded verbatim; the story's `PageArgs` is what holds `layout` to the
	// adapter's union.
	props: {layout: String, defaultValue: String},
	setup(props) {
		// `shallowRef`, not `ref`: `ref<T>()` yields `Ref<UnwrapRef<T>>`, and `UnwrapRef` maps a
		// class instance into a structural copy that is no longer nominally `MarkputApi` — the same
		// reason `page.vue.ts` captures the API through one.
		const api = shallowRef<MarkputApi | null>(null)
		const value = ref(props.defaultValue)

		const nodes = (): readonly (MarkNode | TextNode)[] => api.value?.nodes() ?? []

		const textAt = (index: number): TextNode => {
			const node = nodes()[index]
			if (node.kind !== 'text') throw new Error(`expected a text node at ${index}`)
			return node
		}

		const markAt = (index: number): MarkNode => {
			const node = nodes()[index]
			if (node.kind !== 'mark') throw new Error(`expected a mark node at ${index}`)
			return node
		}

		return {
			value,
			Mark,
			options: OPTIONS,
			// A function ref, not the `shallowRef` itself: everything `setup` returns is UNWRAPPED
			// for the template, so `:ref="api"` would hand the compiler the ref's null VALUE and the
			// API would never be captured. Vue calls this with the component's exposed object, which
			// is what `defineExpose(store.value.api)` puts there.
			setApi: (instance: MarkputApi | null) => {
				api.value = instance
			},
			insertAtCaret: () => api.value?.insertMark('caret', {markup: MARKUP, value: 'carol', meta: 'u3'}),
			editMeta: () => markAt(1).update({meta: 'edited'}),
			clearMeta: () => markAt(1).update({meta: null}),
			removeMark: () => markAt(1).remove(),
			replaceSpan: () => api.value?.replaceText({node: textAt(0), start: 0, end: 5}, 'Howdy'),
			replaceAcross: () => api.value?.replaceRange({node: textAt(0), offset: 6}, {after: markAt(1)}, 'nobody'),
			setWholeValue: () => api.value?.setValue('reset @[all](u9)'),
			// `input.clear()` is not a second verb — §2.3 defines it AS setValue('') (plan decision D-e).
			clearValue: () => api.value?.setValue(''),
			insertBetweenRows: () =>
				api.value?.insertMark({after: markAt(0)}, {markup: MARKUP, value: 'row', meta: 'r'}),
		}
	},
	template: `
		<div>
			<MarkedInput
				:ref="setApi"
				:layout="layout"
				:defaultValue="defaultValue"
				:Mark="Mark"
				:options="options"
				@change="value = $event"
			/>
			<div>
				<button type="button" @mousedown.prevent @click="insertAtCaret">insert at caret</button>
				<button type="button" @click="editMeta">edit meta</button>
				<button type="button" @click="clearMeta">clear meta</button>
				<button type="button" @click="removeMark">remove mark</button>
				<button type="button" @click="replaceSpan">replace span</button>
				<button type="button" @click="replaceAcross">replace across</button>
				<button type="button" @click="setWholeValue">set value</button>
				<button type="button" @click="clearValue">clear value</button>
				<button type="button" @click="insertBetweenRows">insert between rows</button>
			</div>
			<output aria-label="value">{{ value }}</output>
		</div>
	`,
})

export const fixtures = {
	/**
	 * `render: () => Playground` would DROP the args — the returned component is mounted with no
	 * props, so the editor renders empty. Binding the closure's `args` is what carries them.
	 */
	renderPlayground: (args: PageArgs) =>
		defineComponent({
			components: {Playground},
			setup: () => ({args}),
			template: '<Playground v-bind="args" />',
		}),
}