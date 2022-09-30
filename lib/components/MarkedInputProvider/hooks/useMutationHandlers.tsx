import {MarkProps, Payload, Piece, PieceNode, Store, Trigger, Type} from "../../../types";
import {annotate, createNewSpan, findSpanKey, toString, useStore} from "../../../utils";
import {useListener} from "../../../utils/useListener";
import LinkedList from "../../../utils/LinkedList";

//TODO upgrade to full members of react events to external
export function useMutationHandlers(onChange: (value: string) => void, pieces: LinkedList<PieceNode>) {
    const {bus, options} = useStore()


    useListener(Type.Change, (event: Payload) => {
        const {key, value = ""} = event
        const piece = pieces.find(data => data.key === key)
        if (piece) piece.piece = value

        const values = pieces.toArray().map(value1 => value1.piece)
        onChange(toString(values, options))
        //pieces.set(key, value)
        //onChange(toString([...pieces.values()], options))
    }, [pieces, onChange])

    useListener(Type.Delete, (event: Payload) => {
        const {key} = event
        const piece = pieces.findNode(data => data.key === key)
        if (piece) piece.remove()

        const values = pieces.toArray().map(value1 => value1.piece)
        onChange(toString(values, options))
        //pieces.delete(key)
        //onChange(toString([...pieces.values()], options))
    }, [pieces, onChange])

    useListener(Type.Select, (event: { value: MarkProps, trigger: Trigger }) => {
        const {value, trigger: {option, span, index, source}} = event

        const annotation = annotate(option.markup, value.label, value.value)
        const newSpan = createNewSpan(span, annotation, index, source);
        //const key = findSpanKey(span, pieces)
        const piece = pieces.findNode(data => data.piece === span)

        if (piece)
            bus.send(Type.Change, {value: newSpan, key: piece.data.key})
    }, [pieces, onChange])
}