import {useMemo} from "react";
import {genKey} from "../../../utils";
import {Options, PieceNode} from "../../../types";
import {Parser} from "../../../utils/Parser";
import LinkedList from "../../../utils/LinkedList";

//TODO Compare new input value with returned caching?
//TODO dont create a new object for returned value
export const useParsed = (value: string, options: Options): LinkedList<PieceNode> => {
    const pieces = useMemo(Parser.split(value, options), [value])

    return useMemo(() => {
        const set = new Set<number>()
        return LinkedList.from(pieces.map(piece => ({key: genKey(piece, set), piece})))
    }, [pieces.length])
}