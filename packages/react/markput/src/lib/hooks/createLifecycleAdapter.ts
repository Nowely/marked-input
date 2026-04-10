import type {LifecycleAdapter, Subscribable} from '@markput/core'
import {setLifecycleAdapterFactory} from '@markput/core'
import {useEffect, useLayoutEffect} from 'react'

interface ReactLifecycleAdapter extends LifecycleAdapter {
	activate(): void
}

setLifecycleAdapterFactory((): ReactLifecycleAdapter => {
	let mountCb: (() => void) | undefined
	let unmountCb: (() => void) | undefined
	let postRenderDeps: Subscribable[] = []
	let postRenderCb: (() => void) | undefined
	let postCommitDep: Subscribable | undefined
	let postCommitCb: (() => void) | undefined

	return {
		onMount(cb) {
			mountCb = cb
		},
		onUnmount(cb) {
			unmountCb = cb
		},
		watchPostRender(deps, cb) {
			postRenderDeps = deps
			postRenderCb = cb
		},
		watchPostCommit(dep, cb) {
			postCommitDep = dep
			postCommitCb = cb
		},

		activate() {
			useEffect(() => {
				mountCb?.()
				return () => unmountCb?.()
			}, [])

			const renderDepValues = postRenderDeps.map(d => d.use())
			useEffect(() => {
				postRenderCb?.()
			}, renderDepValues)

			const commitDepValue = postCommitDep?.use()
			useLayoutEffect(() => {
				postCommitCb?.()
			}, [commitDepValue])
		},
	}
})