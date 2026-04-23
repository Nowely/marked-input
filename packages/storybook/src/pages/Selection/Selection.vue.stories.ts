import {MarkedInput} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h} from 'vue'

export default {
	title: 'Selection',
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<Meta<typeof MarkedInput>>

const TestMark = defineComponent({
	props: {value: String, meta: String},
	setup(props) {
		return () => h('mark', {'data-testid': 'mark'}, props.value)
	},
})

export const Inline: Story = {
	args: {
		Mark: TestMark,
		defaultValue: 'hello @[world](1) foo',
	},
}

export const Drag: Story = {
	args: {
		layout: 'block',
		draggable: true,
		Mark: TestMark,
		defaultValue: 'hello\n@[world](1)\nfoo',
	},
}