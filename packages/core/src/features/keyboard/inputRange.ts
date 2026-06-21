import type {Range} from '../../shared/editorContracts'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'selection' | 'tokens'>

export function rawRangeFromInputEvent(store: KbCtx, event: InputEvent): Range | undefined {
	const ranges = event.getTargetRanges()
	if (ranges.length === 0) return store.selection.readRaw()?.range
	return rawRangeFromTargetRange(store, ranges[0])
}

function rawRangeFromTargetRange(store: KbCtx, range: StaticRange): Range | undefined {
	const start = store.tokens.boundaryFor(range.startContainer, range.startOffset, 'after')
	if (start === undefined) return undefined
	const end = store.tokens.boundaryFor(range.endContainer, range.endOffset, 'before')
	if (end === undefined) return undefined
	return start <= end ? {start, end} : {start: end, end: start}
}