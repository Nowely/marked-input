import {MarkedInput, useMark} from 'rc-marked-input'
import {FormEvent, useEffect, useState} from 'react'
import {Text} from '../assets/Text'

export default {
	title: 'MarkedInput/Mark',
	tags: ['autodocs'],
	component: MarkedInput,
}

const Mark = () => {
	const {label, change, ref} = useMark()

	useEffect(() => {
		if (ref.current)
			ref.current.textContent = label
	}, [])

	return <mark ref={ref} contentEditable/>
}

export const Dynamic = () => {
	const [value, setValue] = useState('Hello, dynamical mark @[world]( )!')
	return <MarkedInput Mark={Mark} value={value} onChange={setValue}/>
}

const RemovableMark = () => {
	const {label, remove} = useMark()
	return <mark onClick={remove} children={label}/>
}

export const Removable = () => {
	const [value, setValue] = useState('I @[contain]( ) @[removable]( ) by click @[marks]( )!')
	return <MarkedInput Mark={RemovableMark} value={value} onChange={setValue}/>
}

const Abbr = () => {
	const {label, value, ref, change} = useMark()

	const handleInput = (e: FormEvent<HTMLSpanElement>) => {
		const label = e.currentTarget.textContent ?? ''
		change({label, value}, {silent: true})
	}

	return (
		<abbr
			ref={ref}
			title={value}
			contentEditable
			style={{
				outline: 'none',
				whiteSpace: 'pre-wrap'
			}}
			suppressContentEditableWarning
			onInput={handleInput}
			children={label}
		/>
	)
}

export const Focusable = () => {
	const [value, setValue] = useState('Hello, @[focusable](By key operations) abbreviation @[world](Hello! Hello!)!')
	return (
		<>
			<MarkedInput Mark={Abbr} value={value} onChange={setValue}/>
			<Text label="Plaint text:" value={value}/>
		</>
	)
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
