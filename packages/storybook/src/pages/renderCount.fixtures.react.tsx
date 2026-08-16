import type {MarkProps} from '@markput/react'
import {useEffect} from 'react'

/**
 * The one fixture of `renderCount.spec.ts` that a `MarkSpec` cannot express. Its render-counting
 * siblings are `countRenders()` in the mark seam; this one counts MOUNTS, and the two frameworks
 * share no shape for that — React needs a hook, Vue a lifecycle call.
 *
 * The hook is also why it cannot join `defineMark`: `useEffect` may not be called conditionally,
 * so an `onMount` in `MarkSpec` would make EVERY generated mark run an empty effect for the sake
 * of this one.
 */

/**
 * A `Mark` logging each MOUNT, keyed by value. The empty-deps effect fires once per mounted
 * instance, so transient re-renders cannot skew the log — only real unmount/remount cycles land
 * in it.
 */
export function markMounts() {
	const mounts: string[] = []
	const Logged = ({value}: MarkProps) => {
		useEffect(() => {
			mounts.push(String(value))
		}, [])
		return <mark>{value}</mark>
	}
	return {Mark: Logged, mounts: () => mounts}
}