import type {ReactNode} from 'react'

import type {ChipTone} from '../vocabulary'
import {chipTone} from '../vocabulary'

import styles from '../theme/notion.module.css'

export type {ChipTone}

export interface ChipProps {
	/** A palette slot. A name outside it is drawn grey rather than dropping what carries it. */
	tone?: string
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
export const Chip = ({tone = 'grey', children}: ChipProps) => (
	<span className={TONE_CLASS[chipTone(tone)]}>{children}</span>
)