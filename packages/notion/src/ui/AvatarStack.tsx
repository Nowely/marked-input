import {Avatar} from './Avatar'

import styles from '../theme/notion.module.css'

export interface AvatarStackProps {
	names: readonly string[]
	/** How many circles to draw. Whoever is left over becomes the "+N others" tail. */
	max?: number
}

/** Overlapping initials circles, with the overflow spelled out rather than drawn. */
export const AvatarStack = ({names, max = names.length}: AvatarStackProps) => {
	const shown = names.slice(0, max)
	const others = names.length - shown.length

	return (
		<span className={styles.avatarStack}>
			{shown.map(name => (
				<Avatar key={name} name={name} />
			))}
			{others > 0 && <span className={styles.avatarStackTail}>+{others} others</span>}
		</span>
	)
}