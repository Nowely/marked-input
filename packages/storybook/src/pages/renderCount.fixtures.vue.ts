import type {Option} from '@markput/vue'
import {defineComponent, h, onMounted} from 'vue'

import {defineMark} from '../shared/lib/marks'

/**
 * Spec fixtures: the framework half of `renderCount.spec.ts`. Every factory hands back the
 * component AND its reader, so the shared spec never touches a framework spy.
 *
 * The counters sit in the render function `setup` RETURNS, which is where one call means one
 * render. `setup` itself runs once per mounted instance, so counting there would measure mounts
 * instead — which is exactly what {@link counters.markMounts} does deliberately, through
 * `onMounted`.
 *
 * `meta` is declared even though nothing reads it: an undeclared prop falls through onto the
 * mark root as an attribute, which no React fixture does.
 */

/** The renderers a gate does not measure — present so the editor has something to draw. */
export const plain = {
	Mark: defineMark({tag: 'mark'}),
	Span: defineMark({tag: 'span'}),
}

export const counters = {
	/** A `Mark` counting its render invocations. */
	mark() {
		let renders = 0
		const Counted = defineComponent({
			props: {value: String, meta: String},
			setup(props) {
				return () => {
					renders++
					return h('mark', {}, props.value)
				}
			},
		})
		return {Mark: Counted, renders: () => renders}
	},

	/** A `Span` counting its render invocations. */
	span() {
		let renders = 0
		const Counted = defineComponent({
			props: {value: String, meta: String},
			setup(props) {
				return () => {
					renders++
					return h('span', {}, props.value)
				}
			},
		})
		return {Span: Counted, renders: () => renders}
	},

	/**
	 * One block-level markup whose row `Mark` counts its render invocations. The row renders its
	 * default slot and falls back to the value, because a row's text is the slot `Span`.
	 */
	blockRows() {
		let renders = 0
		const RowMark = defineComponent({
			props: {value: String, meta: String},
			setup(props, {slots}) {
				return () => {
					renders++
					return h('span', {}, slots.default?.() ?? props.value)
				}
			},
		})
		const options: Option[] = [{markup: '__slot__\n\n', Mark: RowMark}]
		return {options, renders: () => renders}
	},

	/**
	 * A `Mark` logging each MOUNT, keyed by value. `onMounted` fires once per mounted instance,
	 * so transient re-renders cannot skew the log — only real unmount/remount cycles land in it.
	 */
	markMounts() {
		const mounts: string[] = []
		const Logged = defineComponent({
			props: {value: String, meta: String},
			setup(props) {
				onMounted(() => {
					mounts.push(props.value ?? '')
				})
				return () => h('mark', {}, props.value)
			},
		})
		return {Mark: Logged, mounts: () => mounts}
	},
}