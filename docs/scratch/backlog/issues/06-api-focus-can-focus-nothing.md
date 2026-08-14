# `api.focus()` can focus nothing

Status: ready-for-human

`placeAtHandle` reports success even when the placement declines, so `focusFirst` returns without its container fallback. Public surface: the behaviour change needs sign-off with the fix.
