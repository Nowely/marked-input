import type {MarkProps, Option} from '@markput/react'
import type {CSSProperties} from 'react'

import type {TodoMarkProps} from './types'

export const TODO_OPTIONS: Option<TodoMarkProps>[] = [
	{
		markup: '# __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			style: {display: 'block', fontSize: '1.4em', fontWeight: 'bold', margin: '0.3em 0'} as CSSProperties,
		}),
	},
	{
		markup: '- [__value__] __nested__\n',
		mark: (props: MarkProps) => {
			const isDone = props.value === 'x'
			return {
				...props,
				todo: isDone ? 'done' : 'pending',
				style: {
					display: 'block',
					opacity: isDone ? 0.55 : undefined,
				} as CSSProperties,
			}
		},
	},
	{
		markup: '\t- [__value__] __nested__\n',
		mark: (props: MarkProps) => {
			const isDone = props.value === 'x'
			return {
				...props,
				todo: isDone ? 'done' : 'pending',
				style: {
					display: 'block',
					paddingLeft: '22px',
					borderLeft: '2px solid #d0d7de',
					opacity: isDone ? 0.55 : undefined,
				} as CSSProperties,
			}
		},
	},
	{
		markup: '\t\t- [__value__] __nested__\n',
		mark: (props: MarkProps) => {
			const isDone = props.value === 'x'
			return {
				...props,
				todo: isDone ? 'done' : 'pending',
				style: {
					display: 'block',
					paddingLeft: '22px',
					marginLeft: '24px',
					borderLeft: '2px solid #d0d7de',
					opacity: isDone ? 0.55 : undefined,
				} as CSSProperties,
			}
		},
	},
	{
		markup: '> __nested__\n\n',
		mark: (props: MarkProps) => ({
			...props,
			style: {
				display: 'block',
				fontSize: '0.85em',
				color: '#888',
				fontStyle: 'italic',
				marginTop: 16,
			} as CSSProperties,
		}),
	},
]

export const TODO_VALUE = `# 📋 Project Launch Checklist

- [ ] Design Phase
	- [ ] Create wireframes
	- [x] Define color palette
	- [ ] Design component library
- [x] Research
	- [x] Analyze competitors
	- [x] User interviews
	- [x] Draft interview questions
	- [x] Schedule 5 sessions
- [ ] Development
	- [ ] Set up CI/CD pipeline
	- [x] Write unit tests
	- [ ] API integration
	- [ ] Auth endpoints
	- [ ] Data sync
- [ ] Launch
	- [ ] Final QA pass
	- [ ] Deploy to production
> ☐ = pending  ☑ = done

`