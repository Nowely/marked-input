import type {ReactNode} from 'react'

import styles from '../theme/notion.module.css'

/** A palette slot, not a meaning: the caller maps its own statuses onto it. */
export type ChipTone = 'grey' | 'red' | 'amber' | 'green' | 'blue' | 'purple'

export interface ChipProps {
	tone?: ChipTone
	children: ReactNode
}

const TONE_CLASS: Record<ChipTone, string> = {
	grey: styles.chipGrey,
	red: styles.chipRed,
	amber: styles.chipAmber,
	green: styles.chipGreen,
	blue: styles.chipBlue,
	purple: styles.chipPurple,
}

/** Notion's pill: a label on a tinted background. `span`, because it also sits mid-sentence. */
export const Chip = ({tone = 'grey', children}: ChipProps) => <span className={TONE_CLASS[tone]}>{children}</span>