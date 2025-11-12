import {Token} from '../parsing/ParserV2/types'
import {EventKey, OverlayMatch} from '../../shared/types'

export const SystemEvent = {
	STORE_UPDATED: Symbol() as EventKey,
	ClearTrigger: Symbol() as EventKey,
	CheckTrigger: Symbol() as EventKey,
	Change: Symbol() as EventKey,
	Parse: Symbol() as EventKey,
	Delete: Symbol() as EventKey<{token: Token}>,
	Select: Symbol() as EventKey<{mark: Token; match: OverlayMatch}>,
}
