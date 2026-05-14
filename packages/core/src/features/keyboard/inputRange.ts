import type {BoundaryPositionResult, RawSelectionResult} from '../../shared/editorContracts'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'dom'>

type InputTargetRange = {
	readonly startContainer: Node
	readonly startOffset: number
	readonly endContainer: Node
	readonly endOffset: number
}

type RawSelectionFailureReason = Extract<RawSelectionResult, {ok: false}>['reason']

export function rawRangeFromInputEvent(store: KbCtx, event: InputEvent): RawSelectionResult {
	const ranges = event.getTargetRanges()
	if (ranges.length === 0) return store.dom.readRawSelection()
	return rawRangeFromTargetRange(store, ranges[0])
}

function rawRangeFromTargetRange(store: KbCtx, range: InputTargetRange): RawSelectionResult {
	const start = store.dom.rawPositionFromBoundary(range.startContainer, range.startOffset, 'after')
	const end = store.dom.rawPositionFromBoundary(range.endContainer, range.endOffset, 'before')
	if (!start.ok) return {ok: false, reason: rawSelectionReason(start)}
	if (!end.ok) return {ok: false, reason: rawSelectionReason(end)}
	return {
		ok: true,
		value: {
			range:
				start.value <= end.value ? {start: start.value, end: end.value} : {start: end.value, end: start.value},
		},
	}
}

function rawSelectionReason(result: BoundaryPositionResult): RawSelectionFailureReason {
	if (result.ok) return 'invalidBoundary'
	if (result.reason === 'composing') return 'invalidBoundary'
	return result.reason
}