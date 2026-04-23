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
import type {DragAction} from '../shared/types'
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

	readonly feature = {
		lifecycle: new LifecycleFeature(this),
		value: new ValueFeature(this),
		mark: new MarkFeature(this),
		overlay: new OverlayFeature(this),
		slots: new SlotsFeature(this),
		caret: new CaretFeature(this),
		keyboard: new KeyboardFeature(this),
		dom: new DomFeature(this),
		drag: new DragFeature(this),
		clipboard: new ClipboardFeature(this),
		parsing: new ParsingFeature(this),
	}

	constructor() {
		watch(this.feature.lifecycle.mounted, () => Object.values(this.feature).forEach(f => f.enable()))
		watch(this.feature.lifecycle.unmounted, () => Object.values(this.feature).forEach(f => f.disable()))
	}
}