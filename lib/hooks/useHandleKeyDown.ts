import {KeyboardEvent} from "react";
import {useStore} from "../utils";
import {KEY} from "../constants";
import {Type} from "../types";
import {Caret} from "./useCaret";

export const useHandleKeyDown = () => {
    const {dispatch, caret, sliceMap, focus} = useStore()
    const keys = [...sliceMap.keys()]

    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
        const target = event.target as HTMLSpanElement
        const caretIndex = Caret.getCaretIndex(target);
        const isStartCaret = caretIndex === 0;
        const isEndCaret = caretIndex === target.textContent?.length;
        const handleMap = {
            [KEY.LEFT]: isStartCaret ? handlePressLeft : null,
            [KEY.RIGHT]: isEndCaret ? handlePressRight : null,
            [KEY.UP]: null, //TODO to the start input position
            [KEY.DOWN]: null, //TODO to the end input position
            [KEY.DELETE]: null, //TODO reverse backspace
            [KEY.BACKSPACE]: isStartCaret ? handlePressBackspace : null,
        }

        handleMap[event.key]?.()
    }

    function handlePressLeft() {
        if (focus.focused != null) {
            let index = keys.indexOf(focus.focused)
            if (index >= 2) {
                focus.setFocused(keys[index - 2])
                focus.isTail.current = true
            }
        }
    }

    function handlePressRight() {
        if (focus.focused != null) {
            let index = keys.indexOf(focus.focused)
            if (keys.length - index > 2) {
                focus.setFocused(keys[index + 2])
                focus.isTail.current = false
            }
        }
    }

    function handlePressBackspace() {
        if (focus.focused != null) {
            let index = keys.indexOf(focus.focused)
            if (index >= 1) {
                caret.saveRightOffset()
                dispatch(Type.Delete, {key: keys[index - 1]})
            }
        }
    }

    return handleKeyDown
}