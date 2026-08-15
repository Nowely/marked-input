# The overlay swallows Shift+Arrow

Status: ready-for-agent

While a suggestion list is open, both adapters `preventDefault()` ArrowUp and ArrowDown with no
modifier check — React `Suggestions.tsx:27-33`, Vue `Suggestions.vue:33-40`.
`navigateSuggestions` is handed `event.key` alone, so Shift+ArrowDown is indistinguishable from
ArrowDown: the selection extension never reaches Chromium, and the overlay moves its active row
instead.

One guard per adapter fixes it (`if (event.shiftKey) return` before the switch). The decision
that comes with it: whether Ctrl and Alt should pass through too, and whether Shift+Arrow should
also close the overlay or leave it open. Add a browser test with the overlay open — the current
`Overlay` specs never press a modified arrow.

Related: 19 — rule this out first if the "keyboard selection doesn't work" report came from a
page with a suggestion list.
