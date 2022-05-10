import {KeyboardEvent, ReactElement} from "react";
import {OptionProps} from "../Option";
import {getCaretIndex, toString} from "../utils";
import {EmptyFunc, KEY} from "../constants";
import {TagValue} from "../types";
import {CaretManager} from "./useCaret";

export const useHandleKeyDown = (
    focused: number | null,
    setFocused: Function,
    caret: CaretManager,
    values: Map<number, string | TagValue<any>>,
    onChange: (value: string) => void,
    children: ReactElement<OptionProps<any>> | ReactElement<OptionProps<any>>[]
) => {
    const keys = [...values.keys()]

    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
        const target = event.target as HTMLSpanElement
        const caretIndex = getCaretIndex(target);
        const isStartCaret = caretIndex === 0;
        const isEndCaret = caretIndex === target.textContent?.length;
        const keyMap = {
            [KEY.LEFT]: isStartCaret ? onPressLeft : EmptyFunc,
            [KEY.RIGHT]: isEndCaret ? onPressRight : EmptyFunc,
            [KEY.UP]: EmptyFunc, //TODO to the start input position
            [KEY.DOWN]: EmptyFunc, //TODO to the end input position
            [KEY.BACKSPACE]: isStartCaret ? onPressBackspace : EmptyFunc,
        }

        keyMap[event.key]?.(target)
    }
    const onPressLeft = (target: HTMLSpanElement) => {
        if (focused != null) {
            let index = keys.indexOf(focused)
            if (index >= 2) {
                setFocused(keys[index - 2])
                caret.toEnd()
            }
        }
    }
    const onPressRight = (target: HTMLSpanElement) => {

        if (focused != null) {
            let index = keys.indexOf(focused)
            if (keys.length - index > 2) {
                setFocused(keys[index + 2])
                caret.toStart()
            }
        }
    }
    const onPressBackspace = (target: HTMLSpanElement) => {
        if (focused != null) {
            let index = keys.indexOf(focused)
            if (index >= 1) {
                values.delete(keys[index - 1])
                onChange(toString([...values.values()], children))
            }
            //const value = values[focused]
            //const offset = typeof value === "string" ? value.length : -1

            //TODO
            //values.splice(focused - 1, 1)
            //setFocused(focused - 2)

            //setCaretTo(target, 1)
        }
        //TODO caret
    }

    return handleKeyDown
}