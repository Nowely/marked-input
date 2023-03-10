import {KeyboardEvent, MutableRefObject} from "react";
import {Caret} from "../../../utils/Caret";
import {KEY} from "../../../constants";
import {Recovery, Type} from "../../../types";
import {useStore} from "../../../utils";
import {useDownOf} from "../../../utils/useDownOf";
import {useListener} from "../../../utils/useListener";

export function useKeyDown() {
    const store = useStore()

    useDownOf(KEY.LEFT, event => {
        if (!isCaretInStart(event)) return

        const node = store.focusedNode?.prev
        const element = node?.data.ref?.current ?? node?.prev?.data.ref?.current
        element?.focus()
        Caret.setCaretToEnd(element)
        event.preventDefault()
    })

    useDownOf(KEY.RIGHT, event => {
        if (!isCaretInEnd(event)) return

        const node = store.focusedNode?.next
        const element = node?.data.ref?.current ?? node?.next?.data.ref?.current
        element?.focus()
        event.preventDefault()
    })

    useDownOf(KEY.DELETE, event => {
        if (!isCaretInEnd(event)) return

        const node = store.focusedNode?.next
        if (!node?.data.key) return

        const caretPosition = node.prev?.data.mark.label.length ?? 0
        store.recovery = {prevNodeData: node.prev?.prev?.data, caretPosition}
        store.bus.send(Type.Delete, {key: node.data.key})
        event.preventDefault()
    })

    useDownOf(KEY.BACKSPACE, event => {
        if (!isCaretInStart(event)) return

        const node = store.focusedNode?.prev
        if (!node?.data.key) return

        const caretPosition = node.prev?.data.mark.label.length ?? 0
        store.recovery = {prevNodeData: node.prev?.prev?.data, caretPosition}
        store.bus.send(Type.Delete, {key: node.data.key})
        event.preventDefault()
    })

    //Select all text
    useListener("onKeyDown", (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.ctrlKey && event.code === 'KeyA') {
            event.preventDefault()

            const selection = window.getSelection()
            const anchorNode = store.containerRef.current?.firstChild
            const focusNode = store.containerRef.current?.lastChild

            if (!selection || !anchorNode || !focusNode) return
            selection.setBaseAndExtent(anchorNode, 0, focusNode, 1)
        }
    }, [])
}

function isCaretInStart(e: KeyboardEvent<HTMLSpanElement>) {
    const target = e.target as HTMLSpanElement
    const caretIndex = Caret.getCaretIndex(target);
    return caretIndex === 0;
}

function isCaretInEnd(event: KeyboardEvent<HTMLSpanElement>) {
    const target = event.target as HTMLSpanElement
    const caretIndex = Caret.getCaretIndex(target);
    return caretIndex === target.textContent?.length;
}
