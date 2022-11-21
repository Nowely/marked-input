import {useEffect, useMemo, useRef} from "react";
import {genKey, isObject, useStore} from "../../../utils";
import {NodeData, Piece} from "../../../types";
import {Parser} from "../../../utils/Parser";
import LinkedList from "../../../utils/LinkedList";
import LinkedListNode from "../../../utils/LinkedListNode";
import {useProps} from "../../../utils/useProps";

//TODO Compare new input value with returned caching?
//TODO dont create a new object for returned value
//TODO move to marked text?
export const useValueParser = () => {
    const store = useStore()
    const {value, options} = useProps(state => ({value: state.value, options: state.options}), true)

    const pieces = useMemo(Parser.split(value, options), [value, options])
    const previous = useRef<LinkedList<NodeData> | null>(null)

    useEffect(() => {
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
        store.setState({pieces: previous.current})
    }, [pieces.length])
}

const hasOutdatedState = (piece: Piece, node: LinkedListNode<NodeData>) => {
    if (isObject(piece)) return false
    return node.data.mark.label !== piece
}