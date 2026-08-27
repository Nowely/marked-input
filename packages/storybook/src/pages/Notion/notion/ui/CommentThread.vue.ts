import {defineComponent} from 'vue'

import {Avatar} from './Avatar'

import styles from '../theme/notion.module.css'

export interface CommentThreadProps {
	/** The entry shape is inlined on purpose: it is this component's argument, not a shared type. */
	comments: readonly {author: string; timestamp: string; body: string}[]
	replyLabel?: string
}

/** Avatar, author, relative time, body — then the muted affordance that starts the next one. */
export const CommentThread = defineComponent({
	name: 'CommentThread',
	components: {Avatar},
	props: {
		comments: {type: Array as () => readonly {author: string; timestamp: string; body: string}[], required: true},
		replyLabel: {type: String, default: 'Reply…'},
	},
	emits: ['reply'],
	setup: () => ({styles}),
	template: `
		<div :class="styles.commentThread">
			<div
				v-for="comment in comments"
				:key="comment.author + ' ' + comment.timestamp"
				:class="styles.comment"
			>
				<Avatar :class-name="styles.commentAvatar" :name="comment.author" />
				<div :class="styles.commentHeader">
					<span :class="styles.commentAuthor">{{ comment.author }}</span>
					<span :class="styles.commentTimestamp">{{ comment.timestamp }}</span>
				</div>
				<div :class="styles.commentBody">{{ comment.body }}</div>
			</div>
			<button :class="styles.commentReply" type="button" @click="$emit('reply')">{{ replyLabel }}</button>
		</div>
	`,
})