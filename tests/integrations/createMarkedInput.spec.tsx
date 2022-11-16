import '@testing-library/jest-dom'
import user from "@testing-library/user-event";
import {act, render} from "@testing-library/react";
import {Configured} from "storybook/stories/Base.stories";
import React, {forwardRef, useState} from "react";
import {createMarkedInput} from "rc-marked-input";
import {MarkProps} from "rc-marked-input/types";
import {vi} from "vitest";

//TODO
describe(`Utility: createMarkedInput`, () => {
    it('should render', () => {
        render(<Configured/>)
    })

    it('should support to pass a forward overlay', async () => {
        //override event listener because 'selectionchange' don't work in here
        let events: Record<string, EventListenerOrEventListenerObject> = {};
        document.addEventListener = vi.fn((event, callback) => events[event] = callback);
        document.removeEventListener = vi.fn((event, callback) => delete events[event]);

        const {container, debug, queryByText} = render(<Mark3/>)
        const [span] = container.querySelectorAll("span")
        await user.type(span, '@1')
        await user.type(span, '{ArrowLeft}', {initialSelectionStart: 0})
        console.log(span)

        expect(span).toHaveFocus()
        await act(() => {
            // @ts-ignore
            events['selectionchange']()
        });

        debug()
        expect(await queryByText("I'm here!")).toBeInTheDocument()
    })
})

const Mark3 = () => {
    const [value, setValue] = useState('1')
    const Overlay = forwardRef(() => <span>I'm here!</span>)
    const Input = createMarkedInput(props => <mark>{props.label}</mark>, Overlay, [])

    return <Input value={value} onChange={setValue}/>
}