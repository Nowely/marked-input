import type {RawSelection} from '../../shared/editorContracts'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'selection' | 'tokens'>

type InputTargetRange = {
	readonly startContainer: Node
	readonly startOffset: number
	readonly endContainer: Node
	readonly endOffset: number
}

export function rawRangeFromInputEvent(store: KbCtx, event: InputEvent): RawSelection | undefined {
	const ranges = event.getTargetRanges()
	if (ranges.length === 0) return store.selection.readRaw()
	return rawRangeFromTargetRange(store, ranges[0])
}

function rawRangeFromTargetRange(store: KbCtx, range: InputTargetRange): RawSelection | undefined {
	const start = store.tokens.boundaryFor(range.startContainer, range.startOffset, 'after')
	if (start === undefined) return undefined
	const end = store.tokens.boundaryFor(range.endContainer, range.endOffset, 'before')
	if (end === undefined) return undefined
	return {
		range: start <= end ? {start, end} : {start: end, end: start},
	}
}