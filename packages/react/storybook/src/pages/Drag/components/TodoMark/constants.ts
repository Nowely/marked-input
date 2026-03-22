import type {Option} from '@markput/react'

import {TodoIndent1Mark, TodoItemMark} from './TodoMark'

export const TODO_OPTIONS: Option[] = [
	{markup: '- [__value__] __nested__\n', mark: {slot: TodoItemMark}},
	{markup: '\t- [__value__] __nested__\n', mark: {slot: TodoIndent1Mark}},
]

export const TODO_VALUE = `
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
`