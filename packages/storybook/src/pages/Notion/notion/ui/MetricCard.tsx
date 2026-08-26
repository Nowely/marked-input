import styles from '../theme/notion.module.css'

export interface MetricCardProps {
	label: string
	/** Pre-formatted — "4,120", "184ms", "99.4%". The card does no arithmetic. */
	value: string
}

/** A muted label above one large number. */
export const MetricCard = ({label, value}: MetricCardProps) => (
	<div className={styles.metricCard}>
		<span className={styles.metricLabel}>{label}</span>
		<span className={styles.metricValue}>{value}</span>
	</div>
)