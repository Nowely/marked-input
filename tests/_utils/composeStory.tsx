import {MarkedInputComponent, MarkedInputProps} from 'rc-marked-input'
import {createElement} from 'react'
import Meta, {Default} from '../../storybook/stories/Base.stories'

export const composeStory = (meta: typeof Meta, story: typeof Default): MarkedInputComponent =>
	(props) => {
	const innerProps = Object.assign({}, meta.args, story.args, props) as MarkedInputProps<unknown>

		return createElement(meta.component, innerProps)
	}