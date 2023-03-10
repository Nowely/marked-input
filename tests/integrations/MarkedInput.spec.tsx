import '@testing-library/jest-dom'
import user from "@testing-library/user-event";
import {act, render} from "@testing-library/react";
import {MarkedInput, Option} from "rc-marked-input";
import {Marked} from "storybook/stories/Base.stories";
import {Focusable, Removable} from "storybook/stories/Dynamic.stories";
import {useState} from "react";
import {vi} from "vitest";
import {Markup} from "rc-marked-input/types";

const Mark2 = ({initial, markup}: { initial: string, markup?: Markup }) => {
    const [value, setValue] = useState(initial)
    return <MarkedInput Mark={props => <mark>{props.label}</mark>} value={value} onChange={setValue}>
        <Option markup={markup ?? '@[__label__](__value__)'} data={["Item"]}/>
    </MarkedInput>
}

describe(`Component: ${MarkedInput.name}`, () => {
    it('should render', () => {
        render(<Marked/>);
    })

    it('should support the "Backspace" button', async () => {
        const {container} = render(<Mark2 initial="Hello @[mark](1)!"/>)
        const [firstSpan, secondSpan] = container.querySelectorAll("span")

        //Used for focused
        await user.type(secondSpan, '{ArrowRight}')
        expect(secondSpan).toHaveFocus()

        await user.keyboard("{Backspace}")
        expect(secondSpan).toHaveTextContent("")


        expect(container.querySelector("mark")).toBeInTheDocument()
        await user.keyboard("{Backspace}")
        expect(secondSpan).not.toBeInTheDocument()
        expect(container.querySelector("mark")).toBeNull()

        expect(firstSpan).toHaveTextContent("Hello ", {normalizeWhitespace: false})
        await user.keyboard("{Backspace>7/}")
        expect(firstSpan).toHaveTextContent("")
    })

    it('should support the "Delete" button', async () => {
        const {container} = render(<Mark2 initial="Hello @[mark](1)!"/>)
        const [firstSpan, secondSpan] = container.querySelectorAll("span")

        //Used for focused
        await user.type(firstSpan, '{ArrowLeft}', {initialSelectionStart: 0})
        expect(firstSpan).toHaveFocus()

        await user.keyboard("{Delete>6/}")
        expect(firstSpan).toHaveTextContent("")

        expect(container.querySelector("mark")).toBeInTheDocument()
        await user.keyboard("{Delete}")
        expect(firstSpan).not.toBeInTheDocument()
        expect(container.querySelector("mark")).toBeNull()

        expect(secondSpan).toHaveFocus()
        expect(secondSpan).toHaveTextContent("!")
        await user.keyboard("{Delete>2/}")
        expect(secondSpan).toHaveTextContent("")
    })

    it('should support focus changing', async () => {
        const {container} = render(<Mark2 initial="Hello @[mark](1)!"/>)
        const [firstSpan, secondSpan] = container.querySelectorAll("span")
        const firstSpanLength = firstSpan.textContent?.length ?? 0

        //Used for focused
        await user.type(firstSpan, '{ArrowLeft}', {initialSelectionStart: 0})
        expect(firstSpan).toHaveFocus()

        await user.keyboard(`{ArrowRight>${firstSpanLength + 1}/}`)
        expect(secondSpan).toHaveFocus()

        await user.keyboard(`{ArrowLeft>1/}`)
        expect(firstSpan).toHaveFocus()
    })

    it('should appear a overlay component by trigger', async () => {
        //override event listener because 'selectionchange' don't work in here
        let events: Record<string, EventListenerOrEventListenerObject> = {};
        document.addEventListener = vi.fn((event, callback) => events[event] = callback);
        document.removeEventListener = vi.fn((event, callback) => delete events[event]);

        const {getByText, findByText} = render(<Mark2 initial="@ @[mark](1)!"/>)
        const span = getByText(/@/i)

        //Used for focused
        await user.type(span, '{ArrowLeft}', {initialSelectionStart: 0})
        expect(span).toHaveFocus()
        await user.pointer({target: span, offset: 1, keys: '[MouseLeft]'})

        await act(() => {
            // @ts-ignore
            events['selectionchange']()
        });

        expect(await findByText("Item")).toBeInTheDocument()
    })

    it('should correct process an annotation type', async () => {
        const {container, queryByText} = render(<Mark2 initial=""/>)
        const [span] = container.querySelectorAll("span")
        expect(span).toHaveTextContent("")
        await user.type(span, '@[[mark](1)')
        expect(await queryByText('@[mark](1)')).toBeNull()
        expect(await queryByText('mark')).toBeInTheDocument()
    })

    it('should support reg focusing target', async () => {
        const {container} = render(<Focusable/>)
        const [firstSpan, secondSpan] = container.querySelectorAll("span")
        const [firstAbbr] = container.querySelectorAll("abbr")
        const firstSpanLength = firstSpan.textContent?.length ?? 0
        const firstAbbrLength = firstAbbr.textContent?.length ?? 0

        //Used for focused
        await user.type(firstSpan, '{ArrowLeft}', {initialSelectionStart: 0})
        expect(firstSpan).toHaveFocus()

        await user.keyboard(`{ArrowRight>${firstSpanLength + 1}/}`)
        expect(firstAbbr).toHaveFocus()

        await user.keyboard(`{ArrowLeft>1/}`)
        expect(firstSpan).toHaveFocus()

        await user.keyboard(`{ArrowRight>1/}`)
        expect(firstAbbr).toHaveFocus()

        await user.keyboard(`{ArrowRight>${firstAbbrLength + 1}/}`)
        expect(secondSpan).toHaveFocus()

        await user.keyboard(`{ArrowLeft>1/}`)
        expect(firstAbbr).toHaveFocus()
    })

    it('should support remove itself', async () => {
        const {getByText, queryByText} = render(<Removable/>)

        let mark = getByText('contain')
        await user.click(mark)
        expect(await queryByText('contain')).toBeNull()

        mark = getByText('marks')
        await user.click(mark)
        expect(await queryByText('marks')).toBeNull()
    })

    it('should support editable marks', async () => {
        const {getByText} = render(<Focusable/>)

        await user.type(getByText('world'), '123')

        expect(getByText('world123')).toBeInTheDocument()
        expect(getByText(/@\[world123]\(Hello! Hello!\)/)).toBeInTheDocument()
    })

    it('should be selectable', async () => {
        const {container} = render(<Mark2 initial="Hello @[mark](1)!"/>)
        user.pointer({})
    })

    it('it should select all text by shortcut "cmd + a"', async () => {
        const {container} = render(<Mark2 initial="Hello @[mark](1)!"/>)
        const [span] = container.querySelectorAll("span")

        //Used for focused
        await user.type(span, '{ArrowLeft}', {initialSelectionStart: 0})

        expect(window.getSelection()?.toString()).toBe('')

        await user.type(span, '{Control>}a{/Control}')
        expect(window.getSelection()?.toString()).toBe(container.textContent)

        await user.type(span, '{Control>}A{/Control}')
        expect(window.getSelection()?.toString()).toBe(container.textContent)
    })
})