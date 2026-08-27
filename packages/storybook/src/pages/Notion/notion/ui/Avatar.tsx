import type {ChipTone} from '../vocabulary'
import {avatarTone, initialsOf} from '../vocabulary'

import styles from '../theme/notion.module.css'

export interface AvatarProps {
	name: string
	/** For a parent that owns the avatar's placement — the comment grid spans its avatar two rows. */
	className?: string
}

const TONE_CLASS: Record<ChipTone, string> = {
	grey: styles.avatarGrey,
	red: styles.avatarRed,
	amber: styles.avatarAmber,
	green: styles.avatarGreen,
	blue: styles.avatarBlue,
	purple: styles.avatarPurple,
}

/** The initials circle. `title` rather than `aria-label`: a bare `span` exposes no name to read it. */
export const Avatar = ({name, className}: AvatarProps) => {
	const toneClass = TONE_CLASS[avatarTone(name)]
	return (
		<span className={className ? `${toneClass} ${className}` : toneClass} title={name}>
			{initialsOf(name)}
		</span>
	)
}