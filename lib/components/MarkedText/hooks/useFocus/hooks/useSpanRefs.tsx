import {RefObject, useCallback, useEffect, useMemo, useRef} from "react";
import {Type} from "../../../../../types";
import {useListener} from "../../../../../utils/useListener";
import {usePieces} from "../../../../../utils";

export const useSpanRefs = () => {
    const pieces = usePieces()
    const spanRefs = useMemo(() => new Map<number, RefObject<HTMLSpanElement>>(), [])
    const register = useRef((key: number) => (ref: RefObject<HTMLSpanElement>) => {
        if (!pieces.has(key)) return
        //order
        spanRefs.set(key, ref);
    })
    /*const register = useCallback(
        (key: number) => (ref: RefObject<HTMLSpanElement>) => {
            debugger
            if (!pieces.has(key)) return
            //order
            spanRefs.set(key, ref);
        },
        [pieces]
    )*/

    /*useEffect(() => {
        setTimeout(_ => {
            console.log([...spanRefs.entries()])
            const ordered = [...spanRefs.entries()].sort((a, b) => {
                for (let key of pieces.keys()) {
                    if (key === a[0]) return key
                    if (key === b[0]) return key
                }
                return 0
            })
            console.log(ordered)
        }, 10)
    }, [pieces])*/

    //useListener(Type.Change, () => spanRefs.clear(), [])
    useListener(Type.Delete, () => spanRefs.clear(), [])

    return {register, spanRefs}
};