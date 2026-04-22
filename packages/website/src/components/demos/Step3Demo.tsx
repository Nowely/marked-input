import {MarkedInput, useOverlay} from '@markput/react'
import {type RefObject, useEffect, useState} from 'react'

const userStyle: React.CSSProperties = {display: 'inline-flex', gap: '0.5rem'}
const userClickableStyle: React.CSSProperties = {display: 'flex', padding: '0.5rem', cursor: 'pointer'}
const avatarStyle: React.CSSProperties = {height: '1.5rem', width: '1.5rem', borderRadius: '9999px'}
const overlayStyle: React.CSSProperties = {
	position: 'fixed',
	zIndex: 10,
	border: '1px solid #e5e7eb',
	background: 'white',
	boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
}

const User = ({avatar, login, onClick}: {avatar?: string; login?: string; onClick?: () => void}) => (
	<span style={onClick ? userClickableStyle : userStyle} onClick={onClick}>
		<img src={avatar} alt="" style={avatarStyle} />
		{login}
	</span>
)

const CustomOverlay = () => {
	const {select, match, style, ref} = useOverlay()
	const [users, setUsers] = useState<{login: string; avatar_url: string}[]>([])

	useEffect(() => {
		if (!match?.value) return
		fetch(`https://api.github.com/search/users?q=${match.value}`)
			.then(res => res.json())
			.then(data => setUsers(data.items?.slice(0, 10) || []))
	}, [match?.value])

	return (
		<div ref={ref as RefObject<HTMLDivElement>} style={{...overlayStyle, top: style.top, left: style.left}}>
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