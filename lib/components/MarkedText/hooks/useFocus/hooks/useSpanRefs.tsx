import {FocusEvent, RefObject, useCallback, useEffect, useMemo} from "react";
import {useStore} from "../../../../../utils";
import {Type} from "../../../../../types";

export const useSpanRefs = () => {
    const {bus} = useStore()

    const spanRefs = useMemo(() => new Map<number, RefObject<HTMLSpanElement>>(), [])
    const register = useCallback(
        (key: number) => (ref: RefObject<HTMLSpanElement>) => spanRefs.set(key, ref),
        []
    )

    useEffect(() => bus.listen(Type.Change, () => spanRefs.clear()), [])
    useEffect(() => bus.listen(Type.Delete, () => spanRefs.clear()), [])

    return {register, spanRefs}
};