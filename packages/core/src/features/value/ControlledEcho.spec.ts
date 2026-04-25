import {describe, it, expect} from 'vitest'

import type {CaretRecovery} from '../../shared/editorContracts'
import {ControlledEcho} from './ControlledEcho'

describe('ControlledEcho', () => {
	it('returns recovery only for a matching echo', () => {
		const recovery: CaretRecovery = {kind: 'caret', rawPosition: 4}
		const echo = new ControlledEcho()

		echo.propose('next', recovery)

		expect(echo.onEcho('next')).toBe(recovery)
		expect(echo.onEcho('next')).toBeUndefined()
	})

	it('clears pending recovery on failed echo', () => {
		const recovery: CaretRecovery = {kind: 'caret', rawPosition: 4}
		const echo = new ControlledEcho()

		echo.propose('next', recovery)

		expect(echo.onEcho('other')).toBeUndefined()
		expect(echo.onEcho('next')).toBeUndefined()
	})

	it('supersedes older pending recovery', () => {
		const first: CaretRecovery = {kind: 'caret', rawPosition: 1}
		const second: CaretRecovery = {kind: 'caret', rawPosition: 2}
		const echo = new ControlledEcho()

		echo.propose('first', first)
		echo.propose('second', second)

		expect(echo.onEcho('second')).toBe(second)
		expect(echo.onEcho('first')).toBeUndefined()
	})

	it('clears pending recovery on supersede', () => {
		const recovery: CaretRecovery = {kind: 'caret', rawPosition: 1}
		const echo = new ControlledEcho()

		echo.propose('next', recovery)
		echo.supersede()

		expect(echo.onEcho('next')).toBeUndefined()
	})
})