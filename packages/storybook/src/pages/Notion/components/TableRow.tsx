import type {RowProps} from '@markput/react'

import styles from './notion.module.css'

/**
 * A markdown table, rendered as a table.
 *
 * A ROW KIND now, not a mark: `'|__value__'` is an OPEN kind, so its raw body runs to the row's
 * own separator and one `'\n\n'`-delimited block is one table.
 *
 * What that still costs is visible in the story: the table is one row with a raw body, so no
 * cell is editable and no cell can hold a mention. Cells become rows of their own when a kind
 * can declare a split — the phase that does it is P9.
 */
export const TableRow = ({node, ref, className, style}: RowProps) => {
	// The kind's leading `|` is structural, so the body starts after it: put it back before
	// splitting, exactly as the mark version had to.
	const rows = ('|' + node.slot())
		.split('\n')
		.map(line => line.trim())
		.filter(line => line.startsWith('|'))
		.map(line =>
			line
				.replace(/^\||\|$/g, '')
				.split('|')
				.map(cell => cell.trim())
		)

	const [header, ...body] = rows.filter(cells => !cells.every(cell => /^-+$/.test(cell)))

	return (
		<div ref={ref} className={`${className ?? ''} ${styles.table}`} style={style}>
			<div className={styles.row}>
				{header.map(cell => (
					<div key={cell} className={styles.headerCell}>
						{cell}
					</div>
				))}
			</div>
			{body.map(cells => (
				<div key={cells.join('|')} className={styles.row}>
					{cells.map(cell => (
						<div key={cell} className={styles.cell}>
							{cell}
						</div>
					))}
				</div>
			))}
		</div>
	)
}