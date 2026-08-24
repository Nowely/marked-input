import type {MarkProps} from '@markput/react'
import {Fragment} from 'react'

import styles from './notion.module.css'

/**
 * The document's YAML frontmatter, rendered as Notion's properties panel.
 *
 * The mark is atomic — its markup is `__value__`-only, so core gives it no editable children
 * and the panel is read-only (`docs/scratch/backlog/issues/01-editable-mark-values.md`).
 *
 * It splits its own interior on `key: value` because a mark receives one opaque string and
 * nothing more: the parser has no way to hand over structure (notion-like issue 02). A real
 * YAML parser drops in here unchanged once that shape is worth keeping.
 */
export const PropertiesMark = ({value = ''}: MarkProps) => {
	const properties = value
		.split('\n')
		.map(line => /^([^:]+):\s*(.*)$/.exec(line))
		.filter(match => match !== null)

	return (
		<div className={styles.properties}>
			{properties.map(([, name, propertyValue]) => (
				<Fragment key={name}>
					<span className={styles.propertyName}>{name}</span>
					<span className={styles.propertyValue}>{propertyValue}</span>
				</Fragment>
			))}
		</div>
	)
}