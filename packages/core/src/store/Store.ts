import {CaretFeature} from '../features/caret'
import {ClipboardFeature} from '../features/clipboard'
import {DomFeature} from '../features/dom'
import {DragFeature} from '../features/drag'
import {KeyboardFeature} from '../features/keyboard'
import {LifecycleFeature} from '../features/lifecycle'
import {MarkFeature} from '../features/mark'
import {OverlayFeature} from '../features/overlay'
import {ParsingFeature} from '../features/parsing/ParseFeature'
import {PropsFeature} from '../features/props/PropsFeature'
import {SlotsFeature} from '../features/slots'
import {ValueFeature} from '../features/value'
import {KeyGenerator, MarkputHandler, NodeProxy} from '../shared/classes'
import {watch} from '../shared/signals'
import type {DragAction, Feature} from '../shared/types'
import {BlockRegistry} from './BlockRegistry'

export type {DragAction} from '../shared/types'

export class Store {
	readonly key = new KeyGenerator()
	readonly blocks = new BlockRegistry()

	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}

	readonly props = new PropsFeature(this)
	readonly handler = new MarkputHandler(this)

	readonly lifecycle = new LifecycleFeature(this)
	readonly value = new ValueFeature(this)
	readonly mark = new MarkFeature(this)
	readonly overlay = new OverlayFeature(this)
	readonly slots = new SlotsFeature(this)
	readonly caret = new CaretFeature(this)
	readonly keyboard = new KeyboardFeature(this)
	readonly dom = new DomFeature(this)
	readonly drag = new DragFeature(this)
	readonly clipboard = new ClipboardFeature(this)
	readonly parsing = new ParsingFeature(this)

	constructor() {
		const features: Feature[] = [
			this.lifecycle,
			this.value,
			this.mark,
			this.overlay,
			this.slots,
			this.caret,
			this.keyboard,
			this.dom,
			this.drag,
			this.clipboard,
			this.parsing,
		]
		watch(this.lifecycle.mounted, () => features.forEach(f => f.enable()))
		watch(this.lifecycle.unmounted, () => features.forEach(f => f.disable()))
	}
}