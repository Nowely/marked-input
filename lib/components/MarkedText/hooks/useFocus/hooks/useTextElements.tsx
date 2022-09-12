import {FocusEvent, RefObject, useCallback, useEffect, useMemo} from "react";
import {useStore} from "../../../../../utils";
import {Type} from "../../../../../types";

export const useTextElements = () => {
    const {bus} = useStore()

    const elements = useMemo(() => new Map<number, RefObject<HTMLSpanElement>>(), [])
    const register = useCallback(
        (key: number) => (ref: RefObject<HTMLSpanElement>) => elements.set(key, ref),
        []
    )

    useEffect(() => bus.listen(Type.Change, () => {
        elements.clear()
    }), [])

    useEffect(() => bus.listen(Type.Delete, () => {
        elements.clear()
    }), [])

    return {register, elements}
};