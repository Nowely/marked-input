import {Fragment} from 'react'

import styles from '../theme/notion.module.css'

export interface PageChromeProps {
	/** "Product / Launches / Apollo" as its parts; the slashes are drawn, not typed. */
	breadcrumb: readonly string[]
	editedLabel: string
	onShare?: () => void
	onMore?: () => void
}

/** The bar above the cover: where the page is, when it changed, and what can be done to it. */
export const PageChrome = ({breadcrumb, editedLabel, onShare, onMore}: PageChromeProps) => (
	<div className={styles.topBar}>
		{breadcrumb.map((crumb, index) => (
			<Fragment key={crumb}>
				{index > 0 && <span className={styles.breadcrumbSeparator}>/</span>}
				<span className={styles.breadcrumbItem}>{crumb}</span>
			</Fragment>
		))}
		<div className={styles.topBarActions}>
			<span className={styles.topBarStatus}>{editedLabel}</span>
			<button className={styles.topBarButton} onClick={onShare} type="button">
				Share
			</button>
			{/* Icon-only, so the name has to come from somewhere: an ellipsis reads as nothing. */}
			<button aria-label="More actions" className={styles.topBarButton} onClick={onMore} type="button">
				…
			</button>
		</div>
	</div>
)