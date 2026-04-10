import {watch} from '../../shared/signals/index.js'
import type {Store} from '../store'

export class Lifecycle {
	#enabled = false
	#featuresEnabled = false

	constructor(private store: Store) {
		watch(store.event.updated, () => this.#onUpdated())
		watch(store.event.afterTokensRendered, () => this.recoverFocus())
		watch(store.event.unmounted, () => this.disable())
	}

	#onUpdated() {
		if (!this.#enabled) {
			this.enable()
			this.store.features.parse.sync()
			return
		}
		if (!this.store.features.parse.hasChanged()) return
		if (!this.store.state.recovery()) {
			this.store.event.parse()
		}
	}

	#enableFeatures() {
		if (this.#featuresEnabled) return
		this.#featuresEnabled = true
		const {features} = this.store
		for (const f of Object.values(features)) f.enable()
	}

	#disableFeatures() {
		if (!this.#featuresEnabled) return
		this.#featuresEnabled = false
		const {features} = this.store
		for (const f of Object.values(features)) f.disable()
	}

	enable() {
		if (this.#enabled) return
		const {store} = this
		store.state.overlayTrigger(option => option.overlay?.trigger)
		this.#enableFeatures()
		this.#enabled = true
	}

	disable() {
		this.#enabled = false
		this.#disableFeatures()
		this.store.state.overlayTrigger(undefined)
	}

	recoverFocus() {
		this.store.event.sync()
		if (!this.store.state.Mark()) return
		this.store.event.recoverFocus()
	}
}