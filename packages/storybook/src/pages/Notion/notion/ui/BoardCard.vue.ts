import {defineComponent, ref} from 'vue'

import type {ChipTone} from '../vocabulary'
import {Chip} from './Chip'

import styles from '../theme/notion.module.css'

export interface BoardCardProps {
	title: string
	tag?: {label: string; tone: ChipTone}
}

/**
 * A draggable board card. It owns the HTML5 drag source and nothing else: no document listener,
 * no focus call, and `preventDefault` only where the drop protocol demands it (in `BoardColumn`,
 * on `dragover`).
 */
export const BoardCard = defineComponent({
	name: 'BoardCard',
	components: {Chip},
	props: {
		title: {type: String, required: true},
		tag: {type: Object as () => {label: string; tone: ChipTone} | undefined, default: undefined},
	},
	emits: ['dragStart', 'dragEnd'],
	setup(props, {emit}) {
		const dragging = ref(false)

		const handleDragStart = (event: DragEvent) => {
			// Firefox starts no drag at all unless the transfer carries a payload.
			event.dataTransfer?.setData('text/plain', props.title)
			if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
			dragging.value = true
			emit('dragStart')
		}

		const handleDragEnd = () => {
			dragging.value = false
			emit('dragEnd')
		}

		return {styles, dragging, handleDragStart, handleDragEnd}
	},
	template: `
		<div
			:class="dragging ? styles.boardCardDragging : styles.boardCardDraggable"
			draggable="true"
			@dragend="handleDragEnd"
			@dragstart="handleDragStart"
		>
			<span :class="styles.boardCardTitle">{{ title }}</span>
			<Chip v-if="tag !== undefined" :tone="tag.tone">{{ tag.label }}</Chip>
		</div>
	`,
})