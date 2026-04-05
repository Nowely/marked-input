export interface Feature {
	name: string
	enable(): void
	disable(): void
}

export class FeatureManager {
	#features: Feature[] = []
	#enabled = false

	register(feature: Feature): this {
		this.#features.push(feature)
		return this
	}

	enableAll() {
		if (this.#enabled) return
		this.#enabled = true
		this.#features.forEach(f => f.enable())
	}

	disableAll() {
		if (!this.#enabled) return
		this.#enabled = false
		this.#features.forEach(f => f.disable())
	}
}

export const asFeature = (name: string, controller: {enable(): void; disable(): void}): Feature => ({
	name,
	enable: () => controller.enable(),
	disable: () => controller.disable(),
})