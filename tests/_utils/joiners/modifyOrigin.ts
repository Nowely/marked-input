import {JoinParameters} from '../types'
import {MarkMatch} from 'rc-marked-input'

export function modifyOrigin({pieces, index, value}: JoinParameters) {
	const annotationLast = (pieces[index - 1] as MarkMatch).annotation
	const annIndex = value.lastIndexOf(annotationLast)
	const substring = value.substring(0, annIndex + annotationLast.length)
	return substring + pieces[index]
}