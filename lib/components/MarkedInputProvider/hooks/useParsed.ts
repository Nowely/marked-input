import {useMemo} from "react";
import {genHash, isObject} from "../../../utils";
import {Options, Piece, KeyedPieces} from "../../../types";
import {Parser} from "../../../utils/Parser";

//TODO Compare new input value with returned caching?
//TODO dont create a new object for returned value
export const useParsed = (value: string, options: Options): KeyedPieces => {
    const pieces = useMemo(Parser.split(value, options), [value])
    return useMemo(bindKeysWithPieces, [pieces.length])


    function bindKeysWithPieces() {
        return pieces.reduce((map: KeyedPieces, piece) => map.set(genKey(piece, map), piece), new Map())

        function genKey(piece: Piece, newMap: Map<number, Piece>) {
            let str = isObject(piece) ? piece.label + piece.value : piece
            let seed = 0
            let key = genHash(str, seed)
            while (newMap.has(key)) key = genHash(str, seed++)
            return key;
        }
    }
}