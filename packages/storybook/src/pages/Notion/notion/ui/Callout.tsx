import type {ReactNode} from 'react'

import type {CalloutTone} from '../vocabulary'
import {calloutTone} from '../vocabulary'

import styles from '../theme/notion.module.css'

export type {CalloutTone}

export interface CalloutProps {
	/** A tone. A name outside the set is drawn neutral rather than dropping the row. */
	tone?: string
	/** The icon slot — an emoji, a glyph, anything renderable. */
	icon?: ReactNode
	children: ReactNode
}

const TONE_CLASS: Record<CalloutTone, string> = {
	neutral: styles.callout,
	info: styles.calloutInfo,
	success: styles.calloutSuccess,
	warning: styles.calloutWarning,
	danger: styles.calloutDanger,
}

/** A tinted wash with an icon on the left. The icon is not hidden from readers: in a warning it carries the warning. */
export const Callout = ({tone = 'neutral', icon, children}: CalloutProps) => (
	<div className={TONE_CLASS[calloutTone(tone)]}>
		{icon !== undefined && <span className={styles.calloutIcon}>{icon}</span>}
		<div className={styles.calloutBody}>{children}</div>
	</div>
)