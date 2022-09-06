import user from "@testing-library/user-event";
import {render, screen} from "@testing-library/react";
import {MarkedInput} from "lib";
import {Marked} from "storybook/stories/Base.stories";
import '@testing-library/jest-dom'
import {useState} from "react";

const Mark2 = () => {
    const [value, setValue] = useState("Hello @[mark](1)!")
    return <MarkedInput Mark={props => <mark>{props.label}</mark>} value={value} onChange={setValue}/>
}

describe(`Component: ${MarkedInput.name}`, () => {
    it('should render', () => {
        render(<Marked/>)
    })

    it('should support the "Backspace" button', async () => {
        const {container, debug} = render(<Mark2/>)
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
        const {container} = render(<Mark2/>)
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

    //TODO
    it('should support focus changing', function () {

    });
})