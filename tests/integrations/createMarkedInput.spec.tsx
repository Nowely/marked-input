import '@testing-library/jest-dom'
import user from "@testing-library/user-event";
import {act, render} from "@testing-library/react";
import {Configured} from "storybook/stories/Base.stories";
import React, {forwardRef, useState} from "react";
import {createMarkedInput} from "rc-marked-input";
import {vi} from "vitest";

describe(`Utility: createMarkedInput`, () => {
    it('should render', () => {
        render(<Configured/>)
    })

    it('should support to pass a forward overlay', async () => {
        //override event listener because 'selectionchange' don't work in here
        let events: Record<string, EventListenerOrEventListenerObject> = {};
        document.addEventListener = vi.fn((event, callback) => events[event] = callback);
        document.removeEventListener = vi.fn((event, callback) => delete events[event]);

        const {queryByText, getByText} = render(<Mark3/>)
        const span = getByText(/hello/i)
        await user.type(span, '{ArrowRight}')
        expect(span).toHaveFocus()

        await act(() => {
            // @ts-ignore
            events['selectionchange']()
        });

        expect(await queryByText("I'm here!")).toBeInTheDocument()
    })
})

const Mark3 = () => {
    const [value, setValue] = useState('Hello @')
    const Overlay = forwardRef(() => <span>I'm here!</span>)
    const Input = createMarkedInput(() => null, Overlay, [{}])

    return <Input value={value} onChange={setValue}/>
}