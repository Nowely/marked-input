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
import {KeyGenerator, MarkputHandler} from '../shared/classes'
import {BlockRegistry} from './BlockRegistry'

export type {DragAction} from '../shared/types'

export class Store {
	readonly key = new KeyGenerator()
	readonly blocks = new BlockRegistry()

	readonly props = new PropsFeature(this)
	readonly handler = new MarkputHandler(this)

	readonly lifecycle = new LifecycleFeature()
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

	constructor() {}
}