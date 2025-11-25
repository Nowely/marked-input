import {MarkedInput, useOverlay} from 'rc-marked-input'
import {useState} from 'react'

const Mark = ({value}: {value: string}) => <mark>@{value}</mark>

const CustomOverlay = () => {
	const overlay = useOverlay()

	return (
		<div ref={overlay.ref} style={{...overlay.style, border: '1px solid #ccc', padding: 8}}>
			{overlay.match.map((name, i) => (
				<div key={i} onClick={() => overlay.select(name)} style={{padding: 4, cursor: 'pointer'}}>
					{name}
				</div>
			))}
		</div>
	)
}

export function Step3Demo() {
	const [value, setValue] = useState('Type @ to mention someone!')

	return (
		<MarkedInput
			value={value}
			onChange={setValue}
			Mark={Mark}
			Overlay={CustomOverlay}
			options={[
				{
					markup: '@[__value__](__meta__)',
					slotProps: {
						overlay: {
							trigger: '@',
							data: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
						},
					},
				},
			]}
		/>
	)
}
