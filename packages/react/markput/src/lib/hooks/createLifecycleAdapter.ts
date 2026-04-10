import type {Subscribable} from '@markput/core'
import {setLifecycleAdapterFactory} from '@markput/core'
import {useEffect, useLayoutEffect} from 'react'

setLifecycleAdapterFactory(() => ({
	onLifecycle(mount, unmount) {
		useEffect(() => {
			mount()
			return unmount
		}, [])
	},

	watchPostRender(deps: Subscribable[], cb) {
		const depValues = deps.map(d => d.use())
		useEffect(() => {
			cb()
		}, depValues)
	},

	watchPostCommit(dep: Subscribable, cb) {
		const depValue = dep.use()
		useLayoutEffect(() => {
			cb()
		}, [depValue])
	},
}))