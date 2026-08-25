import type {RowNode} from '@markput/core'
import {Fragment, memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
// oxlint-disable-next-line import/no-cycle -- A recursive component pair: `Rows` maps a sibling list and `Block` paints one row and its own list. The cycle is the recursion, both sides are used only inside a render body, and the alternative is the grouping rule written twice.
import {Block} from './Block'

/**
 * ONE sibling list of rows, at any depth: the container's roots and a row's own children paint
 * through the same component, because they are the same list.
 *
 * The GROUP runs come from core (`slots.rowGroups`) rather than from a fold written here — a
 * wrapper around consecutive siblings is one rule, and writing it once per adapter is the defect
 * `9024586b` removed for suggestions.
 *
 * `index` is the row's position among ITS SIBLINGS, not within its group: a group is presentation
 * and does not renumber the list it wraps.
 */
export const Rows = memo(({rows, depth}: {rows: readonly RowNode[]; depth: number}) => {
	const resolveRowGroups = useMarkput(s => s.slots.rowGroups)

	let index = 0
	const painted = []
	for (const [run, {Group, rows: group}] of resolveRowGroups(rows).entries()) {
		const children = group.map(row => <Block key={row.id} node={row} depth={depth} index={index++} />)
		// Keyed by the RUN's position, not by its first row's id: a run is presentation and has no
		// identity of its own, and keying it by a member makes a reorder inside the run look like a
		// new wrapper — which unmounts every row in it and rebuilds the elements a drag must move.
		painted.push(Group ? <Group key={run}>{children}</Group> : <Fragment key={run}>{children}</Fragment>)
	}
	return painted
})

Rows.displayName = 'Rows'