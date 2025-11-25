import {MarkedInput, useOverlay} from 'rc-marked-input'
import {useState, useEffect, type RefObject} from 'react'

const User = ({avatar, login, onClick}: {avatar?: string; login?: string; onClick?: () => void}) => (
	<span
		className={`inline-flex items-center gap-2 ${onClick ? '!flex p-2 cursor-pointer hover:bg-gray-100 ' : ''}`}
		onClick={onClick}
	>
		<img src={avatar} alt="" width={24} height={24} className="rounded-full" />
		{login}
	</span>
)

const CustomOverlay = () => {
	const {select, match, style, ref} = useOverlay()
	const [users, setUsers] = useState<{login: string; avatar_url: string}[]>([])

	useEffect(() => {
		if (!match.value) return
		fetch(`https://api.github.com/search/users?q=${match.value}`)
			.then(res => res.json())
			.then(data => setUsers(data.items?.slice(0, 10) || []))
	}, [match.value])

	useEffect(() => ref.current?.showPopover(), [])

	return (
		<div
			ref={ref as RefObject<HTMLDivElement>}
			popover="auto"
			style={{top: style.top, left: style.left}}
			className="m-0 p-0 border border-gray-200 rounded bg-white max-w-52 shadow-md"
		>
			{users?.map(user => (
				<User
					key={user.login}
					avatar={user.avatar_url}
					login={user.login}
					onClick={() => select({value: user.login, meta: user.avatar_url})}
				/>
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
			Mark={({value, meta}) => <User avatar={meta} login={value} />}
			Overlay={CustomOverlay}
		/>
	)
}
