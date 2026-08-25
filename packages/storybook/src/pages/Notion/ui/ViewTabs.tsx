import styles from '../theme/notion.module.css'

export interface ViewTabsProps {
	tabs: readonly string[]
	active: string
	onSelect?: (tab: string) => void
	actions?: readonly string[]
	onAction?: (action: string) => void
}

const DEFAULT_ACTIONS: readonly string[] = ['Filter', 'Sort', 'New']

/**
 * The inline database's view bar. `role=tablist` sits on the tabs alone, not on the bar: Filter,
 * Sort and New are commands, and calling them tabs would be a claim the widget does not honour.
 * No `aria-controls` either — the panel a tab governs is the caller's, not this component's.
 */
export const ViewTabs = ({tabs, active, onSelect, actions = DEFAULT_ACTIONS, onAction}: ViewTabsProps) => (
	<div className={styles.viewTabBar}>
		<div className={styles.viewTabList} role="tablist">
			{tabs.map(tab => (
				<button
					aria-selected={tab === active}
					className={tab === active ? styles.viewTabActive : styles.viewTab}
					key={tab}
					onClick={() => onSelect?.(tab)}
					role="tab"
					type="button"
				>
					{tab}
				</button>
			))}
		</div>
		<div className={styles.viewTabActions}>
			{actions.map(action => (
				<button className={styles.viewTabAction} key={action} onClick={() => onAction?.(action)} type="button">
					{action}
				</button>
			))}
		</div>
	</div>
)