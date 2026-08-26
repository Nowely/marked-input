import type {MarkProps, RowProps} from '@markput/react'
import {useState} from 'react'

import {Button} from '../../shared/components/Button'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Base.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */
export const fixtures = {
	Button,
}

/** Spec fixtures: mark components the shared spec mounts through story args. */
export const marks = {
	Todo: ({children}: MarkProps) => (
		<span>
			<input type="checkbox" aria-label="done" />
			{children}
		</span>
	),
}

export const Overlay = () => <span>I'm here!</span>

/**
 * Spec fixtures: a row KIND that paints its own child rows. React delivers them as the `rows`
 * PROP and Vue as the `rows` SLOT, which is the one place the two adapters' row contract
 * differs — so the shared spec needs one fixture per framework to read it at all.
 */
export const rows = {
	Bullet: ({children, rows: childRows, node, ref}: RowProps) => (
		// `data-id` is the browser's NODE-IDENTITY oracle: a row's id is minted at node birth and
		// never reused, so an id that survived a move is a node that survived it — which the DOM
		// element cannot say, since neither framework can move an element between two parents.
		<li ref={ref} data-id={node.id}>
			{children}
			{childRows}
		</li>
	),
	/**
	 * A COLLAPSIBLE row kind, and the collapse state is the CONSUMER'S — a `useState` inside the
	 * component, keyed to nothing but the component instance. That is what makes it the measurement
	 * the spec owes: if a cross-parent drop re-mints the row's node, both adapters key by `node.id`
	 * and rebuild the component, and this state goes with it.
	 *
	 * HIDDEN, never absent, which is core's contract for a collapsed row: an unpainted row leaves
	 * `bind` and takes its anchors with it, so a collapse is CSS and nothing else.
	 */
	Toggle: ({children, rows: childRows, node, ref}: RowProps) => {
		const [open, setOpen] = useState(true)
		return (
			<div ref={ref} data-id={node.id}>
				<input type="checkbox" aria-label="open" checked={open} onChange={e => setOpen(e.target.checked)} />
				{children}
				<span hidden={!open}>{childRows}</span>
			</div>
		)
	},
	/**
	 * A row KIND that is handed its child rows and PAINTS NONE OF THEM — a heading, which is the
	 * commonest shape of it. It is a fixture and not a mistake: nothing in the option API obliges a
	 * kind to render `rows`, so a row nested under one would be in the document with no box, no
	 * caret position and nothing on screen. Both gestures that can deepen a row have to refuse it.
	 */
	Heading: ({children, node, ref}: RowProps) => (
		<h2 ref={ref} data-id={node.id}>
			{children}
		</h2>
	),
}