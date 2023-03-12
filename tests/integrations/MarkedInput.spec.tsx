import '@testing-library/jest-dom'
import user from "@testing-library/user-event";
import {act, render} from "@testing-library/react";
import {MarkedInput} from "rc-marked-input";
import {Marked} from "storybook/stories/Base.stories";
import {Focusable, Removable} from "storybook/stories/Dynamic.stories";
import {useState} from "react";
import {vi, expect} from "vitest";
import {Markup} from "rc-marked-input/types";
import {MarkedInputHandler} from "rc-marked-input/components/Featurer/hooks/useMarkedInputHandler";

const Mark2 = ({initial, markup}: { initial: string, markup?: Markup }) => {
    const [value, setValue] = useState(initial)
    return <MarkedInput Mark={props => <mark>{props.label}</mark>} value={value} onChange={setValue} options={[{
        markup: markup ?? '@[__label__](__value__)', data: ["Item"]
    }]}/>
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

    it('should support ref focusing target', async () => {
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
        const selection = window.getSelection()!
        expect(selection).not.toBeNull()

        await user.pointer([{target: container, offset: 0, keys: '[MouseLeft>]'}, {offset: 8}])
        expect(selection.toString(), 'Outer div to cross inner mark').toBe(container.textContent?.slice(0, 8))

        const MarkedText = container.firstElementChild!
        const [span1, mark, span2] = MarkedText.children

        await user.pointer([{target: span1, offset: 0, keys: '[MouseLeft>]'}, {target: mark, offset: 2}])
        expect(selection.toString(), 'To mark from the start').toBe(container.textContent?.slice(0, 8))

        await user.pointer([{target: span2, keys: '[MouseLeft>]'}, {target: mark, offset: 2}])
        expect(selection.toString(), 'To mark from the end').toBe(container.textContent?.slice(8))

        await user.pointer([{target: span1, keys: '[MouseLeft>]'}, {target: mark, offset: 2}])
        expect(selection.toString(), 'To mark from before it').toBe(container.textContent?.slice(6, 8))

        await user.pointer([{target: span2, offset: 0, keys: '[MouseLeft>]'}, {target: mark, offset: 2}])
        expect(selection.toString(), 'To mark from after it').toBe(container.textContent?.slice(8, 10))

        await user.pointer([{target: mark, offset: 2, keys: '[MouseLeft>]'}, {target: span1, offset: 2}])
        expect(selection.toString(), 'To span 1 from mark').toBe(container.textContent?.slice(2, 8))

        await user.pointer([{target: mark, offset: 2, keys: '[MouseLeft>]'}, {target: span2, offset: 1}])
        expect(selection.toString(), 'To span 2 from mark').toBe(container.textContent?.slice(8))


        await user.pointer([{target: span1, offset: 2, keys: '[MouseLeft>]'}, {offset: 4}, {offset: 2}])
        expect(selection.isCollapsed).toBeTruthy()
        await user.keyboard('abc')
        expect(span1, 'Span stay editable after collapse inner selection').toHaveTextContent(/abc/)
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

    it('should to support the ref prop', async () => {
        let ref: MarkedInputHandler | null = null

        render(<MarkedInput ref={(el) => ref = el} Mark={() => null} value={''} onChange={() => ({})}/>)

        await act(() => {
            expect(ref?.container).not.toBeNull()
        })
    })
})