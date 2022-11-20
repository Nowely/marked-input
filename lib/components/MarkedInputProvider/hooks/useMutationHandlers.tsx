import {Mark, Payload, Trigger, Type} from "../../../types";
import {annotate, createNewSpan, toString, useStore} from "../../../utils";
import {useListener} from "../../../utils/useListener";
import {useSelector} from "../../../utils/useSelector";

//TODO upgrade to full members of react events to external
export function useMutationHandlers() {
    const {bus} = useStore()
    const {pieces, onChange, options} = useSelector(state => ({
        pieces: state.pieces, onChange: state.onChange, options: state.options
    }), true)

    useListener(Type.Change, (event: Payload) => {
        const {key, value} = event
        const node = pieces.find(data => data.key === key)
        if (node && value) {
            node.mark.label = value.label
            node.mark.value = value.value
        }

        const values = pieces.toArray().map(value1 => value1.mark)
        onChange(toString(values, options))
        //bus.send(Type.CheckTrigger) TODO check on value change
    }, [pieces, onChange])

    useListener(Type.Delete, (event: Payload) => {
        const {key} = event
        const piece = pieces.findNode(data => data.key === key)
        if (piece) piece.remove()

        const values = pieces.toArray().map(value1 => value1.mark)
        onChange(toString(values, options))
        //pieces.delete(key)
        //onChange(toString([...pieces.values()], options))
    }, [pieces, onChange])

    useListener(Type.Select, (event: { value: Mark, trigger: Trigger }) => {
        const {value, trigger: {option, span, index, source}} = event

        const annotation = annotate(option.markup, value.label, value.value)
        const newSpan = createNewSpan(span, annotation, index, source);
        //const key = findSpanKey(span, pieces)
        const piece = pieces.findNode(data => data.mark.label === span)

        if (piece) {
            piece.data.mark.label = newSpan
            //piece.data.mark.value = value.value
            //bus.send(Type.Change, {value: newSpan, key: mark.data.key})
            bus.send(Type.Change, {value: {label: newSpan}, key: piece.data.key})
        }
    }, [pieces, onChange])
}