import type {ChipTone} from './Chip'

import styles from '../theme/notion.module.css'

export interface AvatarProps {
	name: string
	/** For a parent that owns the avatar's placement — the comment grid spans its avatar two rows. */
	className?: string
}

const TONES: readonly ChipTone[] = ['grey', 'red', 'amber', 'green', 'blue', 'purple']

const TONE_CLASS: Record<ChipTone, string> = {
	grey: styles.avatarGrey,
	red: styles.avatarRed,
	amber: styles.avatarAmber,
	green: styles.avatarGreen,
	blue: styles.avatarBlue,
	purple: styles.avatarPurple,
}

const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.filter(part => part.length > 0)
		.slice(0, 2)
		.map(part => part.charAt(0).toUpperCase())
		.join('')

/**
 * Same name, same colour, on every page and in any order — a sum over the code units, not a
 * counter, so a stack rendered twice does not recolour itself.
 */
const toneOf = (name: string): ChipTone => {
	let hash = 0
	for (let index = 0; index < name.length; index += 1) {
		hash = (hash * 31 + name.charCodeAt(index)) % 1000003
	}
	return TONES[hash % TONES.length]
}

/** The initials circle. `title` rather than `aria-label`: a bare `span` exposes no name to read it. */
export const Avatar = ({name, className}: AvatarProps) => {
	const toneClass = TONE_CLASS[toneOf(name)]
	return (
		<span className={className ? `${toneClass} ${className}` : toneClass} title={name}>
			{initialsOf(name)}
		</span>
	)
}