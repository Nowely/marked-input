import {useMemo, useRef} from "react";
import {genKey, isObject} from "../../../utils";
import {NodeData, Options, Piece} from "../../../types";
import {Parser} from "../../../utils/Parser";
import LinkedList from "../../../utils/LinkedList";
import LinkedListNode from "../../../utils/LinkedListNode";

//TODO Compare new input value with returned caching?
//TODO dont create a new object for returned value
export const useParsed = (value: string, options: Options): LinkedList<NodeData> => {
    const pieces = useMemo(Parser.split(value, options), [value])
    const previous = useRef<LinkedList<NodeData> | null>(null)

    return useMemo(() => {
        const existedKeys = new Set<number>()
        //get data from previous if exists
        const data = pieces.map(piece => {
            let key = genKey(piece, existedKeys)
            const node = previous.current?.findNode(data => data.key === key)

            if (!node || hasOutdatedState(piece, node) && key++)
                return ({key, mark: isObject(piece) ? piece : {label: piece}});

            return node.data
        })

        previous.current = LinkedList.from(data)
        return previous.current
    }, [pieces.length])
}

const hasOutdatedState = (piece: Piece, node: LinkedListNode<NodeData>) => {
    if (isObject(piece)) return false
    return node.data.mark.label !== piece
}