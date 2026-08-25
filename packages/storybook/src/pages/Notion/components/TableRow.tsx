import type {RowProps} from '@markput/react'

import styles from './notion.module.css'

/**
 * ONE LINE of a markdown table — and its CELLS are Rows of their own.
 *
 * The kind declares `split: {at: ' | ', as: tableCell}`, so the parse takes the line's body apart
 * at the delimiter and each piece is an ordinary Row: it renders through the cell option's
 * component, holds ordinary inline marks, and takes the caret. That is what closes the cost this
 * component used to carry — the whole line was one raw body, so nothing inside a cell was a token
 * and no mention could live in one.
 *
 * THE HEADER is the first line of a consecutive run, and it stays a CONSUMER-side reading: which
 * line is the header is a fact about the line after it, and a row is recognised by its own first
 * bytes alone. What the split changed is where the reading can live — the cells are elements now,
 * so `.table + .table` says "not the first of a run" in CSS and no component asks about a sibling.
 *
 * Two costs are still visible on the reference document, and both are the delimiter model rather
 * than this component. A markdown line ends with `' |'`, which is not a delimiter and therefore
 * belongs to the last cell's own text. And each line is its own `display: table`, so columns do
 * not align between lines: one wrapper around consecutive lines is `RowSpec.group`, which is not
 * built. The alignment line (`| --- | --- |`) paints its dashes like any other line now, where
 * this component used to drop its cells and leave an empty row behind.
 */
export const TableRow = ({rows, ref, className, style}: RowProps) => (
	<div ref={ref} data-table className={`${className ?? ''} ${styles.table}`} style={style}>
		<div className={styles.row}>{rows}</div>
	</div>
)

/**
 * ONE CELL, which is a Row born from the line's own split — never a node kind of its own. Its
 * structural bytes are the delimiter it was carved at, so the component paints nothing but the
 * cell's own inline content, and its column is the position among its siblings the mapper passes.
 */
export const TableCell = ({children, index, ref, className, style}: RowProps) => (
	<div ref={ref} data-cell={index} className={`${className ?? ''} ${styles.cell}`} style={style}>
		{children}
	</div>
)