import {MarkedInput, useMark} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, ref, onMounted, watch, type ComponentPublicInstance} from 'vue'

import Text from '../../shared/components/Text.vue'

export default {
	title: 'MarkedInput/Mark',
	tags: ['autodocs'],
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

const DynamicMark = defineComponent({
	setup() {
		const mark = useMark<HTMLElement>()
		const elRef = ref<HTMLElement | null>(null)

		onMounted(() => {
			if (elRef.value) elRef.value.textContent = mark.value ?? null
		})

		watch(
			() => mark.value,
			val => {
				if (elRef.value) elRef.value.textContent = val ?? null
			}
		)

		return () =>
			h('mark', {
				ref: (el: Element | ComponentPublicInstance | null) => {
					elRef.value = el as HTMLElement | null
					mark.ref.current = el as HTMLElement | null
				},
				contentEditable: true,
			})
	},
})

export const Dynamic: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('Hello, dynamical mark @[world]( )!')
				return () =>
					h(MarkedInput, {
						Mark: DynamicMark,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
					})
			},
		}),
}

const RemovableMark = defineComponent({
	setup() {
		const mark = useMark()
		return () => h('mark', {onClick: () => mark.remove()}, mark.value)
	},
})

export const Removable: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('I @[contain]( ) @[removable]( ) by click @[marks]( )!')
				return () =>
					h(MarkedInput, {
						Mark: RemovableMark,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
					})
			},
		}),
}

const Abbr = defineComponent({
	setup() {
		const mark = useMark<HTMLElement>()
		const elRef = ref<HTMLElement | null>(null)

		onMounted(() => {
			if (elRef.value) elRef.value.textContent = mark.value ?? null
		})

		watch(
			() => mark.value,
			val => {
				if (elRef.value) elRef.value.textContent = val ?? null
			}
		)

		return () =>
			h('abbr', {
				ref: (el: Element | ComponentPublicInstance | null) => {
					elRef.value = el as HTMLElement | null
					mark.ref.current = el as HTMLElement | null
				},
				title: mark.meta,
				contentEditable: true,
				style: {
					outline: 'none',
					whiteSpace: 'pre-wrap',
				},
			})
	},
})

export const Focusable: Story = {
	render: () =>
		defineComponent({
			setup() {
				const value = ref('Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!')
				return () => [
					h(MarkedInput, {
						Mark: Abbr,
						value: value.value,
						onChange: (v: string) => {
							value.value = v
						},
					}),
					h(Text, {label: 'Plain text:', value: value.value}),
				]
			},
		}),
}