import type {Subscribable} from '@markput/core'
import {setLifecycleAdapterFactory} from '@markput/core'
import type {WatchSource} from 'vue'
import {onMounted, onUnmounted, watch as vueWatch} from 'vue'

setLifecycleAdapterFactory(() => ({
	onMount(cb) {
		onMounted(cb)
	},
	onUnmount(cb) {
		onUnmounted(cb)
	},

	watchPostRender(deps: Subscribable[], cb) {
		// oxlint-disable-next-line no-unsafe-type-assertion -- .use() returns Vue Ref; core types it as unknown at the framework boundary
		const vueRefs = deps.map(d => d.use() as WatchSource)
		vueWatch(vueRefs, cb, {flush: 'post', immediate: true})
	},

	watchPostCommit(dep: Subscribable, cb) {
		// oxlint-disable-next-line no-unsafe-type-assertion -- .use() returns Vue Ref; core types it as unknown at the framework boundary
		const vueRef = dep.use() as WatchSource
		vueWatch(vueRef, cb, {flush: 'post'})
	},
}))