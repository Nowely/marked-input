import styles from '../theme/notion.module.css'

export interface EffortBarProps {
	/** A fraction, 0..1. Anything outside is clamped rather than refused. */
	value: number
	/** Hover text. The bar reads as a picture of the number, so the number is spelled out here. */
	label?: string
}

/**
 * A filled track: two elements, because the theme's fill is a box whose WIDTH the component sets
 * (`.effortBarFill`) — a value, not a colour, and the one thing set inline here.
 *
 * No `role="progressbar"`: the lint rule sends that role to a native `<progress>`, and `<progress>`
 * is a replaced element the theme's track/fill pair cannot dress. The bar is left as decoration
 * beside a cell the table already names, rather than carrying a role its markup will not honour.
 */
export const EffortBar = ({value, label}: EffortBarProps) => {
	const fraction = Math.min(1, Math.max(0, value))

	return (
		<span className={styles.effortBar} title={label}>
			<span className={styles.effortBarFill} style={{width: `${(fraction * 100).toFixed(1)}%`}} />
		</span>
	)
}