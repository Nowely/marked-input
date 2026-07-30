import type {Meta, StoryObj} from '@storybook/vue3-vite'
import {defineComponent, h} from 'vue'

import {MarkedInputStory} from '../../shared/lib/markedInput.vue'

export default {
	title: 'Selection',
	component: MarkedInputStory,
} satisfies Meta<typeof MarkedInputStory>

type Story = StoryObj<Meta<typeof MarkedInputStory>>

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