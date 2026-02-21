import {SystemEvent, TriggerFinder} from '@markput/core'
import type {Option} from '../../types'
import {useListener} from '../../lib/hooks/useListener'
import {useStore} from '../../lib/hooks/useStore'

export const useTrigger = () => {
	const store = useStore()

	useListener(SystemEvent.ClearTrigger, _ => (store.overlayMatch = undefined), [])
	useListener(
		SystemEvent.CheckTrigger,
		_ =>
			(store.overlayMatch = TriggerFinder.find(store.props.options, (option: Option) => option.overlay?.trigger)),
		[]
	)
}
