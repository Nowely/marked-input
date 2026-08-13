import type {MarkProps, Option} from '@markput/react'
import {MarkedInput, useOverlay} from '@markput/react'
import {useState} from 'react'

const Mark = ({value}: MarkProps) => <mark>{value}</mark>

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Overlay.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */
export const fixtures = {
	Mark,
	/** The three overlay-only stories render no mark: the overlay itself is what they show. */
	Empty: () => null,
	Overlay: () => <h1>I am the overlay</h1>,
	Tooltip: () => {
		const {style} = useOverlay()
		return <div style={{position: 'absolute', ...style}}>I am the overlay</div>
	},
	List: () => {
		const {select, ref} = useOverlay()
		return (
			// A callback ref, not the handler's own object: `RefObject<HTMLElement | null>` is not
			// assignable to `Ref<HTMLUListElement>`, and this keeps the assertion out of the fixture.
			<ul
				ref={element => {
					ref.current = element
				}}
			>
				<li onClick={() => select({value: 'First'})}>Clickable First</li>
				<li onClick={() => select({value: 'Second'})}>Clickable Second</li>
			</ul>
		)
	},
}

const SUGGESTIONS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth']

const ECHO_OPTIONS: Option[] = [{markup: '@[__value__](__meta__)', overlay: {trigger: '@', data: SUGGESTIONS}}]

/**
 * Spec fixture: the shape the `Configured` story has and no other overlay case does —
 * CONTROLLED, with a parent that echoes `onChange` straight back into `value`, and
 * `showOverlayOn` left at its default (`'change'`).
 *
 * It owns its state instead of going through the seam's `mountEcho`, because a vue composed
 * story REMOUNTS the editor on every echoed arg change: the host detaches, focus is lost and
 * the overlay state resets, which is exactly what this case asserts survives.
 */
export const EchoingParent = () => {
	const [value, setValue] = useState('calling ')
	return <MarkedInput Mark={Mark} value={value} onChange={setValue} options={ECHO_OPTIONS} />
}