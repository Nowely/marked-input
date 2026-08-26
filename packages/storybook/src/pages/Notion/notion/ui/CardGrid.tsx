import type {ReactNode} from 'react'

import styles from '../theme/notion.module.css'

export interface CardGridProps {
	children: ReactNode
}

/** The responsive row of cards: as many columns as fit, then it wraps. */
export const CardGrid = ({children}: CardGridProps) => <div className={styles.cardGrid}>{children}</div>