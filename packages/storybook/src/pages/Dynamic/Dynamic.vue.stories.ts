import {MarkedInput, useMark} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h} from 'vue'

export default {
	title: 'MarkedInput/Mark',
	tags: ['autodocs'],
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

const DynamicMark = defineComponent({
	setup() {
		const mark = useMark()
		return () => h('mark', mark.value)
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

		return () =>
			h(
				'abbr',
				{
					title: mark.meta,
					style: {
						outline: 'none',
						whiteSpace: 'pre-wrap',
					},
				},
				mark.value
			)
	},
})

export const Focusable: Story = {
	parameters: {plainValue: 'right'},
	args: {
		Mark: Abbr,
		value: 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!',
	},
}