import {MarkedInput, useMark} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import {useEffect} from 'react'

import {useCaretInfo} from '../../shared/hooks/useCaretInfo'

export default {
	title: 'MarkedInput/Mark',
	tags: ['autodocs'],
	component: MarkedInput,
} satisfies Meta<typeof MarkedInput>

type Story = StoryObj<typeof MarkedInput>

const Mark = () => {
	const {value, ref} = useMark()

	useEffect(() => {
		if (ref.current) ref.current.textContent = value ?? null
	}, [value, ref])

	return <mark ref={ref} contentEditable />
}

export const Dynamic: Story = {
	args: {
		Mark,
		value: 'Hello, dynamical mark @[world]( )!',
	},
}

const RemovableMark = () => {
	const {value, remove} = useMark()
	return <mark onClick={remove} children={value} />
}

export const Removable: Story = {
	parameters: {docs: {disable: true}},
	args: {
		Mark: RemovableMark,
		value: 'I @[contain]( ) @[removable]( ) by click @[marks]( )!',
	},
}

const Abbr = () => {
	const {value, meta, ref} = useMark()

	useEffect(() => {
		if (ref.current) ref.current.textContent = value ?? null
	}, [value, ref])

	return (
		<abbr
			ref={ref}
			title={meta}
			contentEditable
			style={{
				outline: 'none',
				whiteSpace: 'pre-wrap',
			}}
		/>
	)
}

export const Focusable: Story = {
	parameters: {docs: {disable: true}, plainValue: true},
	args: {
		Mark: Abbr,
		value: 'Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!',
	},
	render: args => {
		useCaretInfo(true)
		return <MarkedInput {...args} />
	},
}

/*TODO
const Tag = () => {
    const {reg, label, value, change} = useMark()

    return createElement(label, {
        ref: reg,
        contentEditable: true,
        suppressContentEditableWarning: true,
        children: value,
        style: {
            outline: 'none',
            whiteSpace: 'pre-wrap'
        },
        onInput: (e: React.FormEvent<HTMLElement>) => {
            change({label, value: e.currentTarget.textContent ?? ""}, {silent: true})
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