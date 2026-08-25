import {BlockMenu, useOverlay} from '@markput/react'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Overlay.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */
export const fixtures = {
	/** The adapter's own row menu, so `RowMenu`'s cases drive the SHIPPED component in both projects. */
	BlockMenu,
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