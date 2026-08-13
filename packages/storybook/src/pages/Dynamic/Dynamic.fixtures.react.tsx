import {useMark} from '@markput/react'
import type {Decorator} from '@storybook/react'

import {useCaretInfo} from '../../shared/hooks/useCaretInfo.react'

/** Debug aid with no Vue counterpart: a tooltip on `document.body`, outside the story container. */
const withCaretInfo: Decorator = Story => {
	useCaretInfo(true)
	return <Story />
}

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Dynamic.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 *
 * Every mark here is prop-less and reads through `useMark()`, which is what the page is about.
 */
export const fixtures = {
	Dynamic: () => {
		const mark = useMark()
		return <mark>{mark.value()}</mark>
	},
	Removable: () => {
		const mark = useMark()
		return <mark onClick={() => mark.remove()}>{mark.value()}</mark>
	},
	Focusable: () => {
		const mark = useMark()
		return (
			<abbr title={mark.meta()} style={{outline: 'none', whiteSpace: 'pre-wrap'}}>
				{mark.value()}
			</abbr>
		)
	},
	/** Only the react instance hides these stories from its docs page. */
	hiddenFromDocs: {docs: {disable: true}},
	caretInfo: [withCaretInfo],
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