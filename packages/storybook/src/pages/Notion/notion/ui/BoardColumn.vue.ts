import {defineComponent, ref} from 'vue'

import styles from '../theme/notion.module.css'

export interface BoardColumnProps {
	title: string
	/** Rendered as given. The board that owns the cards decides whether that is `cards.length`. */
	count: number
	/** Does this column take drops at all. */
	droppable?: boolean
}

/** A titled drop target. The highlight is its own state — nobody outside needs to know about it. */
export const BoardColumn = defineComponent({
	name: 'BoardColumn',
	props: {
		title: {type: String, required: true},
		count: {type: Number, required: true},
		droppable: {type: Boolean, default: true},
	},
	emits: ['cardDrop'],
	setup(props, {emit}) {
		const isOver = ref(false)

		const handleDragOver = (event: DragEvent) => {
			if (!props.droppable) return
			// The only way to say "a drop is allowed here"; without it `drop` never fires.
			event.preventDefault()
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
			isOver.value = true
		}

		// `dragleave` also fires when the pointer crosses INTO a child, which would flicker the
		// highlight off on every card it passes over.
		const handleDragLeave = (event: DragEvent) => {
			const {relatedTarget, currentTarget} = event
			if (
				relatedTarget instanceof Node &&
				currentTarget instanceof Node &&
				currentTarget.contains(relatedTarget)
			) {
				return
			}
			isOver.value = false
		}

		const handleDrop = (event: DragEvent) => {
			if (!props.droppable) return
			event.preventDefault()
			isOver.value = false
			emit('cardDrop')
		}

		return {styles, isOver, handleDragOver, handleDragLeave, handleDrop}
	},
	template: `
		<div
			:class="isOver ? styles.boardColumnDropTarget : styles.boardColumn"
			@dragleave="handleDragLeave"
			@dragover="handleDragOver"
			@drop="handleDrop"
		>
			<div :class="styles.boardColumnHeader">
				<span>{{ title }}</span>
				<span :class="styles.boardColumnCount">{{ count }}</span>
			</div>
			<slot />
		</div>
	`,
})