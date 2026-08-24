import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {createContext, useContext, useMemo} from 'react'

import {MentionMarkup, TagMarkup} from './content'
import {SuggestionOverlay} from './Overlay'

const MarkClickContext = createContext<(message: string) => void>(() => {})

const MentionChip = ({value, meta}: MarkProps) => {
	const onMarkClick = useContext(MarkClickContext)
	return (
		<button
			className="chip chip-mention"
			onClick={() => onMarkClick(`Clicked @${value} (${meta})`)}
			tabIndex={-1}
			title={`@${meta}`}
			type="button"
		>
			{value}
		</button>
	)
}

const TagChip = ({value}: MarkProps) => <span className="chip chip-tag">#{value}</span>

const options = [
	{markup: MentionMarkup, Mark: MentionChip, overlay: {trigger: '@'}},
	{markup: TagMarkup, Mark: TagChip, overlay: {trigger: '#'}},
]

type EditorProps = {
	value: string
	onChange: (value: string) => void
	onMarkClick: (message: string) => void
}

export const Editor = ({value, onChange, onMarkClick}: EditorProps) => {
	const handleMarkClick = useMemo(() => onMarkClick, [onMarkClick])
	return (
		<MarkClickContext.Provider value={handleMarkClick}>
			<div className="editor">
				<MarkedInput onChange={onChange} options={options} Overlay={SuggestionOverlay} value={value} />
			</div>
		</MarkClickContext.Provider>
	)
}