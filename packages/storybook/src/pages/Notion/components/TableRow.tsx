import type {RowProps} from '@markput/react'

import styles from './notion.module.css'

/**
 * ONE LINE of a markdown table, rendered as one table row.
 *
 * A ROW KIND, not a mark: `'|__value__'` is an OPEN kind, so its raw body runs to the row's own
 * separator — and under the `'\n'` default that bound is the end of the line. Each line is
 * therefore a row of its own, with its own grip and its own row menu, which is the gesture a
 * whole-table row could not offer.
 *
 * Two things that costs, both visible in the story. The HEADER is gone: which line is the header
 * is a fact about the line AFTER it, and a row component sees only its own row. And the alignment
 * line renders as an empty row rather than disappearing — an unpainted row leaves `bind` with no
 * element for it.
 *
 * The cells are still raw text, so none of them is editable and none can hold a mention. Cells
 * become rows of their own when a kind can declare a split — the phase that does it is P9.
 */
export const TableRow = ({node, ref, className, style}: RowProps) => {
	// The kind's leading `|` is structural, so the body starts after it: put it back before
	// splitting, exactly as the mark version had to.
	const cells = ('|' + node.slot())
		.trim()
		.replace(/^\||\|$/g, '')
		.split('|')
		.map(cell => cell.trim())
	const isAlignment = cells.every(cell => /^:?-+:?$/.test(cell))

	return (
		<div ref={ref} className={`${className ?? ''} ${styles.table}`} style={style}>
			{!isAlignment && (
				<div className={styles.row}>
					{cells.map(cell => (
						<div key={cell} className={styles.cell}>
							{cell}
						</div>
					))}
				</div>
			)}
		</div>
	)
}