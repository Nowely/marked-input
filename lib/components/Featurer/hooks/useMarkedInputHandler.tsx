import {ForwardedRef, useImperativeHandle} from "react";
import {useStore} from "../../../utils";
import {Store} from "../../../utils/Store";

export interface MarkedInputHandler {
    /**
     * Container element
     */
    container: HTMLDivElement | null
    /**
     * Overlay element if exists
     */
    overlay: HTMLElement | null

    focus(): void
}

const initHandler = (store: Store) => ({
    get container() {
        return store.containerRef.current
    },
    get overlay() {
        return store.overlayRef.current
    },
    focus() {
        store.state.pieces.head?.data.ref.current?.focus()
    }
})

export function useMarkedInputHandler(ref: ForwardedRef<MarkedInputHandler>) {
    const store = useStore()
    useImperativeHandle(ref, initHandler.bind(null, store), [])
}
