<script setup lang="ts">
import {computed, type Ref} from 'vue'
import type {CoreSlotProps, CoreSlots} from '@markput/core'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {useMark} from '../lib/hooks/useMark'
import {useStore} from '../lib/hooks/useStore'

const mark = useMark()
const store = useStore()
const slots = store.state.slots.use() as unknown as Ref<CoreSlots | undefined>
const slotProps = store.state.slotProps.use() as unknown as Ref<CoreSlotProps | undefined>
const spanTag = computed(() => resolveSlot('span', slots.value))
const spanProps = computed(() => resolveSlotProps('span', slotProps.value))

function handlePaste(e: ClipboardEvent) {
	e.preventDefault()
	const text = e.clipboardData?.getData('text')
	if (text) document.execCommand('insertText', false, text)
}
</script>

<template>
	<component
		:is="spanTag"
		:ref="
			(el: any) => {
				if (mark.ref) (mark.ref as any).current = el
			}
		"
		v-bind="spanProps"
		:contenteditable="!mark.readOnly"
		@paste="handlePaste"
	/>
</template>
