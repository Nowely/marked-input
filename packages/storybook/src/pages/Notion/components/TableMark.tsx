import type {MarkProps} from '@markput/react'

import styles from './notion.module.css'

/**
 * A markdown table, rendered as a table.
 *
 * The markup is `'|__value__'`: a leading literal `|` and a trailing value that closes at the
 * row boundary, which is the only shape that captures a whole multi-line table. A per-cell
 * markup is impossible — a markup carries at most two `__value__` placeholders and a table row
 * has N cells (notion-like issue 02) — so the whole table arrives here as one opaque string and
 * this component does the splitting the parser cannot.
 *
 * What that costs is visible in the story: the table is one atomic mark, so no cell is editable
 * and no cell can hold a mention. The mentions written into the fixture's task table are inert
 * text inside this string.
 */
export const TableMark = ({value = ''}: MarkProps) => {
	// The markup's leading `|` is the mark's own, not the value's: put it back before splitting.
	const rows = ('|' + value)
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
		<div className={styles.table}>
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