import {MarkedInput} from '@markput/vue'
import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h, ref} from 'vue'

export default {
	title: 'Clipboard',
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

function PlainTextInput() {
	return defineComponent({
		setup() {
			const value = ref('abc')
			return () =>
				h(MarkedInput, {
					Mark: TestMark,
					value: value.value,
					onChange: (v: string) => {
						value.value = v
					},
				})
		},
	})
}

export const PlainText: Story = {
	render: () => PlainTextInput(),
}

export const Drag: Story = {
	args: {
		layout: 'block',
		draggable: true,
		Mark: TestMark,
		defaultValue: 'hello\n@[world](1)\nfoo',
	},
}

const NestedMark = defineComponent({
	props: {value: String, meta: String},
	setup(props) {
		const mid = Math.ceil((props.value ?? '').length / 2)
		return () =>
			h('mark', {'data-testid': 'mark'}, [
				h('strong', (props.value ?? '').slice(0, mid)),
				h('em', (props.value ?? '').slice(mid)),
			])
	},
})

export const NestedMarkStory: Story = {
	args: {
		Mark: NestedMark,
		defaultValue: 'hello @[world](1) foo',
	},
}