---
title: Getting Started
description: Basic usage of Marked Input
---

There are many examples available in the [Storybook](https://marked-input.vercel.app). You can also try a template
on [CodeSandbox](https://codesandbox.io/s/configured-marked-input-305v6m).

## Static Marks

Here is a simple example to get you started with static marks.

[![sandbox](https://user-images.githubusercontent.com/37639183/199624889-6129e303-6b44-4b82-859d-ada79942842c.svg)](https://codesandbox.io/s/marked-input-x5wx6k?file=/src/App.tsx)

```javascript
import {MarkedInput} from 'rc-marked-input'
import {useState} from 'react'

const Mark = props => <mark onClick={_ => alert(props.meta)}>{props.value}</mark>

const Marked = () => {
    const [value, setValue] = useState('Hello, clickable marked @[world](Hello! Hello!)!')
    return <MarkedInput Mark={Mark} value={value} onChange={setValue} />
}
```

