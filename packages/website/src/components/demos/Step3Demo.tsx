import {MarkedInput, useOverlay} from 'rc-marked-input'
import {useState, useEffect, type RefObject} from 'react'

const User = ({avatar, login, onClick}: {avatar?: string; login?: string; onClick?: () => void}) => (
	<span className={`inline-flex gap-2 ${onClick ? '!flex p-2 hover:bg-gray-100' : ''}`} onClick={onClick}>
		<img src={avatar} alt="" className="rounded-full w-6 h-6" />
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
			className="border border-gray-200 shadow-md"
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

export const Step3Demo = () => (
	<MarkedInput
		defaultValue="Type @ to mention someone!"
		Mark={({value, meta}) => <User avatar={meta} login={value} />}
		Overlay={CustomOverlay}
	/>
)
