import {KeyboardEvent} from "react";
import {toString} from "../utils";
import {EmptyFunc, KEY} from "../constants";
import {PassedOptions, SliceMap} from "../types";
import {Caret} from "./useCaret";
import {Focus} from "./useFocus";

export const useHandleKeyDown = (
    caret: Caret,
    values: SliceMap<any>,
    onChange: (value: string) => void,
    children: PassedOptions<any>,
    focus: Focus,
) => {
    const keys = [...values.keys()]

    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
        const target = event.target as HTMLSpanElement
        const caretIndex = caret.getCaretIndex(target);
        const isStartCaret = caretIndex === 0;
        const isEndCaret = caretIndex === target.textContent?.length;
        const keyMap = {
            [KEY.LEFT]: isStartCaret ? onPressLeft : EmptyFunc,
            [KEY.RIGHT]: isEndCaret ? onPressRight : EmptyFunc,
            [KEY.UP]: EmptyFunc, //TODO to the start input position
            [KEY.DOWN]: EmptyFunc, //TODO to the end input position
            [KEY.DELETE]: EmptyFunc, //TODO reverse backspace
            [KEY.BACKSPACE]: isStartCaret ? onPressBackspace : EmptyFunc,
        }

        keyMap[event.key]?.(target)
    }

    const onPressLeft = (target: HTMLSpanElement) => {
        if (focus.focused != null) {
            let index = keys.indexOf(focus.focused)
            if (index >= 2) {
                focus.setFocused(keys[index - 2])
                focus.isTail.current = true
            }
        }
    }
    const onPressRight = (target: HTMLSpanElement) => {
        if (focus.focused != null) {
            let index = keys.indexOf(focus.focused)
            if (keys.length - index > 2) {
                focus.setFocused(keys[index + 2])
                focus.isTail.current = false
            }
        }
    }
    const onPressBackspace = (target: HTMLSpanElement) => {
        if (focus.focused != null) {
            let index = keys.indexOf(focus.focused)
            if (index >= 1) {
                caret.saveRightOffset()
                values.delete(keys[index - 1])
                onChange(toString([...values.values()], children))
            }
        }
    }

    return handleKeyDown
}