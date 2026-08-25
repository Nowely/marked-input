import styles from '../theme/notion.module.css'

export interface BookmarkCardProps {
	title: string
	description: string
	url: string
}

/**
 * The card is NOT an anchor. `.bookmark` resets neither `text-decoration` nor `color`, which is the
 * theme saying it never expected one — and an `<a>` inside the editing host is a click target that
 * fights the caret. The url is shown, not followed.
 *
 * Spans rather than divs, for the same reason: a block box in an inline context splits the line
 * the row is drawing.
 */
export const BookmarkCard = ({title, description, url}: BookmarkCardProps) => (
	<div className={styles.bookmark}>
		<span className={styles.bookmarkBody}>
			<span className={styles.bookmarkTitle}>{title}</span>
			<span className={styles.bookmarkDescription}>{description}</span>
			<span className={styles.bookmarkUrl}>{url}</span>
		</span>
		<span className={styles.bookmarkThumbnail} />
	</div>
)