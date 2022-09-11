import '@testing-library/jest-dom'
import user from "@testing-library/user-event";
import {act, render} from "@testing-library/react";
import {MarkedInput, Option} from "rc-marked-input";
import {Marked} from "storybook/stories/Base.stories";
import {useState} from "react";

const Mark2 = ({initial}: { initial: string }) => {
    const [value, setValue] = useState(initial)
    return <MarkedInput Mark={props => <mark>{props.label}</mark>} value={value} onChange={setValue}>
        <Option data={["Item"]}/>
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
        let events: Record<string,  EventListenerOrEventListenerObject> = {};
        document.addEventListener = jest.fn((event, callback) => events[event] = callback);
        document.removeEventListener = jest.fn((event, callback) => delete events[event]);

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
})