import {wordRegex} from '../constants'
import {Option, OverlayMatch} from '../types'
import {Caret} from './Caret'

import {escape} from "./escape";

export class TriggerFinder {
	span: string
	node: Node
	dividedText: { left: string; right: string }

	constructor() {
		let caretPosition = Caret.getCurrentPosition()
		this.node = Caret.getSelectedNode()
		this.span = Caret.getFocusedSpan()
		this.dividedText = this.getDividedTextBy(caretPosition)
	}

	static find(options: Option[]) {
		if (Caret.isSelectedPosition)
			return new TriggerFinder().find(options)
	}

	getDividedTextBy(position: number) {
		return {left: this.span.slice(0, position), right: this.span.slice(position)}
	}

	find(options: Option[]): OverlayMatch | undefined {
		for (let option of options) {
			let match = this.matchInTextVia(option.trigger!)
			if (match) return {
				value: match.word,
				source: match.annotation,
				index: match.index,
				span: this.span,
				node: this.node,
				option,
			}
		}
	}

	matchInTextVia(trigger: string) {
		const rightMatch = this.matchRightPart()
		const leftMatch = this.matchLeftPart(trigger)
		if (leftMatch) return {
			word: leftMatch.word + rightMatch.word,
			annotation: leftMatch.annotation + rightMatch.word,
			index: leftMatch.index,
		}
	}

	matchRightPart() {
		const {right} = this.dividedText
		return {word: right.match(wordRegex)?.[0]}
	}

	matchLeftPart(trigger: string) {
		const regex = this.makeTriggerRegex(trigger)
		const {left} = this.dividedText
		const match = left.match(regex)

		if (!match) return

		const [annotation, word] = match
		return {word, annotation, index: match.index ?? 0}
	}

	//TODO new overlayMatch option if (isSpaceBeforeRequired) append space check for not first words '\\s'
	makeTriggerRegex(trigger: string): RegExp {
		const patten = escape(trigger) + '(\\w*)$'
		return new RegExp(patten)
	}
}