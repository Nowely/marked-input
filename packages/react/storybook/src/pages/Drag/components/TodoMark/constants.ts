import type {Option} from '@markput/react'

import type {TodoMarkProps} from './TodoMark'

export const TODO_OPTIONS: Option<TodoMarkProps>[] = [
	{markup: '# __nested__\n\n', mark: p => ({...p, type: 'heading'})},
	{markup: '- [__value__] __nested__\n', mark: p => ({...p, type: 'todo'})},
	{markup: '\t- [__value__] __nested__\n', mark: p => ({...p, type: 'todo-indent1'})},
	{markup: '\t\t- [__value__] __nested__\n', mark: p => ({...p, type: 'todo-indent2'})},
	{markup: '> __nested__\n\n', mark: p => ({...p, type: 'blockquote'})},
	{markup: '- [__value__|__meta__] __nested__\n', mark: p => ({...p, type: 'counter'})},
]

export const TODO_VALUE = `# 📋 Project Launch Checklist

> ☐ = pending  ☑ = done

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


- [0|1] Completed tasks
`