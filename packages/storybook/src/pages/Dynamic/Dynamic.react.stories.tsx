import {MarkedInput, useMark} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'

import {useCaretInfo} from '../../shared/hooks/useCaretInfo.react'

export default {
	title: 'MarkedInput/Mark',
	tags: ['autodocs'],
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<typeof MarkedInput>

const Mark = () => {
	const mark = useMark()
	return <mark>{mark.value}</mark>
}

export const Dynamic: Story = {
	args: {
		Mark,
		value: 'Hello, dynamical mark @[world]( )!',
	},
}

const RemovableMark = () => {
	const mark = useMark()
	return <mark onClick={() => mark.remove()}>{mark.value}</mark>
}

export const Removable: Story = {
	parameters: {docs: {disable: true}},
	args: {
		Mark: RemovableMark,
		value: 'I @[contain]( ) @[removable]( ) by click @[marks]( )!',
	},
}

const Abbr = () => {
	const mark = useMark()

	return (
		<abbr
			title={mark.meta}
			style={{
				outline: 'none',
				whiteSpace: 'pre-wrap',
			}}
		>
			{mark.value}
		</abbr>
	)
}

export const Focusable: Story = {
	parameters: {docs: {disable: true}, plainValue: 'right'},
	args: {
		Mark: Abbr,
		value: 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!',
	},
	decorators: [
		Story => {
			useCaretInfo(true)
			return <Story />
		},
	],
}

/*TODO
const Tag = () => {
    const mark = useMark()

    return createElement("mark", {
        contentEditable: true,
        suppressContentEditableWarning: true,
        children: mark.value,
        style: {
            outline: 'none',
            whiteSpace: 'pre-wrap'
        },
        onInput: (e: React.FormEvent<HTMLElement>) => {
            mark.update({value: e.currentTarget.textContent ?? ""})
        }
    })
}

export const RichEditor = () => {
    const [value, setValue] = useState(`<h4>Rich editor:>` +
        `<i>This page introduces a feature that has not yet been published.>

This feature allows you to use dynamic marks to edit itself and beyond.

It can be used to simulate a rich editor with <b>bold>, <i>italic>, <mark>marked>, <small>smaller>, <del>deleted>,
<ins>inserted>, <sub>subscript> and other types of text.`)

    return (
        <>
            <MarkedInput Mark={Tag} value={value} change={setValue}>
                <Option markup="<__label__>__value__>"/>
            </MarkedInput>

            <br/>
            <Text label="Plaint text:" value={value}/>
        </>
    )
}*/