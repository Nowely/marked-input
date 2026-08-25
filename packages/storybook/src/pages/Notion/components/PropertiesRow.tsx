import type {RowProps} from '@markput/react'
import {Fragment} from 'react'

import styles from './notion.module.css'

/**
 * The document's YAML frontmatter, rendered as Notion's properties panel.
 *
 * A ROW KIND now, not a mark: its markup `'---\n__value__\n---'` is a closed kind whose body is
 * RAW, so the scanner types the row wherever it starts and the interior is never re-parsed —
 * which is what closes notion-like issue 09's "matches only at offset 0".
 *
 * It splits its own interior on `key: value` because a kind hands over one opaque string and
 * nothing more (notion-like issue 02). A real YAML parser drops in here unchanged.
 */
export const PropertiesRow = ({node, ref, className, style}: RowProps) => {
	const properties = node
		.slot()
		.split('\n')
		.map(line => /^([^:]+):\s*(.*)$/.exec(line))
		.filter(match => match !== null)

	return (
		<div ref={ref} className={`${className ?? ''} ${styles.properties}`} style={style}>
			{properties.map(([, name, propertyValue]) => (
				<Fragment key={name}>
					<span className={styles.propertyName}>{name}</span>
					<span className={styles.propertyValue}>{propertyValue}</span>
				</Fragment>
			))}
		</div>
	)
}