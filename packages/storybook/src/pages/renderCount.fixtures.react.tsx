import type {MarkProps, Option} from '@markput/react'
import {useEffect} from 'react'

import {defineMark} from '../shared/lib/marks'

/**
 * Spec fixtures: the framework half of `renderCount.spec.ts`. Every factory hands back the
 * component AND its reader, so the shared spec never touches a framework spy.
 *
 * The counters sit in the component BODY, which is where one call means one RENDER INVOCATION.
 * `useSyncExternalStore` calls `getSnapshot` without committing, and a body counter cannot see
 * those — counting anywhere else would measure the subscription instead of the render.
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
		const Counted = ({value}: MarkProps) => {
			renders++
			return <mark>{value}</mark>
		}
		return {Mark: Counted, renders: () => renders}
	},

	/** A `Span` counting its render invocations. */
	span() {
		let renders = 0
		const Counted = ({value}: MarkProps) => {
			renders++
			return <span>{value}</span>
		}
		return {Span: Counted, renders: () => renders}
	},

	/**
	 * One block-level markup whose row `Mark` counts its render invocations. The row renders its
	 * children and falls back to the value, because a row's text is the slot `Span`.
	 */
	blockRows() {
		let renders = 0
		const RowMark = ({children, value}: MarkProps) => {
			renders++
			return <span>{children ?? value}</span>
		}
		const options: Option[] = [{markup: '__slot__\n\n', Mark: RowMark}]
		return {options, renders: () => renders}
	},

	/**
	 * A `Mark` logging each MOUNT, keyed by value. The empty-deps effect fires once per mounted
	 * instance, so transient re-renders cannot skew the log — only real unmount/remount cycles
	 * land in it.
	 */
	markMounts() {
		const mounts: string[] = []
		const Logged = ({value}: MarkProps) => {
			useEffect(() => {
				mounts.push(String(value))
			}, [])
			return <mark>{value}</mark>
		}
		return {Mark: Logged, mounts: () => mounts}
	},
}