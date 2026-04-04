import {MarkedInput, useMark} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, ref, onMounted, watch, type ComponentPublicInstance} from 'vue'

export default {
	title: 'MarkedInput/Mark',
	tags: ['autodocs'],
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

const DynamicMark = defineComponent({
	setup() {
		const mark = useMark()
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
					// oxlint-disable-next-line no-unsafe-type-assertion
					elRef.value = el as HTMLElement | null
					// oxlint-disable-next-line no-unsafe-type-assertion
					mark.ref.current = el as HTMLElement | null
				},
				contentEditable: true,
			})
	},
})

export const Dynamic: Story = {
	args: {
		Mark: DynamicMark,
		defaultValue: 'Hello, dynamical mark @[world]( )!',
	},
}

const RemovableMark = defineComponent({
	setup() {
		const mark = useMark()
		return () => h('mark', {onClick: () => mark.remove()}, mark.value)
	},
})

export const Removable: Story = {
	args: {
		Mark: RemovableMark,
		defaultValue: 'I @[contain]( ) @[removable]( ) by click @[marks]( )!',
	},
}

const Abbr = defineComponent({
	setup() {
		const mark = useMark()
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
					// oxlint-disable-next-line no-unsafe-type-assertion
					elRef.value = el as HTMLElement | null
					// oxlint-disable-next-line no-unsafe-type-assertion
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
	parameters: {plainValue: 'right'},
	args: {
		Mark: Abbr,
		value: 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!',
	},
}