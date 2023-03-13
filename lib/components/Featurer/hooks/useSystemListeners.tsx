import {MarkStruct, Payload, Trigger, Type} from '../../../types'
import {annotate, createNewSpan, toString, useStore} from '../../../utils'
import {useListener} from '../../../utils/useListener'

//TODO upgrade to full members of react events to external
export function useSystemListeners() {
    const store = useStore()

    useListener(Type.Change, (event: Payload) => {
        const {pieces, onChange, options} = store.state
        const {key, value} = event

        const node = pieces.find(data => data.key === key)
        if (node && value) {
            node.mark.label = value.label
            node.mark.value = value.value
        }

        const values = pieces.toArray().map(node => node.mark)
        onChange(toString(values, options))
        //bus.send(Type.CheckTrigger) TODO check on value change
    }, [])

    useListener(Type.Delete, (event: Payload) => {
        const {pieces, onChange, options} = store.state
        const {key} = event

        const piece = pieces.findNode(node => node.key === key)
        if (piece) piece.remove()

        const values = pieces.toArray().map(data => data.mark)
        onChange(toString(values, options))
        //pieces.delete(key)
        //onChange(toString([...pieces.values()], options))
    }, [])

    useListener(Type.Select, (event: { value: MarkStruct, trigger: Trigger }) => {
        const {pieces} = store.state
        const {value, trigger: {option, span, index, source}} = event

        const annotation = annotate(option.markup, value.label, value.value)
        const newSpan = createNewSpan(span, annotation, index, source)
        //const key = findSpanKey(span, pieces)
        const piece = pieces.findNode(node => node.mark.label === span)
        store.recovery = {caretPosition: 0, prevNodeData: piece?.prev?.data, isPrevPrev: true}

        if (piece) {
            piece.data.mark.label = newSpan
            //piece.data.mark.value = value.value
            //bus.send(Type.Change, {value: newSpan, key: mark.data.key})
            store.bus.send(Type.Change, {value: {label: newSpan}, key: piece.data.key})
        }
    }, [])
}