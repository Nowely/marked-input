import type {RowNode} from '@markput/core'
import {memo} from 'react'

// oxlint-disable-next-line import/no-cycle -- A recursive component pair: `Rows` maps a sibling list and `Row` paints one row and its own list. The cycle is the recursion, and both sides are used only inside a render body.
import {Row} from './Row'

/**
 * ONE sibling list of rows, at any depth: the container's roots and a row's own children paint
 * through the same component, because they are the same list.
 */
export const Rows = memo(({rows, depth}: {rows: readonly RowNode[]; depth: number}) => {
	// NO POSITION IS HANDED DOWN. `Row` is memoised on what it is given, and a sibling position
	// changes for every row after an insert, so passing one made a structural edit repaint the
	// whole tail — see {@link RowRender}.
	return rows.map(row => <Row key={row.id} node={row} depth={depth} />)
})

Rows.displayName = 'Rows'