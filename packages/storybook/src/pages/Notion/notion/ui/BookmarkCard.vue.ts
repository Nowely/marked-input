import {defineComponent} from 'vue'

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
 */
export const BookmarkCard = defineComponent({
	name: 'BookmarkCard',
	props: {
		title: {type: String, required: true},
		description: {type: String, required: true},
		url: {type: String, required: true},
	},
	setup: () => ({styles}),
	template: `
		<div :class="styles.bookmark">
			<span :class="styles.bookmarkBody">
				<span :class="styles.bookmarkTitle">{{ title }}</span>
				<span :class="styles.bookmarkDescription">{{ description }}</span>
				<span :class="styles.bookmarkUrl">{{ url }}</span>
			</span>
			<span :class="styles.bookmarkThumbnail" />
		</div>
	`,
})