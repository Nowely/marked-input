import {RefObject, useCallback, useMemo} from "react";
import {Type} from "../../../../../types";
import {useListener} from "../../../../../utils/useListener";

export const useSpanRefs = () => {
    const spanRefs = useMemo(() => new Map<number, RefObject<HTMLSpanElement>>(), [])
    const register = useCallback(
        (key: number) => (ref: RefObject<HTMLSpanElement>) => spanRefs.set(key, ref),
        []
    )

    useListener(Type.Change, () => spanRefs.clear(), [])
    useListener(Type.Delete, () => spanRefs.clear(), [])

    return {register, spanRefs}
};