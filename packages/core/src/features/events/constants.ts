import {MarkStruct} from '../parsing/ParserV1/types'
import {EventKey, OverlayMatch} from '../../shared/types'

export const SystemEvent = {
	STORE_UPDATED: Symbol() as EventKey,
	ClearTrigger: Symbol() as EventKey,
	CheckTrigger: Symbol() as EventKey,
	Change: Symbol() as EventKey,
	Parse: Symbol() as EventKey,
	Delete: Symbol() as EventKey<{token: MarkStruct}>,
	Select: Symbol() as EventKey<{mark: MarkStruct; match: OverlayMatch}>,
}
