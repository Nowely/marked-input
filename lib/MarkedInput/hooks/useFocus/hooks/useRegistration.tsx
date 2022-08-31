import {RefObject, useCallback, useMemo} from "react";

export const useRegistration = () => {
    const registered = useMemo(() => new Map<number, RefObject<HTMLSpanElement>>(), [])
    const register = useCallback(
        (key: number) => (ref: RefObject<HTMLSpanElement>) => registered.set(key, ref),
        []
    )

    return {register, registered}
};