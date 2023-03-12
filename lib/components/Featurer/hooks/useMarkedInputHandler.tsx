import {ForwardedRef, useImperativeHandle} from "react";
import {useStore} from "../../../utils";
import {Store} from "../../../utils/Store";

const init = (store: Store) => ({
    /**
     * Container element
     */
    get container() {
        return store.containerRef.current
    },
    /**
    * Overlay element if exists
    */
    get overlay() {
        return store.overlayRef.current
    },
    focus() {
        store.state.pieces.head?.data.ref.current?.focus()
    }
})

export type MarkedInputHandler = ReturnType<typeof init>

export function useMarkedInputHandler(ref: ForwardedRef<MarkedInputHandler>) {
    const store = useStore()

    useImperativeHandle(ref, init.bind(null, store), [])
}
