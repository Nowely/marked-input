import {defineComponent, h, onMounted} from 'vue'

/**
 * The one fixture of `renderCount.spec.ts` that a `MarkSpec` cannot express. Its render-counting
 * siblings are `countRenders()` in the mark seam; this one counts MOUNTS, and the two frameworks
 * share no shape for that — Vue needs a lifecycle call, React a hook.
 *
 * `meta` is declared even though nothing reads it: an undeclared prop falls through onto the mark
 * root as an attribute, which the React fixture does not do.
 */

/**
 * A `Mark` logging each MOUNT, keyed by value. `onMounted` fires once per mounted instance, so
 * transient re-renders cannot skew the log — only real unmount/remount cycles land in it.
 */
export function markMounts() {
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
}