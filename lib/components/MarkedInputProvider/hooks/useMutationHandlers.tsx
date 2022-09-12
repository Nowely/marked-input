import {Store, Type} from "../../../types";
import {useEffect} from "react";
import {toString} from "../../../utils";

export function useMutationHandlers(store: Store) {
    const {bus, pieces, options, props} = store

    useEffect(() => bus.listen(Type.Change, e => {
        const {key, value = ""} = e
        pieces.set(key, value)
        props.onChange(toString([...pieces.values()], options))
    }), [pieces])

    useEffect(() => bus.listen(Type.Delete, e => {
        const {key} = e
        pieces.delete(key)
        props.onChange(toString([...pieces.values()], options))
    }), [pieces])
}