import {useMemo, useRef} from "react";
import {genKey} from "../../../utils";
import {Options, PieceNode} from "../../../types";
import {Parser} from "../../../utils/Parser";
import LinkedList from "../../../utils/LinkedList";

//TODO Compare new input value with returned caching?
//TODO dont create a new object for returned value
export const useParsed = (value: string, options: Options): LinkedList<PieceNode> => {
    const pieces = useMemo(Parser.split(value, options), [value])
    const ref = useRef<LinkedList<PieceNode> | null>(null)

    return useMemo(() => {
        const set = new Set<number>()

        const previous = ref.current

        //with caching from previous
        let data = pieces.map(piece => {
            const key = genKey(piece, set)
            const node = previous?.findNode(data => data.key === key)
            if (node) return node.data
            return ({key, piece});
        })

        ref.current = LinkedList.from(data)
        return ref.current
    }, [pieces.length])
}