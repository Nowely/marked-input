import type {ReactNode} from 'react'

import styles from '../theme/notion.module.css'

export type CalloutTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface CalloutProps {
	tone?: CalloutTone
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
	<div className={TONE_CLASS[tone]}>
		{icon !== undefined && <span className={styles.calloutIcon}>{icon}</span>}
		<div className={styles.calloutBody}>{children}</div>
	</div>
)